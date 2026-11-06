// Écran Tickets d'une initiative (ticket 17, décision 11) : tableau filtrable et
// triable, liste compacte sur petit écran ; la fiche s'ouvre en panneau à côté.
// Règles de filtre et de tri dans @app/shared (tickets.ts).
import {
  actionToTicketRow,
  changeTicketFilters,
  DEFAULT_TICKET_FILTERS,
  DEFAULT_TICKET_SORT,
  type InitiativeDto,
  isOverdueTicket,
  localDate,
  memberName,
  ACTION_STATUSES,
  selectTickets,
  sortTickets,
  TICKET_FILTER_NONE,
  TICKET_SORT_KEYS,
  TICKET_STATES,
  TICKET_TYPES,
  ticketAssigneeOptions,
  ticketEpicOptions,
  type TicketFilters,
  type TicketRow,
  type TicketSort,
  type TicketSortKey,
  toggleTicketSort,
} from '@app/shared';
import { ArrowDown, ArrowUp, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { StatusLabel } from './action-panels';
import { api, ApiError } from './api';
import { EmptyState } from './empty-state';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { formatDate } from './initiative-panels';
import { usePanels } from './panels';

/** Le non-membre reçoit 404 de l'API : même refus pour une initiative disparue. */
const isRefusal = (error: unknown) => error instanceof ApiError && (error.status === 403 || error.status === 404);

export function TicketsScreen({
  initiativeId,
  initiative,
  version,
}: {
  initiativeId: string;
  /** Absente tant que la liste des initiatives n'est pas chargée. */
  initiative: InitiativeDto | undefined;
  /** Change à chaque création, modification ou suppression d'un ticket. */
  version: number;
}) {
  const { t, locale } = useI18n();
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);
  const [filters, setFilters] = useState(DEFAULT_TICKET_FILTERS);
  const [sort, setSort] = useState(DEFAULT_TICKET_SORT);
  const [refused, setRefused] = useState(false);
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    api.listActions(initiativeId).then(
      (actions) => {
        setTickets(actions.map(actionToTicketRow));
        setError(null);
      },
      (e: unknown) => {
        if (isRefusal(e)) setRefused(true);
        else setError(toUiError(e));
      },
    );
  }, [initiativeId, version]);

  if (refused) {
    return (
      <>
        <h1>{t('tickets.title')}</h1>
        <p className="error" role="alert">
          {t('tickets.refused')}
        </p>
      </>
    );
  }

  const shown = tickets && sortTickets(selectTickets(tickets, filters), sort, locale);
  return (
    <section className="tickets">
      {initiative && (
        <div className="panel-kicker">
          {t('initiative.kicker')} <span className="code">{initiative.code}</span> · {initiative.name}
        </div>
      )}
      <h1>{t('tickets.title')}</h1>
      {initiative?.archivedAt && (
        <p className="notice">{t('initiative.archivedOn', { date: formatDate(locale, initiative.archivedAt) })}</p>
      )}
      <ErrorMessage error={error} />
      {tickets?.length === 0 && <EmptyState subject="actions" title={t('tickets.empty')} hint={t('tickets.emptyHint')} />}
      {tickets && tickets.length > 0 && shown && (
        <>
          <TicketFilterBar tickets={tickets} filters={filters} onChange={setFilters} />
          <p className="tickets-count" role="status">
            <small>{t('tickets.count', { count: shown.length })}</small>
          </p>
          <TicketTable tickets={shown} initiativeId={initiativeId} sort={sort} onSort={setSort} />
          <TicketCompactList tickets={shown} initiativeId={initiativeId} />
          {shown.length === 0 && <p className="tickets-no-match">{t('tickets.noMatch')}</p>}
        </>
      )}
    </section>
  );
}

