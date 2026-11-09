// Tickets d'une initiative (tickets 17 et 18, décisions 01, 03 et 11) : types,
// statuts, champs propres, Epics, filtres et tri de la liste, historique. Règles
// écrites une seule fois ici, appliquées par l'API et reproduites par la base
// (migration 0019).
import { z } from 'zod';
import { ACTION_STATUSES, actionDescriptionSchema, actionTitleSchema, CLOSED_ACTION_STATUSES } from './actions.js';
import { type Locale, type MessageKey, translate } from './i18n.js';
import { sortByReference } from './references.js';
import type { InitiativeRole } from './roles.js';
import { sameIdSet } from './requirements.js';
import { memberName, type MemberNameDto } from './schemas.js';
import { matchesEveryWord } from './search.js';
import { STAKEHOLDER_LEVELS, stakeholderIdsSchema, type StakeholderRefDto } from './stakeholders.js';

/** Types livrés, dans l'ordre affiché ; un ticket garde son type à vie. */
export const TICKET_TYPES = ['action', 'question', 'decision', 'risk', 'change_request', 'epic'] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

/** Types sans autre champ obligatoire que le titre, créés par la route générique. L'Action garde la sienne. */
export const GENERIC_TICKET_TYPES = ['question', 'decision', 'risk', 'change_request', 'epic'] as const;
export type GenericTicketType = (typeof GENERIC_TICKET_TYPES)[number];

/** Statuts de chaque type, dans l'ordre affiché ; le premier est le statut initial, tout statut peut passer à tout autre. */
export const TICKET_STATUSES = {
  action: ACTION_STATUSES,
  question: ['open', 'on_hold', 'answered', 'closed', 'rejected'],
  decision: ['proposed', 'on_hold', 'agreed', 'rejected'],
  risk: ['identified', 'on_hold', 'addressed', 'closed'],
  change_request: ['submitted', 'analysed', 'on_hold', 'accepted', 'rejected'],
  epic: ['todo', 'in_progress', 'on_hold', 'done', 'cancelled'],
} as const satisfies Record<TicketType, readonly string[]>;
export type TicketStatus = (typeof TICKET_STATUSES)[TicketType][number];

/** Statuts fermés : le ticket est terminé. En attente n'en fait jamais partie. */
const CLOSED_TICKET_STATUSES: Record<TicketType, readonly TicketStatus[]> = {
  action: CLOSED_ACTION_STATUSES,
  question: ['closed', 'rejected'],
  decision: ['agreed', 'rejected'],
  risk: ['closed'],
  change_request: ['accepted', 'rejected'],
  epic: ['done', 'cancelled'],
};

export const isOpenTicket = (ticket: { type: TicketType; status: TicketStatus }) =>
  !CLOSED_TICKET_STATUSES[ticket.type].includes(ticket.status);

export const isTicketStatusOf = (type: TicketType, status: string): boolean =>
  (TICKET_STATUSES[type] as readonly string[]).includes(status);

/** Libellé d'un statut, qui dépend du type (Terminée pour l'Action, Terminé pour l'Epic). */
export function ticketStatusLabelKey(type: TicketType, status: TicketStatus): MessageKey {
  return (type === 'action' ? `actionStatus.${status}` : `ticketStatus.${type}.${status}`) as MessageKey;
}

/** Champs qui dépendent du type : `babok` pour la tâche et la technique, `riskLevels` pour la probabilité et l'impact. */
export type TicketTypeField = 'epic' | 'babok' | 'questionedStakeholders' | 'riskLevels';

const TICKET_TYPE_FIELDS: Record<TicketType, readonly TicketTypeField[]> = {
  action: ['epic', 'babok'],
  question: ['epic', 'questionedStakeholders'],
  decision: ['epic'],
  risk: ['epic', 'riskLevels'],
  change_request: ['epic'],
  epic: [],
};

export const ticketHasField = (type: TicketType, field: TicketTypeField) => TICKET_TYPE_FIELDS[type].includes(field);

/** Le responsable n'est obligatoire que pour l'Action. */
export const isAssigneeRequired = (type: TicketType) => type === 'action';

