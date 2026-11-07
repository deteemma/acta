// Éléments communs aux fiches de tous les types de ticket, Action comprise
// (ticket 18) : statut, Epic, auteurs et dates, historique. Règles dans
// @app/shared (tickets.ts).
import {
  type BabokDto,
  findBabokElement,
  memberName,
  type MemberNameDto,
  type MessageKey,
  ticketHistory,
  ticketStatusLabelKey,
  ticketStatusTone,
  type TicketChange,
  type TicketEpicRef,
  type TicketRow,
  type TicketStatus,
  type TicketType,
  type TicketVersionDto,
} from '@app/shared';
import type { ReactNode } from 'react';
import { useI18n } from './i18n';
import { formatDate } from './initiative-panels';
import { type PanelContent, usePanels } from './panels';
import { RichText } from './rich-text';
import { formatDateTime } from './team-section';

/** Fiche d'un ticket : l'Action a la sienne. */
export function ticketTarget(initiativeId: string, ticket: Pick<TicketRow, 'id' | 'type'>): PanelContent {
  return ticket.type === 'action'
    ? { kind: 'action', initiativeId, actionId: ticket.id }
    : { kind: 'ticket', initiativeId, ticketId: ticket.id };
}

export function TicketStatusLabel({ type, status }: { type: TicketType; status: TicketStatus }) {
  const { t } = useI18n();
  return <span className={`badge status tone-${ticketStatusTone(status)}`}>{t(ticketStatusLabelKey(type, status))}</span>;
}

/** Liste de choix de l'Epic d'un ticket, « Sans Epic » en tête. */
export function EpicSelect({
  epics,
  value,
  onChange,
}: {
  epics: readonly TicketEpicRef[];
  value: string;
  onChange: (epicId: string) => void;
}) {
  const { t } = useI18n();
  return (
    <label>
      {t('ticket.epic')}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('tickets.noEpic')}</option>
        {epics.map((epic) => (
          <option key={epic.id} value={epic.id}>
            {epic.reference} {epic.title}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Epic d'un ticket en lecture seule : un clic ouvre sa fiche. */
export function EpicLink({ initiativeId, epic }: { initiativeId: string; epic: TicketEpicRef | null }) {
  const { t } = useI18n();
  const { open } = usePanels();
  if (!epic) return <small>{t('tickets.noEpic')}</small>;
  return (
    <button type="button" className="link" onClick={() => open({ kind: 'ticket', initiativeId, ticketId: epic.id })}>
      <span className="code">{epic.reference}</span> {epic.title}
    </button>
  );
}

/** Date de création et de dernière modification, avec leur auteur. */
export function TicketAudit({
  ticket,
}: {
  ticket: { createdAt: string; createdBy: MemberNameDto; updatedAt: string; updatedBy: MemberNameDto };
}) {
  const { t, locale } = useI18n();
  return (
    <p className="audit">
      <small>
        {t('ticket.created', { date: formatDateTime(locale, ticket.createdAt), name: memberName(ticket.createdBy) })}
        <br />
        {t('ticket.updated', { date: formatDateTime(locale, ticket.updatedAt), name: memberName(ticket.updatedBy) })}
      </small>
    </p>
  );
}

/** Historique : qui, quand, et pour chaque champ modifié l'ancienne et la nouvelle valeur. */
export function TicketHistory({
  type,
  babok,
  versions,
}: {
  type: TicketType;
  /** Pour nommer la tâche et la technique d'une Action. */
  babok: BabokDto | null;
  versions: TicketVersionDto[];
}) {
  const { t, locale } = useI18n();
  const entries = ticketHistory(versions);
  return (
    <section className="requirement-history">
      <h3 className="group-title">{t('action.history')}</h3>
      {entries.length === 0 && <p><small>{t('action.historyEmpty')}</small></p>}
      <ol className="timeline">
        {entries.map((entry) => (
          <li key={entry.changedAt}>
            <span className="timeline-when">
              {t('ticket.historyUpdated', { date: formatDateTime(locale, entry.changedAt), name: memberName(entry.changedBy) })}
            </span>
            <table className="change-table">
              <thead>
                <tr>
                  <td />
                  <th scope="col">{t('action.historyBefore')}</th>
                  <th scope="col">{t('action.historyAfter')}</th>
                </tr>
              </thead>
              <tbody>
                {entry.changes.map((change) => (
                  <TicketChangeLine key={change.field} type={type} babok={babok} change={change} />
                ))}
              </tbody>
            </table>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Libellé du champ modifié, dans la langue de l'interface. */
const TICKET_FIELD_LABELS = {
  title: 'action.title',
  description: 'action.description',
  status: 'action.status',
  taskId: 'action.task',
  techniqueId: 'action.technique',
  dueDate: 'action.dueDate',
  probability: 'ticket.probability',
  impact: 'ticket.impact',
  assignee: 'action.assignee',
  epic: 'ticket.epic',
  stakeholders: 'action.stakeholders',
  questionedStakeholders: 'ticket.questionedStakeholders',
} as const satisfies Record<TicketChange['field'], MessageKey>;

function TicketChangeLine({ type, babok, change }: { type: TicketType; babok: BabokDto | null; change: TicketChange }) {
  const { t, locale } = useI18n();
  const empty = <em>{t('action.historyNoValue')}</em>;
  const label = t(TICKET_FIELD_LABELS[change.field]);
  // La description, souvent longue, s'affiche en entier à la demande.
  if (change.field === 'description') {
    return (
      <tr>
        <th scope="row">{label}</th>
        <td colSpan={2}>
          <details>
            <summary>{t('action.historyShowDescription')}</summary>
            <div className="change-statement">
              <div className="change-before">{change.from ? <RichText source={change.from} /> : empty}</div>
              <div>{change.to ? <RichText source={change.to} /> : empty}</div>
            </div>
          </details>
        </td>
      </tr>
    );
  }
  const babokName = (id: string | null) => {
    if (!id) return empty;
    const element = babok && findBabokElement(babok, id);
    return element ? `${element.section} ${element.name[locale]}` : id;
  };
  const value = (): [ReactNode, ReactNode] => {
    switch (change.field) {
      case 'title':
        return [change.from, change.to];
      case 'status':
        return [t(ticketStatusLabelKey(type, change.from)), t(ticketStatusLabelKey(type, change.to))];
      case 'taskId':
      case 'techniqueId':
        return [babokName(change.from), babokName(change.to)];
      case 'dueDate':
        return [
          change.from ? formatDate(locale, change.from) : empty,
          change.to ? formatDate(locale, change.to) : empty,
        ];
      case 'probability':
      case 'impact':
        return [
          change.from ? t(`riskLevel.${change.from}`) : empty,
          change.to ? t(`riskLevel.${change.to}`) : empty,
        ];
      case 'assignee':
        return [change.from ? memberName(change.from) : empty, change.to ? memberName(change.to) : empty];
      case 'epic':
        return [
          change.from ? `${change.from.reference} ${change.from.title}` : empty,
          change.to ? `${change.to.reference} ${change.to.title}` : empty,
        ];
      case 'stakeholders':
      case 'questionedStakeholders':
        return [
          change.from.length ? change.from.map((s) => s.name).join(', ') : empty,
          change.to.length ? change.to.map((s) => s.name).join(', ') : empty,
        ];
    }
  };
  const [from, to] = value();
  return (
    <tr>
      <th scope="row">{label}</th>
      <td className="change-before">{from}</td>
      <td>{to}</td>
    </tr>
  );
}
