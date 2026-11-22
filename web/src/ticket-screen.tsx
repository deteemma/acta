// Ticket de tout type dans l'écran de données (ADR-0021, N11 ; ticket 18,
// décision 11) : onglets Fiche, Tickets de l'Epic (Epic seulement), Liens,
// Commentaires, Pièces jointes, Historique ; l'Action garde sa fiche (actions.tsx).
// « Nouveau ticket », où le type décide des champs, en fenêtre de dialogue (N15).
// Règles dans @app/shared (tickets.ts, roles.ts).
import {
  ACTION_DESCRIPTION_MAX_LENGTH,
  ACTION_TITLE_MAX_LENGTH,
  type ActionDto,
  type BabokDto,
  can,
  canBeAssignee,
  agileTechniqueInput,
  createActionSchema,
  createTicketSchema,
  isAssigneeRequired,
  epicProgress,
  type InitiativeDto,
  type InitiativeMemberDto,
  type InitiativeTreeNode,
  memberName,
  type MessageKey,
  newTicketTypes,
  offersAgileTechnique,
  RISK_LEVELS,
  selectableTicketStatuses,
  type RiskLevel,
  sortByReference,
  type StakeholderDto,
  TICKET_TABS,
  ticketHasField,
  ticketEpicOptions,
  type TicketDto,
  type TicketRow,
  type TicketStatus,
  type TicketTab,
  type TicketType,
  type TicketVersionDto,
  updateTicketSchema,
} from '@app/shared';
import { useEffect, useState } from 'react';
import { ActionSheet, AgileTechniqueField, TaskOptions, TechniqueOptions, TermLabel } from './actions';
import { api, ApiError } from './api';
import { DataScreen } from './data-screen';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { useTicketLabels, useTicketTypes } from './ticket-types';
import { formatDate } from './initiative-sheet';
import { Dialog, useCloseSilently } from './dialogs';
import { useOpenNode } from './references';
import { RichText, RichTextEditor } from './rich-text';
import { StakeholderLink } from './stakeholder-screen';
import { TicketAttachments } from './attachments';
import { TicketComments } from './comments';
import { TicketLinks } from './link-sections';
import { EpicLink, EpicSelect, TicketAudit, TicketHistory, TicketStatusLabel } from './ticket-parts';
import { useUnsavedForm } from './unsaved-changes';

const canEditTicket = (ticket: Pick<TicketDto, 'initiative'>) =>
  can(ticket.initiative.myRole, 'editActions', { archived: ticket.initiative.archived });

/** Fiche chargée : l'Action a la sienne, avec la tâche et la technique BABOK. */
type LoadedTicket = { kind: 'action'; dto: ActionDto } | { kind: 'ticket'; dto: TicketDto };

/** Onglets du ticket : Tickets de l'Epic pour un Epic seulement (le type sans champ Epic). */
const ticketTabs = (type: TicketType): TicketTab[] =>
  TICKET_TABS.filter((tab) => tab !== 'epic' || !ticketHasField(type, 'epic'));

