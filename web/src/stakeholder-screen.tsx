// Parties prenantes (ticket 08) : liste et matrice influence × intérêt d'une
// initiative, onglets d'une partie prenante dans l'écran de données (ADR-0021,
// N11 : Fiche, « À l'origine de ») et fenêtre de création (N15). Règles dans
// @app/shared (stakeholders.ts, roles.ts).
import {
  memberName,
  type ActionDto,
  type BabokDto,
  can,
  createStakeholderSchema,
  englishTermTooltip,
  type InitiativeDto,
  type InitiativeMemberDto,
  linkableMembers,
  type MessageKey,
  type NeedDto,
  type RequirementDto,
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
import { useEffect, useState } from 'react';
import { ActionList, NewActionButton } from './action-panels';
import { api, ApiError } from './api';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { NeedList } from './need-screen';
import { RequirementList } from './requirement-panels';
import { Panel, useCloseSilently } from './panels';
import { useOpenNode } from './references';
import { RichText, RichTextEditor } from './rich-text';
import { formatDateTime } from './team-section';
import { useUnsavedForm } from './unsaved-changes';

export const canEditStakeholders = (initiative: InitiativeDto) =>
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
  const openNode = useOpenNode();
  return (
    <button type="button" className="link" onClick={() => openNode(initiativeId, { kind: 'stakeholder', id: stakeholder.id })}>
      {stakeholder.name}
    </button>
  );
}

/** Nature de l'écran, l'anglais en info-bulle. */
export const StakeholderKicker = () => <Term term="stakeholder.kicker" />;

export function StakeholderList({ stakeholders }: { stakeholders: StakeholderDto[] }) {
  const { t } = useI18n();
  const level = (value: StakeholderDto['influence']) =>
    value ? t(`stakeholderLevel.${value}`) : t('stakeholder.notEvaluated');
  return (
    <ul className="links dense-list stakeholder-list">
      {stakeholders.map((s) => (
        <li key={s.id} className="stakeholder-row">
          <StakeholderLink initiativeId={s.initiativeId} stakeholder={s} />
          {/* Influence et intérêt sur chaque ligne (validé le 01.11.2026). */}
          <span className="stakeholder-levels">
            <span className="badge">{t(`stakeholderKind.${s.kind}`)}</span>
            <small>
              {s.influence || s.interest
                ? t('stakeholders.levels', {
                    influence: level(s.influence),
                    interest: level(s.interest),
                  })
                : t('stakeholder.notEvaluated')}
            </small>
          </span>
          <small className="stakeholder-roles">
            <RoleList roles={s.roles} />
          </small>
        </li>
      ))}
    </ul>
  );
}

