// Tickets autres que l'Action (ticket 18, décision 11) : fiche en panneau, sur une
// colonne, et « Nouveau ticket », où le type décide des champs. Règles dans
// @app/shared (tickets.ts, roles.ts).
import {
  ACTION_DESCRIPTION_MAX_LENGTH,
  ACTION_TITLE_MAX_LENGTH,
  type BabokDto,
  can,
  canBeAssignee,
  createActionSchema,
  createTicketSchema,
  isAssigneeRequired,
  epicProgress,
  type InitiativeDto,
  type InitiativeMemberDto,
  memberName,
  newTicketTypes,
  RISK_LEVELS,
  type RiskLevel,
  sortByReference,
  type StakeholderDto,
  TICKET_STATUSES,
  ticketHasField,
  ticketEpicOptions,
  type TicketDto,
  type TicketRow,
  ticketStatusLabelKey,
  type TicketStatus,
  type TicketType,
  type TicketVersionDto,
  updateTicketSchema,
} from '@app/shared';
import { useEffect, useState } from 'react';
import { TaskOptions, TechniqueOptions, TermLabel } from './action-panels';
import { api, ApiError } from './api';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { formatDate } from './initiative-panels';
import { Panel, useCloseSilently, usePanels } from './panels';
import { RichText, RichTextEditor } from './rich-text';
import { StakeholderLink } from './stakeholder-panels';
import { EpicLink, EpicSelect, TicketAudit, TicketHistory, TicketStatusLabel, ticketTarget } from './ticket-parts';
import { useUnsavedForm } from './unsaved-changes';

const canEditTicket = (ticket: Pick<TicketDto, 'initiative'>) =>
  can(ticket.initiative.myRole, 'editActions', { archived: ticket.initiative.archived });

