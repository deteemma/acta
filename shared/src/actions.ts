// Actions (ticket 07) : unité de travail d'un BA, toujours rattachée à une tâche
// BABOK. Règles écrites une seule fois ici, appliquées par l'API et reproduites
// par la base (migration 0010).
import { z } from 'zod';
import type { BabokDto, TechniqueDto } from './babok.js';
import { can, hasAtLeast, type InitiativeRole } from './roles.js';
import { needIdsSchema, type NeedRefDto } from './needs.js';
import { requirementIdsSchema, type RequirementRefDto } from './requirements.js';
import type { InitiativeDto, MemberNameDto } from './schemas.js';
import { stakeholderIdsSchema, type StakeholderRefDto } from './stakeholders.js';
import {
  CLOSED_TICKET_STATUSES,
  findTicketType,
  isClosedTicketStatus,
  TICKET_STATUSES,
  type TicketTypeDto,
} from './ticket-type-catalog.js';
import type { TicketEpicRef } from './tickets.js';

/**
 * Statuts livrés d'une action, dans l'ordre affiché, avant ceux qu'ajoute
 * l'administration (ticket 29) ; tout statut peut passer à tout autre.
 */
export const ACTION_STATUSES = TICKET_STATUSES.action;
/** Code d'un statut : livré, ou identifiant d'un statut ajouté (ticket-type-catalog.ts). */
export type ActionStatus = string;
export const actionStatusSchema = z.string().min(1);

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

/** Identifiant d'une technique agile du référentiel de l'Extension Agile (`ae-7.15`). */
const agileTechniqueIdSchema = z.string().regex(/^ae-\d+\.\d+$/);

/**
 * Création d'une action : la création rapide fournit le titre et la tâche ; le
 * responsable est alors la personne qui crée l'action.
 */
export const createActionSchema = z
  .object({
    title: actionTitleSchema,
    taskId: babokIdSchema,
    techniqueId: babokIdSchema.nullable().optional(),
    /** Seulement si l'Extension Agile est activée sur l'initiative (Extension Agile, D14). */
    agileTechniqueId: agileTechniqueIdSchema.nullable().optional(),
    assigneeId: z.string().min(1).optional(),
    dueDate: z.iso.date().nullable().optional(),
    epicId: z.uuid().nullable().optional(),
    description: actionDescriptionSchema.optional(),
    stakeholderIds: stakeholderIdsSchema.optional(),
    needIds: needIdsSchema.optional(),
    requirementIds: requirementIdsSchema.optional(),
    /** Suggestion de l'encart d'où l'action est créée (ticket 14) ; ne change plus. */
    suggestionKey: suggestionKeySchema.optional(),
  })
  // Créée depuis une action suggérée : pas de technique agile ; elle peut en
  // recevoir une ensuite, en modification (Extension Agile, D16).
  .refine((input) => !input.suggestionKey || !input.agileTechniqueId, { path: ['agileTechniqueId'] });
export type CreateActionInput = z.infer<typeof createActionSchema>;

