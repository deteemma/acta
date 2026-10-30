// Actions (ticket 07) : fiche d'une action dans un panneau latéral, création
// rapide, liste. Règles dans @app/shared (actions.ts, roles.ts).
import {
  ACTION_DESCRIPTION_MAX_LENGTH,
  ACTION_STATUSES,
  ACTION_TITLE_MAX_LENGTH,
  type ActionDto,
  type ActionStatus,
  type BabokDto,
  type BabokElementDto,
  babokEnglishName,
  can,
  canBeAssignee,
  createActionSchema,
  englishTermTooltip,
  findBabokElement,
  type InitiativeDto,
  type InitiativeMemberDto,
  type StakeholderDto,
  techniqueChoices,
  tasksOfKnowledgeArea,
  updateActionSchema,
} from '@app/shared';
import { type FormEvent, useEffect, useId, useState } from 'react';
import { api, ApiError } from './api';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { formatDate } from './initiative-panels';
import { Panel, usePanels } from './panels';
import { RichText, RichTextEditor } from './rich-text';
import { StakeholderLink } from './stakeholder-panels';
import { formatDateTime, memberName } from './team-section';

const canEditActions = (action: Pick<ActionDto, 'initiative'>) =>
  can(action.initiative.myRole, 'editActions', { archived: action.initiative.archived });

/**
 * Tâche ou technique : son numéro et son nom, avec un aperçu au survol ou au
 * focus (nom anglais en français, résumé) ; le clic ouvre sa fiche.
 */
export function BabokPreview({ element }: { element: BabokElementDto }) {
  const { t, locale } = useI18n();
  const { open } = usePanels();
  const english = babokEnglishName(element, locale);
  // Une même tâche peut apparaître plusieurs fois dans une liste.
  const previewId = useId();
  return (
    <span className="babok-preview">
      <button
        type="button"
        className="link"
        aria-describedby={previewId}
        onClick={() => open({ kind: 'babokElement', elementId: element.id })}
      >
        <strong>{element.section}</strong> {element.name[locale]}
      </button>
      <span role="tooltip" id={previewId} className="preview-card">
        <small>
          {t(`babok.${element.kind}`)} · {t('babok.section', { section: element.section })}
        </small>
        {english && <em lang="en">{english}</em>}
        <span>{element.summary[locale]}</span>
      </span>
    </span>
  );
}

function StatusLabel({ status }: { status: ActionStatus }) {
  const { t } = useI18n();
  return <span className={`badge status-${status}`}>{t(`actionStatus.${status}`)}</span>;
}

