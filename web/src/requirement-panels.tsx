// Exigences (ticket 10) : liste d'une initiative, fiche d'une exigence dans un
// panneau latéral, avec son historique. Règles dans @app/shared
// (requirements.ts, references.ts, roles.ts).
import {
  type ActionDto,
  type BabokDto,
  can,
  createRequirementSchema,
  createsParentCycle,
  englishTermTooltip,
  type InitiativeDto,
  INITIAL_REQUIREMENT_STATUS,
  type NeedDto,
  REQUIREMENT_STATEMENT_MAX_LENGTH,
  REQUIREMENT_STATUSES,
  REQUIREMENT_SUBTYPES,
  REQUIREMENT_TITLE_MAX_LENGTH,
  REQUIREMENT_TYPES,
  type RequirementChange,
  type RequirementDto,
  requirementHistory,
  type RequirementRefDto,
  type RequirementStatus,
  type RequirementSubtype,
  type RequirementType,
  type RequirementVersionDto,
  sortByDueDate,
  type StakeholderDto,
} from '@app/shared';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { ActionList } from './action-panels';
import { api, ApiError } from './api';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { NeedLink } from './need-panels';
import { Panel, usePanels } from './panels';
import { RichText, RichTextEditor } from './rich-text';
import { StakeholderLink } from './stakeholder-panels';
import { formatDateTime, memberName } from './team-section';

export const canEditRequirements = (initiative: InitiativeDto) =>
  can(initiative.myRole, 'editRequirements', { archived: initiative.archivedAt != null });

/** Bouton qui ouvre la fiche d'une exigence : sa référence et son titre. */
export function RequirementLink({ initiativeId, requirement }: { initiativeId: string; requirement: RequirementRefDto }) {
  const { open } = usePanels();
  return (
    <button
      type="button"
      className="link"
      onClick={() => open({ kind: 'requirement', initiativeId, requirementId: requirement.id })}
    >
      <strong>{requirement.reference}</strong> {requirement.title}
    </button>
  );
}

/** Type d'exigence (terme du BABOK, l'anglais en info-bulle), avec son sous-type. */
function TypeLabel({ type, subtype }: { type: RequirementType; subtype: RequirementSubtype | null }) {
  const { t, locale } = useI18n();
  return (
    <span title={englishTermTooltip(locale, `requirementType.${type}`)}>
      {t(`requirementType.${type}`)}
      {subtype && ` (${t(`requirementSubtype.${subtype}`)})`}
    </span>
  );
}

function StatusLabel({ status }: { status: RequirementStatus }) {
  const { t, locale } = useI18n();
  return <span title={englishTermTooltip(locale, `requirementStatus.${status}`)}>{t(`requirementStatus.${status}`)}</span>;
}

