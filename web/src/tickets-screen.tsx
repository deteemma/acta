// Écran Tickets d'une initiative (ticket 17, décision 11) : tableau filtrable et
// triable, liste compacte sur petit écran ; la fiche s'ouvre en panneau à côté.
// « Nouveau ticket », création rapide et regroupement par Epic : ticket 18. Règles
// de filtre, de tri et de regroupement dans @app/shared (tickets.ts).
import {
  ACTION_TITLE_MAX_LENGTH,
  canCreateActionIn,
  changeTicketFilters,
  createTicketSchema,
  DEFAULT_TICKET_FILTERS,
  DEFAULT_TICKET_SORT,
  type GenericTicketType,
  groupTicketsByEpic,
  type InitiativeDto,
  isOverdueTicket,
  localDate,
  memberName,
  QUICK_CREATE_TICKET_TYPES,
  selectTickets,
  sortTickets,
  TICKET_FILTER_NONE,
  TICKET_SORT_KEYS,
  TICKET_STATES,
  TICKET_STATUSES,
  TICKET_TYPES,
  ticketAssigneeOptions,
  ticketEpicOptions,
  type TicketEpicGroup,
  type TicketFilters,
  type TicketRow,
  ticketStatusLabelKey,
  type TicketStatus,
  type TicketSort,
  type TicketSortKey,
  type TicketType,
  toggleTicketSort,
} from '@app/shared';
import { ArrowDown, ArrowUp, Plus, TriangleAlert } from 'lucide-react';
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';
import { EmptyState } from './empty-state';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { formatDate } from './initiative-panels';
import { usePanels } from './panels';
import { TicketStatusLabel, ticketTarget } from './ticket-parts';
import { useUnsavedForm } from './unsaved-changes';

/** Le non-membre reçoit 404 de l'API : même refus pour une initiative disparue. */
const isRefusal = (error: unknown) => error instanceof ApiError && (error.status === 403 || error.status === 404);