/** Liste d'actions ; `showInitiative` pour « Mes actions », toutes initiatives confondues. */
export function ActionList({
  actions,
  babok,
  showInitiative,
}: {
  actions: ActionDto[];
  babok: BabokDto | null;
  showInitiative?: boolean;
}) {
  const { t, locale } = useI18n();
  const { open } = usePanels();
  return (
    <ul className="links action-list">
      {actions.map((a) => {
        const task = babok && findBabokElement(babok, a.taskId);
        return (
          <li key={a.id}>
            <button
              type="button"
              className="link"
              onClick={() => open({ kind: 'action', initiativeId: a.initiative.id, actionId: a.id })}
            >
              {showInitiative && <strong>{a.initiative.code} </strong>}
              {a.title}
            </button>
            <span className="action-meta">
              <StatusLabel status={a.status} />
              <small>{a.dueDate ? formatDate(locale, a.dueDate) : t('action.noDueDate')}</small>
              {showInitiative && a.initiative.archived && <small>{t('initiative.archived')}</small>}
              {/* Liste d'une initiative : le responsable, signalé s'il ne peut plus l'être. */}
              {!showInitiative && (
                <small>
                  <AssigneeName assignee={a.assignee} />
                </small>
              )}
              {task && <BabokPreview element={task} />}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Tâches du référentiel, groupées par domaine de connaissance. */
function TaskOptions({ babok }: { babok: BabokDto }) {
  const { locale } = useI18n();
  return babok.knowledgeAreas.map((area) => (
    <optgroup key={area.id} label={`${area.section} ${area.name[locale]}`}>
      {tasksOfKnowledgeArea(babok, area.id).map((task) => (
        <option key={task.id} value={task.id} title={babokEnglishName(task, locale)}>
          {task.section} {task.name[locale]}
        </option>
      ))}
    </optgroup>
  ));
}

/** Les 50 techniques, celles de la tâche en tête. */
function TechniqueOptions({ babok, taskId }: { babok: BabokDto; taskId: string }) {
  const { t, locale } = useI18n();
  const { ofTask, others } = techniqueChoices(babok, taskId);
  const options = (list: typeof ofTask) =>
    list.map((technique) => (
      <option key={technique.id} value={technique.id} title={babokEnglishName(technique, locale)}>
        {technique.section} {technique.name[locale]}
      </option>
    ));
  return (
    <>
      <option value="">{t('action.noTechnique')}</option>
      {ofTask.length > 0 && <optgroup label={t('action.techniquesOfTask')}>{options(ofTask)}</optgroup>}
      <optgroup label={t('action.otherTechniques')}>{options(others)}</optgroup>
    </>
  );
}

/** Libellé d'un terme du BABOK, l'anglais en info-bulle. */
function TermLabel({ term }: { term: 'babok.task' | 'babok.technique' }) {
  const { t, locale } = useI18n();
  return (
    <span title={englishTermTooltip(locale, term)}>
      {t(term === 'babok.task' ? 'action.task' : 'action.technique')}
    </span>
  );
}

export function ActionPanel({
  babok,
  initiativeId,
  actionId,
  stakeholdersVersion,
  onChanged,
  onClose,
}: {
  babok: BabokDto;
  initiativeId: string;
  actionId: string;
  /** Change à chaque écriture sur une partie prenante : les choix se rechargent. */
  stakeholdersVersion: number;
  /** Une action a été modifiée ou supprimée : les listes se rechargent. */
  onChanged: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [action, setAction] = useState<ActionDto | null>(null);
  const [members, setMembers] = useState<InitiativeMemberDto[] | null>(null);
  const [stakeholders, setStakeholders] = useState<StakeholderDto[] | null>(null);
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    api.getAction(initiativeId, actionId).then(setAction, (e: unknown) => setError(toUiError(e)));
    api.listMembers(initiativeId).then(setMembers, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, actionId]);

  useEffect(() => {
    api.listStakeholders(initiativeId).then(setStakeholders, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, stakeholdersVersion]);

  return (
    <Panel title={action ? `${action.initiative.code} · ${action.title}` : t('common.loading')} onClose={onClose}>
      <ErrorMessage error={error} />
      {action && (
        <>
          {action.initiative.archived && <p className="notice">{t('initiative.archived')}</p>}
          {canEditActions(action) && members && stakeholders ? (
            <ActionForm
              babok={babok}
              action={action}
              members={members}
              stakeholders={stakeholders}
              onSaved={(saved) => {
                setAction(saved);
                onChanged();
              }}
            />
          ) : (
            <ActionDetails babok={babok} action={action} />
          )}
          <AuditTrail action={action} />
          {canEditActions(action) && (
            <DeleteAction
              action={action}
              onDeleted={() => {
                onChanged();
                onClose();
              }}
            />
          )}
        </>
      )}
    </Panel>
  );
}

function AssigneeName({ assignee }: { assignee: ActionDto['assignee'] }) {
  const { t } = useI18n();
  return (
    <>
      {memberName(assignee)}
      {!assignee.eligible && <small> · {t('action.assigneeNotEligible')}</small>}
    </>
  );
}

/** Fiche en lecture seule : lecteur, ou initiative archivée. */
function ActionDetails({ babok, action }: { babok: BabokDto; action: ActionDto }) {
  const { t, locale } = useI18n();
  const task = findBabokElement(babok, action.taskId);
  const technique = action.techniqueId ? findBabokElement(babok, action.techniqueId) : undefined;
  const notSet = <small>{t('initiative.notSet')}</small>;
  return (
    <dl>
      <dt>{t('action.status')}</dt>
      <dd><StatusLabel status={action.status} /></dd>
      <dt><TermLabel term="babok.task" /></dt>
      <dd>{task ? <BabokPreview element={task} /> : action.taskId}</dd>
      <dt><TermLabel term="babok.technique" /></dt>
      <dd>{technique ? <BabokPreview element={technique} /> : notSet}</dd>
      <dt>{t('action.assignee')}</dt>
      <dd><AssigneeName assignee={action.assignee} /></dd>
      <dt>{t('action.dueDate')}</dt>
      <dd>{action.dueDate ? formatDate(locale, action.dueDate) : t('action.noDueDate')}</dd>
      <dt>{t('action.stakeholders')}</dt>
      <dd>
        {action.stakeholders.length === 0 ? (
          <small>{t('action.noStakeholders')}</small>
        ) : (
          <ul className="links">
            {action.stakeholders.map((s) => (
              <li key={s.id}>
                <StakeholderLink initiativeId={action.initiative.id} stakeholder={s} />
              </li>
            ))}
          </ul>
        )}
      </dd>
      <dt>{t('action.description')}</dt>
      <dd>{action.description ? <RichText source={action.description} /> : notSet}</dd>
    </dl>
  );
}

function ActionForm({
  babok,
  action,
  members,
  stakeholders,
  onSaved,
}: {
  babok: BabokDto;
  action: ActionDto;
  members: InitiativeMemberDto[];
  /** Parties prenantes de l'initiative, que l'on peut lier à l'action. */
  stakeholders: StakeholderDto[];
  onSaved: (action: ActionDto) => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState(action.title);
  const [status, setStatus] = useState(action.status);
  const [taskId, setTaskId] = useState(action.taskId);
  const [techniqueId, setTechniqueId] = useState(action.techniqueId ?? '');
  const [assigneeId, setAssigneeId] = useState(action.assignee.userId);
  const [dueDate, setDueDate] = useState(action.dueDate ?? '');
  const [description, setDescription] = useState(action.description ?? '');
  const [stakeholderIds, setStakeholderIds] = useState<readonly string[]>(action.stakeholders.map((s) => s.id));
  const [error, setError] = useState<UiError | null>(null);
  const [saved, setSaved] = useState(false);

  const toggleStakeholder = (id: string) =>
    setStakeholderIds((current) => (current.includes(id) ? current.filter((s) => s !== id) : [...current, id]));

  const task = findBabokElement(babok, taskId);
  const technique = techniqueId ? findBabokElement(babok, techniqueId) : undefined;
  // Responsables possibles ; l'actuel reste affiché s'il ne l'est plus.
  const assignees = members.filter((m) => canBeAssignee(m.role));
  const keepsIneligible = !assignees.some((m) => m.userId === action.assignee.userId);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    // Même schéma de validation que l'API (@app/shared).
    const parsed = updateActionSchema.safeParse({
      title,
      status,
      taskId,
      techniqueId: techniqueId || null,
      ...(assigneeId !== action.assignee.userId ? { assigneeId } : {}),
      dueDate: dueDate || null,
      description,
      stakeholderIds,
    });
    if (!parsed.success) {
      setError({ key: 'action.invalid' });
      return;
    }
    try {
      onSaved(await api.updateAction(action.initiative.id, action.id, parsed.data));
      setError(null);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 400 && !e.refusal ? { key: 'action.invalid' } : toUiError(e));
    }
  }

  return (
    <form className="stacked" onSubmit={(e) => void save(e)} onChange={() => setSaved(false)}>
      <label>
        {t('action.title')}
        <input value={title} maxLength={ACTION_TITLE_MAX_LENGTH} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        {t('action.status')}
        <select value={status} onChange={(e) => setStatus(e.target.value as ActionStatus)}>
          {ACTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`actionStatus.${s}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <TermLabel term="babok.task" />
        <select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
          <TaskOptions babok={babok} />
        </select>
      </label>
      {task && <BabokPreview element={task} />}
      <label>
        <TermLabel term="babok.technique" />
        <select value={techniqueId} onChange={(e) => setTechniqueId(e.target.value)}>
          <TechniqueOptions babok={babok} taskId={taskId} />
        </select>
      </label>
      {technique && <BabokPreview element={technique} />}
      <label>
        {t('action.assignee')}
        <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          {keepsIneligible && (
            <option value={action.assignee.userId}>
              {memberName(action.assignee)} · {t('action.assigneeNotEligible')}
            </option>
          )}
          {assignees.map((m) => (
            <option key={m.userId} value={m.userId}>
              {memberName(m)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('action.dueDate')}
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </label>
      <fieldset>
        <legend>{t('action.stakeholders')}</legend>
        {stakeholders.length === 0 && <small>{t('stakeholders.sectionEmpty')}</small>}
        {stakeholders.map((s) => (
          <label key={s.id} className="inline">
            <input type="checkbox" checked={stakeholderIds.includes(s.id)} onChange={() => toggleStakeholder(s.id)} />
            {s.name}
          </label>
        ))}
      </fieldset>
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

/** Date de création et de dernière modification, avec leur auteur. */
function AuditTrail({ action }: { action: ActionDto }) {
  const { t, locale } = useI18n();
  return (
    <p className="audit">
      <small>
        {t('action.created', { date: formatDateTime(locale, action.createdAt), name: memberName(action.createdBy) })}
        <br />
        {t('action.updated', { date: formatDateTime(locale, action.updatedAt), name: memberName(action.updatedBy) })}
      </small>
    </p>
  );
}

/** Suppression après confirmation ; une action liée à un autre objet s'annule plutôt (refus `linked`). */
function DeleteAction({ action, onDeleted }: { action: ActionDto; onDeleted: () => void }) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<UiError | null>(null);

  async function remove() {
    try {
      await api.deleteAction(action.initiative.id, action.id);
      onDeleted();
    } catch (e) {
      setConfirming(false);
      setError(toUiError(e));
    }
  }

  return (
    <section className="owner-actions">
      {confirming ? (
        <div role="alertdialog" aria-labelledby="action-delete-confirm" className="confirm">
          <p id="action-delete-confirm">{t('action.deleteConfirm', { title: action.title })}</p>
          <button type="button" autoFocus onClick={() => setConfirming(false)}>
            {t('common.cancel')}
          </button>{' '}
          <button type="button" className="danger" onClick={() => void remove()}>
            {t('action.deleteConfirmButton')}
          </button>
        </div>
      ) : (
        <>
          <button type="button" className="danger" onClick={() => setConfirming(true)}>
            {t('action.delete')}
          </button>
          <p>
            <small>{t('action.deleteHint')}</small>
          </p>
        </>
      )}
      <ErrorMessage error={error} />
    </section>
  );
}

/**
 * Création rapide, ouverte par le bouton flottant « + Action » : initiative,
 * titre, tâche BABOK ; la personne qui crée en est responsable. La fiche créée
 * remplace le panneau.
 */
export function CreateActionPanel({
  babok,
  initiatives,
  initiativeId,
  onCreated,
  onClose,
}: {
  babok: BabokDto;
  initiatives: InitiativeDto[];
  /** Initiative proposée d'abord (celle du panneau d'où l'on vient). */
  initiativeId?: string;
  onCreated: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { replace } = usePanels();
  const editable = initiatives.filter((i) => can(i.myRole, 'editActions', { archived: i.archivedAt != null }));
  const [chosenInitiative, setChosenInitiative] = useState(
    editable.find((i) => i.id === initiativeId)?.id ?? editable[0]?.id ?? '',
  );
  const [title, setTitle] = useState('');
  const [taskId, setTaskId] = useState('');
  const [error, setError] = useState<UiError | null>(null);
  const task = taskId ? findBabokElement(babok, taskId) : undefined;

  async function create(event: FormEvent) {
    event.preventDefault();
    // Même schéma de validation que l'API (@app/shared).
    const parsed = createActionSchema.safeParse({ title, taskId });
    if (!parsed.success || !chosenInitiative) {
      setError({ key: 'action.invalid' });
      return;
    }
    try {
      const action = await api.createAction(chosenInitiative, parsed.data);
      onCreated();
      replace({ kind: 'action', initiativeId: action.initiative.id, actionId: action.id });
    } catch (e) {
      setError(toUiError(e));
    }
  }

  return (
    <Panel title={t('actions.new')} showFab={false} onClose={onClose}>
      {editable.length === 0 ? (
        <p className="notice">{t('actions.noEditableInitiative')}</p>
      ) : (
        <form className="stacked" onSubmit={(e) => void create(e)}>
          <label>
            {t('action.initiative')}
            <select value={chosenInitiative} onChange={(e) => setChosenInitiative(e.target.value)}>
              {editable.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.code} · {i.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('action.title')}
            <input data-autofocus value={title} maxLength={ACTION_TITLE_MAX_LENGTH} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            <TermLabel term="babok.task" />
            <select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="" disabled>
                {t('action.chooseTask')}
              </option>
              <TaskOptions babok={babok} />
            </select>
          </label>
          {task && <BabokPreview element={task} />}
          <button type="submit">{t('action.create')}</button>
        </form>
      )}
      <ErrorMessage error={error} />
    </Panel>
  );
}
