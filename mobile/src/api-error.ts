// À part de api.ts pour que config.ts puisse l'utiliser sans import circulaire.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }

  /** Motif de refus renvoyé par l'API dans le corps de la réponse (`refusal`), s'il y en a un. */
  get refusal(): string | undefined {
    try {
      const refusal = (JSON.parse(this.message) as { refusal?: unknown } | null)?.refusal;
      return typeof refusal === 'string' ? refusal : undefined;
    } catch {
      return undefined;
    }
  }
}
