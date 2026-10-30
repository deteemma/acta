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
} from '@app/shared';
import { useEffect, useState } from 'react';
import { ActionList } from './action-panels';
import { api } from './api';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';

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
  const [actions, setActions] = useState<ActionDto[]>([]);
  const [statuses, setStatuses] = useState<readonly ActionStatus[]>(DEFAULT_MY_ACTIONS_STATUSES);
  const [initiativeId, setInitiativeId] = useState('');
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    api.listMyActions().then(setActions, (e: unknown) => setError(toUiError(e)));
  }, [version]);

  const toggle = (status: ActionStatus) =>
    setStatuses((current) =>
      current.includes(status) ? current.filter((s) => s !== status) : ACTION_STATUSES.filter((s) => s === status || current.includes(s)),
    );
  const shown = selectMyActions(actions, { statuses, initiativeId: initiativeId || null });

  return (
    <section className="my-actions">
      <div className="action-filters">
        <fieldset>
          <legend>{t('actions.filterStatuses')}</legend>
          {ACTION_STATUSES.map((s) => (
            <label key={s} className="inline">
              <input type="checkbox" checked={statuses.includes(s)} onChange={() => toggle(s)} />
              {t(`actionStatus.${s}`)}
            </label>
          ))}
        </fieldset>
        <label>
          {t('actions.filterInitiative')}{' '}
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
      {shown.length === 0 && <p>{t('actions.empty')}</p>}
      {!initiativeId && actions.some((a) => a.initiative.archived) && (
        <p>
          <small>{t('actions.archivedHidden')}</small>
        </p>
      )}
    </section>
  );
}
