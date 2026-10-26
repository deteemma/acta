// À part de api.ts pour que config.ts puisse l'utiliser sans import circulaire.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
