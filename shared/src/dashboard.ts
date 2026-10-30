// Tableau de bord de l'initiative (ticket 12) : les actions classées par domaine
// de connaissance puis par tâche du BABOK, qui montrent les tâches couvertes.
import { ACTION_STATUSES, type ActionDto, type ActionStatus, sortByDueDate } from './actions.js';
import { type BabokDto, type BabokTaskDto, type KnowledgeAreaDto, tasksOfKnowledgeArea } from './babok.js';

export interface DashboardTask {
  task: BabokTaskDto;
  /** Actions de la tâche, par échéance (sortByDueDate). */
  actions: ActionDto[];
  countByStatus: Record<ActionStatus, number>;
  /** Couverte dès qu'elle a une action, quel qu'en soit le statut. */
  covered: boolean;
}

export interface DashboardKnowledgeArea {
  knowledgeArea: KnowledgeAreaDto;
  tasks: DashboardTask[];
  coveredTaskCount: number;
}

/** Les domaines de connaissance et leurs tâches, dans l'ordre du référentiel, avec les actions de l'initiative. */
export function initiativeDashboard(babok: BabokDto, actions: readonly ActionDto[]): DashboardKnowledgeArea[] {
  return babok.knowledgeAreas.map((knowledgeArea) => {
    const tasks = tasksOfKnowledgeArea(babok, knowledgeArea.id).map((task): DashboardTask => {
      const ofTask = sortByDueDate(actions.filter((a) => a.taskId === task.id));
      const countByStatus = Object.fromEntries(
        ACTION_STATUSES.map((status) => [status, ofTask.filter((a) => a.status === status).length]),
      ) as Record<ActionStatus, number>;
      return { task, actions: ofTask, countByStatus, covered: ofTask.length > 0 };
    });
    return { knowledgeArea, tasks, coveredTaskCount: tasks.filter((t) => t.covered).length };
  });
}
