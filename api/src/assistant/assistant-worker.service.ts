import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
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
import { AssistantAvailability } from './assistant-availability.js';
import { AssistantContextService } from './assistant-context.service.js';
import { type AssistantQueue, DatabaseAssistantQueue, type RunningRequest } from './assistant-queue.service.js';
import {
  HermesClient,
  type HermesPort,
  HermesRefusedError,
  HermesUnreachableError,
  releaseHermesWork,
} from './hermes-client.service.js';

/**
 * Intervalle entre deux passages : bien en deçà de l'heure au-delà de laquelle
 * Hermes oublie le résultat d'un travail (ADR-0022), et assez court pour qu'une
 * demande parte vite.
 */
const TICK_MS = 10_000;

/** Lecture des données avec les droits de l'auteur (AS17). */
export type AssistantReader = Pick<AssistantContextService, 'readStatusReview'>;

/**
 * Traitement de fond des demandes à l'assistant (AS37, ADR-0022 point 3), dans
 * le conteneur `api` : suit les demandes En cours chez Hermes, applique le délai
 * maximal, puis fait passer En cours les demandes En attente par ordre
 * d'arrivée, dans la limite du parallélisme. Absent sans assistant installé (AS25).
 *
 * Tout son état est en base : après un redémarrage de l'API, il reprend les
 * demandes En cours d'après leur identifiant de travail Hermes, sans les renvoyer (AS39).
 * Pas de nouvelle tentative après un échec (AS7).
 */
@Injectable()
export class AssistantWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(AssistantWorker.name);
  private timer: NodeJS.Timeout | undefined;
  private busy = false;

  constructor(
    @Inject(AppConfig) private readonly config: Pick<AppConfig, 'assistant'>,
    @Inject(DatabaseAssistantQueue) private readonly queue: AssistantQueue,
    @Inject(AssistantContextService) private readonly data: AssistantReader,
    @Inject(HermesClient) private readonly hermes: HermesPort,
    private readonly availability: AssistantAvailability,
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
    for (const request of await this.queue.running()) {
      // Délai noté au passage En cours : une modification ultérieure ne le change pas (AS5).
      if (isTimedOut(request.readAt, request.timeoutMinutes, now())) {
        await this.fail(request, 'timeout');
        continue;
      }
      let run;
      try {
        run = await this.hermes.getRun(request.hermesRunId);
      } catch (error) {
        if (!(error instanceof HermesUnreachableError)) throw error;
        // Hermes momentanément muet : nouvel essai au passage suivant, le délai s'applique.
        this.availability.markUnreachable();
        continue;
      }
      this.availability.markReachable();
      const outcome = runOutcome(run);
      if (outcome.kind === 'running') continue;
      if (outcome.kind === 'failed') {
        await this.fail(request, outcome.reason);
        continue;
      }
      // Droits revérifiés avant d'enregistrer l'avis (AS8) : sinon, l'avis est jeté.
      const access = await this.queue.authorAccess(request.authorId, request.initiativeId);
      if (access !== 'ok') {
        await this.cancel(request.id, request.hermesRunId, access);
        continue;
      }
      // Annulée par l'auteur entre-temps : l'avis n'est pas gardé (AS6).
      await this.queue.answer(request.id, outcome.advice);
      await this.hermes.deleteSession(hermesSessionId(request.id));
    }
  }

  /** Demandes En attente, premier arrivé, premier servi, dans la limite du parallélisme (AS4). */
  private async startPending(now: () => Date): Promise<void> {
    const { settings, pending } = await this.queue.nextPending((s, running) => freeSlots(s.concurrency, running));

    for (const request of pending) {
      if (!isOfferedAssistantUsage(request.usage)) {
        // Impossible par construction : l'API ne crée que des demandes d'un usage proposé.
        this.logger.error(`demande ${request.id} : usage ${request.usage} non pris en charge`);
        continue;
      }
      // Droits revérifiés, puis lecture avec l'identité de l'auteur (AS8, AS17).
      const readAt = now();
      const read = await this.data.readStatusReview(request.authorId, request.initiativeId, request.locale);
      if (read.access !== 'ok') {
        await this.cancel(request.id, null, read.access);
        continue;
      }
      if (exceedsDataLimit(read.text, settings.maxDataTokens)) {
        await this.queue.fail(request.id, 'dataTooLarge');
        await releaseHermesWork(this.hermes, request.id, null);
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
        if (error instanceof HermesRefusedError) {
          // Hermes refuse l'envoi : Échouée, la file continue (décision du 27.11.2026).
          this.logger.warn(`assistant : envoi refusé, ${error.message}`);
          this.availability.markReachable();
          await this.queue.fail(request.id, 'noAnswer');
          await releaseHermesWork(this.hermes, request.id, null);
          continue;
        }
        if (!(error instanceof HermesUnreachableError)) throw error;
        // Hermes injoignable avant l'envoi : la demande reste En attente (AS38).
        this.logger.warn(`assistant injoignable : ${error.message}`);
        this.availability.markUnreachable();
        return;
      }
      this.availability.markReachable();
      const started = await this.queue.markRunning(request.id, {
        readAt,
        timeoutMinutes: applicableTimeoutMinutes(request.mode, settings),
        hermesRunId: runId,
      });
      // Annulée par l'auteur pendant l'envoi : le travail parti s'arrête (AS6).
      if (!started) await releaseHermesWork(this.hermes, request.id, runId);
    }
  }

  /** Échouée, sans nouvelle tentative (AS7) ; le travail s'arrête et la session Hermes est supprimée. */
  private async fail(request: RunningRequest, reason: AssistantFailureReason): Promise<void> {
    await this.queue.fail(request.id, reason);
    await releaseHermesWork(this.hermes, request.id, request.hermesRunId);
  }

  /** Annulée, sans avis (AS8) ; le travail s'arrête et la session Hermes est supprimée. */
  private async cancel(requestId: string, runId: string | null, reason: AssistantCancellationReason): Promise<void> {
    await this.queue.cancel(requestId, reason);
    await releaseHermesWork(this.hermes, requestId, runId);
  }
}
