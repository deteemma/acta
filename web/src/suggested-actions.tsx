// Encart « Actions suggérées » du tableau de bord (ticket 14). Règles dans
// @app/shared (suggested-actions.ts), calculées par l'API.
import {
  type BabokDto,
  can,
  findBabokElement,
  type InitiativeDto,
  type SuggestedAction,
  suggestedActionInput,
  suggestedActionText,
  SUGGESTED_ACTIONS_SHOWN,
} from '@app/shared';
import { useEffect, useState } from 'react';
import { BabokPreview } from './action-panels';
import { api } from './api';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { usePanels } from './panels';

export function SuggestedActions({
  initiative,
  babok,
  onActionCreated,
}: {
  /** Relue après chaque écriture qui peut faire naître ou disparaître une suggestion : l'encart se recharge. */
  initiative: InitiativeDto;
  babok: BabokDto;
  onActionCreated: () => void;
}) {
  const { t, locale } = useI18n();
  const { open } = usePanels();
  const [suggestions, setSuggestions] = useState<SuggestedAction[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<UiError | null>(null);

  const load = () => api.listSuggestedActions(initiative.id).then(setSuggestions, (e: unknown) => setError(toUiError(e)));

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initiative]);

  // G4 : masqué sur une initiative archivée.
  const state = { archived: initiative.archivedAt != null };
  if (state.archived || !suggestions) return null;
  // G3 : les lecteurs voient l'encart, sans bouton.
  const canCreate = can(initiative.myRole, 'editActions', state);
  const canDismiss = can(initiative.myRole, 'dismissSuggestedActions', state);

  async function create(suggestion: SuggestedAction) {
    setBusy(true);
    setError(null);
    try {
      const { title } = suggestedActionText(babok, locale, suggestion);
      const action = await api.createAction(initiative.id, suggestedActionInput(suggestion, title));
      onActionCreated();
      open({ kind: 'action', initiativeId: initiative.id, actionId: action.id });
    } catch (e) {
      setError(toUiError(e));
      // La situation a pu changer entre-temps (refus `suggestionNotOffered`).
      void load();
    } finally {
      setBusy(false);
    }
  }

  async function dismiss(suggestion: SuggestedAction) {
    setBusy(true);
    setError(null);
    try {
      await api.dismissSuggestedAction(initiative.id, suggestion.key);
      await load();
    } catch (e) {
      setError(toUiError(e));
    } finally {
      setBusy(false);
    }
  }

  const shown = showAll ? suggestions : suggestions.slice(0, SUGGESTED_ACTIONS_SHOWN);
  return (
    <section className="suggested-actions">
      <h3>{t('suggestedActions.title')}</h3>
      <ErrorMessage error={error} />
      {suggestions.length === 0 && <p>{t('suggestedActions.empty')}</p>}
      <ul className="links">
        {shown.map((suggestion) => {
          const { title, justification } = suggestedActionText(babok, locale, suggestion);
          const task = findBabokElement(babok, suggestion.taskId);
          return (
            <li key={suggestion.key}>
              <div className="suggested-action-head">
                <strong>{title}</strong>
                {task && <BabokPreview element={task} />}
              </div>
              <small>{justification}</small>
              {(canCreate || canDismiss) && (
                <div className="suggested-action-buttons">
                  {canCreate && (
                    <button type="button" disabled={busy} onClick={() => void create(suggestion)}>
                      {t('suggestedActions.create')}
                    </button>
                  )}
                  {canDismiss && (
                    <button type="button" className="link" disabled={busy} onClick={() => void dismiss(suggestion)}>
                      {t('suggestedActions.dismiss')}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {suggestions.length > SUGGESTED_ACTIONS_SHOWN && (
        <button type="button" className="link" onClick={() => setShowAll((v) => !v)}>
          {showAll ? t('suggestedActions.showLess') : t('suggestedActions.showAll', { count: suggestions.length })}
        </button>
      )}
    </section>
  );
}
