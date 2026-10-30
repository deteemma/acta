// Administration des comptes (ticket 05, ADR-0005) : comptes de Keycloak et
// initiatives sans propriétaire actif. Les contrôles proposés et les refus
// suivent les règles de @app/shared (admin.ts).
import {
  type AccountDto,
  checkAccountChange,
  checkAdminOwnerDesignation,
  createAccountSchema,
  isAdminRefusal,
  type OrphanInitiativeDto,
  type UpdateAccountInput,
} from '@app/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from './api';
import { adminRefusalError, ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { Panel } from './panels';
import { memberName } from './team-section';

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

export function AdminPanel({ myId, onClose }: { myId: string; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Panel title={t('admin.title')} onClose={onClose}>
      <AccountsSection myId={myId} />
      <OrphanInitiativesSection />
    </Panel>
  );
}

function AccountsSection({ myId }: { myId: string }) {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<AccountDto[] | null>(null);
  const [error, setError] = useState<UiError | null>(null);

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
      <h3>{t('admin.accounts')}</h3>
      <p>
        <small>{t('admin.accountsHint')}</small>
      </p>
      <ErrorMessage error={error} />
      {accounts === null ? (
        !error && <p>{t('common.loading')}</p>
      ) : (
        <ul className="links team-members">
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
function OrphanInitiativesSection() {
  const { t } = useI18n();
  const [initiatives, setInitiatives] = useState<OrphanInitiativeDto[] | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = () => api.listOrphanInitiatives().then(setInitiatives, (e: unknown) => setError(adminError(e)));

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
      <h3>{t('admin.orphans')}</h3>
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
          <ul className="links team-members">
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
