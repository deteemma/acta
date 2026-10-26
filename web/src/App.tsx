import type { InitiativeDto } from '@app/shared';
import type { User } from 'oidc-client-ts';
import { useEffect, useState } from 'react';
import { api } from './api';
import { login, logout } from './auth';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { I18nProvider, LanguageSelector, useI18n } from './i18n';
import { CreateInitiativePanel, InitiativePanel, MemberPanel } from './initiative-panels';
import { IS_MAC, Palette, usePaletteShortcut } from './palette';
import { PanelHost, PanelsProvider, usePanels } from './panels';

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
  return (
    <PanelsProvider>
      <Shell user={user} />
    </PanelsProvider>
  );
}

/** Coque de navigation : liste, palette (Ctrl+K), bouton « + » et panneaux. */
function Shell({ user }: { user: User }) {
  const { t } = useI18n();
  const { open } = usePanels();
  const [initiatives, setInitiatives] = useState<InitiativeDto[]>([]);
  const [error, setError] = useState<UiError | null>(null);
  usePaletteShortcut();

  useEffect(() => {
    api.listInitiatives().then(setInitiatives, (e: unknown) => setError(toUiError(e)));
  }, []);

  return (
    <>
      <main>
        <header>
          <h1>{t('initiatives.title')}</h1>
          <span>
            <button type="button" onClick={() => open({ kind: 'palette' })}>
              {t('palette.open')} <kbd>{IS_MAC ? '⌘K' : 'Ctrl+K'}</kbd>
            </button>{' '}
            {user.profile.name ?? user.profile.preferred_username} <LanguageSelector />{' '}
            <button onClick={() => void logout()}>{t('auth.logout')}</button>
          </span>
        </header>
        <ErrorMessage error={error} />
        <ul className="links">
          {initiatives.map((i) => (
            <li key={i.id}>
              <button type="button" className="link" onClick={() => open({ kind: 'initiative', initiativeId: i.id })}>
                <strong>{i.code}</strong> {i.name}
              </button>{' '}
              <small>{t(`role.${i.myRole}`)}</small>
            </li>
          ))}
        </ul>
        {initiatives.length === 0 && <p>{t('initiatives.empty')}</p>}
      </main>
      {/* Deviendra « + Action » au ticket 07. */}
      <button
        type="button"
        className="fab"
        aria-label={t('initiatives.new')}
        title={t('initiatives.new')}
        onClick={() => open({ kind: 'createInitiative' })}
      >
        +
      </button>
      <PanelHost
        render={(content, close) => {
          switch (content.kind) {
            case 'palette':
              return <Palette initiatives={initiatives} onClose={close} />;
            case 'createInitiative':
              return (
                <CreateInitiativePanel onCreated={(i) => setInitiatives((list) => [i, ...list])} onClose={close} />
              );
            case 'initiative':
              return <InitiativePanel initiativeId={content.initiativeId} onClose={close} />;
            case 'member':
              return <MemberPanel member={content.member} onClose={close} />;
          }
        }}
      />
    </>
  );
}
