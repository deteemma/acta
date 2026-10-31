// Tableau de bord de l'initiative (ticket 12) : les actions par domaine de
// connaissance puis par tâche du BABOK. Règles dans @app/shared (dashboard.ts).
import {
  ACTION_STATUSES,
  type ActionDto,
  type BabokDto,
  type InitiativeDto,
  initiativeDashboard,
} from '@app/shared';
import { useEffect, useState } from 'react';
import { ActionList, StatusLabel } from './action-panels';
import { api } from './api';
import { BabokName } from './babok-panels';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { Panel } from './panels';
import { SuggestedActions } from './suggested-actions';

export function DashboardPanel({
  initiativeId,
  babok,
  actionsVersion,
  dataVersion,
  onActionCreated,
  onClose,
}: {
  initiativeId: string;
  babok: BabokDto;
  /** Change à chaque écriture sur une action : le tableau se recharge. */
  actionsVersion: number;
  /**
   * Change à chaque écriture sur l'initiative ou ses objets d'analyse : la fiche
   * et les actions suggérées se rechargent.
   */
  dataVersion: string;
  onActionCreated: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [initiative, setInitiative] = useState<InitiativeDto | null>(null);
  const [actions, setActions] = useState<ActionDto[] | null>(null);
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    api.getInitiative(initiativeId).then(setInitiative, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, dataVersion]);

  useEffect(() => {
    api.listActions(initiativeId).then(setActions, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, actionsVersion]);

  return (
    <Panel title={initiative ? t('dashboard.title', { code: initiative.code }) : t('common.loading')} onClose={onClose}>
      <ErrorMessage error={error} />
      {initiative && (
        <SuggestedActions
          initiative={initiative}
          babok={babok}
          onActionCreated={onActionCreated}
        />
      )}
      {actions &&
        initiativeDashboard(babok, actions).map(({ knowledgeArea, tasks, coveredTaskCount }) => (
          <section key={knowledgeArea.id} className="dashboard-area">
            <h3>
              <strong>{knowledgeArea.section}</strong> <BabokName element={knowledgeArea} />
            </h3>
            <p>
              <small>{t('dashboard.coverage', { covered: coveredTaskCount, total: tasks.length })}</small>
            </p>
            {tasks.map(({ task, actions: ofTask, countByStatus, covered }) => (
              <details key={task.id} className={`dashboard-task${covered ? '' : ' uncovered'}`}>
                <summary>
                  <span>
                    <strong>{task.section}</strong> <BabokName element={task} />
                  </span>
                  <span className="action-meta">
                    {covered ? (
                      ACTION_STATUSES.filter((status) => countByStatus[status] > 0).map((status) => (
                        <StatusLabel key={status} status={status} count={countByStatus[status]} />
                      ))
                    ) : (
                      <span className="badge">{t('dashboard.uncovered')}</span>
                    )}
                  </span>
                </summary>
                {ofTask.length > 0 ? <ActionList actions={ofTask} babok={babok} /> : <p>{t('dashboard.noActions')}</p>}
              </details>
            ))}
          </section>
        ))}
    </Panel>
  );
}
