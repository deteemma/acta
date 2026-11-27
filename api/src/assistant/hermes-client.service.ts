import { Injectable, Logger } from '@nestjs/common';
import { type HermesRun, type HermesRunRequest, hermesSessionId } from '@app/shared';
import { AppConfig } from '../config/app-config.js';

/** Hermes ne répond pas (réseau, redémarrage, erreur du serveur) : rien n'a pu être envoyé ou lu. */
export class HermesUnreachableError extends Error {}

/**
 * Hermes refuse l'envoi (réponse 4xx : clé refusée, demande jugée invalide) : la
 * demande devient Échouée « l'assistant n'a pas pu répondre », sans nouvel envoi
 * (décision de la responsable du 27.11.2026, ticket 13).
 */
export class HermesRefusedError extends Error {}

/** Ce dont ACTA se sert chez Hermes. */
export type HermesPort = Pick<HermesClient, 'startRun' | 'getRun' | 'stopRun' | 'deleteSession'>;

/**
 * Arrête le travail d'une demande chez Hermes s'il a été envoyé, puis supprime
 * sa session : rien ne reste chez Hermes après un échec ou une annulation (AS6, AS37).
 */
export async function releaseHermesWork(hermes: HermesPort, requestId: string, runId: string | null): Promise<void> {
  if (runId) await hermes.stopRun(runId);
  await hermes.deleteSession(hermesSessionId(requestId));
}

/** Délai d'un appel à Hermes : il répond tout de suite, le travail se suit par interrogation. */
const CALL_TIMEOUT_MS = 30_000;

/**
 * Appels à l'instance Hermes d'ACTA (ADR-0022, AS37), par le réseau dédié API ↔
 * Hermes. Seul le traitement de fond s'en sert ; n'existe que si l'assistant est installé.
 */
@Injectable()
export class HermesClient {
  private readonly logger = new Logger(HermesClient.name);

  constructor(private readonly config: AppConfig) {}

  /**
   * Envoie le travail d'une demande (`POST /v1/runs`). La clé d'idempotence est
   * propre à la demande : un nouvel envoi après une coupure rend le même travail.
   */
  async startRun(body: HermesRunRequest, idempotencyKey: string): Promise<string> {
    const response = await this.call('POST', '/v1/runs', { body, headers: { 'Idempotency-Key': idempotencyKey } });
    if (response.status >= 400 && response.status < 500) throw new HermesRefusedError(`POST /v1/runs : ${response.status}`);
    if (!response.ok) throw new HermesUnreachableError(`POST /v1/runs : ${response.status}`);
    const created = (await response.json()) as { run_id?: unknown; id?: unknown };
    const runId = typeof created.run_id === 'string' ? created.run_id : created.id;
    if (typeof runId !== 'string') throw new HermesUnreachableError('POST /v1/runs : identifiant de travail absent');
    return runId;
  }

  /** État d'un travail (`GET /v1/runs/{id}`) ; null s'il est introuvable. */
  async getRun(runId: string): Promise<HermesRun | null> {
    const response = await this.call('GET', `/v1/runs/${encodeURIComponent(runId)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new HermesUnreachableError(`GET /v1/runs : ${response.status}`);
    return (await response.json()) as HermesRun;
  }

  /** Arrête un travail (délai dépassé) ; sans effet s'il est déjà fini. */
  async stopRun(runId: string): Promise<void> {
    await this.quietly(`arrêt du travail ${runId}`, () => this.call('POST', `/v1/runs/${encodeURIComponent(runId)}/stop`));
  }

  /** Supprime la session d'une demande : rien de durable chez Hermes (ADR-0022, point 8). */
  async deleteSession(sessionId: string): Promise<void> {
    await this.quietly(`suppression de la session ${sessionId}`, () =>
      this.call('DELETE', `/api/sessions/${encodeURIComponent(sessionId)}`),
    );
  }

  private async quietly(what: string, work: () => Promise<Response>): Promise<void> {
    try {
      const response = await work();
      if (!response.ok && response.status !== 404) this.logger.warn(`${what} : réponse ${response.status}`);
    } catch (error) {
      // Le texte de la demande n'apparaît jamais dans le journal.
      this.logger.warn(`${what} : ${error instanceof Error ? error.message : 'échec'}`);
    }
  }

  private async call(
    method: string,
    path: string,
    { body, headers = {} }: { body?: unknown; headers?: Record<string, string> } = {},
  ): Promise<Response> {
    const connection = this.config.assistant;
    if (!connection) throw new HermesUnreachableError('assistant non installé');
    try {
      return await fetch(`${connection.url}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${connection.apiKey}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      });
    } catch (error) {
      throw new HermesUnreachableError(error instanceof Error ? error.message : String(error));
    }
  }
}
