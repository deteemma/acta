// Demandes à l'assistant (spécification `.scratch/assistant/spec.md`, ADR-0022) :
// cycle de vie, file, délai, plafond des données lues. Règles écrites une seule
// fois ici, appliquées par l'API (traitement de fond) et affichées par le web.
import { z } from 'zod';
import { type Locale, LOCALES, translate } from './i18n.js';

/** Les sept usages du premier lot (AS10), codes de la spécification. */
export const ASSISTANT_USAGES = [
  'review_page',
  'next_steps',
  'prepare_workshop',
  'check_traceability',
  'draft_gherkin',
  'status_review',
  'free_question',
] as const;
export type AssistantUsage = (typeof ASSISTANT_USAGES)[number];

/** Usages déjà proposés (ticket 12 : « Faire le point ») ; les tickets 14 à 17 ajoutent les autres. */
export const OFFERED_ASSISTANT_USAGES = ['status_review'] as const satisfies readonly AssistantUsage[];
export type OfferedAssistantUsage = (typeof OFFERED_ASSISTANT_USAGES)[number];
export const isOfferedAssistantUsage = (usage: AssistantUsage): usage is OfferedAssistantUsage =>
  OFFERED_ASSISTANT_USAGES.some((offered) => offered === usage);

/** Mode de réponse (AS12) : « Réponse rapide » par défaut, ou « Réponse approfondie ». */
export const ASSISTANT_MODES = ['quick', 'thorough'] as const;
export type AssistantMode = (typeof ASSISTANT_MODES)[number];
export const DEFAULT_ASSISTANT_MODE: AssistantMode = 'quick';

/** Statut d'une demande à l'assistant (AS2) : En attente, En cours, Répondue, Échouée, Annulée. */
export const ASSISTANT_REQUEST_STATUSES = ['pending', 'running', 'answered', 'failed', 'cancelled'] as const;
export type AssistantRequestStatus = (typeof ASSISTANT_REQUEST_STATUSES)[number];

/** Répondue, Échouée et Annulée sont définitives (AS2). */
export const isFinalStatus = (status: AssistantRequestStatus): boolean =>
  status === 'answered' || status === 'failed' || status === 'cancelled';

/**
 * Les six raisons d'échec (AS7) : délai dépassé ; assistant indisponible ;
 * l'assistant n'a pas pu répondre ; données trop volumineuses ; l'élément choisi
 * n'existe plus ; l'élément choisi ne convient plus à cet usage.
 */
export const ASSISTANT_FAILURE_REASONS = [
  'timeout',
  'unavailable',
  'noAnswer',
  'dataTooLarge',
  'elementGone',
  'elementUnsuitable',
] as const;
export type AssistantFailureReason = (typeof ASSISTANT_FAILURE_REASONS)[number];

/** Raisons d'une annulation (AS6, AS8) : par l'auteur, perte d'accès, compte désactivé. */
export const ASSISTANT_CANCELLATION_REASONS = ['byAuthor', 'accessLost', 'accountDeactivated'] as const;
export type AssistantCancellationReason = (typeof ASSISTANT_CANCELLATION_REASONS)[number];

/** Nouvelle demande (AS12) : l'usage et le mode, « Réponse rapide » par défaut. */
export const createAssistantRequestSchema = z.object({
  usage: z.enum(OFFERED_ASSISTANT_USAGES),
  mode: z.enum(ASSISTANT_MODES).default(DEFAULT_ASSISTANT_MODE),
  /** Langue d'ACTA de l'auteur, celle de l'interface au moment de la demande (AS18, AS28). */
  locale: z.enum(LOCALES),
});
export type CreateAssistantRequestInput = z.input<typeof createAssistantRequestSchema>;
/** Demande validée, mode par défaut appliqué. */
export type CreateAssistantRequest = z.output<typeof createAssistantRequestSchema>;

/** Demande à l'assistant, telle que son auteur la voit (seul à la voir, AS9). */
export interface AssistantRequestDto {
  id: string;
  initiativeId: string;
  usage: AssistantUsage;
  mode: AssistantMode;
  status: AssistantRequestStatus;
  createdAt: string;
  /** Date de lecture : passage En cours (AS17). */
  readAt: string | null;
  finishedAt: string | null;
  /** Délai applicable, noté au passage En cours (AS5). */
  timeoutMinutes: number | null;
  /** Texte de l'avis, en Markdown (AS27). */
  advice: string | null;
  failureReason: AssistantFailureReason | null;
  cancellationReason: AssistantCancellationReason | null;
  /** En attente : nombre de demandes arrivées avant elle (AS4) ; null sinon. */
  queueAhead: number | null;
}

/**
 * Refus de la création d'une demande, renvoyés par l'API (`refusal`) :
 * - `dataTooLarge` : l'estimation des données lues dépasse le plafond (AS20) ;
 * - `unfinished` : l'auteur a déjà une demande non terminée (AS3), décrite par UnfinishedRequestBody.
 */
