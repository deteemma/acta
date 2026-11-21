// Administration (ticket 05, ADR-0005), dans la zone de droite, un onglet par
// adresse (navigation par arborescence, N3 et N12) : comptes de Keycloak, initiatives sans
// propriétaire actif, acronymes des références (ticket 09), statuts d'exigence
// (ticket 11), types de ticket et leurs statuts (ticket 29, admin-ticket-types.tsx),
// modèles de page (ticket 30, admin-page-templates.tsx), limite de pièces jointes
// (ticket 31, admin-attachment-quota.tsx).
// Les contrôles proposés et les refus suivent les règles de
// @app/shared (admin.ts, references.ts, requirement-statuses.ts, ticket-type-catalog.ts,
// page-template-admin.ts, attachments.ts).
import {
  ACRONYM_MAX_LENGTH,
  ADMIN_TABS,
  type AdminTab,
  memberName,
  type AccountDto,
  type BabokDto,
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
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api';
import { adminRefusalError, ErrorMessage, toUiError, type UiError } from './errors';
import { AttachmentQuotaSection } from './admin-attachment-quota';
import { PageTemplatesSection } from './admin-page-templates';
import { TicketTypesSection } from './admin-ticket-types';
import { useTicketLabels, useTicketTypes } from './ticket-types';
import { ScreenLayout, type Tab } from './data-screen';
import { useI18n } from './i18n';
import { useScreens } from './screens';
import { setRequirementStatuses } from './requirement-statuses';
import { RevealFormContext, useUnsavedForm } from './unsaved-changes';

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

const TAB_LABELS = {
  accounts: 'admin.accounts',
  orphans: 'admin.orphansTab',
  references: 'admin.references',
  statuses: 'admin.requirementStatuses',
  'ticket-types': 'admin.ticketTypes',
  'page-templates': 'admin.pageTemplates',
  attachments: 'admin.attachments',
} as const satisfies Record<AdminTab, string>;

/**
 * Onglets (refonte du design, validé le 01.11.2026 ; « Types de ticket », « Modèles de page » et « Pièces jointes » : décision 14 de la phase 2). Toutes les sections
 * restent montées d'un onglet à l'autre : elles se chargent à l'ouverture, ce qui
 * donne les compteurs. Changer d'onglet passe par l'alerte des modifications non
 * enregistrées (N13).
 */
export function AdminScreen({ myId, babok, tab }: { myId: string; babok: BabokDto | null; tab: AdminTab }) {
  const { t } = useI18n();
  const { goTo } = useScreens();
  const [accountCount, setAccountCount] = useState<number | null>(null);
  const [orphanCount, setOrphanCount] = useState<number | null>(null);
  // Enregistrement depuis l'alerte en échec : l'onglet du formulaire s'affiche,
  // pour son erreur, sans changer l'adresse (une sortie est en cours).
  const [revealed, setRevealed] = useState<{ tab: AdminTab; from: AdminTab } | null>(null);
  const shown = revealed?.from === tab ? revealed.tab : tab;
  const reveal = useCallback((id: AdminTab) => setRevealed({ tab: id, from: tab }), [tab]);
  const counts: Partial<Record<AdminTab, number | null>> = { accounts: accountCount, orphans: orphanCount };
  const tabs: Tab<AdminTab>[] = ADMIN_TABS.map((id) => {
    const count = counts[id] ?? null;
    // Initiatives sans propriétaire : le nombre n'apparaît que s'il y en a.
    const showCount = count !== null && (count > 0 || id !== 'orphans');
    return { id, label: t(TAB_LABELS[id]), ...(showCount && { count }) };
  });
  const section = (id: AdminTab) => ({ hidden: shown !== id });
  return (
    <ScreenLayout
      crumbs={[]}
      title={t('admin.title')}
      tabs={tabs}
      tab={shown}
      onTab={(next) => void goTo({ kind: 'admin', tab: next }).then((left) => left && setRevealed(null))}
    >
      <div {...section('accounts')}>
        <RevealFormContext.Provider value={() => reveal('accounts')}>
          <AccountsSection myId={myId} onCount={setAccountCount} />
        </RevealFormContext.Provider>
      </div>
      <div {...section('orphans')}>
        <OrphanInitiativesSection onCount={setOrphanCount} />
      </div>
      <div {...section('references')}>
        <RevealFormContext.Provider value={() => reveal('references')}>
          <ReferenceCategoriesSection />
        </RevealFormContext.Provider>
      </div>
      <div {...section('statuses')}>
        <RevealFormContext.Provider value={() => reveal('statuses')}>
          <RequirementStatusesSection />
        </RevealFormContext.Provider>
      </div>
      <div {...section('ticket-types')}>
        <RevealFormContext.Provider value={() => reveal('ticket-types')}>
          <TicketTypesSection />
        </RevealFormContext.Provider>
      </div>
      <div {...section('page-templates')}>
        <PageTemplatesSection babok={babok} />
      </div>
      <div {...section('attachments')}>
        <RevealFormContext.Provider value={() => reveal('attachments')}>
          <AttachmentQuotaSection />
        </RevealFormContext.Provider>
      </div>
    </ScreenLayout>
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
      <h2 className="visually-hidden">{t('admin.accounts')}</h2>
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
  const submit = useUnsavedForm(form, create);

  async function create() {
    // Même schéma de validation que l'API (@app/shared).
    const parsed = createAccountSchema.safeParse(form);
    if (!parsed.success) {
      setError({ key: 'admin.account.invalid' });
      return false;
    }
    try {
      const account = await api.createAccount(parsed.data);
      setError(null);
      setForm(emptyAccount);
      setCreated(account.username);
      onCreated(account);
      return emptyAccount;
    } catch (e) {
      setCreated(null);
      setError(adminError(e));
      return false;
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
    <form className="stacked invite" onSubmit={submit}>
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
      <h2 className="visually-hidden">{t('admin.orphans')}</h2>
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
  const { categoryLabel } = useTicketLabels();
  const [categories, setCategories] = useState<ReferenceCategoryDto[] | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Relue quand la liste des types change : un type ajouté est une catégorie de plus.
  const ticketTypes = useTicketTypes();
  useEffect(() => {
    api.listReferenceCategories().then(setCategories, (e: unknown) => setError(toUiError(e)));
  }, [ticketTypes]);

  async function save(category: ReferenceCategoryDto, acronym: string): Promise<boolean> {
    const refusal = checkAcronymChange(categories ?? [], category.category, acronym);
    if (refusal) {
      setDone(null);
      setError({ key: `reference.refusal.${refusal}` });
      return false;
    }
    try {
      setCategories(await api.updateReferenceCategory(category.category, { acronym }));
      setError(null);
      setDone(t('admin.reference.saved', { category: categoryLabel(category.category), acronym }));
      return true;
    } catch (e) {
      setDone(null);
      setError(toUiError(e));
      return false;
    }
  }

  return (
    <section>
      <h2 className="visually-hidden">{t('admin.references')}</h2>
      <p>
        <small>{t('admin.referencesHint')}</small>
      </p>
      <ErrorMessage error={error} />
      {done && <p className="notice">{done}</p>}
      {categories && (
        <ul className="links dense-list team-members">
          {categories.map((category) => (
            <AcronymForm key={category.category} category={category} onSave={(acronym) => save(category, acronym)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AcronymForm({
  category,
  onSave,
}: {
  category: ReferenceCategoryDto;
  onSave: (acronym: string) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const { categoryLabel } = useTicketLabels();
  const [acronym, setAcronym] = useState(category.acronym);
  const submit = useUnsavedForm({ acronym }, () => onSave(acronym));
  const name = categoryLabel(category.category);
  const former = category.usedAcronyms.filter((a) => a !== category.acronym);
  return (
    <li>
      <span>
        {name}
        {former.length > 0 && <small> · {t('admin.reference.former', { list: former.join(', ') })}</small>}
      </span>
      <form className="team-controls" onSubmit={submit}>
        <input
          value={acronym}
          size={5}
          maxLength={ACRONYM_MAX_LENGTH}
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

  function update(status: AdminRequirementStatusDto, change: UpdateRequirementStatusInput): Promise<boolean> {
    const label = (change.labels ?? status.labels)[locale];
    const message =
      change.active === undefined
        ? 'admin.requirementStatus.saved'
        : change.active
          ? 'admin.requirementStatus.reactivated'
          : 'admin.requirementStatus.deactivated';
    return run(
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
      <h2 className="visually-hidden">{t('admin.requirementStatuses')}</h2>
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
                onToggle={() => void update(status, { active: !status.active })}
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
  onSave: (labels: RequirementStatusLabels) => Promise<boolean>;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { t, locale } = useI18n();
  const [labels, setLabels] = useState(status.labels);
  // Même schéma de validation que l'API (@app/shared).
  const parsed = requirementStatusLabelsSchema.safeParse(labels);
  const unchanged = parsed.success && parsed.data.fr === status.labels.fr && parsed.data.en === status.labels.en;
  // Le bouton est inactif sur des libellés invalides ; l'alerte, elle, peut enregistrer.
  const [invalid, setInvalid] = useState(false);
  const submit = useUnsavedForm(labels, async () => {
    setInvalid(!parsed.success);
    if (!parsed.success) return false;
    return unchanged || onSave(parsed.data);
  });
  return (
    <li>
      <form className="team-controls" onSubmit={submit}>
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
        {/* Un statut déjà porté par une exigence ne se supprime pas : pas de bouton. */}
        {!status.used && (
          <button type="button" className="danger" onClick={onDelete}>
            {t('admin.requirementStatus.delete')}
          </button>
        )}
        {invalid && <ErrorMessage error={{ key: 'admin.requirementStatus.invalid' }} />}
      </form>
    </li>
  );
}

const noLabels: RequirementStatusLabels = { fr: '', en: '' };

function AddStatusForm({ onAdd }: { onAdd: (labels: RequirementStatusLabels) => Promise<boolean> }) {
  const { t } = useI18n();
  const [labels, setLabels] = useState(noLabels);
  const [invalid, setInvalid] = useState(false);
  const submit = useUnsavedForm(labels, async () => {
    // Même schéma de validation que l'API (@app/shared).
    const parsed = requirementStatusLabelsSchema.safeParse(labels);
    setInvalid(!parsed.success);
    if (!parsed.success || !(await onAdd(parsed.data))) return false;
    setLabels(noLabels);
    return noLabels;
  });
  return (
    <form className="stacked invite" onSubmit={submit}>
      <h4>{t('admin.requirementStatus.addTitle')}</h4>
      <StatusLabelInputs labels={labels} onChange={setLabels} />
      <button type="submit">{t('admin.requirementStatus.add')}</button>
      {invalid && <ErrorMessage error={{ key: 'admin.requirementStatus.invalid' }} />}
    </form>
  );
}
