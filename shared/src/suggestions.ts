// Suggestions à la création d'une action (ticket 13) : tâche proposée selon
// l'endroit d'où l'action est créée, techniques de la tâche classées par usage.
// Règles fixes, écrites une seule fois ici ; chaque suggestion porte sa
// justification (libellés `suggestion.*` de i18n.ts).
import type { ActionDto, CreateActionInput } from './actions.js';
import type { BabokDto, TechniqueDto } from './babok.js';
import type { RequirementStatus } from './requirements.js';

/** Objet d'analyse depuis lequel une action est créée. */
export interface AnalysisObjectRef {
  kind: 'stakeholder' | 'need' | 'requirement';
  id: string;
}

/** Créée depuis un objet d'analyse, l'action est liée à cet objet. */
export function analysisObjectLinks(
  object: AnalysisObjectRef,
): Pick<CreateActionInput, 'stakeholderIds' | 'needIds' | 'requirementIds'> {
  switch (object.kind) {
    case 'stakeholder':
      return { stakeholderIds: [object.id] };
    case 'need':
      return { needIds: [object.id] };
    case 'requirement':
      return { requirementIds: [object.id] };
  }
}

/** Endroit d'où l'action est créée, tel que les règles de tâche proposée le lisent. */
export type ActionOrigin =
  | { kind: 'initiative'; hasActions: boolean }
  | { kind: 'stakeholder' }
  | { kind: 'need' }
  | { kind: 'requirement'; status: RequirementStatus };

/** Justification d'une tâche proposée (libellé `suggestion.task.<reason>`). */
export type TaskSuggestionReason =
  | 'noAction'
  | 'stakeholderEngagement'
  | 'stakeholderCollaboration'
  | 'needCurrentState'
  | 'needFutureState'
  | 'requirementProposed'
  | 'requirementVerified'
  | 'requirementValidated'
  | 'requirementTrace';

export interface TaskSuggestion {
  taskId: string;
  reason: TaskSuggestionReason;
}

/** Tâche proposée selon l'état d'une exigence ; 5.1 vient ensuite pour toute exigence. */
const REQUIREMENT_STATUS_TASKS: Partial<Record<RequirementStatus, TaskSuggestion>> = {
  proposed: { taskId: '7.2', reason: 'requirementProposed' },
  verified: { taskId: '7.3', reason: 'requirementVerified' },
  validated: { taskId: '5.5', reason: 'requirementValidated' },
};

/** Tâche proposée pour une exigence de ce statut (7.2, 7.3, 5.5) ; reprise par l'encart « Actions suggérées » (R11 à R13). */
export function requirementStatusTask(status: RequirementStatus): string | undefined {
  return REQUIREMENT_STATUS_TASKS[status]?.taskId;
}

/** Tâches proposées selon l'origine de la création, la première d'abord. */
export function suggestTasks(origin: ActionOrigin): TaskSuggestion[] {
  switch (origin.kind) {
    case 'initiative':
      return origin.hasActions ? [] : [{ taskId: '3.1', reason: 'noAction' }];
    case 'stakeholder':
      return [
        { taskId: '3.2', reason: 'stakeholderEngagement' },
        { taskId: '4.5', reason: 'stakeholderCollaboration' },
      ];
    case 'need':
      return [
        { taskId: '6.1', reason: 'needCurrentState' },
        { taskId: '6.2', reason: 'needFutureState' },
      ];
    case 'requirement': {
      const byStatus = REQUIREMENT_STATUS_TASKS[origin.status];
      return [...(byStatus ? [byStatus] : []), { taskId: '5.1', reason: 'requirementTrace' }];
    }
  }
}

/** Nombre d'actions qui utilisent chaque technique, toutes tâches et tous statuts confondus. */
export type TechniqueCounts = Partial<Record<string, number>>;

/** Usage d'une technique : dans l'initiative, et dans toute l'application (initiative comprise). */
export interface TechniqueUsage {
  initiative: number;
  application: number;
}

export interface RankedTechnique {
  technique: TechniqueDto;
  usage: TechniqueUsage;
}

/** Nombre d'actions par technique. */
function countTechniques(actions: readonly Pick<ActionDto, 'techniqueId'>[]): TechniqueCounts {
  const counts: TechniqueCounts = {};
  for (const { techniqueId } of actions) if (techniqueId) counts[techniqueId] = (counts[techniqueId] ?? 0) + 1;
  return counts;
}

/**
 * Techniques à proposer pour une tâche : celles que le BABOK lui associe, les
 * plus utilisées dans l'initiative d'abord, à égalité les plus utilisées dans
 * toute l'application, puis dans l'ordre du référentiel. Les autres suivent,
 * dans l'ordre du référentiel.
 */
export function rankTechniques(
  babok: BabokDto,
  taskId: string,
  initiativeActions: readonly Pick<ActionDto, 'techniqueId'>[],
  applicationCounts: TechniqueCounts,
): { suggested: RankedTechnique[]; others: TechniqueDto[] } {
  const ids = babok.tasks.find((task) => task.id === taskId)?.techniqueIds ?? [];
  const initiativeCounts = countTechniques(initiativeActions);
  const suggested = babok.techniques
    .filter((t) => ids.includes(t.id))
    .map((technique) => ({
      technique,
      usage: { initiative: initiativeCounts[technique.id] ?? 0, application: applicationCounts[technique.id] ?? 0 },
    }))
    // Tri stable : à égalité complète, l'ordre du référentiel demeure.
    .sort((a, b) => b.usage.initiative - a.usage.initiative || b.usage.application - a.usage.application);
  return { suggested, others: babok.techniques.filter((t) => !ids.includes(t.id)) };
}
