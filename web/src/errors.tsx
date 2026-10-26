import type { MessageKey } from '@app/shared';
import { ApiError } from './api';
import { useI18n } from './i18n';

/** Erreur à afficher : gardée sous forme de clé pour suivre un changement de langue. */
export type UiError = { key: MessageKey; params?: Record<string, string | number> } | { raw: string };

export function toUiError(error: unknown): UiError {
  if (error instanceof ApiError) {
    return error.status === 409 ? { key: 'initiatives.codeTaken' } : { key: 'error.http', params: { status: error.status } };
  }
  return { raw: String(error) };
}

export function ErrorMessage({ error }: { error: UiError | null }) {
  const { t } = useI18n();
  if (!error) return null;
  return <p className="error" role="alert">{'raw' in error ? error.raw : t(error.key, error.params)}</p>;
}
