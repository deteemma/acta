import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  canCancel,
  showsAssistantUnavailable,
  type AssistantRequestDto,
  type AssistantRequestStatus,
  type AssistantSettings,
  type AssistantUsage,
  type CreateAssistantRequest,
  exceedsDataLimit,
  type UnfinishedRequestBody,
} from '@app/shared';
import { type Selectable, sql } from 'kysely';
import { DatabaseService, type Tx } from '../db/database.service.js';
import { isConstraintViolation } from '../db/pg-errors.js';
import type { AssistantRequestTable } from '../db/schema.js';
import { AssistantAvailability } from './assistant-availability.js';
import { AssistantContextService } from './assistant-context.service.js';
import { HermesClient, type HermesPort, releaseHermesWork } from './hermes-client.service.js';

/** Paramètres de l'assistant en vigueur (AS32), lisibles par tous (migration 0038). */
export async function loadAssistantSettings(tx: Tx): Promise<AssistantSettings> {
  const row = await tx
    .selectFrom('app_settings')
    .select([
      'assistant_concurrency',
      'assistant_quick_timeout_minutes',
      'assistant_thorough_timeout_minutes',
      'assistant_max_data_tokens',
    ])
    .executeTakeFirstOrThrow();
  return {
    concurrency: row.assistant_concurrency,
    quickTimeoutMinutes: row.assistant_quick_timeout_minutes,
    thoroughTimeoutMinutes: row.assistant_thorough_timeout_minutes,
    maxDataTokens: row.assistant_max_data_tokens,
  };
}

/**
 * Demandes à l'assistant de l'utilisateur courant (AS1 à AS4, AS20, AS40) : la
 * RLS ne lui montre que les siennes, sur une initiative dont il est membre.
 */
@Injectable()
export class AssistantRequestsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly data: AssistantContextService,
    private readonly availability: AssistantAvailability,
    @Inject(HermesClient) private readonly hermes: HermesPort,
  ) {}

  list(userId: string, initiativeId: string): Promise<AssistantRequestDto[]> {
    return this.database.asUser(userId, async (tx) => {
      const rows = await tx
        .selectFrom('assistant_request')
        .selectAll()
        .where('initiative_id', '=', initiativeId)
        .where('author_id', '=', userId)
        .orderBy('created_at', 'desc')
        .execute();
      return Promise.all(rows.map((row) => toDto(tx, row, this.availability.isUnreachable)));
    });
  }

  /**
   * Annulation par l'auteur tant que la demande n'est pas terminée (AS6) : le
   * travail s'arrête chez Hermes et sa session est supprimée, sans avis partiel.
   * Une demande déjà terminée est rendue telle quelle (son avis vient d'arriver).
   */
  async cancel(userId: string, initiativeId: string, requestId: string): Promise<AssistantRequestDto> {
    const { dto, runId, cancelled } = await this.database.asUser(userId, async (tx) => {
      const found = await tx
        .selectFrom('assistant_request')
        .selectAll()
        .where('id', '=', requestId)
        .where('initiative_id', '=', initiativeId)
        .where('author_id', '=', userId)
        .forUpdate()
        .executeTakeFirst();
      if (!found) throw new NotFoundException();
      if (!canCancel(found.status)) return { dto: await toDto(tx, found, this.availability.isUnreachable), runId: null, cancelled: false };
      const row = await tx
        .updateTable('assistant_request')
        .set({ status: 'cancelled', cancellation_reason: 'byAuthor' })
        .where('id', '=', requestId)
        .returningAll()
        .executeTakeFirstOrThrow();
      return { dto: await toDto(tx, row, this.availability.isUnreachable), runId: row.hermes_run_id, cancelled: true };
    });
    // Après la validation : la demande ne peut plus passer En cours ni recevoir d'avis.
    // L'auteur n'attend pas Hermes ; ses refus sont journalisés par le client.
    if (cancelled) void releaseHermesWork(this.hermes, requestId, runId);
    return dto;
  }

  async create(userId: string, initiativeId: string, { usage, mode, locale }: CreateAssistantRequest): Promise<AssistantRequestDto> {
    await this.database.asUser(userId, (tx) => refuseIfUnfinished(tx));

    // Estimation à la création, sur les données lues avec les droits de l'auteur (AS20, AS21).
    const read = await this.data.readStatusReview(userId, initiativeId, locale);
    if (read.access !== 'ok') throw new ForbiddenException();

    return this.database.asUser(userId, async (tx) => {
      const settings = await loadAssistantSettings(tx);
      if (exceedsDataLimit(read.text, settings.maxDataTokens)) {
        throw new BadRequestException({ statusCode: 400, refusal: 'dataTooLarge' });
      }
      try {
        const row = await tx
          .insertInto('assistant_request')
          .values({ id: randomUUID(), initiative_id: initiativeId, author_id: userId, usage, mode, locale })
          .returningAll()
          .executeTakeFirstOrThrow();
        return await toDto(tx, row, this.availability.isUnreachable);
      } catch (error) {
        // Deux demandes envoyées en même temps : la seconde est refusée (AS3).
        if (isConstraintViolation(error, 'assistant_request_one_unfinished')) {
          throw await this.database.asUser(userId, async (again) => (await unfinishedRefusal(again)) ?? error);
        }
        throw error;
      }
    });
  }
}

/** Une seule demande non terminée par personne, toutes initiatives confondues (AS3). */
async function refuseIfUnfinished(tx: Tx): Promise<void> {
  const refusal = await unfinishedRefusal(tx);
  if (refusal) throw refusal;
}

async function unfinishedRefusal(tx: Tx): Promise<ConflictException | null> {
  const { rows } = await sql<{ usage: AssistantUsage; status: AssistantRequestStatus }>`
    SELECT usage, status FROM my_unfinished_assistant_request()`.execute(tx);
  const unfinished = rows[0];
  if (!unfinished) return null;
  const body: UnfinishedRequestBody & { statusCode: number } = { statusCode: 409, refusal: 'unfinished', ...unfinished };
  return new ConflictException(body);
}

/** `hermesUnreachable` : Hermes injoignable au dernier appel du traitement de fond (AS38). */
async function toDto(
  tx: Tx,
  row: Selectable<AssistantRequestTable>,
  hermesUnreachable: boolean,
): Promise<AssistantRequestDto> {
  let queueAhead: number | null = null;
  if (row.status === 'pending') {
    const { rows } = await sql<{ ahead: number | null }>`SELECT assistant_queue_ahead(${row.id}::uuid) AS ahead`.execute(tx);
    queueAhead = rows[0]?.ahead ?? null;
  }
  return {
    id: row.id,
    initiativeId: row.initiative_id,
    usage: row.usage,
    mode: row.mode,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    readAt: row.read_at?.toISOString() ?? null,
    finishedAt: row.finished_at?.toISOString() ?? null,
    timeoutMinutes: row.timeout_minutes,
    advice: row.advice,
    failureReason: row.failure_reason,
    cancellationReason: row.cancellation_reason,
    queueAhead,
    assistantUnavailable: showsAssistantUnavailable(row.status, hermesUnreachable),
  };
}
