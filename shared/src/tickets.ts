// Écran Tickets d'une initiative (ticket 17, décision 11) : filtres et tri de la
// liste. L'Action est le seul type pour l'instant ; les autres types, leurs
// statuts et les Epics arrivent avec le ticket 18.
import { type ActionDto, type ActionStatus, isOpenAction } from './actions.js';
import { type Locale, translate } from './i18n.js';
import { sortByReference } from './references.js';
import { memberName, type MemberNameDto } from './schemas.js';
import { matchesEveryWord } from './search.js';

export const TICKET_TYPES = ['action'] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

/** Ligne de la liste des tickets. */
export interface TicketRow {
  id: string;
  type: TicketType;
  reference: string;
  title: string;
  status: ActionStatus;
  /** `eligible` : encore propriétaire ou contributeur de l'initiative. */
  assignee: (MemberNameDto & { eligible: boolean }) | null;
  /** AAAA-MM-JJ */
  dueDate: string | null;
  epic: { id: string; reference: string; title: string } | null;
  createdAt: string;
}

export function actionToTicketRow(action: ActionDto): TicketRow {
  const { id, reference, title, status, assignee, dueDate, createdAt } = action;
  return { id, type: 'action', reference, title, status, assignee, dueDate, epic: null, createdAt };
}

/** Une échéance est dépassée à partir du lendemain, tant que le ticket est ouvert. */
export function isOverdueTicket(ticket: Pick<TicketRow, 'status' | 'dueDate'>, today: string): boolean {
  return ticket.dueDate != null && ticket.dueDate < today && isOpenAction(ticket);
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
  status: ActionStatus | '';
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
  return isOpenAction(ticket) === (state === 'open');
}

export function selectTickets(tickets: readonly TicketRow[], filters: TicketFilters): TicketRow[] {
  return tickets.filter(
    (ticket) =>
      matchesEveryWord(`${ticket.reference} ${ticket.title}`, filters.text) &&
      (!filters.type || ticket.type === filters.type) &&
      matchesState(filters.state, ticket) &&
      (!filters.status || ticket.status === filters.status) &&
      matchesFilter(filters.assignee, ticket.assignee?.userId) &&
      matchesFilter(filters.epic, ticket.epic?.id),
  );
}

/** Responsables proposés par le filtre : ceux des tickets, anciens membres compris. */
export function ticketAssigneeOptions(tickets: readonly TicketRow[], locale: Locale): MemberNameDto[] {
  const assignees = new Map(tickets.flatMap((t) => (t.assignee ? [[t.assignee.userId, t.assignee] as const] : [])));
  return [...assignees.values()].sort((a, b) => memberName(a).localeCompare(memberName(b), locale));
}

/** Epics proposés par le filtre : ceux des tickets, par référence. */
export function ticketEpicOptions(tickets: readonly TicketRow[]): NonNullable<TicketRow['epic']>[] {
  const epics = new Map(tickets.flatMap((t) => (t.epic ? [[t.epic.id, t.epic] as const] : [])));
  return sortByReference([...epics.values()]);
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
      return translate(locale, `actionStatus.${ticket.status}`);
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
