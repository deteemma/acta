// Tickets d'une initiative (tickets 17, 18 et 29, décisions 01, 03 et 11) : types,
// statuts, champs propres, Epics, filtres et tri de la liste, historique. Règles
// écrites une seule fois ici, appliquées par l'API et reproduites par la base
// (migrations 0019 et 0029). Les types et statuts ajoutés par l'administration
// sont lus dans la liste des types (ticket-type-catalog.ts).
import { z } from 'zod';
import { actionDescriptionSchema, actionTitleSchema } from './actions.js';
import type { Locale } from './i18n.js';
import { sortByReference } from './references.js';
import type { InitiativeRole } from './roles.js';
import { sameIdSet } from './requirements.js';
import { memberName, type MemberNameDto } from './schemas.js';
import { matchesEveryWord } from './search.js';
import { STAKEHOLDER_LEVELS, stakeholderIdsSchema, type StakeholderRefDto } from './stakeholders.js';
import {
  type DeliveredTicketType,
  findTicketStatus,
  findTicketType,
  isDeliveredTicketType,
  isClosedTicketStatus,
  selectableTicketStatuses,
  ticketStatusLabel,
  type TicketTypeDto,
  ticketTypeLabel,
} from './ticket-type-catalog.js';

export {
  CLOSED_TICKET_STATUSES,
  type DeliveredTicketType,
  isDeliveredTicketType,
  TICKET_STATUSES,
  TICKET_TYPES,
  type TicketStatus,
  ticketStatusLabelKey,
  type TicketType,
} from './ticket-type-catalog.js';
import type { TicketStatus, TicketType } from './ticket-type-catalog.js';

/** Ticket ouvert : son statut n'est pas fermé. */
export const isOpenTicket = (types: readonly TicketTypeDto[], ticket: { type: TicketType; status: TicketStatus }) =>
  !isClosedTicketStatus(types, ticket.type, ticket.status);

/** Champs qui dépendent du type : `babok` pour la tâche et la technique, `riskLevels` pour la probabilité et l'impact. */
export type TicketTypeField = 'epic' | 'babok' | 'questionedStakeholders' | 'riskLevels';

const TICKET_TYPE_FIELDS: Record<DeliveredTicketType, readonly TicketTypeField[]> = {
  action: ['epic', 'babok'],
  question: ['epic', 'questionedStakeholders'],
  decision: ['epic'],
  risk: ['epic', 'riskLevels'],
  change_request: ['epic'],
  epic: [],
};

/** Un type ajouté n'a que les champs communs, dont l'Epic. */
export const ticketHasField = (type: TicketType, field: TicketTypeField) =>
  (isDeliveredTicketType(type) ? TICKET_TYPE_FIELDS[type] : ['epic']).includes(field);

/** Le responsable n'est obligatoire que pour l'Action. */
export const isAssigneeRequired = (type: TicketType) => type === 'action';

/** Types proposés par « Nouveau ticket » : les actifs ; dans un Epic, seulement ceux qui peuvent y entrer. */
export const newTicketTypes = (types: readonly TicketTypeDto[], inEpic: boolean): TicketTypeDto[] =>
  types.filter((type) => type.active && (!inEpic || ticketHasField(type.code, 'epic')));

/** Création rapide : type et titre, pour les types actifs sans autre champ obligatoire, donc pas l'Action. */
export const quickCreateTicketTypes = (types: readonly TicketTypeDto[]): TicketTypeDto[] =>
  types.filter((type) => type.active && type.code !== 'action');

/** Probabilité et impact d'un Risque : faible, moyen ou fort, aucune criticité calculée. */
export const RISK_LEVELS = STAKEHOLDER_LEVELS;
export type RiskLevel = (typeof RISK_LEVELS)[number];

const commonTicketFields = {
  title: actionTitleSchema,
  description: actionDescriptionSchema,
  assigneeId: z.string().min(1).nullable(),
  dueDate: z.iso.date().nullable(),
  epicId: z.uuid().nullable(),
  /** Remplace l'ensemble des parties prenantes interrogées (Question). */
  questionedStakeholderIds: stakeholderIdsSchema,
  probability: z.enum(RISK_LEVELS).nullable(),
  impact: z.enum(RISK_LEVELS).nullable(),
};