export function TicketPanel({
  initiativeId,
  ticketId,
  ticketsVersion,
  stakeholdersVersion,
  onChanged,
  onClose,
}: {
  initiativeId: string;
  ticketId: string;
  /** Change à chaque écriture sur un ticket : l'Epic et ses tickets se rechargent. */
  ticketsVersion: number;
  stakeholdersVersion: number;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const closeSilently = useCloseSilently();
  const [ticket, setTicket] = useState<TicketDto | null>(null);
  const [members, setMembers] = useState<InitiativeMemberDto[] | null>(null);
  const [stakeholders, setStakeholders] = useState<StakeholderDto[] | null>(null);
  const [rows, setRows] = useState<TicketRow[] | null>(null);
  const [versions, setVersions] = useState<TicketVersionDto[]>([]);
  const [saveCount, setSaveCount] = useState(0);
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    api.getTicket(initiativeId, ticketId).then(setTicket, (e: unknown) => setError(toUiError(e)));
    api.listMembers(initiativeId).then(setMembers, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, ticketId]);

  useEffect(() => {
    api.ticketHistory(initiativeId, ticketId).then(setVersions, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, ticketId, saveCount]);

  useEffect(() => {
    api.listStakeholders(initiativeId).then(setStakeholders, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, stakeholdersVersion]);

  useEffect(() => {
    api.listTickets(initiativeId).then(setRows, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, ticketsVersion]);

  return (
    <Panel
      title={ticket ? ticket.title : t('common.loading')}
      kicker={
        ticket && (
          <>
            {t(`ticketType.${ticket.type}`)} <span className="code">{ticket.reference}</span>
          </>
        )
      }
      onClose={onClose}
    >
      <ErrorMessage error={error} />
      {ticket && (
        <>
          {ticket.initiative.archived && <p className="notice">{t('initiative.archived')}</p>}
          {canEditTicket(ticket) && members && stakeholders && rows ? (
            <TicketForm
              ticket={ticket}
              members={members}
              stakeholders={stakeholders}
              rows={rows}
              onSaved={(saved) => {
                setTicket(saved);
                setSaveCount((count) => count + 1);
                onChanged();
              }}
            />
          ) : (
            <TicketDetails ticket={ticket} />
          )}
          <TicketAudit ticket={ticket} />
          {!ticketHasField(ticket.type, 'epic') && rows && <EpicTickets epicId={ticket.id} initiativeId={initiativeId} rows={rows} />}
          <TicketHistory type={ticket.type} babok={null} versions={versions} />
          {canEditTicket(ticket) && (
            <DeleteTicket
              ticket={ticket}
              onDeleted={() => {
                onChanged();
                closeSilently();
              }}
            />
          )}
        </>
      )}
    </Panel>
  );
}

/** Fiche d'un Epic : ses tickets et le nombre de fermés. */
function EpicTickets({ epicId, initiativeId, rows }: { epicId: string; initiativeId: string; rows: TicketRow[] }) {
  const { t } = useI18n();
  const { open } = usePanels();
  const own = sortByReference(rows.filter((row) => row.epic?.id === epicId));
  return (
    <section className="epic-tickets">
      <h3 className="group-title">{t('ticket.epicTickets')}</h3>
      {own.length === 0 ? (
        <p>
          <small>{t('ticket.epicTicketsEmpty')}</small>
        </p>
      ) : (
        <>
          <p>
            <small>{t('ticket.epicClosed', epicProgress(rows, epicId))}</small>
          </p>
          <ul className="links">
            {own.map((row) => (
              <li key={row.id}>
                <button type="button" className="link" onClick={() => open(ticketTarget(initiativeId, row))}>
                  <span className="code">{row.reference}</span> {row.title}
                </button>{' '}
                <TicketStatusLabel type={row.type} status={row.status} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Fiche en lecture seule : lecteur, ou initiative archivée. */
function TicketDetails({ ticket }: { ticket: TicketDto }) {
  const { t, locale } = useI18n();
  const notSet = <small>{t('initiative.notSet')}</small>;
  const level = (value: RiskLevel | null) => (value ? t(`riskLevel.${value}`) : notSet);
  return (
    <dl>
      <dt>{t('action.status')}</dt>
      <dd>
        <TicketStatusLabel type={ticket.type} status={ticket.status} />
      </dd>
      <dt>{t('action.assignee')}</dt>
      <dd>
        {ticket.assignee ? (
          <>
            {memberName(ticket.assignee)}
            {!ticket.assignee.eligible && <small> · {t('action.assigneeNotEligible')}</small>}
          </>
        ) : (
          <small>{t('tickets.noAssignee')}</small>
        )}
      </dd>
      <dt>{t('action.dueDate')}</dt>
      <dd>{ticket.dueDate ? formatDate(locale, ticket.dueDate) : t('action.noDueDate')}</dd>
      {ticketHasField(ticket.type, 'epic') && (
        <>
          <dt>{t('ticket.epic')}</dt>
          <dd>
            <EpicLink initiativeId={ticket.initiative.id} epic={ticket.epic} />
          </dd>
        </>
      )}
      {ticketHasField(ticket.type, 'questionedStakeholders') && (
        <>
          <dt>{t('ticket.questionedStakeholders')}</dt>
          <dd>
            {ticket.questionedStakeholders.length === 0 ? (
              notSet
            ) : (
              <ul className="links">
                {ticket.questionedStakeholders.map((s) => (
                  <li key={s.id}>
                    <StakeholderLink initiativeId={ticket.initiative.id} stakeholder={s} />
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </>
      )}
      {ticketHasField(ticket.type, 'riskLevels') && (
        <>
          <dt>{t('ticket.probability')}</dt>
          <dd>{level(ticket.probability)}</dd>
          <dt>{t('ticket.impact')}</dt>
          <dd>{level(ticket.impact)}</dd>
        </>
      )}
      <dt>{t('action.description')}</dt>
      <dd>{ticket.description ? <RichText source={ticket.description} /> : notSet}</dd>
    </dl>
  );
}

/** Responsables possibles ; l'actuel reste affiché s'il ne l'est plus. */
function AssigneeSelect({
  members,
  current,
  value,
  allowEmpty,
  onChange,
}: {
  members: InitiativeMemberDto[];
  current: TicketDto['assignee'];
  value: string;
  allowEmpty: boolean;
  onChange: (assigneeId: string) => void;
}) {
  const { t } = useI18n();
  const assignees = members.filter((m) => canBeAssignee(m.role));
  const keepsIneligible = current && !assignees.some((m) => m.userId === current.userId);
  return (
    <label>
      {t('action.assignee')}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {allowEmpty && <option value="">{t('tickets.noAssignee')}</option>}
        {keepsIneligible && (
          <option value={current.userId}>
            {memberName(current)} · {t('action.assigneeNotEligible')}
          </option>
        )}
        {assignees.map((m) => (
          <option key={m.userId} value={m.userId}>
            {memberName(m)}
          </option>
        ))}
      </select>
    </label>
  );
}

function QuestionedStakeholders({
  stakeholders,
  value,
  onChange,
}: {
  stakeholders: StakeholderDto[];
  value: readonly string[];
  onChange: (ids: readonly string[]) => void;
}) {
  const { t } = useI18n();
  return (
    <fieldset>
      <legend>{t('ticket.questionedStakeholders')}</legend>
      {stakeholders.length === 0 && <small>{t('stakeholders.sectionEmpty')}</small>}
      {stakeholders.map((s) => (
        <label key={s.id} className="inline">
          <input
            type="checkbox"
            checked={value.includes(s.id)}
            onChange={() => onChange(value.includes(s.id) ? value.filter((id) => id !== s.id) : [...value, s.id])}
          />
          {s.name}
        </label>
      ))}
    </fieldset>
  );
}

function RiskLevelSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (level: string) => void;
}) {
  const { t } = useI18n();
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('initiative.notSet')}</option>
        {RISK_LEVELS.map((level) => (
          <option key={level} value={level}>
            {t(`riskLevel.${level}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

function TicketForm({
  ticket,
  members,
  stakeholders,
  rows,
  onSaved,
}: {
  ticket: TicketDto;
  members: InitiativeMemberDto[];
  stakeholders: StakeholderDto[];
  rows: TicketRow[];
  onSaved: (ticket: TicketDto) => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState(ticket.title);
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [assigneeId, setAssigneeId] = useState(ticket.assignee?.userId ?? '');
  const [dueDate, setDueDate] = useState(ticket.dueDate ?? '');
  const [epicId, setEpicId] = useState(ticket.epic?.id ?? '');
  const [questionedIds, setQuestionedIds] = useState<readonly string[]>(ticket.questionedStakeholders.map((s) => s.id));
  const [probability, setProbability] = useState<string>(ticket.probability ?? '');
  const [impact, setImpact] = useState<string>(ticket.impact ?? '');
  const [description, setDescription] = useState(ticket.description ?? '');
  const [error, setError] = useState<UiError | null>(null);
  const [saved, setSaved] = useState(false);
  const submit = useUnsavedForm(
    { title, status, assigneeId, dueDate, epicId, questionedIds, probability, impact, description },
    save,
  );

  async function save(): Promise<boolean> {
    setSaved(false);
    // Même schéma de validation que l'API (@app/shared). Le responsable n'est
    // envoyé que s'il change : resté hors de l'équipe, il garde sa place.
    const parsed = updateTicketSchema.safeParse({
      title,
      status,
      ...(assigneeId !== (ticket.assignee?.userId ?? '') ? { assigneeId: assigneeId || null } : {}),
      dueDate: dueDate || null,
      ...(ticketHasField(ticket.type, 'epic') ? { epicId: epicId || null } : {}),
      ...(ticketHasField(ticket.type, 'questionedStakeholders') ? { questionedStakeholderIds: questionedIds } : {}),
      ...(ticketHasField(ticket.type, 'riskLevels') ? { probability: probability || null, impact: impact || null } : {}),
      description,
    });
    if (!parsed.success) {
      setError({ key: 'ticket.invalid' });
      return false;
    }
    try {
      onSaved(await api.updateTicket(ticket.initiative.id, ticket.id, parsed.data));
      setError(null);
      setSaved(true);
      return true;
    } catch (e) {
      setError(e instanceof ApiError && e.status === 400 && !e.refusal ? { key: 'ticket.invalid' } : toUiError(e));
      return false;
    }
  }

  return (
    <form className="stacked" onSubmit={submit} onChange={() => setSaved(false)}>
      <label>
        {t('action.title')}
        <input value={title} maxLength={ACTION_TITLE_MAX_LENGTH} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        {t('action.status')}
        <select value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)}>
          {TICKET_STATUSES[ticket.type].map((s: TicketStatus) => (
            <option key={s} value={s}>
              {t(ticketStatusLabelKey(ticket.type, s))}
            </option>
          ))}
        </select>
      </label>
      <AssigneeSelect members={members} current={ticket.assignee} value={assigneeId} allowEmpty onChange={setAssigneeId} />
      <label>
        {t('action.dueDate')}
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </label>
      {ticketHasField(ticket.type, 'epic') && <EpicSelect epics={ticketEpicOptions(rows)} value={epicId} onChange={setEpicId} />}
      {ticketHasField(ticket.type, 'questionedStakeholders') && (
        <QuestionedStakeholders stakeholders={stakeholders} value={questionedIds} onChange={setQuestionedIds} />
      )}
      {ticketHasField(ticket.type, 'riskLevels') && (
        <>
          <RiskLevelSelect label={t('ticket.probability')} value={probability} onChange={setProbability} />
          <RiskLevelSelect label={t('ticket.impact')} value={impact} onChange={setImpact} />
        </>
      )}
      <RichTextEditor
        label={t('action.description')}
        value={description}
        maxLength={ACTION_DESCRIPTION_MAX_LENGTH}
        onChange={(value) => {
          setDescription(value);
          setSaved(false);
        }}
      />
      <button type="submit">{t('action.save')}</button>
      <ErrorMessage error={error} />
      <p role="status">{saved && t('action.saved')}</p>
    </form>
  );
}

/** Suppression définitive après confirmation ; refus clair si le ticket est lié ou si l'Epic contient des tickets. */
function DeleteTicket({ ticket, onDeleted }: { ticket: TicketDto; onDeleted: () => void }) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<UiError | null>(null);

  async function remove() {
    try {
      await api.deleteTicket(ticket.initiative.id, ticket.id);
      onDeleted();
    } catch (e) {
      setConfirming(false);
      setError(toUiError(e));
    }
  }

  return (
    <section className="owner-actions">
      {confirming ? (
        <div role="alertdialog" aria-labelledby="ticket-delete-confirm" className="confirm">
          <p id="ticket-delete-confirm">{t('ticket.deleteConfirm', { reference: ticket.reference, title: ticket.title })}</p>
          <button type="button" autoFocus onClick={() => setConfirming(false)}>
            {t('common.cancel')}
          </button>{' '}
          <button type="button" className="danger" onClick={() => void remove()}>
            {t('ticket.deleteConfirmButton')}
          </button>
        </div>
      ) : (
        <>
          <button type="button" className="danger" onClick={() => setConfirming(true)}>
            {t('ticket.delete')}
          </button>
          <p>
            <small>{t('ticket.deleteHint')}</small>
          </p>
        </>
      )}
      <ErrorMessage error={error} />
    </section>
  );
}

/**
 * « Nouveau ticket » : le type d'abord, qui ne changera plus, puis les champs qu'il
 * prévoit. Tout ticket naît dans le statut initial de son type. La fiche créée
 * remplace le panneau. Le responsable d'une Action est obligatoire : par défaut, la
 * personne qui crée ; il est facultatif pour les autres types.
 */
export function CreateTicketPanel({
  babok,
  initiative,
  epicId: proposedEpicId,
  myId,
  onCreated,
  onClose,
}: {
  babok: BabokDto;
  initiative: InitiativeDto;
  /** Ouvert depuis le « + Ticket » d'un Epic : le ticket y entre. */
  epicId?: string;
  myId: string | null;
  onCreated: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { replaceSaved } = usePanels();
  const types = newTicketTypes(!!proposedEpicId);
  const [type, setType] = useState<TicketType>(types[0]!);
  const [title, setTitle] = useState('');
  const [chosenAssignee, setChosenAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [epicId, setEpicId] = useState(proposedEpicId ?? '');
  const [taskId, setTaskId] = useState('');
  const [techniqueId, setTechniqueId] = useState('');
  const [questionedIds, setQuestionedIds] = useState<readonly string[]>([]);
  const [probability, setProbability] = useState('');
  const [impact, setImpact] = useState('');
  const [description, setDescription] = useState('');
  const [members, setMembers] = useState<InitiativeMemberDto[]>([]);
  const [stakeholders, setStakeholders] = useState<StakeholderDto[]>([]);
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [error, setError] = useState<UiError | null>(null);
  const initiativeId = initiative.id;
  const assigneeId = isAssigneeRequired(type) ? chosenAssignee || (myId ?? '') : chosenAssignee;
  const submit = useUnsavedForm(
    { type, title, chosenAssignee, dueDate, epicId, taskId, techniqueId, questionedIds, probability, impact, description },
    create,
  );

  useEffect(() => {
    api.listMembers(initiativeId).then(setMembers, (e: unknown) => setError(toUiError(e)));
    api.listStakeholders(initiativeId).then(setStakeholders, (e: unknown) => setError(toUiError(e)));
    api.listTickets(initiativeId).then(setRows, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId]);

  async function create(): Promise<boolean> {
    const common = { title, dueDate: dueDate || null, description };
    const epic = ticketHasField(type, 'epic') ? { epicId: epicId || null } : {};
    try {
      // Même schéma de validation que l'API (@app/shared).
      if (type === 'action') {
        const parsed = createActionSchema.safeParse({
          ...common,
          ...epic,
          taskId,
          techniqueId: techniqueId || null,
          assigneeId: assigneeId || undefined,
        });
        if (!parsed.success) {
          setError({ key: 'action.invalid' });
          return false;
        }
        const action = await api.createAction(initiativeId, parsed.data);
        onCreated();
        replaceSaved({ kind: 'action', initiativeId, actionId: action.id });
        return true;
      }
      const parsed = createTicketSchema.safeParse({
        ...common,
        ...epic,
        type,
        assigneeId: assigneeId || null,
        ...(ticketHasField(type, 'questionedStakeholders') ? { questionedStakeholderIds: questionedIds } : {}),
        ...(ticketHasField(type, 'riskLevels') ? { probability: probability || null, impact: impact || null } : {}),
      });
      if (!parsed.success) {
        setError({ key: 'ticket.invalid' });
        return false;
      }
      const ticket = await api.createTicket(initiativeId, parsed.data);
      onCreated();
      replaceSaved({ kind: 'ticket', initiativeId, ticketId: ticket.id });
      return true;
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 400 && !e.refusal
          ? { key: type === 'action' ? 'action.invalid' : 'ticket.invalid' }
          : toUiError(e),
      );
      return false;
    }
  }

  return (
    <Panel
      title={t('tickets.new')}
      kicker={
        <>
          {t('initiative.kicker')} <span className="code">{initiative.code}</span> · {initiative.name}
        </>
      }
      onClose={onClose}
    >
      <form className="stacked" onSubmit={submit}>
        <label>
          {t('ticket.type')}
          <select data-autofocus value={type} onChange={(e) => setType(e.target.value as TicketType)}>
            {types.map((option) => (
              <option key={option} value={option}>
                {t(`ticketType.${option}`)}
              </option>
            ))}
          </select>
          <small>{t('ticket.typeHint')}</small>
        </label>
        <label>
          {t('action.title')}
          <input value={title} maxLength={ACTION_TITLE_MAX_LENGTH} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <AssigneeSelect
          members={members}
          current={null}
          value={assigneeId}
          allowEmpty={!isAssigneeRequired(type)}
          onChange={setChosenAssignee}
        />
        <label>
          {t('action.dueDate')}
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        {ticketHasField(type, 'epic') && <EpicSelect epics={ticketEpicOptions(rows)} value={epicId} onChange={setEpicId} />}
        {ticketHasField(type, 'babok') && (
          <>
            <label>
              <TermLabel term="babok.task" />
              <select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                <option value="" disabled>
                  {t('action.chooseTask')}
                </option>
                <TaskOptions babok={babok} />
              </select>
            </label>
            <label>
              <TermLabel term="babok.technique" />
              <select value={techniqueId} onChange={(e) => setTechniqueId(e.target.value)}>
                <TechniqueOptions babok={babok} taskId={taskId} />
              </select>
            </label>
          </>
        )}
        {ticketHasField(type, 'questionedStakeholders') && (
          <QuestionedStakeholders stakeholders={stakeholders} value={questionedIds} onChange={setQuestionedIds} />
        )}
        {ticketHasField(type, 'riskLevels') && (
          <>
            <RiskLevelSelect label={t('ticket.probability')} value={probability} onChange={setProbability} />
            <RiskLevelSelect label={t('ticket.impact')} value={impact} onChange={setImpact} />
          </>
        )}
        <RichTextEditor
          label={t('action.description')}
          value={description}
          maxLength={ACTION_DESCRIPTION_MAX_LENGTH}
          onChange={setDescription}
        />
        <button type="submit">{t('ticket.create')}</button>
        <ErrorMessage error={error} />
      </form>
    </Panel>
  );
}
