// Actions (ticket 07) : unité de travail d'un BA, toujours rattachée à une tâche
// BABOK. Règles écrites une seule fois ici, appliquées par l'API et reproduites
// par la base (migration 0010).
import { z } from 'zod';
import type { BabokDto, TechniqueDto } from './babok.js';
import { hasAtLeast, type InitiativeRole } from './roles.js';
import { needIdsSchema, type NeedRefDto } from './needs.js';
import { requirementIdsSchema, type RequirementRefDto } from './requirements.js';
import type { MemberNameDto } from './schemas.js';
import { stakeholderIdsSchema, type StakeholderRefDto } from './stakeholders.js';

/** Statuts d'une action ; tout statut peut passer à tout autre. */
export const ACTION_STATUSES = ['todo', 'in_progress', 'done', 'cancelled'] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];
export const actionStatusSchema = z.enum(ACTION_STATUSES);

export const ACTION_TITLE_MAX_LENGTH = 200;
export const actionTitleSchema = z.string().trim().min(1).max(ACTION_TITLE_MAX_LENGTH);

/** Texte mis en forme (rich-text.ts), qui accueille aussi les comptes rendus d'élicitation ; vide = pas de description. */
export const ACTION_DESCRIPTION_MAX_LENGTH = 20000;
export const actionDescriptionSchema = z
  .string()
  .trim()
  .max(ACTION_DESCRIPTION_MAX_LENGTH)
  .transform((text) => text || null)
  .nullable();

/** Clé d'une suggestion de l'encart « Actions suggérées » (ticket 14) : R1 à R15, R14 suivie du domaine (`R14:5`). */
export const suggestionKeySchema = z.string().regex(/^R(?:[1-9]|1[0-35]|14:\d+)$/);

/** Identifiant d'une tâche (`4.1`) ou d'une technique (`10.33`) du référentiel BABOK. */
const babokIdSchema = z.string().regex(/^\d+\.\d+$/);

/**
 * Création d'une action : la création rapide fournit le titre et la tâche ; le
 * responsable est alors la personne qui crée l'action.
 */
export const createActionSchema = z.object({
  title: actionTitleSchema,
  taskId: babokIdSchema,
  techniqueId: babokIdSchema.nullable().optional(),
  assigneeId: z.string().min(1).optional(),
  dueDate: z.iso.date().nullable().optional(),
  description: actionDescriptionSchema.optional(),
  stakeholderIds: stakeholderIdsSchema.optional(),
  needIds: needIdsSchema.optional(),
  requirementIds: requirementIdsSchema.optional(),
  /** Suggestion de l'encart d'où l'action est créée (ticket 14) ; ne change plus. */
  suggestionKey: suggestionKeySchema.optional(),
});
export type CreateActionInput = z.infer<typeof createActionSchema>;

/** Modification d'une action : seuls les champs fournis changent. */
export const updateActionSchema = z
  .object({
    title: actionTitleSchema,
    description: actionDescriptionSchema,
    taskId: babokIdSchema,
    techniqueId: babokIdSchema.nullable(),
    assigneeId: z.string().min(1),
    dueDate: z.iso.date().nullable(),
    status: actionStatusSchema,
    /** Remplace l'ensemble des parties prenantes liées. */
    stakeholderIds: stakeholderIdsSchema,
    /** Remplace l'ensemble des besoins liés (ticket 09). */
    needIds: needIdsSchema,
    /** Remplace l'ensemble des exigences liées (ticket 10). */
    requirementIds: requirementIdsSchema,
  })
  .partial();
export type UpdateActionInput = z.infer<typeof updateActionSchema>;