/** Création rapide : type et titre, pour les types sans autre champ obligatoire. */
export const QUICK_CREATE_TICKET_TYPES = GENERIC_TICKET_TYPES;

/** Types proposés par « Nouveau ticket » ; dans un Epic, seulement ceux qui peuvent y entrer. */
export const newTicketTypes = (inEpic: boolean): readonly TicketType[] =>
  inEpic ? TICKET_TYPES.filter((type) => ticketHasField(type, 'epic')) : TICKET_TYPES;

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
  type: z.enum(GENERIC_TICKET_TYPES),
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
 * - `ticketLinked` : le ticket est lié à un autre objet.
 */
export const TICKET_REFUSALS = ['statusNotOfType', 'fieldNotOfType', 'epicInEpic', 'unknownEpic', 'epicHasTickets', 'ticketLinked'] as const;
export type TicketRefusal = (typeof TICKET_REFUSALS)[number];
export const isTicketRefusal = (value: unknown): value is TicketRefusal => TICKET_REFUSALS.some((r) => r === value);

/** Vérifie les champs saisis d'après le type du ticket ; null s'ils sont permis. Un champ propre vide est permis. */
export function checkTicketFields(
  type: TicketType,
  input: Pick<UpdateTicketInput, 'status' | 'epicId' | 'questionedStakeholderIds' | 'probability' | 'impact'>,
): TicketRefusal | null {
  if (input.status !== undefined && !isTicketStatusOf(type, input.status)) return 'statusNotOfType';
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
export function isOverdueTicket(ticket: Pick<TicketRow, 'type' | 'status' | 'dueDate'>, today: string): boolean {
  return ticket.dueDate != null && ticket.dueDate < today && isOpenTicket(ticket);
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

function matchesState(state: TicketState, ticket: TicketRow): boolean {
  if (state === 'all') return true;
  return isOpenTicket(ticket) === (state === 'open');
}

export function selectTickets(tickets: readonly TicketRow[], filters: TicketFilters): TicketRow[] {
  return tickets.filter(
    (ticket) =>
      matchesEveryWord(`${ticket.reference} ${ticket.title}`, filters.text) &&
      (!filters.type || ticket.type === filters.type) &&
      matchesState(filters.state, ticket) &&
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
export function epicProgress(tickets: readonly TicketRow[], epicId: string): { closed: number; total: number } {
  const own = tickets.filter((t) => t.epic?.id === epicId);
  return { closed: own.filter((t) => !isOpenTicket(t)).length, total: own.length };
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
  all: readonly TicketRow[],
  shown: readonly TicketRow[],
): { epics: TicketEpicGroup[]; withoutEpic: TicketRow[] } {
  const members = shown.filter((t) => t.type !== 'epic');
  const shownIds = new Set(shown.map((t) => t.id));
  const epics = sortByReference(all.filter((t) => t.type === 'epic'))
    .map((epic) => ({
      epic,
      tickets: members.filter((t) => t.epic?.id === epic.id),
      ...epicProgress(all, epic.id),
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
function sortValue(ticket: TicketRow, key: TicketSortKey, locale: Locale): string | null {
  switch (key) {
    case 'reference':
      return ticket.reference;
    case 'type':
      return translate(locale, `ticketType.${ticket.type}`);
    case 'title':
      return ticket.title;
    case 'status':
      return translate(locale, ticketStatusLabelKey(ticket.type, ticket.status));
    case 'assignee':
      return ticket.assignee && memberName(ticket.assignee);
    case 'dueDate':
      return ticket.dueDate;
    case 'epic':
      return ticket.epic?.title ?? null;
  }
}

/** Tickets triés : sans valeur en dernier dans les deux sens ; à égalité, l'échéance puis la date de création départagent. */
export function sortTickets(tickets: readonly TicketRow[], sort: TicketSort, locale: Locale): TicketRow[] {
  const compareValues = (a: TicketRow, b: TicketRow, key: TicketSortKey, sign: 1 | -1) => {
    const [left, right] = [sortValue(a, key, locale), sortValue(b, key, locale)];
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

const TICKET_VALUE_FIELDS = ['title', 'description', 'status', 'taskId', 'techniqueId', 'dueDate', 'probability', 'impact'] as const;
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