/** Création par la route générique : tout ticket sauf l'Action, dans le statut initial de son type. */
export const createTicketSchema = z.object({
  /** L'Action garde sa route (`/actions`). */
  type: z
    .string()
    .min(1)
    .refine((type) => type !== 'action'),
  title: commonTicketFields.title,
  description: commonTicketFields.description.optional(),
  assigneeId: commonTicketFields.assigneeId.optional(),
  dueDate: commonTicketFields.dueDate.optional(),
  epicId: commonTicketFields.epicId.optional(),
  questionedStakeholderIds: commonTicketFields.questionedStakeholderIds.optional(),
  probability: commonTicketFields.probability.optional(),
  impact: commonTicketFields.impact.optional(),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

/** Modification : seuls les champs fournis changent. Le type, lui, ne change plus. */
export const updateTicketSchema = z
  .object({ ...commonTicketFields, status: z.string().min(1) })
  .partial();
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

/**
 * Refus d'une écriture sur un ticket, renvoyés par l'API (`refusal`) :
 * - `statusNotOfType` : ce statut n'appartient pas au type du ticket ;
 * - `fieldNotOfType` : ce type n'a pas ce champ propre ;
 * - `epicInEpic` : un Epic ne rejoint pas un Epic ;
 * - `unknownEpic` : cet Epic n'existe pas dans l'initiative ;
 * - `epicHasTickets` : un Epic qui contient des tickets ne se supprime pas ;
 * - `ticketLinked` : le ticket est lié à un autre objet ;
 * - `inactiveStatus` : le statut est désactivé, il n'est plus attribué ;
 * - `inactiveType` : le type est désactivé, il n'est plus proposé à la création ;
 * - `unknownType` : le type n'existe pas.
 */
export const TICKET_REFUSALS = [
  'statusNotOfType',
  'fieldNotOfType',
  'epicInEpic',
  'unknownEpic',
  'epicHasTickets',
  'ticketLinked',
  'inactiveStatus',
  'inactiveType',
  'unknownType',
] as const;
export type TicketRefusal = (typeof TICKET_REFUSALS)[number];
export const isTicketRefusal = (value: unknown): value is TicketRefusal => TICKET_REFUSALS.some((r) => r === value);

/** Vérifie le type d'un ticket à créer ; null s'il est permis : un type actif. */
export function checkTicketCreation(types: readonly TicketTypeDto[], type: TicketType): TicketRefusal | null {
  const found = findTicketType(types, type);
  if (!found) return 'unknownType';
  return found.active ? null : 'inactiveType';
}

/**
 * Vérifie les champs saisis d'après le type du ticket et son statut actuel (null :
 * ticket à créer) ; null s'ils sont permis. Un champ propre vide est permis. Un
 * statut désactivé n'est plus attribué, mais le ticket qui le porte le garde.
 */
export function checkTicketFields(
  types: readonly TicketTypeDto[],
  type: TicketType,
  input: Pick<UpdateTicketInput, 'status' | 'epicId' | 'questionedStakeholderIds' | 'probability' | 'impact'>,
  current: TicketStatus | null,
): TicketRefusal | null {
  if (input.status !== undefined) {
    if (!findTicketStatus(types, type, input.status)) return 'statusNotOfType';
    if (!selectableTicketStatuses(types, type, current).some((s) => s.code === input.status)) return 'inactiveStatus';
  }
  if (!ticketHasField(type, 'epic') && input.epicId) return 'epicInEpic';
  if (!ticketHasField(type, 'questionedStakeholders') && input.questionedStakeholderIds?.length) return 'fieldNotOfType';
  if (!ticketHasField(type, 'riskLevels') && (input.probability || input.impact)) return 'fieldNotOfType';
  return null;
}

/** Epic d'un ticket, tel qu'il s'affiche. */
export interface TicketEpicRef {
  id: string;
  reference: string;
  title: string;
}

/** Ticket tel que renvoyé par la route générique (l'Action a son propre ActionDto). */
export interface TicketDto {
  id: string;
  initiative: { id: string; code: string; name: string; archived: boolean; myRole: InitiativeRole };
  type: TicketType;
  reference: string;
  title: string;
  /** Texte mis en forme (voir rich-text.ts) ; null si vide. */
  description: string | null;
  status: TicketStatus;
  /** `eligible` : encore propriétaire ou contributeur de l'initiative. */
  assignee: (MemberNameDto & { eligible: boolean }) | null;
  /** AAAA-MM-JJ */
  dueDate: string | null;
  epic: TicketEpicRef | null;
  /** Question : parties prenantes interrogées, par ordre alphabétique. */
  questionedStakeholders: StakeholderRefDto[];
  /** Risque. */
  probability: RiskLevel | null;
  impact: RiskLevel | null;
  createdAt: string;
  createdBy: MemberNameDto;
  updatedAt: string;
  updatedBy: MemberNameDto;
}

/** Ligne de la liste des tickets. */
export interface TicketRow {
  id: string;
  type: TicketType;
  reference: string;
  title: string;
  status: TicketStatus;
  /** `eligible` : encore propriétaire ou contributeur de l'initiative. */
  assignee: (MemberNameDto & { eligible: boolean }) | null;
  /** AAAA-MM-JJ */
  dueDate: string | null;
  epic: TicketEpicRef | null;
  createdAt: string;
}

/** Une échéance est dépassée à partir du lendemain, tant que le ticket est ouvert. */
export function isOverdueTicket(
  types: readonly TicketTypeDto[],
  ticket: Pick<TicketRow, 'type' | 'status' | 'dueDate'>,
  today: string,
): boolean {
  return ticket.dueDate != null && ticket.dueDate < today && isOpenTicket(types, ticket);
}

export const TICKET_STATES = ['open', 'closed', 'all'] as const;
export type TicketState = (typeof TICKET_STATES)[number];

/** Valeur des filtres responsable et Epic : aucun des deux renseigné. */
export const TICKET_FILTER_NONE = 'none';

/** Filtres de la liste ; une chaîne vide signifie « tous ». */
export interface TicketFilters {
  /** Sur le titre et la référence. */
  text: string;
  type: TicketType | '';
  state: TicketState;
  /** Proposé une fois un type choisi. */
  status: TicketStatus | '';
  /** Identifiant du responsable, ou TICKET_FILTER_NONE. */
  assignee: string;
  /** Identifiant de l'Epic, ou TICKET_FILTER_NONE. */
  epic: string;
}

export const DEFAULT_TICKET_FILTERS: TicketFilters = { text: '', type: '', state: 'open', status: '', assignee: '', epic: '' };

/**
 * Applique un changement de filtre : un statut n'a de sens que pour un type et un
 * état donnés, il s'efface s'ils changent ; le choisir montre aussi les fermés.
 */
export function changeTicketFilters(filters: TicketFilters, change: Partial<TicketFilters>): TicketFilters {
  const next = { ...filters, ...change };
  if ('type' in change || 'state' in change) return { ...next, status: '' };
  return change.status ? { ...next, state: 'all' } : next;
}

const matchesFilter = (filter: string, id: string | undefined) =>
  !filter || (filter === TICKET_FILTER_NONE ? id === undefined : filter === id);

function matchesState(types: readonly TicketTypeDto[], state: TicketState, ticket: TicketRow): boolean {
  if (state === 'all') return true;
  return isOpenTicket(types, ticket) === (state === 'open');
}

export function selectTickets(
  types: readonly TicketTypeDto[],
  tickets: readonly TicketRow[],
  filters: TicketFilters,
): TicketRow[] {
  return tickets.filter(
    (ticket) =>
      matchesEveryWord(`${ticket.reference} ${ticket.title}`, filters.text) &&
      (!filters.type || ticket.type === filters.type) &&
      matchesState(types, filters.state, ticket) &&
      (!filters.status || ticket.status === filters.status) &&
      matchesFilter(filters.assignee, ticket.assignee?.userId) &&
      matchesFilter(filters.epic, ticket.epic?.id) &&
      // Un Epic ne peut pas avoir d'Epic : « Sans Epic » ne le montre pas.
      !(filters.epic === TICKET_FILTER_NONE && ticket.type === 'epic'),
  );
}

/** Responsables proposés par le filtre : ceux des tickets, anciens membres compris. */
export function ticketAssigneeOptions(tickets: readonly TicketRow[], locale: Locale): MemberNameDto[] {
  const assignees = new Map(tickets.flatMap((t) => (t.assignee ? [[t.assignee.userId, t.assignee] as const] : [])));
  return [...assignees.values()].sort((a, b) => memberName(a).localeCompare(memberName(b), locale));
}

/** Epics de l'initiative, par référence, même encore vides : ceux des tickets et les tickets de type Epic. */
export function ticketEpicOptions(tickets: readonly TicketRow[]): TicketEpicRef[] {
  const epics = new Map<string, TicketEpicRef>();
  for (const { id, type, reference, title, epic } of tickets) {
    if (epic) epics.set(epic.id, epic);
    if (type === 'epic') epics.set(id, { id, reference, title });
  }
  return sortByReference([...epics.values()]);
}

/** Tickets d'un Epic : ses fermés sur le total, à titre d'information ; le statut de l'Epic ne s'en déduit pas. */
export function epicProgress(
  types: readonly TicketTypeDto[],
  tickets: readonly TicketRow[],
  epicId: string,
): { closed: number; total: number } {
  const own = tickets.filter((t) => t.epic?.id === epicId);
  return { closed: own.filter((t) => !isOpenTicket(types, t)).length, total: own.length };
}

export interface TicketEpicGroup {
  epic: TicketRow;
  /** Tickets montrés par les filtres, dans l'ordre reçu. */
  tickets: TicketRow[];
  /** Progression sur tous les tickets de l'Epic, filtres ou non. */
  closed: number;
  total: number;
}

/**
 * Regroupement de la liste par Epic : les Epics par référence, puis les tickets
 * sans Epic. Un Epic y figure si les filtres le montrent lui-même, même vide, ou
 * si au moins un de ses tickets est montré.
 */
export function groupTicketsByEpic(
  types: readonly TicketTypeDto[],
  all: readonly TicketRow[],
  shown: readonly TicketRow[],
): { epics: TicketEpicGroup[]; withoutEpic: TicketRow[] } {
  const members = shown.filter((t) => t.type !== 'epic');
  const shownIds = new Set(shown.map((t) => t.id));
  const epics = sortByReference(all.filter((t) => t.type === 'epic'))
    .map((epic) => ({
      epic,
      tickets: members.filter((t) => t.epic?.id === epic.id),
      ...epicProgress(types, all, epic.id),
    }))
    .filter((group) => group.tickets.length > 0 || shownIds.has(group.epic.id));
  return { epics, withoutEpic: members.filter((t) => !t.epic) };
}

export const TICKET_SORT_KEYS = ['reference', 'type', 'title', 'status', 'assignee', 'dueDate', 'epic'] as const;
export type TicketSortKey = (typeof TICKET_SORT_KEYS)[number];

export interface TicketSort {
  key: TicketSortKey;
  direction: 'asc' | 'desc';
}

/** Tri par défaut : par échéance. */
export const DEFAULT_TICKET_SORT: TicketSort = { key: 'dueDate', direction: 'asc' };

/** Une colonne se trie d'abord en ordre croissant ; la recliquer inverse le sens. */
export function toggleTicketSort(sort: TicketSort, key: TicketSortKey): TicketSort {
  return { key, direction: sort.key === key && sort.direction === 'asc' ? 'desc' : 'asc' };
}

/** Valeur de tri, telle qu'elle est affichée ; null si le ticket n'en a pas. */
function sortValue(types: readonly TicketTypeDto[], ticket: TicketRow, key: TicketSortKey, locale: Locale): string | null {
  switch (key) {
    case 'reference':
      return ticket.reference;
    case 'type':
      return ticketTypeLabel(types, ticket.type, locale);
    case 'title':
      return ticket.title;
    case 'status':
      return ticketStatusLabel(types, ticket.type, ticket.status, locale);
    case 'assignee':
      return ticket.assignee && memberName(ticket.assignee);
    case 'dueDate':
      return ticket.dueDate;
    case 'epic':
      return ticket.epic?.title ?? null;
  }
}

/** Tickets triés : sans valeur en dernier dans les deux sens ; à égalité, l'échéance puis la date de création départagent. */
export function sortTickets(
  types: readonly TicketTypeDto[],
  tickets: readonly TicketRow[],
  sort: TicketSort,
  locale: Locale,
): TicketRow[] {
  const compareValues = (a: TicketRow, b: TicketRow, key: TicketSortKey, sign: 1 | -1) => {
    const [left, right] = [sortValue(types, a, key, locale), sortValue(types, b, key, locale)];
    if (left === null || right === null) return Number(left === null) - Number(right === null);
    return sign * left.localeCompare(right, locale, { numeric: true });
  };
  return [...tickets].sort(
    (a, b) =>
      compareValues(a, b, sort.key, sort.direction === 'asc' ? 1 : -1) ||
      compareValues(a, b, 'dueDate', 1) ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

/** État des champs d'un ticket, enregistré par la base à chaque modification (migrations 0018, 0019). */
export interface TicketSnapshot {
  title: string;
  description: string | null;
  status: TicketStatus;
  /** Action. */
  taskId: string | null;
  techniqueId: string | null;
  /** Action : technique agile (Extension Agile, D16). */
  agileTechniqueId: string | null;
  dueDate: string | null;
  /** Risque. */
  probability: RiskLevel | null;
  impact: RiskLevel | null;
  assignee: MemberNameDto | null;
  epic: TicketEpicRef | null;
  /** Action : parties prenantes concernées. */
  stakeholders: StakeholderRefDto[];
  /** Question : parties prenantes interrogées. */
  questionedStakeholders: StakeholderRefDto[];
}

/** Modification d'un ticket, telle que renvoyée par l'API, la plus ancienne d'abord. */
export interface TicketVersionDto {
  changedAt: string;
  changedBy: MemberNameDto;
  before: TicketSnapshot;
  after: TicketSnapshot;
}

/** Champ modifié : ancienne et nouvelle valeur. */
export type TicketChange = {
  [F in keyof TicketSnapshot]: { field: F; from: TicketSnapshot[F]; to: TicketSnapshot[F] };
}[keyof TicketSnapshot];

export interface TicketHistoryEntry {
  changedAt: string;
  changedBy: MemberNameDto;
  changes: TicketChange[];
}

const TICKET_VALUE_FIELDS = ['title', 'description', 'status', 'taskId', 'techniqueId', 'agileTechniqueId', 'dueDate', 'probability', 'impact'] as const;
const TICKET_STAKEHOLDER_FIELDS = ['stakeholders', 'questionedStakeholders'] as const;

function ticketChangesBetween(before: TicketSnapshot, after: TicketSnapshot): TicketChange[] {
  const changes: TicketChange[] = [];
  for (const field of TICKET_VALUE_FIELDS) {
    if (before[field] !== after[field]) changes.push({ field, from: before[field], to: after[field] } as TicketChange);
  }
  // Une personne, un Epic ou une partie prenante change si c'en est un autre, pas si son nom a changé.
  if (before.assignee?.userId !== after.assignee?.userId) {
    changes.push({ field: 'assignee', from: before.assignee, to: after.assignee });
  }
  if (before.epic?.id !== after.epic?.id) changes.push({ field: 'epic', from: before.epic, to: after.epic });
  for (const field of TICKET_STAKEHOLDER_FIELDS) {
    if (!sameIdSet(before[field], after[field])) changes.push({ field, from: before[field], to: after[field] });
  }
  return changes;
}

/**
 * Historique d'un ticket d'après ses modifications (la plus ancienne d'abord), la
 * plus récente en tête. Pour une action reprise de la phase 1, il commence à la
 * première modification qui suit le passage au ticket : aucune entrée n'est
 * reconstituée. Les liens n'y figurent pas.
 */
export function ticketHistory(versions: readonly TicketVersionDto[]): TicketHistoryEntry[] {
  return versions
    .map(({ changedAt, changedBy, before, after }) => ({ changedAt, changedBy, changes: ticketChangesBetween(before, after) }))
    .filter((entry) => entry.changes.length > 0)
    .reverse();
}
