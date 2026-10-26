import { createInitiativeSchema, type InitiativeDto, type MessageKey } from '@app/shared';
import type { User } from 'oidc-client-ts';
import { type FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from './api';
import { login, logout } from './auth';
import { I18nProvider, LanguageSelector, useI18n } from './i18n';

export function App({ user }: { user: User | null }) {
  return (
    <I18nProvider signedIn={!!user}>
      {user ? <SignedIn user={user} /> : <SignedOut />}
    </I18nProvider>
  );
}

function SignedOut() {
  const { t } = useI18n();
  // Échec avant la redirection vers Keycloak (réseau, certificat…) : à afficher.
  const [failure, setFailure] = useState<string | null>(null);
  return (
    <main>
      <header>
        <h1>{t('app.title')}</h1>
        <LanguageSelector />
      </header>
      <button onClick={() => login().catch((e: unknown) => setFailure(String(e)))}>{t('auth.login')}</button>
      {failure && <p className="error">{t('auth.loginFailed', { error: failure })}</p>}
    </main>
  );
}

function SignedIn({ user }: { user: User }) {
  const { t } = useI18n();
  return (
    <main>
      <header>
        <h1>{t('initiatives.title')}</h1>
        <span>
          {user.profile.name ?? user.profile.preferred_username} <LanguageSelector />{' '}
          <button onClick={() => void logout()}>{t('auth.logout')}</button>
        </span>
      </header>
      <Initiatives />
    </main>
  );
}

/** Erreur à afficher : gardée sous forme de clé pour suivre un changement de langue. */
type UiError = { key: MessageKey; params?: Record<string, string | number> } | { raw: string };

function toUiError(error: unknown): UiError {
  if (error instanceof ApiError) {
    return error.status === 409 ? { key: 'initiatives.codeTaken' } : { key: 'error.http', params: { status: error.status } };
  }
  return { raw: String(error) };
}

function Initiatives() {
  const { t } = useI18n();
  const [initiatives, setInitiatives] = useState<InitiativeDto[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    api.listInitiatives().then(setInitiatives, (e: unknown) => setError(toUiError(e)));
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    // Même schéma de validation que l'API (@app/shared).
    const parsed = createInitiativeSchema.safeParse({ code, name });
    if (!parsed.success) {
      setError({ key: 'initiatives.invalid' });
      return;
    }
    try {
      const initiative = await api.createInitiative(parsed.data);
      setInitiatives((list) => [initiative, ...list]);
      setCode('');
      setName('');
      setError(null);
    } catch (e) {
      setError(toUiError(e));
    }
  }

  return (
    <>
      <form onSubmit={(e) => void create(e)}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t('initiatives.codePlaceholder')}
        />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('initiatives.namePlaceholder')} />
        <button type="submit">{t('initiatives.create')}</button>
      </form>
      {error && <p className="error">{'raw' in error ? error.raw : t(error.key, error.params)}</p>}
      <ul>
        {initiatives.map((i) => (
          <li key={i.id}>
            <strong>{i.code}</strong> {i.name} <small>{t(`role.${i.myRole}`)}</small>
          </li>
        ))}
      </ul>
      {initiatives.length === 0 && <p>{t('initiatives.empty')}</p>}
    </>
  );
}
