import { type AdminRefusal, isAdminRefusal, isTeamRefusal, type MessageKey, type TeamRefusal } from '@app/shared';
import { ApiError } from './api';
import { useI18n } from './i18n';

/** Erreur à afficher : gardée sous forme de clé pour suivre un changement de langue. */
export type UiError = { key: MessageKey; params?: Record<string, string | number> } | { raw: string };

export function toUiError(error: unknown): UiError {
  if (error instanceof ApiError) {
    if (isTeamRefusal(error.refusal)) return teamRefusalError(error.refusal);
    if (isAdminRefusal(error.refusal)) return adminRefusalError(error.refusal);
    return error.status === 409 ? { key: 'initiatives.codeTaken' } : { key: 'error.http', params: { status: error.status } };
  }
  return { raw: String(error) };
}

/** Refus d'un changement de l'équipe (règles d'équipe de @app/shared). */
export const teamRefusalError = (refusal: TeamRefusal): UiError => ({ key: `team.refusal.${refusal}` });

/** Refus de l'administration des comptes (règles de @app/shared). */
export const adminRefusalError = (refusal: AdminRefusal): UiError => ({ key: `admin.refusal.${refusal}` });

export function ErrorMessage({ error }: { error: UiError | null }) {
  const { t } = useI18n();
  if (!error) return null;
  return <p className="error" role="alert">{'raw' in error ? error.raw : t(error.key, error.params)}</p>;
}
