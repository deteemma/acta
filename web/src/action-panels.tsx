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
  type NeedDto,
  type RequirementDto,
  type StakeholderDto,
  type ActionOrigin,
  analysisObjectLinks,
  type AnalysisObjectRef,
  rankTechniques,
  suggestTasks,
  type TechniqueCounts,
  type TechniqueDto,
  type TechniqueUsage,
  techniqueChoices,
  tasksOfKnowledgeArea,
  updateActionSchema,
} from '@app/shared';
import { type FormEvent, useEffect, useId, useState } from 'react';
import { api, ApiError } from './api';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { formatDate } from './initiative-panels';
import { NeedLink } from './need-panels';
import { RequirementLink } from './requirement-panels';
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

/** Statut d'une action ; avec `count`, le nombre d'actions à ce statut (tableau de bord). */
export function StatusLabel({ status, count }: { status: ActionStatus; count?: number }) {
  const { t } = useI18n();
  const label = t(`actionStatus.${status}`);
  return (
    <span className={`badge status-${status}`}>
      {count === undefined ? label : t('dashboard.statusCount', { status: label, count })}
    </span>
  );
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
  needsVersion,
  requirementsVersion,
  onChanged,
  onClose,
}: {
  babok: BabokDto;
  initiativeId: string;
  actionId: string;
  /** Change à chaque écriture sur une partie prenante : les choix se rechargent. */
  stakeholdersVersion: number;
  /** De même pour les besoins. */
  needsVersion: number;
  /** De même pour les exigences. */
  requirementsVersion: number;
  /** Une action a été modifiée ou supprimée : les listes se rechargent. */
  onChanged: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [action, setAction] = useState<ActionDto | null>(null);
  const [members, setMembers] = useState<InitiativeMemberDto[] | null>(null);
  const [stakeholders, setStakeholders] = useState<StakeholderDto[] | null>(null);
  const [needs, setNeeds] = useState<NeedDto[] | null>(null);
  const [requirements, setRequirements] = useState<RequirementDto[] | null>(null);
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    api.getAction(initiativeId, actionId).then(setAction, (e: unknown) => setError(toUiError(e)));
    api.listMembers(initiativeId).then(setMembers, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, actionId]);

  useEffect(() => {
    api.listStakeholders(initiativeId).then(setStakeholders, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, stakeholdersVersion]);

  useEffect(() => {
    api.listNeeds(initiativeId).then(setNeeds, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, needsVersion]);

  useEffect(() => {
    api.listRequirements(initiativeId).then(setRequirements, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, requirementsVersion]);

  return (
    <Panel title={action ? `${action.initiative.code} · ${action.title}` : t('common.loading')} onClose={onClose}>
      <ErrorMessage error={error} />
      {action && (
        <>
          {action.initiative.archived && <p className="notice">{t('initiative.archived')}</p>}
          {canEditActions(action) && members && stakeholders && needs && requirements ? (
            <ActionForm
              babok={babok}
              action={action}
              members={members}
              stakeholders={stakeholders}
              needs={needs}
              requirements={requirements}
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
      <dt>{t('action.needs')}</dt>
      <dd>
        {action.needs.length === 0 ? (
          <small>{t('action.noNeeds')}</small>
        ) : (
          <ul className="links">
            {action.needs.map((n) => (
              <li key={n.id}>
                <NeedLink initiativeId={action.initiative.id} need={n} />
              </li>
            ))}
          </ul>
        )}
      </dd>
      <dt>{t('action.requirements')}</dt>
      <dd>
        {action.requirements.length === 0 ? (
          <small>{t('action.noRequirements')}</small>
        ) : (
          <ul className="links">
            {action.requirements.map((r) => (
              <li key={r.id}>
                <RequirementLink initiativeId={action.initiative.id} requirement={r} />
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
  needs,
  requirements,
  onSaved,
}: {
  babok: BabokDto;
  action: ActionDto;
  members: InitiativeMemberDto[];
  /** Parties prenantes de l'initiative, que l'on peut lier à l'action. */
  stakeholders: StakeholderDto[];
  /** Besoins de l'initiative, par référence. */
  needs: NeedDto[];
  /** Exigences de l'initiative, par référence. */
  requirements: RequirementDto[];
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
  const [needIds, setNeedIds] = useState<readonly string[]>(action.needs.map((n) => n.id));
  const [requirementIds, setRequirementIds] = useState<readonly string[]>(action.requirements.map((r) => r.id));
  const [error, setError] = useState<UiError | null>(null);
  const [saved, setSaved] = useState(false);

  const toggleStakeholder = (id: string) =>
    setStakeholderIds((current) => (current.includes(id) ? current.filter((s) => s !== id) : [...current, id]));

  const toggleNeed = (id: string) =>
    setNeedIds((current) => (current.includes(id) ? current.filter((n) => n !== id) : [...current, id]));

  const toggleRequirement = (id: string) =>
    setRequirementIds((current) => (current.includes(id) ? current.filter((r) => r !== id) : [...current, id]));

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
      needIds,
      requirementIds,
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
      <fieldset>
        <legend>{t('action.needs')}</legend>
        {needs.length === 0 && <small>{t('needs.sectionEmpty')}</small>}
        {needs.map((n) => (
          <label key={n.id} className="inline">
            <input type="checkbox" checked={needIds.includes(n.id)} onChange={() => toggleNeed(n.id)} />
            <strong>{n.reference}</strong> {n.title}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>{t('action.requirements')}</legend>
        {requirements.length === 0 && <small>{t('requirements.sectionEmpty')}</small>}
        {requirements.map((r) => (
          <label key={r.id} className="inline">
            <input
              type="checkbox"
              checked={requirementIds.includes(r.id)}
              onChange={() => toggleRequirement(r.id)}
            />
            <strong>{r.reference}</strong> {r.title}
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

/** Bouton « Nouvelle action » d'une fiche : l'action est créée depuis cet objet et liée à lui (ticket 13). */
export function NewActionButton({ initiative, from }: { initiative: InitiativeDto; from: AnalysisObjectRef }) {
  const { t } = useI18n();
  const { open } = usePanels();
  if (!can(initiative.myRole, 'editActions', { archived: initiative.archivedAt != null })) return null;
  return (
    <button type="button" onClick={() => open({ kind: 'createAction', initiativeId: initiative.id, from })}>
      {t('actions.new')}
    </button>
  );
}

/** Objet d'origine, chargé pour la tâche proposée (statut d'une exigence) et son nom. */
interface LoadedOriginObject {
  origin: ActionOrigin;
  name: string;
}

async function loadOriginObject(initiativeId: string, from: AnalysisObjectRef): Promise<LoadedOriginObject> {
  switch (from.kind) {
    case 'stakeholder': {
      const stakeholder = (await api.listStakeholders(initiativeId)).find((s) => s.id === from.id);
      return { origin: { kind: 'stakeholder' }, name: stakeholder?.name ?? '' };
    }
    case 'need': {
      const need = await api.getNeed(initiativeId, from.id);
      return { origin: { kind: 'need' }, name: `${need.reference} ${need.title}` };
    }
    case 'requirement': {
      const requirement = await api.getRequirement(initiativeId, from.id);
      return {
        origin: { kind: 'requirement', status: requirement.status },
        name: `${requirement.reference} ${requirement.title}`,
      };
    }
  }
}

/**
 * Création rapide, ouverte par le bouton flottant « + Action » ou le bouton
 * « Nouvelle action » d'une fiche : initiative, titre, tâche BABOK, technique ;
 * la personne qui crée en est responsable. Tâches proposées selon l'origine et
 * techniques classées par usage : @app/shared (suggestions.ts) ; la première
 * tâche proposée est présélectionnée. La fiche créée remplace le panneau.
 */
export function CreateActionPanel({
  babok,
  initiatives,
  initiativeId,
  from,
  onCreated,
  onClose,
}: {
  babok: BabokDto;
  initiatives: InitiativeDto[];
  /** Initiative proposée d'abord (celle du panneau d'où l'on vient). */
  initiativeId?: string;
  /** Objet de l'initiative `initiativeId` depuis lequel l'action est créée. */
  from?: AnalysisObjectRef;
  onCreated: () => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { replace } = usePanels();
  const editable = initiatives.filter((i) => can(i.myRole, 'editActions', { archived: i.archivedAt != null }));
  const proposed = editable.find((i) => i.id === initiativeId);
  // Sans droit d'écriture sur l'initiative de l'objet, on ne part pas de cet objet.
  const originObject = proposed ? from : undefined;
  const [chosenInitiative, setChosenInitiative] = useState(proposed?.id ?? editable[0]?.id ?? '');
  const [title, setTitle] = useState('');
  // Tâche choisie par le BA ; à défaut, la première tâche proposée est présélectionnée.
  const [chosenTask, setChosenTask] = useState<string | null>(null);
  const [techniqueId, setTechniqueId] = useState('');
  const [loadedActions, setLoadedActions] = useState<{ initiativeId: string; actions: ActionDto[] } | null>(null);
  const [applicationCounts, setApplicationCounts] = useState<TechniqueCounts>({});
  const [loadedOriginObject, setLoadedOriginObject] = useState<LoadedOriginObject | null>(null);
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    api.techniqueUsage().then(setApplicationCounts, (e: unknown) => setError(toUiError(e)));
  }, []);

  useEffect(() => {
    if (!chosenInitiative) return;
    api.listActions(chosenInitiative).then(
      (actions) => setLoadedActions({ initiativeId: chosenInitiative, actions }),
      (e: unknown) => setError(toUiError(e)),
    );
  }, [chosenInitiative]);
  // Actions de l'initiative choisie ; null tant qu'elles se chargent.
  const initiativeActions = loadedActions?.initiativeId === chosenInitiative ? loadedActions.actions : null;

  // Partant d'un objet, l'initiative est figée : celle de l'objet.
  const originKind = originObject?.kind;
  const originId = originObject?.id;
  useEffect(() => {
    if (!originKind || !originId) return;
    loadOriginObject(chosenInitiative, { kind: originKind, id: originId }).then(setLoadedOriginObject, (e: unknown) =>
      setError(toUiError(e)),
    );
  }, [chosenInitiative, originKind, originId]);

  const origin: ActionOrigin | null = originObject
    ? (loadedOriginObject?.origin ?? null)
    : initiativeActions && { kind: 'initiative', hasActions: initiativeActions.length > 0 };
  const suggestions = origin ? suggestTasks(origin) : [];
  const taskId = chosenTask ?? suggestions[0]?.taskId ?? '';

  const task = taskId ? findBabokElement(babok, taskId) : undefined;
  const techniques = rankTechniques(babok, taskId, initiativeActions ?? [], applicationCounts);
  const technique = techniqueId ? findBabokElement(babok, techniqueId) : undefined;

  async function create(event: FormEvent) {
    event.preventDefault();
    // Même schéma de validation que l'API (@app/shared).
    const parsed = createActionSchema.safeParse({
      title,
      taskId,
      techniqueId: techniqueId || null,
      ...(originObject && analysisObjectLinks(originObject)),
    });
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

  const techniqueOption = (item: TechniqueDto, usage?: TechniqueUsage) => (
    <option key={item.id} value={item.id} title={babokEnglishName(item, locale)}>
      {item.section} {item.name[locale]}
      {usage && ` · ${t('suggestion.techniqueUsage', { ...usage })}`}
    </option>
  );

  return (
    <Panel title={t('actions.new')} showFab={false} onClose={onClose}>
      {editable.length === 0 ? (
        <p className="notice">{t('actions.noEditableInitiative')}</p>
      ) : (
        <form className="stacked" onSubmit={(e) => void create(e)}>
          <label>
            {t('action.initiative')}
            <select value={chosenInitiative} disabled={!!originObject} onChange={(e) => setChosenInitiative(e.target.value)}>
              {editable.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.code} · {i.name}
                </option>
              ))}
            </select>
          </label>
          {loadedOriginObject && <p>{t('action.linkedTo', { name: loadedOriginObject.name })}</p>}
          <label>
            {t('action.title')}
            <input data-autofocus value={title} maxLength={ACTION_TITLE_MAX_LENGTH} onChange={(e) => setTitle(e.target.value)} />
          </label>
          {suggestions.length > 0 && (
            <fieldset className="suggestions">
              <legend>{t('suggestion.tasks')}</legend>
              <ul>
                {suggestions.map((s) => {
                  const suggested = findBabokElement(babok, s.taskId);
                  return (
                    suggested && (
                      <li key={s.taskId}>
                        <button
                          type="button"
                          aria-pressed={taskId === s.taskId}
                          title={babokEnglishName(suggested, locale)}
                          onClick={() => setChosenTask(s.taskId)}
                        >
                          <strong>{suggested.section}</strong> {suggested.name[locale]}
                        </button>{' '}
                        <small>{t(`suggestion.task.${s.reason}`)}</small>
                      </li>
                    )
                  );
                })}
              </ul>
            </fieldset>
          )}
          <label>
            <TermLabel term="babok.task" />
            <select value={taskId} onChange={(e) => setChosenTask(e.target.value)}>
              <option value="" disabled>
                {t('action.chooseTask')}
              </option>
              <TaskOptions babok={babok} />
            </select>
          </label>
          {task && <BabokPreview element={task} />}
          <label>
            <TermLabel term="babok.technique" />
            <select value={techniqueId} onChange={(e) => setTechniqueId(e.target.value)}>
              <option value="">{t('action.noTechnique')}</option>
              {techniques.suggested.length > 0 && (
                <optgroup label={t('suggestion.techniques')}>
                  {techniques.suggested.map((s) => techniqueOption(s.technique, s.usage))}
                </optgroup>
              )}
              <optgroup label={t('action.otherTechniques')}>{techniques.others.map((o) => techniqueOption(o))}</optgroup>
            </select>
          </label>
          {technique && <BabokPreview element={technique} />}
          <button type="submit">{t('action.create')}</button>
        </form>
      )}
      <ErrorMessage error={error} />
    </Panel>
  );
}