function TicketFilterBar({
  tickets,
  filters,
  onChange,
}: {
  tickets: TicketRow[];
  filters: TicketFilters;
  onChange: (filters: TicketFilters) => void;
}) {
  const { t, locale } = useI18n();
  const change = (next: Partial<TicketFilters>) => onChange(changeTicketFilters(filters, next));
  return (
    <div className="ticket-filters">
      <input
        type="search"
        aria-label={t('tickets.search')}
        placeholder={t('tickets.search')}
        value={filters.text}
        onChange={(e) => change({ text: e.target.value })}
      />
      <select
        aria-label={t('tickets.filterType')}
        value={filters.type}
        onChange={(e) => change({ type: e.target.value as TicketFilters['type'] })}
      >
        <option value="">{t('tickets.allTypes')}</option>
        {TICKET_TYPES.map((type) => (
          <option key={type} value={type}>
            {t(`ticketType.${type}`)}
          </option>
        ))}
      </select>
      <select
        aria-label={t('tickets.filterState')}
        value={filters.state}
        onChange={(e) => change({ state: e.target.value as TicketFilters['state'] })}
      >
        {TICKET_STATES.map((state) => (
          <option key={state} value={state}>
            {t(`ticketState.${state}`)}
          </option>
        ))}
      </select>
      {filters.type && (
        <select
          aria-label={t('tickets.filterStatus')}
          value={filters.status}
          onChange={(e) => change({ status: e.target.value as TicketFilters['status'] })}
        >
          <option value="">{t('tickets.allStatuses')}</option>
          {ACTION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`actionStatus.${status}`)}
            </option>
          ))}
        </select>
      )}
      <select
        aria-label={t('tickets.filterAssignee')}
        value={filters.assignee}
        onChange={(e) => change({ assignee: e.target.value })}
      >
        <option value="">{t('tickets.allAssignees')}</option>
        <option value={TICKET_FILTER_NONE}>{t('tickets.noAssignee')}</option>
        {ticketAssigneeOptions(tickets, locale).map((assignee) => (
          <option key={assignee.userId} value={assignee.userId}>
            {memberName(assignee)}
          </option>
        ))}
      </select>
      <select aria-label={t('tickets.filterEpic')} value={filters.epic} onChange={(e) => change({ epic: e.target.value })}>
        <option value="">{t('tickets.allEpics')}</option>
        <option value={TICKET_FILTER_NONE}>{t('tickets.noEpic')}</option>
        {ticketEpicOptions(tickets).map((epic) => (
          <option key={epic.id} value={epic.id}>
            {epic.reference} {epic.title}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Ticket dont la fiche est ouverte, même si un autre panneau la recouvre : sa ligne est mise en évidence. */
function useOpenedTicketId(): string | undefined {
  const { stack } = usePanels();
  return stack.map((entry) => entry.content).findLast((content) => content.kind === 'action')?.actionId;
}

function TicketTitle({ ticket, initiativeId }: { ticket: TicketRow; initiativeId: string }) {
  const { open } = usePanels();
  return (
    <button
      type="button"
      className="link ticket-title"
      title={ticket.title}
      onClick={() => open({ kind: 'action', initiativeId, actionId: ticket.id })}
    >
      {ticket.title}
    </button>
  );
}

/** Responsable, signalé s'il n'est plus propriétaire ni contributeur. */
function TicketAssignee({ ticket }: { ticket: TicketRow }) {
  const { t } = useI18n();
  if (!ticket.assignee) return <small className="ticket-muted">{t('tickets.noAssignee')}</small>;
  const name = memberName(ticket.assignee);
  if (ticket.assignee.eligible) return <small title={name}>{name}</small>;
  const warning = t('action.assigneeNotEligible');
  return (
    <small className="ticket-warning" title={`${name} · ${warning}`}>
      <TriangleAlert role="img" aria-label={warning} />
      {name}
    </small>
  );
}

function TicketDueDate({ ticket }: { ticket: TicketRow }) {
  const { t, locale } = useI18n();
  if (!ticket.dueDate) return <small className="ticket-muted">{t('action.noDueDate')}</small>;
  const date = formatDate(locale, ticket.dueDate);
  if (!isOverdueTicket(ticket, localDate(new Date().toISOString()))) return <small>{date}</small>;
  return (
    <small className="ticket-warning" title={t('tickets.overdue')}>
      <TriangleAlert role="img" aria-label={t('tickets.overdue')} />
      {date}
    </small>
  );
}

function TicketTable({
  tickets,
  initiativeId,
  sort,
  onSort,
}: {
  tickets: TicketRow[];
  initiativeId: string;
  sort: TicketSort;
  onSort: (sort: TicketSort) => void;
}) {
  const { t } = useI18n();
  const openedId = useOpenedTicketId();
  const ariaSort = (key: TicketSortKey) => {
    if (sort.key !== key) return undefined;
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  };
  return (
    <div className="ticket-table-area">
      <table className="ticket-table">
        <thead>
          <tr>
            {TICKET_SORT_KEYS.map((key) => (
              <th key={key} scope="col" className={`col-${key}`} aria-sort={ariaSort(key)}>
                <button type="button" onClick={() => onSort(toggleTicketSort(sort, key))}>
                  {t(`ticketColumn.${key}`)}
                  {sort.key === key && (sort.direction === 'asc' ? <ArrowUp /> : <ArrowDown />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr
              key={ticket.id}
              className={ticket.id === openedId ? 'selected' : undefined}
              aria-current={ticket.id === openedId ? 'true' : undefined}
            >
              <td className="col-reference">
                <span className="code">{ticket.reference}</span>
              </td>
              <td className="col-type">
                <span className="badge ticket-type">{t(`ticketType.${ticket.type}`)}</span>
              </td>
              <td className="col-title">
                <TicketTitle ticket={ticket} initiativeId={initiativeId} />
              </td>
              <td className="col-status">
                <StatusLabel status={ticket.status} />
              </td>
              <td className="col-assignee">
                <TicketAssignee ticket={ticket} />
              </td>
              <td className="col-dueDate">
                <TicketDueDate ticket={ticket} />
              </td>
              <td className="col-epic">
                <small title={ticket.epic?.title}>{ticket.epic?.title ?? '—'}</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Petit écran : deux lignes par ticket, dans l'ordre du tableau. */
function TicketCompactList({ tickets, initiativeId }: { tickets: TicketRow[]; initiativeId: string }) {
  const { t } = useI18n();
  const openedId = useOpenedTicketId();
  return (
    <ul className="ticket-compact">
      {tickets.map((ticket) => (
        <li key={ticket.id} className={ticket.id === openedId ? 'selected' : undefined}>
          <div className="ticket-compact-title">
            <span className="code">{ticket.reference}</span> <TicketTitle ticket={ticket} initiativeId={initiativeId} />
          </div>
          <div className="ticket-compact-meta">
            <span className="badge ticket-type">{t(`ticketType.${ticket.type}`)}</span>
            <StatusLabel status={ticket.status} />
            <TicketAssignee ticket={ticket} />
            <TicketDueDate ticket={ticket} />
          </div>
        </li>
      ))}
    </ul>
  );
}
