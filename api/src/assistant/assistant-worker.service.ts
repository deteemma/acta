import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import {
  type AssistantCancellationReason,
  type AssistantFailureReason,
  applicableTimeoutMinutes,
  exceedsDataLimit,
  freeSlots,
  hermesRunRequest,
  hermesSessionId,
  isTimedOut,
  isOfferedAssistantUsage,
  runOutcome,
} from '@app/shared';
import { AppConfig } from '../config/app-config.js';
import { DatabaseService } from '../db/database.service.js';
import { AssistantContextService, authorAccess } from './assistant-context.service.js';
import { loadAssistantSettings } from './assistant-requests.service.js';
import { HermesClient, HermesUnreachableError } from './hermes-client.service.js';

/**
 * Intervalle entre deux passages : bien en deçà de l'heure au-delà de laquelle
 * Hermes oublie le résultat d'un travail (ADR-0022), et assez court pour qu'une
 * demande parte vite.
 */
const TICK_MS = 10_000;


/**
 * Traitement de fond des demandes à l'assistant (AS37, ADR-0022 point 3), dans
 * le conteneur `api` : suit les demandes En cours chez Hermes, applique le délai
 * maximal, puis fait passer En cours les demandes En attente par ordre
 * d'arrivée, dans la limite du parallélisme. Absent sans assistant installé (AS25).
 */
@Injectable()
export class AssistantWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(AssistantWorker.name);
  private timer: NodeJS.Timeout | undefined;
  private busy = false;

  constructor(
    private readonly config: AppConfig,
    private readonly database: DatabaseService,
    private readonly data: AssistantContextService,
    private readonly hermes: HermesClient,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.assistant) return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  /** Un passage ; jamais deux à la fois. */
  async tick(now: () => Date = () => new Date()): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.followRunning(now);
      await this.startPending(now);
    } catch (error) {
      this.logger.error(`passage du traitement de fond : ${error instanceof Error ? error.message : 'échec'}`);
    } finally {
      this.busy = false;
    }
  }

  /** Demandes En cours : délai, puis état du travail chez Hermes. */
  private async followRunning(now: () => Date): Promise<void> {
    const running = await this.database.asAssistantWorker((tx) =>
      tx
        .selectFrom('assistant_request')
        .select(['id', 'initiative_id', 'author_id', 'read_at', 'timeout_minutes', 'hermes_run_id'])
        .where('status', '=', 'running')
        .orderBy('read_at')
        .execute(),
    );
    for (const request of running) {
      const runId = request.hermes_run_id!;
      if (isTimedOut(request.read_at!, request.timeout_minutes!, now())) {
        await this.hermes.stopRun(runId);
        await this.fail(request.id, 'timeout');
        continue;
      }
      let run;
      try {
        run = await this.hermes.getRun(runId);
      } catch (error) {
        if (!(error instanceof HermesUnreachableError)) throw error;
        // Hermes momentanément muet : nouvel essai au passage suivant, le délai s'applique.
        continue;
      }
      const outcome = runOutcome(run);
      if (outcome.kind === 'running') continue;
      if (outcome.kind === 'failed') {
        await this.fail(request.id, outcome.reason);
        continue;
      }
      // Droits revérifiés avant d'enregistrer l'avis (AS8) : sinon, l'avis est jeté.
      const access = await this.database.asUser(request.author_id, (tx) => authorAccess(tx, request.initiative_id));
      if (access !== 'ok') {
        await this.cancel(request.id, access);
        continue;
      }
      await this.database.asAssistantWorker((tx) =>
        tx
          .updateTable('assistant_request')
          .set({ status: 'answered', advice: outcome.advice })
          .where('id', '=', request.id)
          .where('status', '=', 'running')
          .execute(),
      );
      await this.hermes.deleteSession(hermesSessionId(request.id));
    }
  }

  /** Demandes En attente, premier arrivé, premier servi, dans la limite du parallélisme (AS4). */
  private async startPending(now: () => Date): Promise<void> {
    const { settings, pending } = await this.database.asAssistantWorker(async (tx) => {
      const settings = await loadAssistantSettings(tx);
      const { count } = await tx
        .selectFrom('assistant_request')
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .where('status', '=', 'running')
        .executeTakeFirstOrThrow();
      const slots = freeSlots(settings.concurrency, Number(count));
      const pending =
        slots === 0
          ? []
          : await tx
              .selectFrom('assistant_request')
              .select(['id', 'initiative_id', 'author_id', 'usage', 'mode', 'locale'])
              .where('status', '=', 'pending')
              .orderBy('created_at')
              .orderBy('id')
              .limit(slots)
              .execute();
      return { settings, pending };
    });

    for (const request of pending) {
      if (!isOfferedAssistantUsage(request.usage)) {
        // Impossible par construction : l'API ne crée que des demandes d'un usage proposé.
        this.logger.error(`demande ${request.id} : usage ${request.usage} non pris en charge`);
        continue;
      }
      // Droits revérifiés, puis lecture avec l'identité de l'auteur (AS8, AS17).
      const readAt = now();
      const read = await this.data.readStatusReview(request.author_id, request.initiative_id, request.locale);
      if (read.access !== 'ok') {
        await this.cancel(request.id, read.access);
        continue;
      }
      if (exceedsDataLimit(read.text, settings.maxDataTokens)) {
        await this.fail(request.id, 'dataTooLarge');
        continue;
      }
      const body = hermesRunRequest({
        requestId: request.id,
        locale: request.locale,
        usage: request.usage,
        mode: request.mode,
        data: read.text,
      });
      let runId: string;
      try {
        runId = await this.hermes.startRun(body, request.id);
      } catch (error) {
        if (!(error instanceof HermesUnreachableError)) throw error;
        // Hermes injoignable avant l'envoi : la demande reste En attente (AS38).
        this.logger.warn(`assistant injoignable : ${error.message}`);
        return;
      }
      await this.database.asAssistantWorker((tx) =>
        tx
          .updateTable('assistant_request')
          .set({
            status: 'running',
            read_at: readAt,
            timeout_minutes: applicableTimeoutMinutes(request.mode, settings),
            hermes_run_id: runId,
          })
          .where('id', '=', request.id)
          .where('status', '=', 'pending')
          .execute(),
      );
    }
  }

  /** Échouée, sans nouvelle tentative (AS7) ; la session Hermes est supprimée. */
  private async fail(requestId: string, reason: AssistantFailureReason): Promise<void> {
    await this.database.asAssistantWorker((tx) =>
      tx
        .updateTable('assistant_request')
        .set({ status: 'failed', failure_reason: reason })
        .where('id', '=', requestId)
        .where('status', 'in', ['pending', 'running'])
        .execute(),
    );
    await this.hermes.deleteSession(hermesSessionId(requestId));
  }

  /** Annulée, sans avis (AS8) ; la session Hermes est supprimée. */
  private async cancel(requestId: string, reason: AssistantCancellationReason): Promise<void> {
    await this.database.asAssistantWorker((tx) =>
      tx
        .updateTable('assistant_request')
        .set({ status: 'cancelled', cancellation_reason: reason })
        .where('id', '=', requestId)
        .where('status', 'in', ['pending', 'running'])
        .execute(),
    );
    await this.hermes.deleteSession(hermesSessionId(requestId));
  }
}