export function TicketScreen({
  initiative,
  row,
  rows,
  members,
  stakeholders,
  babok,
  tab: asked,
  crumbs,
  onCrumb,
  actionsVersion,
  myId,
  onTab,
  onChanged,
  onDeleted,
}: {
  initiative: InitiativeDto;
  /** Ligne du ticket dans la liste de l'initiative : son type, son en-tête avant chargement. */
  row: TicketRow;
  /** Tickets de l'initiative, d'où viennent les Epics proposés et les tickets d'un Epic. */
  rows: TicketRow[];
  members: InitiativeMemberDto[];
  stakeholders: StakeholderDto[];
  babok: BabokDto | null;
  tab: TicketTab;
  crumbs: InitiativeTreeNode[];
  onCrumb: (node: InitiativeTreeNode) => void;
  /** Change à chaque écriture sur un ticket ou un lien : les liens se rechargent. */
  actionsVersion: number;
  /** Pour savoir quels commentaires sont les miens. */
  myId: string | null;
  /** Autre onglet : une adresse de plus, gardée par l'alerte. */
  onTab: (tab: TicketTab) => void;
  /** Ticket modifié, ou lien créé ou retiré : les listes et l'arborescence suivent. */
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const { typeLabel } = useTicketLabels();
  const [loaded, setLoaded] = useState<LoadedTicket | null>(null);
  const [versions, setVersions] = useState<TicketVersionDto[]>([]);
  // Augmente à chaque enregistrement : l'historique se recharge.
  const [saveCount, setSaveCount] = useState(0);
  const [error, setError] = useState<UiError | null>(null);
  const initiativeId = initiative.id;
  const isAction = row.type === 'action';

  useEffect(() => {
    const load: Promise<LoadedTicket> = isAction
      ? api.getAction(initiativeId, row.id).then((dto) => ({ kind: 'action', dto }))
      : api.getTicket(initiativeId, row.id).then((dto) => ({ kind: 'ticket', dto }));
    load.then(setLoaded, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, row.id, isAction]);

  useEffect(() => {
    (isAction ? api.actionHistory(initiativeId, row.id) : api.ticketHistory(initiativeId, row.id)).then(setVersions, (e: unknown) =>
      setError(toUiError(e)),
    );
  }, [initiativeId, row.id, isAction, saveCount]);

  const saved = (next: LoadedTicket) => {
    setLoaded(next);
    setSaveCount((count) => count + 1);
    onChanged();
  };

  const ticket = loaded?.dto;
  const tabs = ticketTabs(row.type);
  const tab = tabs.includes(asked) ? asked : 'sheet';
  const epicTickets = sortByReference(rows.filter((r) => r.epic?.id === row.id));
  return (
    <DataScreen
      crumbs={crumbs}
      onCrumb={onCrumb}
      kind={typeLabel(row.type)}
      reference={row.reference}
      title={ticket?.title ?? row.title}
      badges={<TicketStatusLabel type={row.type} status={ticket?.status ?? row.status} />}
      tabs={tabs.map((id) => ({
        id,
        label: t(`ticketTab.${id}` as MessageKey),
        ...(id === 'epic' && { count: epicTickets.length }),
      }))}
      tab={tab}
      onTab={onTab}
    >
      {initiative.archivedAt && <p className="notice">{t('initiative.archived')}</p>}
      <ErrorMessage error={error} />
      {!loaded || !ticket ? (
        !error && <p>{t('common.loading')}</p>
      ) : (
        <>
          {tab === 'sheet' &&
            (loaded.kind === 'action' ? (
              babok ? (
                <ActionSheet
                  babok={babok}
                  action={loaded.dto}
                  members={members}
                  stakeholders={stakeholders}
                  rows={rows}
                  onSaved={(dto) => saved({ kind: 'action', dto })}
                  onDeleted={onDeleted}
                />
              ) : (
                <p>{t('common.loading')}</p>
              )
            ) : (
              <TicketSheet
                ticket={loaded.dto}
                members={members}
                stakeholders={stakeholders}
                rows={rows}
                onSaved={(dto) => saved({ kind: 'ticket', dto })}
                onDeleted={onDeleted}
              />
            ))}
          {tab === 'epic' && <EpicTickets epicId={row.id} own={epicTickets} initiativeId={initiativeId} rows={rows} />}
          {tab === 'links' && (
            <TicketLinks
              initiativeId={initiativeId}
              ticketId={row.id}
              canEdit={can(ticket.initiative.myRole, 'editLinks', { archived: ticket.initiative.archived })}
              version={actionsVersion}
              onChanged={onChanged}
            />
          )}
          {tab === 'comments' && (
            <TicketComments initiativeId={initiativeId} ticketId={row.id} initiative={ticket.initiative} myId={myId} />
          )}
          {tab === 'attachments' && <TicketAttachments initiativeId={initiativeId} ticketId={row.id} initiative={ticket.initiative} />}
          {tab === 'history' && <TicketHistory type={row.type} babok={isAction ? babok : null} versions={versions} />}
        </>
      )}
    </DataScreen>
  );
}

/** Onglet Fiche d'un ticket autre que l'Action : champs, auteurs et dates, suppression. */
function TicketSheet({
  ticket,
  members,
  stakeholders,
  rows,
  onSaved,
  onDeleted,
}: {
  ticket: TicketDto;
  members: InitiativeMemberDto[];
  stakeholders: StakeholderDto[];
  rows: TicketRow[];
  onSaved: (ticket: TicketDto) => void;
  onDeleted: () => void;
}) {
  return (
    <>
      {canEditTicket(ticket) ? (
        <TicketForm ticket={ticket} members={members} stakeholders={stakeholders} rows={rows} onSaved={onSaved} />
      ) : (
        <TicketDetails ticket={ticket} />
      )}
      <TicketAudit ticket={ticket} />
      {canEditTicket(ticket) && <DeleteTicket ticket={ticket} onDeleted={onDeleted} />}
    </>
  );
}

/** Onglet Tickets de l'Epic : ses tickets et le nombre de fermés. */
function EpicTickets({
  epicId,
  own,
  initiativeId,
  rows,
}: {
  epicId: string;
  /** Ses tickets, par référence. */
  own: TicketRow[];
  initiativeId: string;
  rows: TicketRow[];
}) {
  const { t } = useI18n();
  const ticketTypes = useTicketTypes();
  const openNode = useOpenNode();
  return (
    <section className="epic-tickets">
      {own.length === 0 ? (
        <p>
          <small>{t('ticket.epicTicketsEmpty')}</small>
        </p>
      ) : (
        <>
          <p>
            <small>{t('ticket.epicClosed', epicProgress(ticketTypes, rows, epicId))}</small>
          </p>
          <ul className="links">
            {own.map((row) => (
              <li key={row.id}>
                <button type="button" className="link" onClick={() => openNode(initiativeId, { kind: 'ticket', id: row.id })}>
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
  // Liste relue à l'ouverture : un statut ajouté ou désactivé entre-temps est à jour.
  const ticketTypes = useTicketTypes({ fresh: true });
  const { statusLabel } = useTicketLabels();
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
          {selectableTicketStatuses(ticketTypes, ticket.type, ticket.status).map((s) => (
            <option key={s.code} value={s.code}>
              {statusLabel(ticket.type, s.code)}
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
 * « Nouveau ticket », en fenêtre de dialogue (N15) : le type d'abord, qui ne
 * changera plus, puis les champs qu'il prévoit. Tout ticket naît dans le statut
 * initial de son type ; créé, il s'ouvre dans l'écran de données. Le responsable
 * d'une Action est obligatoire : par défaut, la personne qui crée ; il est
 * facultatif pour les autres types.
 */
export function CreateTicketDialog({
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
  /** Créé : les listes se rechargent, l'écran de données l'affiche. */
  onCreated: (ticketId: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const ticketTypes = useTicketTypes({ fresh: true });
  const { typeLabel } = useTicketLabels();
  const closeSilently = useCloseSilently();
  // Types actifs seulement : un type désactivé n'est plus proposé à la création.
  const types = newTicketTypes(ticketTypes, !!proposedEpicId).map((option) => option.code);
  const [type, setType] = useState<TicketType>(types[0]!);
  const [title, setTitle] = useState('');
  const [chosenAssignee, setChosenAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [epicId, setEpicId] = useState(proposedEpicId ?? '');
  const [taskId, setTaskId] = useState('');
  const [techniqueId, setTechniqueId] = useState('');
  const [agileTechniqueId, setAgileTechniqueId] = useState('');
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
    {
      type,
      title,
      chosenAssignee,
      dueDate,
      epicId,
      taskId,
      techniqueId,
      agileTechniqueId,
      questionedIds,
      probability,
      impact,
      description,
    },
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
          // Initiative sans Extension Agile : le champ n'est ni affiché ni envoyé (D14).
          ...agileTechniqueInput(initiative, agileTechniqueId),
          assigneeId: assigneeId || undefined,
        });
        if (!parsed.success) {
          setError({ key: 'action.invalid' });
          return false;
        }
        const action = await api.createAction(initiativeId, parsed.data);
        // Saisie enregistrée : pas d'alerte.
        closeSilently();
        onCreated(action.id);
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
      closeSilently();
      onCreated(ticket.id);
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
    <Dialog
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
                {typeLabel(option)}
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
            {offersAgileTechnique(initiative) && (
              <AgileTechniqueField babok={babok} value={agileTechniqueId} onChange={setAgileTechniqueId} />
            )}
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
    </Dialog>
  );
}