/** Modification d'une action : seuls les champs fournis changent. */
export const updateActionSchema = z
  .object({
    title: actionTitleSchema,
    description: actionDescriptionSchema,
    taskId: babokIdSchema,
    techniqueId: babokIdSchema.nullable(),
    agileTechniqueId: agileTechniqueIdSchema.nullable(),
    assigneeId: z.string().min(1),
    dueDate: z.iso.date().nullable(),
    epicId: z.uuid().nullable(),
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
  initiative: {
    id: string;
    code: string;
    name: string;
    archived: boolean;
    myRole: InitiativeRole;
    /** Le champ « Technique agile » n'apparaît que si l'Extension Agile est activée (D14). */
    agileExtensionEnabled: boolean;
  };
  /** Référence attribuée par la base (CODE-AC-NNN), en lecture seule. */
  reference: string;
  title: string;
  /** Texte mis en forme (voir rich-text.ts) ; null si vide. */
  description: string | null;
  /** Tâche BABOK (identifiant du référentiel, ex. `4.1`). */
  taskId: string;
  techniqueId: string | null;
  /** Technique agile (identifiant du référentiel agile, ex. `ae-7.15`), Extension Agile D14. */
  agileTechniqueId: string | null;
  /** `eligible` : encore propriétaire ou contributeur de l'initiative. */
  assignee: MemberNameDto & { eligible: boolean };
  /** Auteur et date de la dernière attribution (ticket 15). */
  assignedBy: MemberNameDto;
  assignedAt: string;
  /** AAAA-MM-JJ */
  dueDate: string | null;
  status: ActionStatus;
  /** Epic, le cas échéant (ticket 18). */
  epic: TicketEpicRef | null;
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

/** Statuts livrés fermés : l'action est terminée. En attente n'en fait pas partie. */
export const CLOSED_ACTION_STATUSES: readonly ActionStatus[] = CLOSED_TICKET_STATUSES.action;

/** Action ouverte : son statut n'est pas fermé (ni Terminée, ni Annulée, ni un statut fermé ajouté). */
export const isOpenAction = (types: readonly TicketTypeDto[], action: Pick<ActionDto, 'status'>) =>
  !isClosedTicketStatus(types, 'action', action.status);

/** Tous les statuts de l'Action, dans l'ordre : livrés, puis ajoutés. */
export const actionStatuses = (types: readonly TicketTypeDto[]): ActionStatus[] =>
  findTicketType(types, 'action')?.statuses.map((s) => s.code) ?? [...ACTION_STATUSES];

/** Statuts montrés par défaut dans « Mes actions » : ceux qui ne sont pas fermés. */
export const defaultMyActionsStatuses = (types: readonly TicketTypeDto[]): ActionStatus[] =>
  actionStatuses(types).filter((status) => isOpenAction(types, { status }));

export interface MyActionsFilter {
  statuses?: readonly ActionStatus[];
  /** Une seule initiative ; toutes sinon. */
  initiativeId?: string | null;
}

/** Filtre de « Mes actions » : coche ou décoche un statut, dans l'ordre des statuts. */
export function toggleActionStatus(
  types: readonly TicketTypeDto[],
  current: readonly ActionStatus[],
  status: ActionStatus,
): ActionStatus[] {
  return current.includes(status)
    ? current.filter((s) => s !== status)
    : actionStatuses(types).filter((s) => s === status || current.includes(s));
}

/**
 * Actions de l'écran « Mes actions », filtrées. Celles d'une initiative archivée
 * n'apparaissent que si l'on filtre sur cette initiative.
 */
export function selectMyActions(
  types: readonly TicketTypeDto[],
  actions: readonly ActionDto[],
  filter: MyActionsFilter = {},
): ActionDto[] {
  const statuses = filter.statuses ?? defaultMyActionsStatuses(types);
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

/** Initiative proposée à la création d'une action : on peut y écrire des actions (propriétaire ou contributeur, non archivée). */
export function canCreateActionIn(initiative: Pick<InitiativeDto, 'myRole' | 'archivedAt'>): boolean {
  return can(initiative.myRole, 'editActions', { archived: initiative.archivedAt != null });
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
 * Une action ne porte une technique agile que dans une initiative où l'Extension
 * Agile est activée : le champ n'y apparaît et ne s'y enregistre qu'alors (D6, D14).
 */
export const offersAgileTechnique = (initiative: { agileExtensionEnabled: boolean }) => initiative.agileExtensionEnabled;

/**
 * Technique agile à envoyer avec la fiche d'une action : la valeur choisie (vide =
 * « Aucune »), ou rien si le champ n'est pas proposé ; une valeur cachée n'écrase
 * jamais celle qui est enregistrée.
 */
export const agileTechniqueInput = (
  initiative: { agileExtensionEnabled: boolean },
  agileTechniqueId: string,
): { agileTechniqueId?: string | null } =>
  offersAgileTechnique(initiative) ? { agileTechniqueId: agileTechniqueId || null } : {};

/**
 * Refus d'une écriture sur une action, renvoyés par l'API (`refusal`) :
 * - `assigneeNotEligible` : le responsable choisi n'est pas propriétaire ou contributeur ;
 * - `unknownBabokElement` : tâche ou technique absente du référentiel ;
 * - `linked` : l'action est liée à un autre objet ; utiliser le statut Annulée ;
 * - `suggestionNotOffered` : créée depuis une suggestion que l'encart ne propose pas (ou plus) ;
 * - `agileExtensionDisabled` : technique agile dans une initiative où l'Extension Agile n'est pas activée (D14).
 */
export const ACTION_REFUSALS = [
  'assigneeNotEligible',
  'unknownBabokElement',
  'linked',
  'suggestionNotOffered',
  'agileExtensionDisabled',
] as const;
export type ActionRefusal = (typeof ACTION_REFUSALS)[number];
export const isActionRefusal = (value: unknown): value is ActionRefusal => ACTION_REFUSALS.some((r) => r === value);
