// Parties prenantes (ticket 08) : liste et matrice influence × intérêt d'une
// initiative, fiche d'une partie prenante dans un panneau latéral. Règles dans
// @app/shared (stakeholders.ts, roles.ts).
import {
  type ActionDto,
  type BabokDto,
  can,
  createStakeholderSchema,
  englishTermTooltip,
  type InitiativeDto,
  type InitiativeMemberDto,
  linkableMembers,
  type MessageKey,
  STAKEHOLDER_CONTACT_MAX_LENGTH,
  STAKEHOLDER_KINDS,
  STAKEHOLDER_LEVELS,
  STAKEHOLDER_NAME_MAX_LENGTH,
  STAKEHOLDER_NOTES_MAX_LENGTH,
  STAKEHOLDER_ROLES,
  type StakeholderDto,
  type StakeholderKind,
  type StakeholderLevel,
  type StakeholderRefDto,
  stakeholderMatrix,
  type StakeholderRole,
  sortByDueDate,
} from '@app/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { ActionList } from './action-panels';
import { api, ApiError } from './api';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { Panel, usePanels } from './panels';
import { RichText, RichTextEditor } from './rich-text';
import { formatDateTime, memberName } from './team-section';

const canEditStakeholders = (initiative: InitiativeDto) =>
  can(initiative.myRole, 'editStakeholders', { archived: initiative.archivedAt != null });

/** Libellé d'un terme du BABOK, l'anglais en info-bulle (ADR-0013). */
function Term({ term }: { term: MessageKey }) {
  const { t, locale } = useI18n();
  return <span title={englishTermTooltip(locale, term)}>{t(term)}</span>;
}

function RoleList({ roles }: { roles: readonly StakeholderRole[] }) {
  return roles.map((role, index) => (
    <span key={role}>
      {index > 0 && ', '}
      <Term term={`stakeholderRole.${role}`} />
    </span>
  ));
}

/** Bouton qui ouvre la fiche d'une partie prenante. */
export function StakeholderLink({ initiativeId, stakeholder }: { initiativeId: string; stakeholder: StakeholderRefDto }) {
  const { open } = usePanels();
  return (
    <button
      type="button"
      className="link"
      onClick={() => open({ kind: 'stakeholder', initiativeId, stakeholderId: stakeholder.id })}
    >
      {stakeholder.name}
    </button>
  );
}

/** Liste et matrice influence × intérêt des parties prenantes d'une initiative. */
export function StakeholdersPanel({
  initiativeId,
  version,
  onClose,
}: {
  initiativeId: string;
  /** Change à chaque écriture sur une partie prenante : la liste se recharge. */
  version: number;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { open } = usePanels();
  const [initiative, setInitiative] = useState<InitiativeDto | null>(null);
  const [stakeholders, setStakeholders] = useState<StakeholderDto[] | null>(null);
  const [view, setView] = useState<'list' | 'matrix'>('list');
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    Promise.all([api.getInitiative(initiativeId), api.listStakeholders(initiativeId)]).then(([i, s]) => {
      setInitiative(i);
      setStakeholders(s);
    }, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, version]);

  return (
    <Panel
      title={initiative ? `${initiative.code} · ${t('stakeholders.section')}` : t('common.loading')}
      titleTooltip={englishTermTooltip(locale, 'stakeholders.section')}
      onClose={onClose}
    >
      <ErrorMessage error={error} />
      {initiative && stakeholders && (
        <>
          {initiative.archivedAt && <p className="notice">{t('initiative.archived')}</p>}
          <div className="section-header stakeholder-views">
            <div role="group">
              <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
                {t('stakeholders.list')}
              </button>{' '}
              <button type="button" aria-pressed={view === 'matrix'} onClick={() => setView('matrix')}>
                {t('stakeholders.matrix')}
              </button>
            </div>
            {canEditStakeholders(initiative) && (
              <button type="button" onClick={() => open({ kind: 'stakeholder', initiativeId })}>
                {t('stakeholders.new')}
              </button>
            )}
          </div>
          {stakeholders.length === 0 ? (
            <p>{t('stakeholders.empty')}</p>
          ) : view === 'list' ? (
            <StakeholderList stakeholders={stakeholders} />
          ) : (
            <StakeholderMatrix stakeholders={stakeholders} />
          )}
        </>
      )}
    </Panel>
  );
}

