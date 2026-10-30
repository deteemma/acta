// Erreurs PostgreSQL renvoyées par pg, reconnues par les services.

const pgErrorCode = (error: unknown) => (error as { code?: unknown } | null)?.code;

export const isUniqueViolation = (error: unknown) => pgErrorCode(error) === '23505';

export const isForeignKeyViolation = (error: unknown) => pgErrorCode(error) === '23503';

/** Violation de la contrainte nommée, y compris celles levées par un déclencheur (`CONSTRAINT = …`). */
export const isConstraintViolation = (error: unknown, constraint: string) =>
  (error as { constraint?: unknown } | null)?.constraint === constraint;
