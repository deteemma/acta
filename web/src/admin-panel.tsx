// Administration (ticket 05, ADR-0005) : comptes de Keycloak, initiatives sans
// propriétaire actif, acronymes des références (ticket 09), statuts d'exigence
// (ticket 11). Les contrôles proposés et les refus suivent les règles de
// @app/shared (admin.ts, references.ts, requirement-statuses.ts).
import {
  memberName,
  type AccountDto,
  type AdminRequirementStatusDto,
  checkAccountChange,
  checkAcronymChange,
  checkAdminOwnerDesignation,
  checkStatusDeletion,
  checkStatusLabels,
  checkStatusUpdate,
  createAccountSchema,
  isAdminRefusal,
  type OrphanInitiativeDto,
  LOCALES,
  type ReferenceCategoryDto,
  REQUIREMENT_STATUS_LABEL_MAX_LENGTH,
  type RequirementStatusRefusal,
  type RequirementStatusLabels,
  requirementStatusLabelsSchema,
  type UpdateAccountInput,
  type UpdateRequirementStatusInput,
} from '@app/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from './api';
import { adminRefusalError, ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { Panel } from './panels';
import { setRequirementStatuses } from './requirement-statuses';

/**
 * Erreur de l'administration : ses refus d'abord (certains portent le même nom
 * qu'un refus de l'équipe) ; 503 = connexion à Keycloak non configurée.
 */
function adminError(error: unknown): UiError {
  if (error instanceof ApiError) {
    if (isAdminRefusal(error.refusal)) return adminRefusalError(error.refusal);
    if (error.status === 503) return { key: 'admin.unavailable' };
  }
  return toUiError(error);
}

const accountName = (account: AccountDto) =>
  [account.firstName, account.lastName].filter(Boolean).join(' ') || account.username;

type AdminTab = 'accounts' | 'orphans' | 'references' | 'statuses';

/**
 * Quatre onglets (refonte du design, validé le 01.11.2026). Toutes les sections
 * restent montées : elles se chargent à l'ouverture, ce qui donne les compteurs,
 * et une saisie en cours survit au changement d'onglet.
 */
export function AdminPanel({ myId, onClose }: { myId: string; onClose: () => void }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<AdminTab>('accounts');
  const [accountCount, setAccountCount] = useState<number | null>(null);
  const [orphanCount, setOrphanCount] = useState<number | null>(null);
  const tabs: { id: AdminTab; label: string; count: number | null; warn?: boolean }[] = [
    { id: 'accounts', label: t('admin.accounts'), count: accountCount },
    { id: 'orphans', label: t('admin.orphansTab'), count: orphanCount, warn: true },
    { id: 'references', label: t('admin.references'), count: null },
    { id: 'statuses', label: t('admin.requirementStatuses'), count: null },
  ];
  const panel = (id: AdminTab) => ({ role: 'tabpanel', id: `admin-${id}`, 'aria-labelledby': `admin-tab-${id}`, hidden: tab !== id });
  return (
    <Panel title={t('admin.title')} onClose={onClose}>
      <div role="tablist" className="tabs">
        {tabs.map(({ id, label, count, warn }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`admin-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`admin-${id}`}
            onClick={() => setTab(id)}
          >
            {label}
            {count !== null && (count > 0 || !warn) && (
              <span className={`count${warn ? ' tone-negative' : ''}`}>{count}</span>
            )}
          </button>
        ))}
      </div>
      <div {...panel('accounts')}>
        <AccountsSection myId={myId} onCount={setAccountCount} />
      </div>
      <div {...panel('orphans')}>
        <OrphanInitiativesSection onCount={setOrphanCount} />
      </div>
      <div {...panel('references')}>
        <ReferenceCategoriesSection />
      </div>
      <div {...panel('statuses')}>
        <RequirementStatusesSection />
      </div>
    </Panel>
  );
}

function AccountsSection({ myId, onCount }: { myId: string; onCount: (count: number) => void }) {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<AccountDto[] | null>(null);
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    if (accounts) onCount(accounts.length);
  }, [accounts, onCount]);

  useEffect(() => {
    api.listAccounts().then(setAccounts, (e: unknown) => setError(adminError(e)));
  }, []);

  const replaced = (next: AccountDto) => setAccounts((list) => list?.map((a) => (a.id === next.id ? next : a)) ?? null);

  async function change(account: AccountDto, change: UpdateAccountInput) {
    const refusal = checkAccountChange(accounts ?? [], myId, account.id, change);
    if (refusal) {
      setError(adminRefusalError(refusal));
      return;
    }
    try {
      replaced(await api.updateAccount(account.id, change));
      setError(null);
    } catch (e) {
      setError(adminError(e));
    }
  }

  return (
    <section>
      <h3 className="visually-hidden">{t('admin.accounts')}</h3>
      <p>
        <small>{t('admin.accountsHint')}</small>
      </p>
      <ErrorMessage error={error} />
      {accounts === null ? (
        !error && <p>{t('common.loading')}</p>
      ) : (
        <ul className="links dense-list team-members">
          {accounts.map((account) => {
            const name = accountName(account);
            const toggle = { enabled: !account.enabled };
            const adminToggle = { isAdmin: !account.isAdmin };
            return (
              <li key={account.id}>
                <span>
                  {name} <small>({account.username}{account.email && ` · ${account.email}`})</small>
                  {account.id === myId && <small> ({t('member.you')})</small>}
                </span>
                <span className="team-controls">
                  <small className="badge">{t(account.enabled ? 'admin.account.enabled' : 'admin.account.disabled')}</small>
                  <label className="inline">
                    <input
                      type="checkbox"
                      checked={account.isAdmin}
                      disabled={checkAccountChange(accounts, myId, account.id, adminToggle) !== null}
                      aria-label={t('admin.account.isAdmin', { name })}
                      onChange={() => void change(account, adminToggle)}
                    />
                    {t('admin.account.admin')}
                  </label>
                  {checkAccountChange(accounts, myId, account.id, toggle) === null && (
                    <button
                      type="button"
                      className={account.enabled ? 'danger' : undefined}
                      onClick={() => void change(account, toggle)}
                    >
                      {t(account.enabled ? 'admin.account.deactivate' : 'admin.account.reactivate')}
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <CreateAccountForm onCreated={(account) => setAccounts((list) => [...(list ?? []), account])} />
    </section>
  );
}

const emptyAccount = { username: '', email: '', firstName: '', lastName: '', temporaryPassword: '' };

function CreateAccountForm({ onCreated }: { onCreated: (account: AccountDto) => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState(emptyAccount);
  const [error, setError] = useState<UiError | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  async function create(event: FormEvent) {
    event.preventDefault();
    // Même schéma de validation que l'API (@app/shared).
    const parsed = createAccountSchema.safeParse(form);
    if (!parsed.success) {
      setError({ key: 'admin.account.invalid' });
      return;
    }
    try {
      const account = await api.createAccount(parsed.data);
      setError(null);
      setForm(emptyAccount);
      setCreated(account.username);
      onCreated(account);
    } catch (e) {
      setCreated(null);
      setError(adminError(e));
    }
  }

  const field = (key: keyof typeof emptyAccount, type = 'text') => (
    <label>
      {t(`admin.account.${key}`)}
      <input
        type={type}
        value={form[key]}
        autoComplete={type === 'password' ? 'new-password' : 'off'}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </label>
  );

  return (
    <form className="stacked invite" onSubmit={(e) => void create(e)}>
      <h4>{t('admin.account.createTitle')}</h4>
      {field('username')}
      {field('email', 'email')}
      {field('firstName')}
      {field('lastName')}
      {field('temporaryPassword', 'password')}
      <small>{t('admin.account.temporaryPasswordHint')}</small>
      <button type="submit">{t('admin.account.create')}</button>
      <ErrorMessage error={error} />
      {created && <p className="notice">{t('admin.account.created', { username: created })}</p>}
    </form>
  );
}

/** Initiatives sans propriétaire actif : nom, code et membres, rien d'autre. */
function OrphanInitiativesSection({ onCount }: { onCount: (count: number) => void }) {
  const { t } = useI18n();
  const [initiatives, setInitiatives] = useState<OrphanInitiativeDto[] | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = () => api.listOrphanInitiatives().then(setInitiatives, (e: unknown) => setError(adminError(e)));

  useEffect(() => {
    if (initiatives) onCount(initiatives.length);
  }, [initiatives, onCount]);

  useEffect(() => {
    void load();
  }, []);

  async function designate(initiative: OrphanInitiativeDto, userId: string) {
    const refusal = checkAdminOwnerDesignation(initiative.members, userId);
    if (refusal) {
      setError(adminRefusalError(refusal));
      return;
    }
    const member = initiative.members.find((m) => m.userId === userId)!;
    try {
      await api.designateOwner(initiative.id, userId);
      setError(null);
      setDone(t('admin.designated', { name: memberName(member), code: initiative.code }));
    } catch (e) {
      setDone(null);
      setError(adminError(e));
    }
    // Désignée, ou refusée parce que la situation a changé : la liste est à jour.
    await load();
  }

  return (
    <section>
      <h3 className="visually-hidden">{t('admin.orphans')}</h3>
      <p>
        <small>{t('admin.orphansHint')}</small>
      </p>
      <ErrorMessage error={error} />
      {done && <p className="notice">{done}</p>}
      {initiatives?.length === 0 && <p>{t('admin.orphansEmpty')}</p>}
      {initiatives?.map((initiative) => (
        <section key={initiative.id}>
          <h4>
            {initiative.code} · {initiative.name}
          </h4>
          <ul className="links dense-list team-members">
            {initiative.members.map((member) => (
              <li key={member.userId}>
                <span>
                  {memberName(member)}
                  {!member.active && <small> ({t('admin.inactiveMember')})</small>}
                </span>
                <span className="team-controls">
                  <small>{t(`role.${member.role}`)}</small>
                  {checkAdminOwnerDesignation(initiative.members, member.userId) === null && (
                    <button type="button" onClick={() => void designate(initiative, member.userId)}>
                      {t('admin.designateOwner')}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

/** Acronyme de chaque catégorie ; les références déjà attribuées ne changent pas. */
function ReferenceCategoriesSection() {
  const { t } = useI18n();
  const [categories, setCategories] = useState<ReferenceCategoryDto[] | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    api.listReferenceCategories().then(setCategories, (e: unknown) => setError(toUiError(e)));
  }, []);

  async function save(category: ReferenceCategoryDto, acronym: string) {
    const refusal = checkAcronymChange(categories ?? [], category.category, acronym);
    if (refusal) {
      setDone(null);
      setError({ key: `reference.refusal.${refusal}` });
      return;
    }
    try {
      setCategories(await api.updateReferenceCategory(category.category, { acronym }));
      setError(null);
      setDone(t('admin.reference.saved', { category: t(`referenceCategory.${category.category}`), acronym }));
    } catch (e) {
      setDone(null);
      setError(toUiError(e));
    }
  }

  return (
    <section>
      <h3 className="visually-hidden">{t('admin.references')}</h3>
      <p>
        <small>{t('admin.referencesHint')}</small>
      </p>
      <ErrorMessage error={error} />
      {done && <p className="notice">{done}</p>}
      {categories && (
        <ul className="links dense-list team-members">
          {categories.map((category) => (
            <AcronymForm key={category.category} category={category} onSave={(acronym) => void save(category, acronym)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AcronymForm({ category, onSave }: { category: ReferenceCategoryDto; onSave: (acronym: string) => void }) {
  const { t } = useI18n();
  const [acronym, setAcronym] = useState(category.acronym);
  const name = t(`referenceCategory.${category.category}`);
  const former = category.usedAcronyms.filter((a) => a !== category.acronym);
  return (
    <li>
      <span>
        {name}
        {former.length > 0 && <small> · {t('admin.reference.former', { list: former.join(', ') })}</small>}
      </span>
      <form
        className="team-controls"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(acronym);
        }}
      >
        <input
          value={acronym}
          size={5}
          maxLength={4}
          aria-label={t('admin.reference.acronym', { category: name })}
          onChange={(e) => setAcronym(e.target.value.toUpperCase())}
        />
        <button type="submit" disabled={acronym === category.acronym}>
          {t('admin.reference.save')}
        </button>
      </form>
    </li>
  );
}

/**
 * Statuts d'exigence, valables pour toute l'application : les 6 du BABOK, fixes,
 * puis les statuts ajoutés, que l'on renomme, désactive, réactive ou supprime.
 */
function RequirementStatusesSection() {
  const { t, locale } = useI18n();
  const [statuses, setStatuses] = useState<AdminRequirementStatusDto[] | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const replaced = (next: AdminRequirementStatusDto[]) => {
    setStatuses(next);
    // Les fiches d'exigence ouvertes proposent aussitôt la nouvelle liste.
    setRequirementStatuses(next);
  };

  useEffect(() => {
    api.listRequirementStatuses().then(setStatuses, (e: unknown) => setError(toUiError(e)));
  }, []);

  /** Refus des règles de @app/shared, sinon appel de l'API ; message de réussite. */
  async function run(
    refusal: RequirementStatusRefusal | null,
    call: () => Promise<AdminRequirementStatusDto[]>,
    message: string,
  ): Promise<boolean> {
    if (refusal) {
      setDone(null);
      setError({ key: `requirementStatus.refusal.${refusal}` });
      return false;
    }
    try {
      replaced(await call());
      setError(null);
      setDone(message);
      return true;
    } catch (e) {
      setDone(null);
      setError(toUiError(e));
      // Refusé parce que la liste a changé entre-temps : elle est à jour.
      api.listRequirementStatuses().then(replaced, () => undefined);
      return false;
    }
  }

  function update(status: AdminRequirementStatusDto, change: UpdateRequirementStatusInput) {
    const label = (change.labels ?? status.labels)[locale];
    const message =
      change.active === undefined
        ? 'admin.requirementStatus.saved'
        : change.active
          ? 'admin.requirementStatus.reactivated'
          : 'admin.requirementStatus.deactivated';
    void run(
      checkStatusUpdate(statuses ?? [], status.code, change),
      () => api.updateRequirementStatus(status.code, change),
      t(message, { label }),
    );
  }

  function remove(status: AdminRequirementStatusDto) {
    void run(
      checkStatusDeletion(statuses ?? [], status.code),
      () => api.deleteRequirementStatus(status.code),
      t('admin.requirementStatus.deleted', { label: status.labels[locale] }),
    );
  }

  /** Vrai si le statut est ajouté : le formulaire se vide. */
  function add(labels: RequirementStatusLabels): Promise<boolean> {
    return run(
      checkStatusLabels(statuses ?? [], null, labels),
      () => api.addRequirementStatus({ labels }),
      t('admin.requirementStatus.added', { label: labels[locale] }),
    );
  }

  return (
    <section>
      <h3 className="visually-hidden">{t('admin.requirementStatuses')}</h3>
      <p>
        <small>{t('admin.requirementStatusesHint')}</small>
      </p>
      <ErrorMessage error={error} />
      {done && <p className="notice">{done}</p>}
      {statuses && (
        <ul className="links dense-list team-members">
          {statuses.map((status) =>
            status.babok ? (
              <li key={status.code}>
                <span>
                  {status.labels.fr} · {status.labels.en}
                </span>
                <span className="team-controls">
                  <small className="badge">{t('admin.requirementStatus.babok')}</small>
                </span>
              </li>
            ) : (
              <AddedStatusForm
                // Libellés changés (ici ou par un autre administrateur) : champs remis à jour.
                key={`${status.code}:${status.labels.fr}:${status.labels.en}`}
                status={status}
                onSave={(labels) => update(status, { labels })}
                onToggle={() => update(status, { active: !status.active })}
                onDelete={() => remove(status)}
              />
            ),
          )}
        </ul>
      )}
      <AddStatusForm onAdd={add} />
    </section>
  );
}

function StatusLabelInputs({
  labels,
  onChange,
  of,
}: {
  labels: RequirementStatusLabels;
  onChange: (labels: RequirementStatusLabels) => void;
  /** Libellé actuel du statut modifié, pour nommer les champs ; absent à l'ajout. */
  of?: string;
}) {
  const { t } = useI18n();
  return (
    <>
      {LOCALES.map((language) => (
        <input
          key={language}
          value={labels[language]}
          size={16}
          maxLength={REQUIREMENT_STATUS_LABEL_MAX_LENGTH}
          placeholder={t(`admin.requirementStatus.${language}`)}
          aria-label={
            of ? t(`admin.requirementStatus.${language}Of`, { label: of }) : t(`admin.requirementStatus.${language}`)
          }
          onChange={(e) => onChange({ ...labels, [language]: e.target.value })}
        />
      ))}
    </>
  );
}

function AddedStatusForm({
  status,
  onSave,
  onToggle,
  onDelete,
}: {
  status: AdminRequirementStatusDto;
  onSave: (labels: RequirementStatusLabels) => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { t, locale } = useI18n();
  const [labels, setLabels] = useState(status.labels);
  // Même schéma de validation que l'API (@app/shared).
  const parsed = requirementStatusLabelsSchema.safeParse(labels);
  const unchanged = parsed.success && parsed.data.fr === status.labels.fr && parsed.data.en === status.labels.en;
  return (
    <li>
      <form
        className="team-controls"
        onSubmit={(e) => {
          e.preventDefault();
          if (parsed.success) onSave(parsed.data);
        }}
      >
        <StatusLabelInputs labels={labels} onChange={setLabels} of={status.labels[locale]} />
        <small className="badge">
          {t(status.active ? 'admin.requirementStatus.active' : 'admin.requirementStatus.inactive')}
          {status.used && ` · ${t('admin.requirementStatus.used')}`}
        </small>
        <button type="submit" disabled={!parsed.success || unchanged}>
          {t('admin.requirementStatus.save')}
        </button>
        <button type="button" className={status.active ? 'danger' : undefined} onClick={onToggle}>
          {t(status.active ? 'admin.requirementStatus.deactivate' : 'admin.requirementStatus.reactivate')}
        </button>
        <button type="button" className="danger" onClick={onDelete}>
          {t('admin.requirementStatus.delete')}
        </button>
      </form>
    </li>
  );
}

const noLabels: RequirementStatusLabels = { fr: '', en: '' };

function AddStatusForm({ onAdd }: { onAdd: (labels: RequirementStatusLabels) => Promise<boolean> }) {
  const { t } = useI18n();
  const [labels, setLabels] = useState(noLabels);
  const [invalid, setInvalid] = useState(false);
  return (
    <form
      className="stacked invite"
      onSubmit={(e) => {
        e.preventDefault();
        // Même schéma de validation que l'API (@app/shared).
        const parsed = requirementStatusLabelsSchema.safeParse(labels);
        setInvalid(!parsed.success);
        if (parsed.success) void onAdd(parsed.data).then((added) => added && setLabels(noLabels));
      }}
    >
      <h4>{t('admin.requirementStatus.addTitle')}</h4>
      <StatusLabelInputs labels={labels} onChange={setLabels} />
      <button type="submit">{t('admin.requirementStatus.add')}</button>
      {invalid && <ErrorMessage error={{ key: 'admin.requirementStatus.invalid' }} />}
    </form>
  );
}