function StakeholderList({ stakeholders }: { stakeholders: StakeholderDto[] }) {
  const { t } = useI18n();
  return (
    <ul className="links stakeholder-list">
      {stakeholders.map((s) => (
        <li key={s.id}>
          <StakeholderLink initiativeId={s.initiativeId} stakeholder={s} />
          <span className="action-meta">
            <span className="badge">{t(`stakeholderKind.${s.kind}`)}</span>
            <small>
              <RoleList roles={s.roles} />
            </small>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Influence en lignes (forte en haut), intérêt en colonnes (faible à gauche). */
function StakeholderMatrix({ stakeholders }: { stakeholders: StakeholderDto[] }) {
  const { t } = useI18n();
  const { cells, unpositioned } = stakeholderMatrix(stakeholders);
  const names = (list: StakeholderDto[]) => (
    <ul className="links">
      {list.map((s) => (
        <li key={s.id}>
          <StakeholderLink initiativeId={s.initiativeId} stakeholder={s} />
        </li>
      ))}
    </ul>
  );
  return (
    <>
      <table className="stakeholder-matrix">
        <thead>
          <tr>
            <th scope="col">
              <small>
                {t('stakeholder.influence')} ↓ · {t('stakeholder.interest')} →
              </small>
            </th>
            {STAKEHOLDER_LEVELS.map((interest) => (
              <th key={interest} scope="col">
                {t(`stakeholderLevel.${interest}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...STAKEHOLDER_LEVELS].reverse().map((influence) => (
            <tr key={influence}>
              <th scope="row">{t(`stakeholderLevel.${influence}`)}</th>
              {STAKEHOLDER_LEVELS.map((interest) => (
                <td key={interest}>{names(cells[influence][interest])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {unpositioned.length > 0 && (
        <>
          <h4>{t('stakeholders.unpositioned')}</h4>
          {names(unpositioned)}
        </>
      )}
    </>
  );
}

/** Fiche d'une partie prenante ; sans `stakeholderId`, création. */
export function StakeholderPanel({
  babok,
  initiativeId,
  stakeholderId,
  actionsVersion,
  onChanged,
  onClose,
}: {
  babok: BabokDto | null;
  initiativeId: string;
  stakeholderId?: string;
  /** Change à chaque écriture sur une action : les actions liées se rechargent. */
  actionsVersion: number;
  /** Une partie prenante a été créée, modifiée ou supprimée : les listes se rechargent. */
  onChanged: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { replace } = usePanels();
  const [initiative, setInitiative] = useState<InitiativeDto | null>(null);
  const [members, setMembers] = useState<InitiativeMemberDto[] | null>(null);
  const [stakeholders, setStakeholders] = useState<StakeholderDto[] | null>(null);
  const [actions, setActions] = useState<ActionDto[]>([]);
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    Promise.all([api.getInitiative(initiativeId), api.listMembers(initiativeId), api.listStakeholders(initiativeId)]).then(
      ([i, m, s]) => {
        setInitiative(i);
        setMembers(m);
        setStakeholders(s);
        if (stakeholderId && !s.some((x) => x.id === stakeholderId)) setError({ key: 'error.http', params: { status: 404 } });
      },
      (e: unknown) => setError(toUiError(e)),
    );
  }, [initiativeId, stakeholderId]);

  useEffect(() => {
    if (!stakeholderId) return;
    api.listActions(initiativeId).then(setActions, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, stakeholderId, actionsVersion]);

  const stakeholder = stakeholderId ? stakeholders?.find((s) => s.id === stakeholderId) : undefined;
  const linkedActions = sortByDueDate(actions.filter((a) => a.stakeholders.some((s) => s.id === stakeholderId)));
  const ready = initiative && members && stakeholders && (!stakeholderId || stakeholder);

  function saved(next: StakeholderDto) {
    setStakeholders((list) => list && (list.some((s) => s.id === next.id) ? list.map((s) => (s.id === next.id ? next : s)) : [...list, next]));
    onChanged();
  }

  return (
    <Panel
      title={stakeholder ? stakeholder.name : stakeholderId ? t('common.loading') : t('stakeholders.new')}
      onClose={onClose}
    >
      <ErrorMessage error={error} />
      {ready && (
        <>
          {initiative.archivedAt && <p className="notice">{t('initiative.archived')}</p>}
          {canEditStakeholders(initiative) ? (
            <StakeholderForm
              initiativeId={initiativeId}
              stakeholder={stakeholder}
              linkable={linkableMembers(members, stakeholders, stakeholderId ?? null)}
              onSaved={(next) => {
                saved(next);
                if (!stakeholder) replace({ kind: 'stakeholder', initiativeId, stakeholderId: next.id });
              }}
            />
          ) : (
            stakeholder && <StakeholderDetails stakeholder={stakeholder} />
          )}
          {stakeholder && (
            <>
              <h3>{t('stakeholder.actions')}</h3>
              <ActionList actions={linkedActions} babok={babok} />
              {linkedActions.length === 0 && <p>{t('stakeholder.noActions')}</p>}
              <AuditTrail stakeholder={stakeholder} />
              {canEditStakeholders(initiative) && (
                <DeleteStakeholder
                  stakeholder={stakeholder}
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

function LinkedUser({ user }: { user: StakeholderDto['user'] }) {
  const { t } = useI18n();
  if (!user) return <small>{t('stakeholder.noUser')}</small>;
  return (
    <>
      {memberName(user)}
      {!user.member && <small> · {t('stakeholder.userNotMember')}</small>}
    </>
  );
}

const levelLabel = (t: (key: MessageKey) => string, level: StakeholderLevel | null) =>
  level ? t(`stakeholderLevel.${level}`) : t('stakeholder.notEvaluated');

/** Fiche en lecture seule : lecteur, ou initiative archivée. */
function StakeholderDetails({ stakeholder }: { stakeholder: StakeholderDto }) {
  const { t } = useI18n();
  const notSet = <small>{t('initiative.notSet')}</small>;
  return (
    <dl>
      <dt>{t('stakeholder.kind')}</dt>
      <dd>{t(`stakeholderKind.${stakeholder.kind}`)}</dd>
      <dt>{t('stakeholder.roles')}</dt>
      <dd>
        <RoleList roles={stakeholder.roles} />
      </dd>
      <dt>{t('stakeholder.influence')}</dt>
      <dd>{levelLabel(t, stakeholder.influence)}</dd>
      <dt>{t('stakeholder.interest')}</dt>
      <dd>{levelLabel(t, stakeholder.interest)}</dd>
      <dt>{t('stakeholder.contact')}</dt>
      <dd className="multiline">{stakeholder.contact ?? notSet}</dd>
      <dt>{t('stakeholder.user')}</dt>
      <dd>
        <LinkedUser user={stakeholder.user} />
      </dd>
      <dt>{t('stakeholder.notes')}</dt>
      <dd>{stakeholder.notes ? <RichText source={stakeholder.notes} /> : notSet}</dd>
    </dl>
  );
}

function StakeholderForm({
  initiativeId,
  stakeholder,
  linkable,
  onSaved,
}: {
  initiativeId: string;
  /** Absente à la création. */
  stakeholder?: StakeholderDto;
  /** Membres que l'on peut relier à cette fiche. */
  linkable: InitiativeMemberDto[];
  onSaved: (stakeholder: StakeholderDto) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(stakeholder?.name ?? '');
  const [kind, setKind] = useState<StakeholderKind>(stakeholder?.kind ?? 'person');
  const [roles, setRoles] = useState<readonly StakeholderRole[]>(stakeholder?.roles ?? []);
  const [influence, setInfluence] = useState<StakeholderLevel | ''>(stakeholder?.influence ?? '');
  const [interest, setInterest] = useState<StakeholderLevel | ''>(stakeholder?.interest ?? '');
  const [contact, setContact] = useState(stakeholder?.contact ?? '');
  const [notes, setNotes] = useState(stakeholder?.notes ?? '');
  const [userId, setUserId] = useState(stakeholder?.user?.userId ?? '');
  const [error, setError] = useState<UiError | null>(null);
  const [saved, setSaved] = useState(false);

  // Le compte actuel reste affiché s'il n'est plus membre.
  const keepsFormerMember = stakeholder?.user && !linkable.some((m) => m.userId === stakeholder.user!.userId);

  const toggleRole = (role: StakeholderRole) =>
    setRoles((current) =>
      current.includes(role) ? current.filter((r) => r !== role) : STAKEHOLDER_ROLES.filter((r) => r === role || current.includes(r)),
    );

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    const input = {
      name,
      kind,
      roles,
      influence: influence || null,
      interest: interest || null,
      contact,
      notes,
      userId: userId || null,
    };
    // Même schéma de validation que l'API (@app/shared) ; le formulaire envoie
    // tous les champs, la fiche complète vaut aussi pour une modification.
    const parsed = createStakeholderSchema.safeParse(input);
    if (!parsed.success) {
      setError({ key: 'stakeholder.invalid' });
      return;
    }
    try {
      onSaved(
        stakeholder
          ? await api.updateStakeholder(initiativeId, stakeholder.id, parsed.data)
          : await api.createStakeholder(initiativeId, parsed.data),
      );
      setError(null);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 400 && !e.refusal ? { key: 'stakeholder.invalid' } : toUiError(e));
    }
  }

  return (
    <form className="stacked" onSubmit={(e) => void save(e)} onChange={() => setSaved(false)}>
      <label>
        {t('stakeholder.name')}
        <input
          data-autofocus={stakeholder ? undefined : true}
          value={name}
          maxLength={STAKEHOLDER_NAME_MAX_LENGTH}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        {t('stakeholder.kind')}
        <select value={kind} onChange={(e) => setKind(e.target.value as StakeholderKind)}>
          {STAKEHOLDER_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`stakeholderKind.${k}`)}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>{t('stakeholder.roles')}</legend>
        {STAKEHOLDER_ROLES.map((role) => (
          <label key={role} className="inline">
            <input type="checkbox" checked={roles.includes(role)} onChange={() => toggleRole(role)} />
            <Term term={`stakeholderRole.${role}`} />
          </label>
        ))}
      </fieldset>
      <div className="dates">
        <LevelSelect label={t('stakeholder.influence')} value={influence} onChange={setInfluence} />
        <LevelSelect label={t('stakeholder.interest')} value={interest} onChange={setInterest} />
      </div>
      <label>
        {t('stakeholder.contact')}
        <textarea
          rows={3}
          value={contact}
          maxLength={STAKEHOLDER_CONTACT_MAX_LENGTH}
          onChange={(e) => setContact(e.target.value)}
        />
      </label>
      <label>
        {t('stakeholder.user')}
        <select value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">{t('stakeholder.noUser')}</option>
          {keepsFormerMember && (
            <option value={stakeholder.user!.userId}>
              {memberName(stakeholder.user!)} · {t('stakeholder.userNotMember')}
            </option>
          )}
          {linkable.map((m) => (
            <option key={m.userId} value={m.userId}>
              {memberName(m)}
            </option>
          ))}
        </select>
      </label>
      <RichTextEditor
        label={t('stakeholder.notes')}
        value={notes}
        maxLength={STAKEHOLDER_NOTES_MAX_LENGTH}
        onChange={(value) => {
          setNotes(value);
          setSaved(false);
        }}
      />
      <button type="submit">{stakeholder ? t('stakeholder.save') : t('stakeholder.create')}</button>
      <ErrorMessage error={error} />
      <p role="status">{saved && t('stakeholder.saved')}</p>
    </form>
  );
}

/** Influence ou intérêt ; vide = non évalué. */
function LevelSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: StakeholderLevel | '';
  onChange: (value: StakeholderLevel | '') => void;
}) {
  const { t } = useI18n();
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value as StakeholderLevel | '')}>
        <option value="">{t('stakeholder.notEvaluated')}</option>
        {STAKEHOLDER_LEVELS.map((level) => (
          <option key={level} value={level}>
            {t(`stakeholderLevel.${level}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Date de création et de dernière modification, avec leur auteur. */
function AuditTrail({ stakeholder }: { stakeholder: StakeholderDto }) {
  const { t, locale } = useI18n();
  return (
    <p className="audit">
      <small>
        {t('stakeholder.created', {
          date: formatDateTime(locale, stakeholder.createdAt),
          name: memberName(stakeholder.createdBy),
        })}
        <br />
        {t('stakeholder.updated', {
          date: formatDateTime(locale, stakeholder.updatedAt),
          name: memberName(stakeholder.updatedBy),
        })}
      </small>
    </p>
  );
}

/** Suppression après confirmation ; refusée si la partie prenante est liée à une action. */
function DeleteStakeholder({ stakeholder, onDeleted }: { stakeholder: StakeholderDto; onDeleted: () => void }) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<UiError | null>(null);

  async function remove() {
    try {
      await api.deleteStakeholder(stakeholder.initiativeId, stakeholder.id);
      onDeleted();
    } catch (e) {
      setConfirming(false);
      setError(toUiError(e));
    }
  }

  return (
    <section className="owner-actions">
      {confirming ? (
        <div role="alertdialog" aria-labelledby="stakeholder-delete-confirm" className="confirm">
          <p id="stakeholder-delete-confirm">{t('stakeholder.deleteConfirm', { name: stakeholder.name })}</p>
          <button type="button" autoFocus onClick={() => setConfirming(false)}>
            {t('common.cancel')}
          </button>{' '}
          <button type="button" className="danger" onClick={() => void remove()}>
            {t('stakeholder.deleteConfirmButton')}
          </button>
        </div>
      ) : (
        <>
          <button type="button" className="danger" onClick={() => setConfirming(true)}>
            {t('stakeholder.delete')}
          </button>
          <p>
            <small>{t('stakeholder.deleteHint')}</small>
          </p>
        </>
      )}
      <ErrorMessage error={error} />
    </section>
  );
}