/** Exigences, dans l'ordre reçu (par référence), avec leur type et leur statut. */
export function RequirementList({ requirements }: { requirements: RequirementDto[] }) {
  return (
    <ul className="links action-list">
      {requirements.map((r) => (
        <li key={r.id}>
          <RequirementLink initiativeId={r.initiativeId} requirement={r} />
          <span className="action-meta">
            <small>
              <TypeLabel type={r.type} subtype={r.subtype} />
            </small>
            <span className="badge">
              <StatusLabel status={r.status} />
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Fiche d'une exigence ; sans `requirementId`, création. */
export function RequirementPanel({
  babok,
  initiativeId,
  requirementId,
  actionsVersion,
  stakeholdersVersion,
  needsVersion,
  onChanged,
  onClose,
}: {
  babok: BabokDto | null;
  initiativeId: string;
  requirementId?: string;
  /** Change à chaque écriture sur une action : les actions liées se rechargent. */
  actionsVersion: number;
  /** Change à chaque écriture sur une partie prenante : les choix se rechargent. */
  stakeholdersVersion: number;
  /** De même pour les besoins. */
  needsVersion: number;
  /** Une exigence a été créée, modifiée ou supprimée : les listes se rechargent. */
  onChanged: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { replace } = usePanels();
  const [initiative, setInitiative] = useState<InitiativeDto | null>(null);
  const [requirement, setRequirement] = useState<RequirementDto | null>(null);
  const [stakeholders, setStakeholders] = useState<StakeholderDto[] | null>(null);
  const [needs, setNeeds] = useState<NeedDto[] | null>(null);
  // Toutes les exigences de l'initiative : choix de la parente, exigences enfants.
  const [requirements, setRequirements] = useState<RequirementDto[] | null>(null);
  const [actions, setActions] = useState<ActionDto[]>([]);
  const [versions, setVersions] = useState<RequirementVersionDto[]>([]);
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    api.getInitiative(initiativeId).then(setInitiative, (e: unknown) => setError(toUiError(e)));
    if (requirementId) {
      api.getRequirement(initiativeId, requirementId).then(setRequirement, (e: unknown) => setError(toUiError(e)));
    }
  }, [initiativeId, requirementId]);

  useEffect(() => {
    api.listStakeholders(initiativeId).then(setStakeholders, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, stakeholdersVersion]);

  useEffect(() => {
    api.listNeeds(initiativeId).then(setNeeds, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, needsVersion]);

  // Relue après chaque enregistrement de cette fiche : une parente ou un enfant a pu changer.
  useEffect(() => {
    api.listRequirements(initiativeId).then(setRequirements, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, requirement?.updatedAt]);

  useEffect(() => {
    if (!requirementId) return;
    api.listActions(initiativeId).then(setActions, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, requirementId, actionsVersion]);

  useEffect(() => {
    if (!requirementId) return;
    api.requirementHistory(initiativeId, requirementId).then(setVersions, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, requirementId, requirement?.updatedAt]);

  const linkedActions = sortByDueDate(actions.filter((a) => a.requirements.some((r) => r.id === requirementId)));
  const children = (requirements ?? []).filter((r) => r.parent?.id === requirementId);
  const ready = initiative && stakeholders && needs && requirements && (!requirementId || requirement);

  return (
    <Panel
      title={
        requirement
          ? `${requirement.reference} · ${requirement.title}`
          : requirementId
            ? t('common.loading')
            : t('requirements.new')
      }
      onClose={onClose}
    >
      <ErrorMessage error={error} />
      {ready && (
        <>
          {initiative.archivedAt && <p className="notice">{t('initiative.archived')}</p>}
          {canEditRequirements(initiative) ? (
            <RequirementForm
              initiativeId={initiativeId}
              requirement={requirement ?? undefined}
              stakeholders={stakeholders}
              needs={needs}
              requirements={requirements}
              onSaved={(next) => {
                setRequirement(next);
                onChanged();
                if (!requirement) replace({ kind: 'requirement', initiativeId, requirementId: next.id });
              }}
            />
          ) : (
            requirement && <RequirementDetails requirement={requirement} />
          )}
          {requirement && (
            <>
              <h3>{t('requirement.children')}</h3>
              <RequirementList requirements={children} />
              {children.length === 0 && <p>{t('requirement.noChildren')}</p>}
              <h3>{t('requirement.actions')}</h3>
              <ActionList actions={linkedActions} babok={babok} />
              {linkedActions.length === 0 && <p>{t('requirement.noActions')}</p>}
              <History versions={versions} />
              {canEditRequirements(initiative) && (
                <DeleteRequirement
                  requirement={requirement}
                  onDeleted={() => {
                    onChanged();
                    onClose();
                  }}
                />
              )}
            </>
          )}
        </>
      )}
    </Panel>
  );
}

/** Fiche en lecture seule : lecteur, ou initiative archivée. */
function RequirementDetails({ requirement }: { requirement: RequirementDto }) {
  const { t } = useI18n();
  const none = (key: Parameters<typeof t>[0]) => <small>{t(key)}</small>;
  return (
    <dl>
      <dt>{t('requirement.reference')}</dt>
      <dd>{requirement.reference}</dd>
      <dt>{t('requirement.type')}</dt>
      <dd>
        <TypeLabel type={requirement.type} subtype={requirement.subtype} />
      </dd>
      <dt>{t('requirement.status')}</dt>
      <dd>
        <StatusLabel status={requirement.status} />
      </dd>
      <dt>{t('requirement.needs')}</dt>
      <dd>
        {requirement.needs.length === 0 ? (
          none('requirement.noNeeds')
        ) : (
          <ul className="links">
            {requirement.needs.map((n) => (
              <li key={n.id}>
                <NeedLink initiativeId={requirement.initiativeId} need={n} />
              </li>
            ))}
          </ul>
        )}
      </dd>
      <dt>{t('requirement.parent')}</dt>
      <dd>
        {requirement.parent ? (
          <RequirementLink initiativeId={requirement.initiativeId} requirement={requirement.parent} />
        ) : (
          none('requirement.noParent')
        )}
      </dd>
      <dt>{t('requirement.stakeholders')}</dt>
      <dd>
        {requirement.stakeholders.length === 0 ? (
          none('requirement.noStakeholders')
        ) : (
          <ul className="links">
            {requirement.stakeholders.map((s) => (
              <li key={s.id}>
                <StakeholderLink initiativeId={requirement.initiativeId} stakeholder={s} />
              </li>
            ))}
          </ul>
        )}
      </dd>
      <dt>{t('requirement.statement')}</dt>
      <dd>
        <RichText source={requirement.statement} />
      </dd>
    </dl>
  );
}

function RequirementForm({
  initiativeId,
  requirement,
  stakeholders,
  needs,
  requirements,
  onSaved,
}: {
  initiativeId: string;
  /** Absent à la création. */
  requirement?: RequirementDto;
  /** Parties prenantes de l'initiative, que l'on peut désigner comme sources. */
  stakeholders: StakeholderDto[];
  /** Besoins de l'initiative, par référence. */
  needs: NeedDto[];
  /** Exigences de l'initiative, par référence : parentes possibles. */
  requirements: RequirementDto[];
  onSaved: (requirement: RequirementDto) => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState(requirement?.title ?? '');
  const [type, setType] = useState<RequirementType>(requirement?.type ?? 'business');
  const [subtype, setSubtype] = useState<RequirementSubtype>(requirement?.subtype ?? 'functional');
  const [status, setStatus] = useState<RequirementStatus>(requirement?.status ?? INITIAL_REQUIREMENT_STATUS);
  const [statement, setStatement] = useState(requirement?.statement ?? '');
  const [stakeholderIds, setStakeholderIds] = useState<readonly string[]>(
    requirement?.stakeholders.map((s) => s.id) ?? [],
  );
  const [needIds, setNeedIds] = useState<readonly string[]>(requirement?.needs.map((n) => n.id) ?? []);
  const [parentId, setParentId] = useState(requirement?.parent?.id ?? '');
  const [error, setError] = useState<UiError | null>(null);
  const [saved, setSaved] = useState(false);

  const toggle = (id: string) => (current: readonly string[]) =>
    current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  // Parentes possibles : ni l'exigence elle-même, ni ses descendantes.
  const tree = requirements.map((r) => ({ id: r.id, parentId: r.parent?.id ?? null }));
  const parents = requirement ? requirements.filter((r) => !createsParentCycle(tree, requirement.id, r.id)) : requirements;

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    // Même schéma de validation que l'API (@app/shared) ; le formulaire envoie
    // tous les champs, la fiche complète vaut aussi pour une modification.
    const parsed = createRequirementSchema.safeParse({
      title,
      statement,
      type,
      subtype: type === 'solution' ? subtype : null,
      stakeholderIds,
      needIds,
      parentId: parentId || null,
    });
    if (!parsed.success) {
      setError({ key: 'requirement.invalid' });
      return;
    }
    try {
      onSaved(
        requirement
          ? await api.updateRequirement(initiativeId, requirement.id, { ...parsed.data, status })
          : await api.createRequirement(initiativeId, parsed.data),
      );
      setError(null);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 400 && !e.refusal ? { key: 'requirement.invalid' } : toUiError(e));
    }
  }

  return (
    <form className="stacked" onSubmit={(e) => void save(e)} onChange={() => setSaved(false)}>
      {requirement && (
        <label>
          {t('requirement.reference')}
          <input value={requirement.reference} readOnly aria-readonly="true" />
        </label>
      )}
      <label>
        {t('requirement.title')}
        <input
          data-autofocus={requirement ? undefined : true}
          value={title}
          maxLength={REQUIREMENT_TITLE_MAX_LENGTH}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        {t('requirement.type')}
        <select value={type} onChange={(e) => setType(e.target.value as RequirementType)}>
          {REQUIREMENT_TYPES.map((v) => (
            <option key={v} value={v}>
              {t(`requirementType.${v}`)}
            </option>
          ))}
        </select>
      </label>
      {type === 'solution' && (
        <label>
          {t('requirement.subtype')}
          <select value={subtype} onChange={(e) => setSubtype(e.target.value as RequirementSubtype)}>
            {REQUIREMENT_SUBTYPES.map((v) => (
              <option key={v} value={v}>
                {t(`requirementSubtype.${v}`)}
              </option>
            ))}
          </select>
        </label>
      )}
      {/* À la création, le statut est Proposée. */}
      {requirement && (
        <label>
          {t('requirement.status')}
          <select value={status} onChange={(e) => setStatus(e.target.value as RequirementStatus)}>
            {REQUIREMENT_STATUSES.map((v) => (
              <option key={v} value={v}>
                {t(`requirementStatus.${v}`)}
              </option>
            ))}
          </select>
        </label>
      )}
      <fieldset>
        <legend>{t('requirement.needs')}</legend>
        <small>{t('requirement.originHint')}</small>
        {needs.length === 0 && <small>{t('needs.sectionEmpty')}</small>}
        {needs.map((n) => (
          <label key={n.id} className="inline">
            <input type="checkbox" checked={needIds.includes(n.id)} onChange={() => setNeedIds(toggle(n.id))} />
            <strong>{n.reference}</strong> {n.title}
          </label>
        ))}
      </fieldset>
      <label>
        {t('requirement.parent')}
        <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">{t('requirement.noParent')}</option>
          {parents.map((r) => (
            <option key={r.id} value={r.id}>
              {r.reference} {r.title}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>{t('requirement.stakeholders')}</legend>
        {stakeholders.length === 0 && <small>{t('stakeholders.sectionEmpty')}</small>}
        {stakeholders.map((s) => (
          <label key={s.id} className="inline">
            <input
              type="checkbox"
              checked={stakeholderIds.includes(s.id)}
              onChange={() => setStakeholderIds(toggle(s.id))}
            />
            {s.name}
          </label>
        ))}
      </fieldset>
      <RichTextEditor
        label={t('requirement.statement')}
        value={statement}
        maxLength={REQUIREMENT_STATEMENT_MAX_LENGTH}
        onChange={(value) => {
          setStatement(value);
          setSaved(false);
        }}
      />
      <button type="submit">{requirement ? t('requirement.save') : t('requirement.create')}</button>
      <ErrorMessage error={error} />
      <p role="status">{saved && t('requirement.saved')}</p>
    </form>
  );
}

/** Historique complet : qui, quand, et pour chaque champ modifié l'ancienne et la nouvelle valeur. */
function History({ versions }: { versions: RequirementVersionDto[] }) {
  const { t, locale } = useI18n();
  return (
    <section className="requirement-history">
      <h3>{t('requirement.history')}</h3>
      <ol>
        {requirementHistory(versions).map((entry) => (
          <li key={entry.changedAt + entry.kind}>
            <small>
              {t(entry.kind === 'created' ? 'requirement.historyCreated' : 'requirement.historyUpdated', {
                date: formatDateTime(locale, entry.changedAt),
                name: memberName(entry.changedBy),
              })}
            </small>
            {entry.changes.length > 0 && (
              <ul>
                {entry.changes.map((change) => (
                  <ChangeLine key={change.field} change={change} />
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Libellé du champ modifié, dans la langue de l'interface. */
const FIELD_LABELS = {
  title: 'requirement.title',
  statement: 'requirement.statement',
  type: 'requirement.type',
  subtype: 'requirement.subtype',
  status: 'requirement.status',
  stakeholders: 'requirement.stakeholders',
  needs: 'requirement.needs',
  parent: 'requirement.parent',
} as const satisfies Record<RequirementChange['field'], Parameters<ReturnType<typeof useI18n>['t']>[0]>;

function ChangeLine({ change }: { change: RequirementChange }) {
  const { t } = useI18n();
  const empty = <em>{t('requirement.historyEmpty')}</em>;
  const label = t(FIELD_LABELS[change.field]);
  // L'énoncé, souvent long, s'affiche en entier à la demande.
  if (change.field === 'statement') {
    return (
      <li>
        <details>
          <summary>{label}</summary>
          <p>
            <strong>{t('requirement.historyBefore')}</strong>
          </p>
          <RichText source={change.from} />
          <p>
            <strong>{t('requirement.historyAfter')}</strong>
          </p>
          <RichText source={change.to} />
        </details>
      </li>
    );
  }
  const value = (): [ReactNode, ReactNode] => {
    switch (change.field) {
      case 'title':
        return [change.from, change.to];
      case 'type':
        return [t(`requirementType.${change.from}`), t(`requirementType.${change.to}`)];
      case 'subtype':
        return [
          change.from ? t(`requirementSubtype.${change.from}`) : empty,
          change.to ? t(`requirementSubtype.${change.to}`) : empty,
        ];
      case 'status':
        return [t(`requirementStatus.${change.from}`), t(`requirementStatus.${change.to}`)];
      case 'stakeholders':
        return [
          change.from.length ? change.from.map((s) => s.name).join(', ') : empty,
          change.to.length ? change.to.map((s) => s.name).join(', ') : empty,
        ];
      case 'needs':
        return [
          change.from.length ? change.from.map((n) => n.reference).join(', ') : empty,
          change.to.length ? change.to.map((n) => n.reference).join(', ') : empty,
        ];
      case 'parent':
        return [change.from?.reference ?? empty, change.to?.reference ?? empty];
    }
  };
  const [from, to] = value();
  return (
    <li>
      {label} : {from} → {to}
    </li>
  );
}

/** Suppression après confirmation ; refusée si l'exigence est liée à une action ou a des enfants. */
function DeleteRequirement({ requirement, onDeleted }: { requirement: RequirementDto; onDeleted: () => void }) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<UiError | null>(null);

  async function remove() {
    try {
      await api.deleteRequirement(requirement.initiativeId, requirement.id);
      onDeleted();
    } catch (e) {
      setConfirming(false);
      setError(toUiError(e));
    }
  }

  return (
    <section className="owner-actions">
      {confirming ? (
        <div role="alertdialog" aria-labelledby="requirement-delete-confirm" className="confirm">
          <p id="requirement-delete-confirm">
            {t('requirement.deleteConfirm', { reference: requirement.reference, title: requirement.title })}
          </p>
          <button type="button" autoFocus onClick={() => setConfirming(false)}>
            {t('common.cancel')}
          </button>{' '}
          <button type="button" className="danger" onClick={() => void remove()}>
            {t('requirement.deleteConfirmButton')}
          </button>
        </div>
      ) : (
        <>
          <button type="button" className="danger" onClick={() => setConfirming(true)}>
            {t('requirement.delete')}
          </button>
          <p>
            <small>{t('requirement.deleteHint')}</small>
          </p>
        </>
      )}
      <ErrorMessage error={error} />
    </section>
  );
}
