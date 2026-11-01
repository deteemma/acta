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
    <Panel
      title={initiative ? initiative.name : t('common.loading')}
      kicker={
        initiative && (
          <>
            {t('dashboard.kicker')} <span className="code">{initiative.code}</span>
          </>
        )
      }
      onClose={onClose}
    >
      <ErrorMessage error={error} />
      {initiative && (
        <SuggestedActions
          initiative={initiative}
          babok={babok}
          onActionCreated={onActionCreated}
        />
      )}
      {actions && <h3 className="group-title">{t('dashboard.coverageGroup')}</h3>}
      {actions &&
        initiativeDashboard(babok, actions).map(({ knowledgeArea, tasks, coveredTaskCount }) => {
          const coverage = t('dashboard.coverage', { covered: coveredTaskCount, total: tasks.length });
          return (
            <section key={knowledgeArea.id} className="dashboard-area">
              <div className="dashboard-area-head">
                <h4>
                  <span className="code">{knowledgeArea.section}</span> <BabokName element={knowledgeArea} />
                </h4>
                <small>{coverage}</small>
              </div>
              {/* Barre de couverture (refonte du design, ticket 04) : part des tâches couvertes. */}
              <div className="coverage-bar" role="img" aria-label={coverage}>
                <span style={{ width: `${tasks.length ? (100 * coveredTaskCount) / tasks.length : 0}%` }} />
              </div>
              <div className="dashboard-tasks">
                {tasks.map(({ task, actions: ofTask, countByStatus, covered }) => (
                  <details key={task.id} className="dashboard-task">
                    <summary>
                      <span className="code">{task.section}</span>
                      <span className="dashboard-task-name">
                        <BabokName element={task} />
                      </span>
                      <span className="action-meta">
                        {covered ? (
                          ACTION_STATUSES.filter((status) => countByStatus[status] > 0).map((status) => (
                            <StatusLabel key={status} status={status} count={countByStatus[status]} />
                          ))
                        ) : (
                          <span className="badge tone-negative">{t('dashboard.uncovered')}</span>
                        )}
                      </span>
                    </summary>
                    {ofTask.length > 0 ? <ActionList actions={ofTask} babok={babok} /> : <p>{t('dashboard.noActions')}</p>}
                  </details>
                ))}
              </div>
            </section>
          );
        })}
    </Panel>
  );
}