export function TicketsScreen({
  initiativeId,
  initiative,
  version,
  onChanged,
}: {
  initiativeId: string;
  /** Absente tant que la liste des initiatives n'est pas chargée. */
  initiative: InitiativeDto | undefined;
  /** Change à chaque création, modification ou suppression d'un ticket. */
  version: number;
  /** Un ticket vient d'être créé : les listes se rechargent. */
  onChanged: () => void;
}) {
  const { t, locale } = useI18n();
  const { open } = usePanels();
  const [grouped, setGrouped] = useState(false);
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);
  const [filters, setFilters] = useState(DEFAULT_TICKET_FILTERS);
  const [sort, setSort] = useState(DEFAULT_TICKET_SORT);
  const [refused, setRefused] = useState(false);
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    api.listTickets(initiativeId).then(
      (rows) => {
        setTickets(rows);
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
  const canCreate = !!initiative && canCreateActionIn(initiative);
  const groups = grouped && tickets && shown ? groupTicketsByEpic(tickets, shown) : null;
  return (
    <section className="tickets">
      {initiative && (
        <div className="panel-kicker">
          {t('initiative.kicker')} <span className="code">{initiative.code}</span> · {initiative.name}
        </div>
      )}
      <div className="tickets-header">
        <h1>{t('tickets.title')}</h1>
        {canCreate && (
          <button type="button" className="primary" onClick={() => open({ kind: 'createTicket', initiativeId })}>
            <Plus />
            {t('tickets.new')}
          </button>
        )}
      </div>
      {initiative?.archivedAt && (
        <p className="notice">{t('initiative.archivedOn', { date: formatDate(locale, initiative.archivedAt) })}</p>
      )}
      <ErrorMessage error={error} />
      {canCreate && <QuickCreate initiativeId={initiativeId} onCreated={onChanged} />}
      {tickets?.length === 0 && <EmptyState subject="actions" title={t('tickets.empty')} hint={t(canCreate ? 'tickets.emptyHint' : 'tickets.emptyHintReadOnly')} />}
      {tickets && tickets.length > 0 && shown && (
        <>
          <TicketFilterBar
            tickets={tickets}
            filters={filters}
            onChange={setFilters}
            grouped={grouped}
            onGroupedChange={setGrouped}
          />
          <p className="tickets-count" role="status">
            <small>{t('tickets.count', { count: shown.length })}</small>
          </p>
          <TicketTable tickets={shown} groups={groups} initiativeId={initiativeId} canCreate={canCreate} sort={sort} onSort={setSort} />
          <TicketCompactList tickets={shown} groups={groups} initiativeId={initiativeId} canCreate={canCreate} />
          {shown.length === 0 && <p className="tickets-no-match">{t('tickets.noMatch')}</p>}
        </>
      )}
    </section>
  );
}

/** Type et titre, puis Entrée ; la fiche s'ouvre ensuite. Pas pour l'Action, qui a d'autres champs obligatoires. */
function QuickCreate({ initiativeId, onCreated }: { initiativeId: string; onCreated: () => void }) {
  const { t } = useI18n();
  const { open } = usePanels();
  const [type, setType] = useState<GenericTicketType>(QUICK_CREATE_TICKET_TYPES[0]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<UiError | null>(null);
  const submit = useUnsavedForm({ type, title }, create);

  async function create(): Promise<boolean> {
    const parsed = createTicketSchema.safeParse({ type, title });
    if (!parsed.success) {
      setError({ key: 'ticket.invalid' });
      return false;
    }
    try {
      const ticket = await api.createTicket(initiativeId, parsed.data);
      setTitle('');
      setError(null);
      onCreated();
      open({ kind: 'ticket', initiativeId, ticketId: ticket.id });
      return true;
    } catch (e) {
      setError(toUiError(e));
      return false;
    }
  }

  return (
    <form className="ticket-quick-create" onSubmit={submit}>
      <select aria-label={t('tickets.quickType')} value={type} onChange={(e) => setType(e.target.value as GenericTicketType)}>
        {QUICK_CREATE_TICKET_TYPES.map((option) => (
          <option key={option} value={option}>
            {t(`ticketType.${option}`)}
          </option>
        ))}
      </select>
      <input
        aria-label={t('tickets.quickTitle')}
        placeholder={t('tickets.quickTitle')}
        value={title}
        maxLength={ACTION_TITLE_MAX_LENGTH}
        onChange={(e) => setTitle(e.target.value)}
      />
      <ErrorMessage error={error} />
    </form>
  );
}

function TicketFilterBar({
  tickets,
  filters,
  onChange,
  grouped,
  onGroupedChange,
}: {
  tickets: TicketRow[];
  filters: TicketFilters;
  onChange: (filters: TicketFilters) => void;
  grouped: boolean;
  onGroupedChange: (grouped: boolean) => void;
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
          {TICKET_STATUSES[filters.type].map((status: TicketStatus) => (
            <option key={status} value={status}>
              {t(ticketStatusLabelKey(filters.type as TicketType, status))}
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
      <label className="ticket-group-toggle inline">
        <input type="checkbox" checked={grouped} onChange={(e) => onGroupedChange(e.target.checked)} />
        {t('tickets.groupByEpic')}
      </label>
    </div>
  );
}

/** Ticket dont la fiche est ouverte, même si un autre panneau la recouvre : sa ligne est mise en évidence. */
function useOpenedTicketId(): string | undefined {
  const { stack } = usePanels();
  const opened = stack.map((entry) => entry.content).findLast((content) => content.kind === 'action' || content.kind === 'ticket');
  if (opened?.kind === 'action') return opened.actionId;
  return opened?.kind === 'ticket' ? opened.ticketId : undefined;
}

function TicketTitle({ ticket, initiativeId }: { ticket: TicketRow; initiativeId: string }) {
  const { open } = usePanels();
  return (
    <button
      type="button"
      className="link ticket-title"
      title={ticket.title}
      onClick={() => open(ticketTarget(initiativeId, ticket))}
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

/** En-tête d'un Epic : référence, titre, statut, responsable, progression et « + Ticket ». */
function EpicGroupHeader({
  group,
  initiativeId,
  canCreate,
}: {
  group: TicketEpicGroup;
  initiativeId: string;
  canCreate: boolean;
}) {
  const { t } = useI18n();
  const { open } = usePanels();
  const { epic, closed, total } = group;
  return (
    <div className="ticket-group">
      <span className="code">{epic.reference}</span>
      <TicketTitle ticket={epic} initiativeId={initiativeId} />
      <TicketStatusLabel type={epic.type} status={epic.status} />
      <TicketAssignee ticket={epic} />
      <small className="ticket-group-progress">{t('ticket.epicClosed', { closed, total })}</small>
      {canCreate && (
        <button
          type="button"
          aria-label={t('tickets.addToEpicLabel', { reference: epic.reference })}
          onClick={() => open({ kind: 'createTicket', initiativeId, epicId: epic.id })}
        >
          <Plus />
          {t('tickets.addToEpic')}
        </button>
      )}
    </div>
  );
}

function NoEpicGroupHeader() {
  const { t } = useI18n();
  return (
    <div className="ticket-group">
      <span className="ticket-group-name">{t('tickets.noEpic')}</span>
    </div>
  );
}

/**
 * Colonnes réellement affichées, d'après la largeur (voir styles.css). Un en-tête de
 * groupe s'étend sur elles seules : en table à largeurs fixes, s'étendre sur des
 * colonnes effacées les ferait réapparaître, vides, à la place du titre.
 */
function useVisibleColumnCount(area: RefObject<HTMLDivElement | null>): number {
  const [count, setCount] = useState<number>(TICKET_SORT_KEYS.length);
  useLayoutEffect(() => {
    const element = area.current;
    if (!element) return;
    const measure = () =>
      setCount([...element.querySelectorAll('thead th')].filter((th) => getComputedStyle(th).display !== 'none').length);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [area]);
  return count;
}

function TicketTable({
  tickets,
  groups,
  initiativeId,
  canCreate,
  sort,
  onSort,
}: {
  tickets: TicketRow[];
  /** Regroupement par Epic, s'il est choisi. */
  groups: ReturnType<typeof groupTicketsByEpic> | null;
  initiativeId: string;
  canCreate: boolean;
  sort: TicketSort;
  onSort: (sort: TicketSort) => void;
}) {
  const { t } = useI18n();
  const openedId = useOpenedTicketId();
  const area = useRef<HTMLDivElement>(null);
  const columnCount = useVisibleColumnCount(area);
  const ariaSort = (key: TicketSortKey) => {
    if (sort.key !== key) return undefined;
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  };
  const rows = (list: TicketRow[]) =>
    list.map((ticket) => (
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
          <TicketStatusLabel type={ticket.type} status={ticket.status} />
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
    ));
  const groupRow = (header: ReactNode, selected: boolean) => (
    <tr className={`ticket-group-row${selected ? ' selected' : ''}`} aria-current={selected ? 'true' : undefined}>
      <td colSpan={columnCount}>{header}</td>
    </tr>
  );
  return (
    <div ref={area} className="ticket-table-area">
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
        {groups ? (
          <>
            {groups.epics.map((group) => (
              <tbody key={group.epic.id}>
                {groupRow(
                  <EpicGroupHeader group={group} initiativeId={initiativeId} canCreate={canCreate} />,
                  group.epic.id === openedId,
                )}
                {rows(group.tickets)}
              </tbody>
            ))}
            <tbody>
              {groupRow(<NoEpicGroupHeader />, false)}
              {rows(groups.withoutEpic)}
            </tbody>
          </>
        ) : (
          <tbody>{rows(tickets)}</tbody>
        )}
      </table>
    </div>
  );
}

/** Petit écran : deux lignes par ticket, dans l'ordre du tableau. */
function TicketCompactList({
  tickets,
  groups,
  initiativeId,
  canCreate,
}: {
  tickets: TicketRow[];
  groups: ReturnType<typeof groupTicketsByEpic> | null;
  initiativeId: string;
  canCreate: boolean;
}) {
  const { t } = useI18n();
  const openedId = useOpenedTicketId();
  const items = (list: TicketRow[]) =>
    list.map((ticket) => (
      <li key={ticket.id} className={ticket.id === openedId ? 'selected' : undefined}>
        <div className="ticket-compact-title">
          <span className="code">{ticket.reference}</span> <TicketTitle ticket={ticket} initiativeId={initiativeId} />
        </div>
        <div className="ticket-compact-meta">
          <span className="badge ticket-type">{t(`ticketType.${ticket.type}`)}</span>
          <TicketStatusLabel type={ticket.type} status={ticket.status} />
          <TicketAssignee ticket={ticket} />
          <TicketDueDate ticket={ticket} />
        </div>
      </li>
    ));
  return (
    <ul className="ticket-compact">
      {groups ? (
        <>
          {groups.epics.flatMap((group) => [
            <li key={`group-${group.epic.id}`} className={`ticket-group-row${group.epic.id === openedId ? ' selected' : ''}`}>
              <EpicGroupHeader group={group} initiativeId={initiativeId} canCreate={canCreate} />
            </li>,
            ...items(group.tickets),
          ])}
          <li className="ticket-group-row">
            <NoEpicGroupHeader />
          </li>
          {items(groups.withoutEpic)}
        </>
      ) : (
        items(tickets)
      )}
    </ul>
  );
}