/** Influence en lignes (forte en haut), intérêt en colonnes (faible à gauche). */
export function StakeholderMatrix({ stakeholders }: { stakeholders: StakeholderDto[] }) {
  const { t } = useI18n();
  const { cells, unpositioned } = stakeholderMatrix(stakeholders);
  const names = (list: StakeholderDto[]) => (
    <ul className="links matrix-names">
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

/**
 * Onglet Fiche : les champs (en lecture seule pour un lecteur ou une initiative
 * archivée), les actions liées (décision du 21.11.2026), la trace et la suppression.
 */
export function StakeholderSheet({
  initiative,
  members,
  stakeholders,
  stakeholder,
  babok,
  actionsVersion,
  onChanged,
  onDeleted,
}: {
  initiative: InitiativeDto;
  members: InitiativeMemberDto[];
  stakeholders: StakeholderDto[];
  stakeholder: StakeholderDto;
  babok: BabokDto | null;
  /** Change à chaque écriture sur une action : les actions liées se rechargent. */
  actionsVersion: number;
  /** Modifiée : les listes et l'arborescence se rechargent. */
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const [actions, setActions] = useState<ActionDto[]>([]);
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    api.listActions(initiative.id).then(setActions, (e: unknown) => setError(toUiError(e)));
  }, [initiative.id, actionsVersion]);

  const linkedActions = sortByDueDate(actions.filter((a) => a.stakeholders.some((s) => s.id === stakeholder.id)));
  const editable = canEditStakeholders(initiative);

  return (
    <>
      <ErrorMessage error={error} />
      {editable ? (
        <StakeholderForm
          initiativeId={initiative.id}
          stakeholder={stakeholder}
          linkable={linkableMembers(members, stakeholders, stakeholder.id)}
          onSaved={onChanged}
        />
      ) : (
        <StakeholderDetails stakeholder={stakeholder} />
      )}
      <div className="section-header">
        <h3>{t('stakeholder.actions')}</h3>
        <NewActionButton initiative={initiative} from={{ kind: 'stakeholder', id: stakeholder.id }} />
      </div>
      <ActionList actions={linkedActions} babok={babok} />
      {linkedActions.length === 0 && <p>{t('stakeholder.noActions')}</p>}
      <AuditTrail stakeholder={stakeholder} />
      {editable && <DeleteStakeholder stakeholder={stakeholder} onDeleted={onDeleted} />}
    </>
  );
}

/** Besoins et exigences dont la partie prenante est la source. */
export const originatedBy = (stakeholderId: string, needs: NeedDto[], requirements: RequirementDto[]) => ({
  needs: needs.filter((n) => n.stakeholders.some((s) => s.id === stakeholderId)),
  requirements: requirements.filter((r) => r.stakeholders.some((s) => s.id === stakeholderId)),
});

/** Onglet « À l'origine de ». */
export function StakeholderOrigin({ needs, requirements }: { needs: NeedDto[]; requirements: RequirementDto[] }) {
  const { t } = useI18n();
  return (
    <>
      <h3>{t('stakeholder.needs')}</h3>
      <NeedList needs={needs} />
      {needs.length === 0 && <p>{t('stakeholder.noNeeds')}</p>}
      <h3>{t('stakeholder.requirements')}</h3>
      <RequirementList requirements={requirements} />
      {requirements.length === 0 && <p>{t('stakeholder.noRequirements')}</p>}
    </>
  );
}

/** Nouvelle partie prenante, en fenêtre de dialogue (N15) : les champs de création actuels. */
export function CreateStakeholderDialog({
  initiativeId,
  members,
  stakeholders,
  onCreated,
  onClose,
}: {
  initiativeId: string;
  members: InitiativeMemberDto[];
  stakeholders: StakeholderDto[];
  /** Créée : les listes se rechargent, l'écran de données l'affiche. */
  onCreated: (stakeholder: StakeholderDto) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const closeSilently = useCloseSilently();
  return (
    <Panel title={t('stakeholders.new')} variant="dialog" onClose={onClose}>
      <StakeholderForm
        initiativeId={initiativeId}
        linkable={linkableMembers(members, stakeholders, null)}
        onSaved={(created) => {
          // Saisie enregistrée : pas d'alerte.
          closeSilently();
          onCreated(created);
        }}
      />
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
  const submit = useUnsavedForm({ name, kind, roles, influence, interest, contact, notes, userId }, save);

  // Le compte actuel reste affiché s'il n'est plus membre.
  const keepsFormerMember = stakeholder?.user && !linkable.some((m) => m.userId === stakeholder.user!.userId);

  const toggleRole = (role: StakeholderRole) =>
    setRoles((current) =>
      current.includes(role) ? current.filter((r) => r !== role) : STAKEHOLDER_ROLES.filter((r) => r === role || current.includes(r)),
    );

  async function save(): Promise<boolean> {
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
      return false;
    }
    try {
      onSaved(
        stakeholder
          ? await api.updateStakeholder(initiativeId, stakeholder.id, parsed.data)
          : await api.createStakeholder(initiativeId, parsed.data),
      );
      setError(null);
      setSaved(true);
      return true;
    } catch (e) {
      setError(e instanceof ApiError && e.status === 400 && !e.refusal ? { key: 'stakeholder.invalid' } : toUiError(e));
      return false;
    }
  }

  return (
    <form className="stacked" onSubmit={submit} onChange={() => setSaved(false)}>
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
