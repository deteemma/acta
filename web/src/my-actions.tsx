// Écran d'accueil « Mes actions » (ticket 07) : les actions dont je suis
// responsable, toutes initiatives confondues, filtrées et triées selon
// @app/shared (selectMyActions).
import {
  ACTION_STATUSES,
  type ActionDto,
  type ActionStatus,
  type BabokDto,
  DEFAULT_MY_ACTIONS_STATUSES,
  type InitiativeDto,
  selectMyActions,
  toggleActionStatus,
} from '@app/shared';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ActionList } from './action-panels';
import { api } from './api';
import { EmptyState } from './empty-state';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { usePanels } from './panels';

export function MyActions({
  initiatives,
  babok,
  version,
}: {
  initiatives: InitiativeDto[];
  babok: BabokDto | null;
  /** Change à chaque création, modification ou suppression d'une action. */
  version: number;
}) {
  const { t } = useI18n();
  const { open } = usePanels();
  const [actions, setActions] = useState<ActionDto[]>([]);
  const [statuses, setStatuses] = useState<readonly ActionStatus[]>(DEFAULT_MY_ACTIONS_STATUSES);
  const [initiativeId, setInitiativeId] = useState('');
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    api.listMyActions().then(setActions, (e: unknown) => setError(toUiError(e)));
  }, [version]);

  const toggle = (status: ActionStatus) => setStatuses((current) => toggleActionStatus(current, status));
  const shown = selectMyActions(actions, { statuses, initiativeId: initiativeId || null });

  return (
    <section className="my-actions">
      <div className="action-filters">
        {/* Boutons bascule (refonte du design, ticket 04) ; même filtre qu'avec des cases à cocher. */}
        <div role="group" aria-label={t('actions.filterStatuses')} className="filter-chips">
          {ACTION_STATUSES.map((s) => (
            <button key={s} type="button" aria-pressed={statuses.includes(s)} onClick={() => toggle(s)}>
              {t(`actionStatus.${s}`)}
            </button>
          ))}
        </div>
        <label className="inline-field">
          {t('actions.filterInitiative')}
          <select value={initiativeId} onChange={(e) => setInitiativeId(e.target.value)}>
            <option value="">{t('actions.allInitiatives')}</option>
            {initiatives.map((i) => (
              <option key={i.id} value={i.id}>
                {i.code} · {i.name}
                {i.archivedAt ? ` (${t('initiative.archived')})` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ErrorMessage error={error} />
      <ActionList actions={shown} babok={babok} showInitiative />
      {shown.length === 0 && (
        <EmptyState
          subject="actions"
          title={t('actions.empty')}
          hint={t('empty.actionsHint')}
          action={
            // Même création que le bouton flottant « + Action ».
            <button type="button" className="primary" disabled={!babok} onClick={() => open({ kind: 'createAction' })}>
              <Plus />
              {t('actions.fab')}
            </button>
          }
        />
      )}
      {!initiativeId && actions.some((a) => a.initiative.archived) && (
        <p>
          <small>{t('actions.archivedHidden')}</small>
        </p>
      )}
    </section>
  );
}