export const ASSISTANT_REFUSALS = ['dataTooLarge', 'unfinished'] as const;
export type AssistantRefusal = (typeof ASSISTANT_REFUSALS)[number];
export const isAssistantRefusal = (value: unknown): value is AssistantRefusal =>
  ASSISTANT_REFUSALS.some((r) => r === value);

/** Corps du refus `unfinished` : la demande non terminée, pour la nommer. */
export interface UnfinishedRequestBody {
  refusal: 'unfinished';
  usage: AssistantUsage;
  status: AssistantRequestStatus;
}

/** Paramètres de l'assistant (AS32), modifiables par l'administrateur au ticket 21. */
export interface AssistantSettings {
  /** Demandes traitées en même temps. */
  concurrency: number;
  quickTimeoutMinutes: number;
  thoroughTimeoutMinutes: number;
  /** Taille maximale des données lues, en tokens estimés (AS21). */
  maxDataTokens: number;
}

/** Valeurs de départ (AS32), reprises par la migration 0038. */
export const ASSISTANT_SETTINGS_DEFAULTS: AssistantSettings = {
  concurrency: 1,
  quickTimeoutMinutes: 20,
  thoroughTimeoutMinutes: 60,
  maxDataTokens: 16_000,
};

/** Délai maximal du mode, celui en vigueur au passage En cours (AS5). */
export function applicableTimeoutMinutes(mode: AssistantMode, settings: AssistantSettings): number {
  return mode === 'quick' ? settings.quickTimeoutMinutes : settings.thoroughTimeoutMinutes;
}

/** Une demande En cours dépasse son délai : elle devient Échouée, « délai dépassé » (AS5). */
export function isTimedOut(readAt: string | Date, timeoutMinutes: number, now: Date): boolean {
  return now.getTime() - new Date(readAt).getTime() > timeoutMinutes * 60_000;
}

/** État d'un travail Hermes tel que `GET /v1/runs/{id}` le renvoie ; null si le travail est introuvable. */
export interface HermesRun {
  status: string;
  output?: unknown;
  error?: unknown;
}

export type RunOutcome =
  | { kind: 'running' }
  | { kind: 'answered'; advice: string }
  | { kind: 'failed'; reason: AssistantFailureReason };

const RUN_NOT_FINISHED = new Set(['started', 'queued', 'running', 'stopping']);

/** Texte de la réponse : une chaîne, ou des morceaux `{ text }` / `{ content }` mis bout à bout. */
function outputText(output: unknown): string {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return output.map(outputText).join('');
  if (output && typeof output === 'object') {
    const { text, content } = output as { text?: unknown; content?: unknown };
    return outputText(text ?? content);
  }
  return '';
}

/**
 * Suite à donner à l'état d'un travail Hermes (AS37, AS38) : rien tant qu'il
 * tourne ; Répondue avec un texte ; « l'assistant n'a pas pu répondre » pour une
 * réponse vide ou en erreur ; « assistant indisponible » pour un travail perdu
 * (interrompu, inconnu après un redémarrage, arrêté hors d'ACTA, introuvable).
 */
export function runOutcome(run: HermesRun | null): RunOutcome {
  if (!run) return { kind: 'failed', reason: 'unavailable' };
  if (RUN_NOT_FINISHED.has(run.status)) return { kind: 'running' };
  if (run.status === 'completed') {
    const advice = outputText(run.output);
    return advice.trim() ? { kind: 'answered', advice } : { kind: 'failed', reason: 'noAnswer' };
  }
  if (run.status === 'failed') return { kind: 'failed', reason: 'noAnswer' };
  return { kind: 'failed', reason: 'unavailable' };
}

/** Position dans la file (AS4) : nombre de demandes En attente arrivées avant la sienne. */
export function queuePositionMessage(locale: Locale, ahead: number): string {
  if (ahead === 0) return translate(locale, 'assistant.queue.next');
  if (ahead === 1) return translate(locale, 'assistant.queue.one');
  return translate(locale, 'assistant.queue.many', { n: ahead });
}

/** Nombre de demandes En attente à faire passer En cours, dans la limite du parallélisme (AS4). */
export function freeSlots(concurrency: number, running: number): number {
  return Math.max(0, concurrency - running);
}

/**
 * Estimation de la taille des données lues, en tokens (AS21) : nombre de
 * caractères divisé par 3, arrondi au supérieur. Utilisée à la création et au
 * passage En cours ; le compte porte sur les données lues seules, sans les instructions.
 */
export function estimateTokens(data: string): number {
  return Math.ceil([...data].length / 3);
}

/** Données lues au-delà du plafond (AS20) : refus à la création, Échouée au passage En cours. */
export function exceedsDataLimit(data: string, maxTokens: number): boolean {
  return estimateTokens(data) > maxTokens;
}
