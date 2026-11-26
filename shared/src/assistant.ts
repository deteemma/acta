// Assistant d'ACTA (spécification `.scratch/assistant/spec.md`, ADR-0022).

/** Longueur minimale de la clé de l'instance Hermes d'ACTA (AS35, ADR-0022 point 10). */
export const ASSISTANT_API_KEY_MIN_LENGTH = 32;

/** Accès de l'API d'ACTA à son instance Hermes. */
export interface AssistantConnection {
  /** Adresse de Hermes, sans « / » final (ex. http://assistant:8642). */
  url: string;
  apiKey: string;
}

/**
 * Assistant installé (AS25, ADR-0022 point 12) : il faut l'adresse et la clé de
 * Hermes. Sans l'une ou l'autre, l'assistant est absent (null) et le reste
 * d'ACTA fonctionne normalement. Une clé trop courte est une erreur
 * d'installation, signalée au démarrage plutôt que de rendre l'assistant absent.
 */
export function assistantConnection(
  url: string | undefined,
  apiKey: string | undefined,
): AssistantConnection | null {
  const address = url?.trim() ?? '';
  const key = apiKey?.trim() ?? '';
  if (!address || !key) return null;
  if (key.length < ASSISTANT_API_KEY_MIN_LENGTH) {
    throw new Error(
      `HERMES_API_KEY trop courte : au moins ${ASSISTANT_API_KEY_MIN_LENGTH} caractères aléatoires attendus.`,
    );
  }
  return { url: address.replace(/\/+$/, ''), apiKey: key };
}
