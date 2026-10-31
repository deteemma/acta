// Encart « Actions suggérées » du tableau de bord (ticket 14) : des Actions
// proposées selon l'état de l'initiative, par des règles fixes et explicables.
// Règles validées par la responsable fonctionnelle le 30.10.2026
// (.scratch/phase-1/14-regles-actions-suggerees.md), écrites une seule fois ici.
import { type ActionStatus, type CreateActionInput, isOpenAction } from './actions.js';
import type { BabokDto } from './babok.js';
import { type Locale, type MessageKey, translate } from './i18n.js';
import type { AnalysisApproach } from './schemas.js';
import type { StakeholderLevel, StakeholderRole } from './stakeholders.js';
import type { RequirementStatus } from './requirements.js';
import { requirementStatusTask } from './suggestions.js';

/** G1 : nombre de suggestions affichées avant « voir tout ». */
export const SUGGESTED_ACTIONS_SHOWN = 5;

/** Numéro de règle du document validé ; R14 se décline par domaine de connaissance. */
export type SuggestedActionRule =
  | 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8'
  | 'R9' | 'R10' | 'R11' | 'R12' | 'R13' | 'R14' | 'R15';

/** Ce que les règles lisent de l'initiative. */
export interface SuggestionContext {
  /** Instant de calcul (ISO), pour « depuis plus de 14 jours ». */
  now: string;
  /** Date du jour, AAAA-MM-JJ, pour la date de fin prévue. */
  today: string;
  initiative: { archived: boolean; analysisApproach: AnalysisApproach | null; plannedEndDate: string | null };
  actions: readonly {
    taskId: string;
    status: ActionStatus;
    /** Suggestion d'où l'action a été créée ; null sinon. */
    suggestionKey: string | null;
    stakeholderIds: readonly string[];
  }[];
  stakeholders: readonly {
    id: string;
    roles: readonly StakeholderRole[];
    influence: StakeholderLevel | null;
    interest: StakeholderLevel | null;
  }[];
  needs: readonly { id: string; stakeholderIds: readonly string[] }[];
  requirements: readonly {
    id: string;
    status: RequirementStatus;
    /** Dernier passage au statut actuel (ISO) : requirementStatusSince. */
    statusSince: string;
    stakeholderIds: readonly string[];
    needIds: readonly string[];
  }[];
  /** Suggestions écartées par l'équipe (G7). */
  dismissedKeys: readonly string[];
}

/** Objets concernés par une suggestion, auxquels l'Action créée est liée (G11). */
export interface SuggestedActionLinks {
  stakeholderIds: string[];
  needIds: string[];
  requirementIds: string[];
}

export interface SuggestedAction {
  /** Identifie la suggestion : son numéro de règle, suivi du domaine pour R14 (`R14:5`). */
  key: string;
  rule: SuggestedActionRule;
  taskId: string;
  techniqueId: string | null;
  /** Nombre d'objets concernés ; null pour une règle qui porte sur toute l'initiative. */
  count: number | null;
  /** R14 : le domaine non couvert. */
  knowledgeAreaId: string | null;
  /** R15 : jours avant la date de fin prévue, négatif si elle est dépassée. */
  daysLeft: number | null;
  links: SuggestedActionLinks;
}

const NO_LINKS: SuggestedActionLinks = { stakeholderIds: [], needIds: [], requirementIds: [] };

