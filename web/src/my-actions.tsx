// Écran d'accueil « Mes actions » (ticket 07) : les actions dont je suis
// responsable, toutes initiatives confondues, filtrées et triées selon
// @app/shared (selectMyActions).
import {
  type ActionDto,
  type ActionStatus,
  actionStatuses,
  type BabokDto,
  defaultMyActionsStatuses,
  type InitiativeDto,
  selectMyActions,
  toggleActionStatus,
} from '@app/shared';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ActionList } from './actions';
import { api } from './api';
import { EmptyState } from './empty-state';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { usePanels } from './panels';
import { useTicketLabels, useTicketTypes } from './ticket-types';

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
  const ticketTypes = useTicketTypes();
  const { statusLabel } = useTicketLabels();
  // null : statuts par défaut (non fermés), y compris ceux qu'ajoute l'administration.
  const [chosen, setChosen] = useState<readonly ActionStatus[] | null>(null);
  const statuses = chosen ?? defaultMyActionsStatuses(ticketTypes);
  const [initiativeId, setInitiativeId] = useState('');
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    api.listMyActions().then(setActions, (e: unknown) => setError(toUiError(e)));
  }, [version]);

  const toggle = (status: ActionStatus) => setChosen(toggleActionStatus(ticketTypes, statuses, status));
  const shown = selectMyActions(ticketTypes, actions, { statuses, initiativeId: initiativeId || null });

  return (
    <section className="my-actions">
      <div className="action-filters">
        {/* Boutons bascule (refonte du design, ticket 04) ; même filtre qu'avec des cases à cocher. */}
        <div role="group" aria-label={t('actions.filterStatuses')} className="filter-chips">
          {actionStatuses(ticketTypes).map((s) => (
            <button key={s} type="button" aria-pressed={statuses.includes(s)} onClick={() => toggle(s)}>
              {statusLabel('action', s)}
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
