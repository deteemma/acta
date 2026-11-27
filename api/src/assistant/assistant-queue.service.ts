import { Injectable } from '@nestjs/common';
import {
  type AssistantCancellationReason,
  type AssistantFailureReason,
  type AssistantMode,
  type AssistantSettings,
  type AssistantUsage,
  type Locale,
  UNFINISHED_STATUSES,
} from '@app/shared';
import { DatabaseService } from '../db/database.service.js';
import { type AuthorAccess, authorAccess } from './assistant-context.service.js';
import { loadAssistantSettings } from './assistant-requests.service.js';

/** Demande En cours, suivie chez Hermes d'après son identifiant de travail (AS37, AS39). */
export interface RunningRequest {
  id: string;
  initiativeId: string;
  authorId: string;
  readAt: Date;
  /** Délai noté au passage En cours (AS5). */
  timeoutMinutes: number;
  hermesRunId: string;
}

/** Demande En attente, à faire passer En cours. */
export interface PendingRequest {
  id: string;
  initiativeId: string;
  authorId: string;
  usage: AssistantUsage;
  mode: AssistantMode;
  locale: Locale;
}

/**
 * File des demandes à l'assistant, vue du traitement de fond (AS4, AS37). Chaque
 * passage de statut ne vaut que pour une demande encore non terminée : il rend
 * faux si l'auteur l'a annulée entre-temps (AS6).
 */
export interface AssistantQueue {
  /** Demandes En cours, de la plus ancienne lecture à la plus récente. */
  running(): Promise<RunningRequest[]>;
  /** Paramètres en vigueur et demandes En attente à servir, dans la limite des places libres (AS4, AS32). */
  nextPending(slots: (settings: AssistantSettings, running: number) => number): Promise<{
    settings: AssistantSettings;
    pending: PendingRequest[];
  }>;
  markRunning(id: string, run: { readAt: Date; timeoutMinutes: number; hermesRunId: string }): Promise<boolean>;
  answer(id: string, advice: string): Promise<boolean>;
  fail(id: string, reason: AssistantFailureReason): Promise<boolean>;
  cancel(id: string, reason: AssistantCancellationReason): Promise<boolean>;
  /** Droits de l'auteur, lus sous son identité (AS8). */
  authorAccess(authorId: string, initiativeId: string): Promise<AuthorAccess>;
}


/** La file en base, par la transaction du traitement de fond (migration 0038). */
@Injectable()
export class DatabaseAssistantQueue implements AssistantQueue {
  constructor(private readonly database: DatabaseService) {}

  async running(): Promise<RunningRequest[]> {
    const rows = await this.database.asAssistantWorker((tx) =>
      tx
        .selectFrom('assistant_request')
        .select(['id', 'initiative_id', 'author_id', 'read_at', 'timeout_minutes', 'hermes_run_id'])
        .where('status', '=', 'running')
        .orderBy('read_at')
        .execute(),
    );
    return rows.map((row) => ({
      id: row.id,
      initiativeId: row.initiative_id,
      authorId: row.author_id,
      readAt: row.read_at!,
      timeoutMinutes: row.timeout_minutes!,
      hermesRunId: row.hermes_run_id!,
    }));
  }

  nextPending(slots: (settings: AssistantSettings, running: number) => number) {
    return this.database.asAssistantWorker(async (tx) => {
      const settings = await loadAssistantSettings(tx);
      const { count } = await tx
        .selectFrom('assistant_request')
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .where('status', '=', 'running')
        .executeTakeFirstOrThrow();
      const free = slots(settings, Number(count));
      const rows =
        free === 0
          ? []
          : await tx
              .selectFrom('assistant_request')
              .select(['id', 'initiative_id', 'author_id', 'usage', 'mode', 'locale'])
              .where('status', '=', 'pending')
              .orderBy('created_at')
              .orderBy('id')
              .limit(free)
              .execute();
      const pending = rows.map((row) => ({
        id: row.id,
        initiativeId: row.initiative_id,
        authorId: row.author_id,
        usage: row.usage,
        mode: row.mode,
        locale: row.locale,
      }));
      return { settings, pending };
    });
  }

  async markRunning(id: string, run: { readAt: Date; timeoutMinutes: number; hermesRunId: string }): Promise<boolean> {
    const result = await this.database.asAssistantWorker((tx) =>
      tx
        .updateTable('assistant_request')
        .set({ status: 'running', read_at: run.readAt, timeout_minutes: run.timeoutMinutes, hermes_run_id: run.hermesRunId })
        .where('id', '=', id)
        .where('status', '=', 'pending')
        .executeTakeFirst(),
    );
    return result.numUpdatedRows > 0n;
  }

  async answer(id: string, advice: string): Promise<boolean> {
    const result = await this.database.asAssistantWorker((tx) =>
      tx
        .updateTable('assistant_request')
        .set({ status: 'answered', advice })
        .where('id', '=', id)
        .where('status', '=', 'running')
        .executeTakeFirst(),
    );
    return result.numUpdatedRows > 0n;
  }

  async fail(id: string, reason: AssistantFailureReason): Promise<boolean> {
    const result = await this.database.asAssistantWorker((tx) =>
      tx
        .updateTable('assistant_request')
        .set({ status: 'failed', failure_reason: reason })
        .where('id', '=', id)
        .where('status', 'in', UNFINISHED_STATUSES)
        .executeTakeFirst(),
    );
    return result.numUpdatedRows > 0n;
  }

  async cancel(id: string, reason: AssistantCancellationReason): Promise<boolean> {
    const result = await this.database.asAssistantWorker((tx) =>
      tx
        .updateTable('assistant_request')
        .set({ status: 'cancelled', cancellation_reason: reason })
        .where('id', '=', id)
        .where('status', 'in', UNFINISHED_STATUSES)
        .executeTakeFirst(),
    );
    return result.numUpdatedRows > 0n;
  }

  authorAccess(authorId: string, initiativeId: string): Promise<AuthorAccess> {
    return this.database.asUser(authorId, (tx) => authorAccess(tx, initiativeId));
  }
}