/** Suggestion d'une règle qui porte sur toute l'initiative. */
function onInitiative(
  rule: SuggestedActionRule,
  taskId: string,
  techniqueId: string | null = null,
  extra: Partial<Pick<SuggestedAction, 'key' | 'knowledgeAreaId' | 'daysLeft'>> = {},
): SuggestedAction {
  return { key: rule, rule, taskId, techniqueId, count: null, knowledgeAreaId: null, daysLeft: null, links: NO_LINKS, ...extra };
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** R11 à R13 : « depuis plus de 14 jours ». */
const STALE_AFTER_MS = 14 * DAY_MS;
/** R15 : à partir de 30 jours avant la date de fin prévue. */
const END_DATE_NOTICE_DAYS = 30;

/**
 * Dernier passage d'une exigence à son statut actuel : la première version de
 * la dernière suite de versions à ce statut. `versions` : la plus ancienne d'abord.
 */
export function requirementStatusSince(versions: readonly { changedAt: string; status: RequirementStatus }[]): string {
  let index = versions.length - 1;
  while (index > 0 && versions[index - 1]!.status === versions[index]!.status) index--;
  return versions[index]!.changedAt;
}

/** Suggestion d'une règle qui porte sur des objets ; aucune s'il n'y en a pas. */
function onObjects(
  rule: SuggestedActionRule,
  taskId: string,
  techniqueId: string | null,
  kind: keyof SuggestedActionLinks,
  objects: readonly { id: string }[],
): SuggestedAction[] {
  if (objects.length === 0) return [];
  const links = { ...NO_LINKS, [kind]: objects.map((o) => o.id) };
  return [{ key: rule, rule, taskId, techniqueId, count: objects.length, knowledgeAreaId: null, daysLeft: null, links }];
}

/**
 * Toutes les situations présentes, une suggestion par règle déclenchée (par
 * domaine pour R14), avant tout masquage : sert aussi à oublier les écarts
 * dont la situation a disparu (G7).
 */
export function currentSituations(babok: BabokDto, context: SuggestionContext): SuggestedAction[] {
  const { initiative, actions, stakeholders, needs, requirements } = context;
  const found: SuggestedAction[] = [];
  if (actions.length === 0) found.push(onInitiative('R1', '3.1'));
  if (initiative.analysisApproach == null) found.push(onInitiative('R2', '3.1'));
  if (stakeholders.length === 0) found.push(onInitiative('R3', '3.2', '10.43'));
  if (!stakeholders.some((s) => s.roles.includes('sponsor'))) found.push(onInitiative('R4', '3.2', '10.43'));
  found.push(
    ...onObjects('R5', '3.2', '10.43', 'stakeholderIds', stakeholders.filter((s) => !s.influence || !s.interest)),
  );
  // R6 : liée à une action quel qu'en soit le statut.
  const linkedStakeholders = new Set(actions.flatMap((a) => a.stakeholderIds));
  found.push(...onObjects('R6', '4.5', null, 'stakeholderIds', stakeholders.filter((s) => !linkedStakeholders.has(s.id))));
  if (needs.length === 0) found.push(onInitiative('R7', '6.1', '10.25'));
  found.push(...onObjects('R8', '5.1', null, 'needIds', needs.filter((n) => n.stakeholderIds.length === 0)));
  const specifiedNeeds = new Set(requirements.flatMap((r) => r.needIds));
  found.push(...onObjects('R9', '7.1', null, 'needIds', needs.filter((n) => !specifiedNeeds.has(n.id))));
  found.push(
    ...onObjects('R10', '5.1', null, 'requirementIds', requirements.filter((r) => r.stakeholderIds.length === 0)),
  );
  // R11 à R13 : la tâche que le ticket 13 propose pour une exigence de ce statut.
  const staleRules = [
    ['R11', 'proposed'],
    ['R12', 'verified'],
    ['R13', 'validated'],
  ] as const;
  for (const [rule, status] of staleRules) {
    const stale = requirements.filter(
      (r) => r.status === status && Date.parse(context.now) - Date.parse(r.statusSince) > STALE_AFTER_MS,
    );
    found.push(...onObjects(rule, requirementStatusTask(status)!, '10.37', 'requirementIds', stale));
  }
  // R14 : un domaine est couvert dès qu'une action porte sur l'une de ses
  // tâches, quel qu'en soit le statut (même définition que le ticket 12).
  const coveredAreas = new Set(actions.map((a) => babok.tasks.find((t) => t.id === a.taskId)?.knowledgeAreaId));
  for (const knowledgeArea of babok.knowledgeAreas) {
    const firstTask = babok.tasks.find((t) => t.knowledgeAreaId === knowledgeArea.id);
    if (firstTask && !coveredAreas.has(knowledgeArea.id)) {
      found.push(
        onInitiative('R14', firstTask.id, null, { key: `R14:${knowledgeArea.id}`, knowledgeAreaId: knowledgeArea.id }),
      );
    }
  }
  if (initiative.plannedEndDate) {
    // Dates AAAA-MM-JJ, lues à minuit UTC : l'écart est un nombre entier de jours.
    const daysLeft = (Date.parse(initiative.plannedEndDate) - Date.parse(context.today)) / DAY_MS;
    if (daysLeft <= END_DATE_NOTICE_DAYS) found.push(onInitiative('R15', '3.5', null, { daysLeft }));
  }
  return found;
}

const RULE_NUMBER = (rule: SuggestedActionRule) => Number(rule.slice(1));
const isOnObjects = (s: SuggestedAction) => s.count != null;

/**
 * Suggestions de l'encart, dans l'ordre du référentiel de leur tâche (G1) :
 * aucune sur une initiative archivée (G4) ; ni celles écartées (G7), ni celles
 * dont une Action créée depuis elles est À faire ou En cours (G6) ; parmi les
 * restantes, une seule par tâche (G2) : celle qui porte sur des objets, puis
 * la règle au plus petit numéro.
 */
export function suggestActions(babok: BabokDto, context: SuggestionContext): SuggestedAction[] {
  if (context.initiative.archived) return [];
  const inProgress = new Set(
    context.actions.filter(isOpenAction).map((a) => a.suggestionKey),
  );
  const visible = currentSituations(babok, context).filter(
    (s) => !context.dismissedKeys.includes(s.key) && !inProgress.has(s.key),
  );
  const byTask = new Map<string, SuggestedAction>();
  for (const s of visible) {
    const best = byTask.get(s.taskId);
    const wins =
      !best ||
      (isOnObjects(s) && !isOnObjects(best)) ||
      (isOnObjects(s) === isOnObjects(best) && RULE_NUMBER(s.rule) < RULE_NUMBER(best.rule));
    if (wins) byTask.set(s.taskId, s);
  }
  const taskOrder = (s: SuggestedAction) => babok.tasks.findIndex((t) => t.id === s.taskId);
  return [...byTask.values()].sort((a, b) => taskOrder(a) - taskOrder(b));
}

/** Titre de l'Action à créer (G9) et justification affichée, dans la langue de l'interface (G12). */
export function suggestedActionText(
  babok: BabokDto,
  locale: Locale,
  suggestion: SuggestedAction,
): { title: string; justification: string } {
  const { rule, count, daysLeft, knowledgeAreaId, taskId } = suggestion;
  if (rule === 'R14') {
    // Titre : le nom de la tâche proposée.
    const domain = babok.knowledgeAreas.find((a) => a.id === knowledgeAreaId)?.name[locale] ?? '';
    return {
      title: babok.tasks.find((t) => t.id === taskId)?.name[locale] ?? taskId,
      justification: translate(locale, 'suggestedActions.R14.justification', { domain }),
    };
  }
  const overdue = daysLeft != null && daysLeft < 0;
  const justification = `suggestedActions.${rule}.${overdue ? 'justificationOverdue' : 'justification'}` as MessageKey;
  return {
    title: translate(locale, `suggestedActions.${rule}.title` as MessageKey),
    justification: translate(locale, justification, { n: count ?? Math.abs(daysLeft ?? 0) }),
  };
}

/**
 * Action créée en un clic (G8 à G11) : titre, tâche et technique de la règle,
 * liée à tous les objets comptés ; le responsable est la personne qui clique
 * (valeur par défaut de la création), sans échéance.
 */
export function suggestedActionInput(suggestion: SuggestedAction, title: string): CreateActionInput {
  return {
    title,
    taskId: suggestion.taskId,
    techniqueId: suggestion.techniqueId,
    ...suggestion.links,
    suggestionKey: suggestion.key,
  };
}