/** Action telle que renvoyée par l'API. */
export interface ActionDto {
  id: string;
  /** Initiative de l'action, avec le rôle de l'utilisateur courant. */
  initiative: { id: string; code: string; name: string; archived: boolean; myRole: InitiativeRole };
  title: string;
  /** Texte mis en forme (voir rich-text.ts) ; null si vide. */
  description: string | null;
  /** Tâche BABOK (identifiant du référentiel, ex. `4.1`). */
  taskId: string;
  techniqueId: string | null;
  /** `eligible` : encore propriétaire ou contributeur de l'initiative. */
  assignee: MemberNameDto & { eligible: boolean };
  /** Auteur et date de la dernière attribution (ticket 15). */
  assignedBy: MemberNameDto;
  assignedAt: string;
  /** AAAA-MM-JJ */
  dueDate: string | null;
  status: ActionStatus;
  /** Parties prenantes liées, par ordre alphabétique. */
  stakeholders: StakeholderRefDto[];
  /** Besoins liés, par référence. */
  needs: NeedRefDto[];
  /** Exigences liées, par référence. */
  requirements: RequirementRefDto[];
  createdAt: string;
  createdBy: MemberNameDto;
  updatedAt: string;
  updatedBy: MemberNameDto;
}

/** Action ouverte : ni Terminée ni Annulée. */
export const isOpenAction = (action: Pick<ActionDto, 'status'>) => action.status === 'todo' || action.status === 'in_progress';

/** Statuts montrés par défaut dans « Mes actions ». */
export const DEFAULT_MY_ACTIONS_STATUSES: readonly ActionStatus[] = ['todo', 'in_progress'];

export interface MyActionsFilter {
  statuses?: readonly ActionStatus[];
  /** Une seule initiative ; toutes sinon. */
  initiativeId?: string | null;
}

/**
 * Actions de l'écran « Mes actions », filtrées. Celles d'une initiative archivée
 * n'apparaissent que si l'on filtre sur cette initiative.
 */
export function selectMyActions(actions: readonly ActionDto[], filter: MyActionsFilter = {}): ActionDto[] {
  const statuses = filter.statuses ?? DEFAULT_MY_ACTIONS_STATUSES;
  return sortByDueDate(
    actions.filter(
      (a) =>
        statuses.includes(a.status) &&
        (filter.initiativeId ? a.initiative.id === filter.initiativeId : !a.initiative.archived),
    ),
  );
}

/** Échéance la plus proche d'abord, sans échéance en dernier ; à égalité, la plus ancienne créée. */
export function sortByDueDate(actions: readonly ActionDto[]): ActionDto[] {
  return [...actions].sort(
    (a, b) =>
      (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31') || a.createdAt.localeCompare(b.createdAt),
  );
}

/** Responsable possible d'une action : un membre propriétaire ou contributeur de l'initiative. */
export function canBeAssignee(role: InitiativeRole | null | undefined): boolean {
  return hasAtLeast(role, 'contributor');
}

/**
 * Techniques proposées pour une action : les 50, celles que le BABOK associe à
 * la tâche en tête, chaque groupe dans l'ordre du référentiel.
 */
export function techniqueChoices(babok: BabokDto, taskId: string): { ofTask: TechniqueDto[]; others: TechniqueDto[] } {
  const ids = babok.tasks.find((task) => task.id === taskId)?.techniqueIds ?? [];
  return {
    ofTask: babok.techniques.filter((t) => ids.includes(t.id)),
    others: babok.techniques.filter((t) => !ids.includes(t.id)),
  };
}

/**
 * Refus d'une écriture sur une action, renvoyés par l'API (`refusal`) :
 * - `assigneeNotEligible` : le responsable choisi n'est pas propriétaire ou contributeur ;
 * - `unknownBabokElement` : tâche ou technique absente du référentiel ;
 * - `linked` : l'action est liée à un autre objet ; utiliser le statut Annulée ;
 * - `suggestionNotOffered` : créée depuis une suggestion que l'encart ne propose pas (ou plus).
 */
export const ACTION_REFUSALS = ['assigneeNotEligible', 'unknownBabokElement', 'linked', 'suggestionNotOffered'] as const;
export type ActionRefusal = (typeof ACTION_REFUSALS)[number];
export const isActionRefusal = (value: unknown): value is ActionRefusal => ACTION_REFUSALS.some((r) => r === value);
