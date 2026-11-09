import { type AnalysisObjectRef, type BabokDto, findBabokElement, type InitiativeDto, type MeDto, screenInitiativeId } from '@app/shared';
import type { User } from 'oidc-client-ts';
import { Archive, BookOpen, FileText, ListChecks, LogOut, PanelLeft, Plus, Search, Settings2, Ticket } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ActionPanel, CreateActionPanel } from './action-panels';
import { AdminPanel } from './admin-panel';
import { AlertsButton, AlertsPanel, useMyAlerts } from './alerts';
import { api } from './api';
import { BabokElementPanel, BabokPanel } from './babok-panels';
import { DashboardPanel } from './dashboard-panel';
import { EmptyState } from './empty-state';
import { login, loginErrorFromUrl, logout, shouldRedirectToLogin } from './auth';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { I18nProvider, LanguageSelector, useI18n } from './i18n';
import { CreateInitiativePanel, InitiativePanel, MemberPanel } from './initiative-panels';
import { MyActions } from './my-actions';
import { NeedPanel } from './need-panels';
import { StakeholderPanel, StakeholdersPanel } from './stakeholder-panels';
import { IS_MAC, Palette, usePaletteShortcut } from './palette';
import { PagesScreen } from './pages-screen';
import { FabContext, PanelHost, type PanelContent, PanelsProvider, ScreenForms, usePanels } from './panels';
import { ReferencesProvider } from './references';
import { RequirementPanel } from './requirement-panels';
import { ResizeHandle, SIDEBAR } from './resize';
import { ScreensProvider, useScreens } from './screens';
import { CreateTicketPanel, TicketPanel } from './ticket-panels';
import { TicketsScreen } from './tickets-screen';

export function App({ user }: { user: User | null }) {
  return (
    <I18nProvider signedIn={!!user}>
      {user ? <SignedIn user={user} /> : <SignedOut />}
    </I18nProvider>
  );
}

/** Une seule redirection vers Keycloak, même si React monte l'accueil deux fois (développement). */
let loginStarted = false;

function SignedOut() {
  const { t } = useI18n();
  // Échec avant la redirection vers Keycloak (réseau, certificat…) ou erreur
  // renvoyée par Keycloak : à afficher.
  const [failure, setFailure] = useState<string | null>(() => loginErrorFromUrl());

  // Connexion directe (validée le 01.11.2026) : l'accueil ne reste affiché
  // qu'après une déconnexion volontaire ou une erreur.
  useEffect(() => {
    if (shouldRedirectToLogin() && !loginStarted) {
      loginStarted = true;
      login().catch((e: unknown) => setFailure(String(e)));
    }
  }, []);
  // Écran de connexion (refonte du design, ticket 05) : logotype, accroche, illustration du système de design.
  return (
    <main className="signed-out">
      <div className="signed-out-text">
        <h1 className="logotype">{t('app.title')}</h1>
        <p className="tagline">{t('app.tagline')}</p>
        <div className="signed-out-buttons">
          <button type="button" className="primary" onClick={() => login().catch((e: unknown) => setFailure(String(e)))}>
            {t('auth.login')}
          </button>
          <LanguageSelector />
        </div>
        {failure && <p className="error">{t('auth.loginFailed', { error: failure })}</p>}
      </div>
      <LoginIllustration />
    </main>
  );
}

/** Blocs de couleur et trame de points, comme la couverture du système de design ACTA (style B). */
function LoginIllustration() {
  return (
    <div className="signed-out-art">
      <svg viewBox="0 0 240 180" aria-hidden="true">
        <defs>
          <pattern id="login-dots" x="6" y="6" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle className="fill-accent-soft" cx="0" cy="0" r="2" />
          </pattern>
        </defs>
        <rect className="fill-accent" x="10" y="10" width="90" height="160" rx="6" />
        <rect className="fill-text" x="112" y="10" width="118" height="100" rx="6" />
        <rect fill="url(#login-dots)" x="112" y="10" width="118" height="100" />
        <rect className="fill-accent-soft" x="112" y="122" width="72" height="48" rx="6" />
        <rect className="fill-progress" x="196" y="122" width="34" height="48" rx="6" />
      </svg>
    </div>
  );
}

function SignedIn({ user }: { user: User }) {
  return (
    <PanelsProvider>
      <ScreensProvider>
        <Shell user={user} />
      </ScreensProvider>
    </PanelsProvider>
  );
}

/** Coque de navigation : « Mes actions », initiatives, palette (Ctrl+K), bouton « + Action » et panneaux. */
function Shell({ user }: { user: User }) {
  const { t } = useI18n();
  const { stack, open, leaveScreen } = usePanels();
  const { screen, goTo, initiativeGone } = useScreens();
  const [initiatives, setInitiatives] = useState<InitiativeDto[]>([]);
  const [me, setMe] = useState<MeDto | null>(null);
  const [babok, setBabok] = useState<BabokDto | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  // Incrémenté à chaque écriture sur un ticket, de tout type, ou sur un lien : les listes se rechargent.
  const [actionsVersion, setActionsVersion] = useState(0);
  const actionsChanged = () => setActionsVersion((v) => v + 1);
  // De même pour les parties prenantes.
  const [stakeholdersVersion, setStakeholdersVersion] = useState(0);
  const stakeholdersChanged = () => setStakeholdersVersion((v) => v + 1);
  // De même pour les besoins.
  const [needsVersion, setNeedsVersion] = useState(0);
  const needsChanged = () => setNeedsVersion((v) => v + 1);
  // De même pour les exigences.
  const [requirementsVersion, setRequirementsVersion] = useState(0);
  const requirementsChanged = () => setRequirementsVersion((v) => v + 1);
  // De même pour les pages (ticket 22).
  const [pagesVersion, setPagesVersion] = useState(0);
  const pagesChanged = () => setPagesVersion((v) => v + 1);
  // De même pour la fiche d'une initiative (approche, date de fin prévue : ticket 14).
  const [initiativeVersion, setInitiativeVersion] = useState(0);
  usePaletteShortcut();
  const alerts = useMyAlerts(me, actionsVersion);
  const [navHidden, setNavHidden] = useState(() => readNavHidden());
  const toggleNav = (hidden: boolean) => {
    setNavHidden(hidden);
    writeNavHidden(hidden);
  };

  useEffect(() => {
    api.listInitiatives().then(setInitiatives, (e: unknown) => setError(toUiError(e)));
    // Sans réponse, pas d'accès à l'administration : l'API la refuse de toute façon.
    api.me().then(setMe, () => undefined);
    api.babok().then(setBabok, (e: unknown) => setError(toUiError(e)));
  }, []);

  const active = initiatives.filter((i) => !i.archivedAt);
  const archived = initiatives.filter((i) => i.archivedAt);
  const screenInitiative = screenInitiativeId(screen);
  // Une seule initiative dépliée à la fois : celle de la fiche ouverte, sinon celle
  // de l'écran Tickets ou Pages ; elle le reste une fois la fiche refermée (décision 13).
  const shownInitiativeId =
    stack.map((e) => e.content).findLast((content) => content.kind === 'initiative')?.initiativeId ?? screenInitiative;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (shownInitiativeId && shownInitiativeId !== expandedId) setExpandedId(shownInitiativeId);
  // Panneau le plus haut qui montre une initiative ou l'un de ses objets : la
  // création rapide propose cette initiative, et part de cet objet (ticket 13) ;
  // sans panneau, celle de l'écran Tickets ou Pages.
  const fabOrigin =
    stack.map((e) => actionOrigin(e.content)).findLast((origin) => origin !== undefined) ??
    (screenInitiative ? { initiativeId: screenInitiative } : undefined);
  const fab = (
    <button
      type="button"
      className="fab"
      aria-label={t('actions.new')}
      title={t('actions.new')}
      disabled={!babok}
      onClick={() => open({ kind: 'createAction', ...fabOrigin })}
    >
      <Plus />
      {t('actions.fab')}
    </button>
  );

  return (
    // Les références citées dans un texte suivent les besoins, exigences, tickets et pages créés, modifiés ou supprimés.
    <ReferencesProvider version={needsVersion + requirementsVersion + actionsVersion + pagesVersion}>
      <FabContext.Provider value={fab}>
        <div className="shell">
          {/* Barre latérale (refonte du design, ticket 03) : repliable, le choix est retenu sur ce navigateur. */}
          {!navHidden && (
            <nav id="sidebar" className="sidebar" aria-label={t('shell.navigation')}>
              <ResizeHandle area={SIDEBAR} label={t('shell.resizeNav')} className="sidebar-resize" />
              <span className="logotype">{t('app.title')}</span>
              <button
                type="button"
                className="nav-item"
                aria-current={screen.kind === 'myActions' ? 'page' : undefined}
                onClick={() => void goTo({ kind: 'myActions' })}
              >
                <ListChecks />
                {t('actions.title')}
              </button>
              <div className="nav-section">
                <h2>{t('initiatives.title')}</h2>
                <button type="button" className="ghost" onClick={() => open({ kind: 'createInitiative' })}>
                  <Plus />
                  {t('initiatives.new')}
                </button>
              </div>
              <InitiativeList initiatives={active} expandedId={expandedId} />
              {initiatives.length === 0 && (
                <EmptyState
                  subject="initiatives"
                  compact
                  title={t('initiatives.empty')}
                  hint={t('empty.initiativesHint')}
                />
              )}
              {archived.length > 0 && (
                // Ouverte si l'initiative dépliée en fait partie, sans quoi son entrée resterait cachée.
                <details className="archived" open={archived.some((i) => i.id === expandedId)}>
                  <summary>
                    <Archive />
                    {t('initiatives.archivedSection', { count: archived.length })}
                  </summary>
                  <InitiativeList initiatives={archived} expandedId={expandedId} />
                </details>
              )}
              {me?.isAdmin && (
                <button type="button" className="nav-item sidebar-end" onClick={() => open({ kind: 'admin' })}>
                  <Settings2 />
                  {t('admin.open')}
                </button>
              )}
            </nav>
          )}
          <div className="shell-main">
            <header className="topbar">
              <button
                type="button"
                className="ghost icon-only"
                aria-controls="sidebar"
                aria-expanded={!navHidden}
                aria-label={t(navHidden ? 'shell.showNav' : 'shell.hideNav')}
                title={t(navHidden ? 'shell.showNav' : 'shell.hideNav')}
                onClick={() => toggleNav(!navHidden)}
              >
                <PanelLeft />
              </button>
              <button type="button" className="search" onClick={() => open({ kind: 'palette' })}>
                <span>
                  <Search />
                  {t('palette.open')}
                </span>
                <kbd>{IS_MAC ? '⌘K' : 'Ctrl+K'}</kbd>
              </button>
              <span className="topbar-end">
                <button type="button" className="ghost" disabled={!babok} onClick={() => open({ kind: 'babok' })}>
                  <BookOpen />
                  {t('babok.open')}
                </button>
                <AlertsButton alerts={alerts} />
                <small>{user.profile.name ?? user.profile.preferred_username}</small>
                <LanguageSelector />
                <button type="button" className="ghost" onClick={() => void leaveScreen().then((left) => (left ? logout() : undefined))}>
                  <LogOut />
                  {t('auth.logout')}
                </button>
              </span>
            </header>
            <main className="page">
              <ErrorMessage error={error} />
              {screen.kind === 'pages' ? (
                // La page en écriture est gardée par l'alerte comme un panneau.
                <ScreenForms>
                  <PagesScreen
                    key={screen.initiativeId}
                    initiativeId={screen.initiativeId}
                    pageId={screen.pageId}
                    initiative={initiatives.find((i) => i.id === screen.initiativeId)}
                    version={pagesVersion}
                    onChanged={pagesChanged}
                  />
                </ScreenForms>
              ) : screen.kind === 'tickets' ? (
                <TicketsScreen
                  key={screen.initiativeId}
                  initiativeId={screen.initiativeId}
                  initiative={initiatives.find((i) => i.id === screen.initiativeId)}
                  version={actionsVersion}
                  onChanged={actionsChanged}
                />
              ) : (
                <>
                  <h1>{t('actions.title')}</h1>
                  <MyActions initiatives={[...active, ...archived]} babok={babok} version={actionsVersion} />
                </>
              )}
            </main>
          </div>
          {fab}
        </div>
        <PanelHost
          render={(content, close) => {
            switch (content.kind) {
              case 'palette':
                // Les archivées après les actives.
                return <Palette initiatives={[...active, ...archived]} babok={babok} onClose={close} />;
              case 'createInitiative':
                return (
                  <CreateInitiativePanel onCreated={(i) => setInitiatives((list) => [i, ...list])} onClose={close} />
                );
              case 'initiative':
                return (
                  <InitiativePanel
                    initiativeId={content.initiativeId}
                    babok={babok}
                    actionsVersion={actionsVersion}
                    stakeholdersVersion={stakeholdersVersion}
                    needsVersion={needsVersion}
                    requirementsVersion={requirementsVersion}
                    pagesVersion={pagesVersion}
                    onChanged={(changed) => {
                      setInitiatives((list) => list.map((i) => (i.id === changed.id ? changed : i)));
                      setInitiativeVersion((v) => v + 1);
                    }}
                    onDeleted={(id) => {
                      setInitiatives((list) => list.filter((i) => i.id !== id));
                      initiativeGone(id);
                    }}
                    onClose={close}
                  />
                );
              case 'dashboard':
                return (
                  babok && (
                    <DashboardPanel
                      initiativeId={content.initiativeId}
                      babok={babok}
                      actionsVersion={actionsVersion}
                      dataVersion={[actionsVersion, stakeholdersVersion, needsVersion, requirementsVersion, initiativeVersion].join('-')}
                      onActionCreated={actionsChanged}
                      onClose={close}
                    />
                  )
                );
              case 'alerts':
                return <AlertsPanel alerts={alerts} onSeen={setMe} onClose={close} />;
              case 'member':
                return <MemberPanel member={content.member} onClose={close} />;
              case 'admin':
                return me && <AdminPanel myId={me.id} onClose={close} />;
              case 'babok':
                return babok && <BabokPanel babok={babok} onClose={close} />;
              case 'babokElement': {
                const element = babok && findBabokElement(babok, content.elementId);
                return element && <BabokElementPanel babok={babok} element={element} onClose={close} />;
              }
              case 'createAction':
                return (
                  babok && (
                    <CreateActionPanel
                      babok={babok}
                      initiatives={active}
                      initiativeId={content.initiativeId}
                      from={content.from}
                      onCreated={actionsChanged}
                      onClose={close}
                    />
                  )
                );
              case 'action':
                return (
                  babok && (
                    <ActionPanel
                      babok={babok}
                      initiativeId={content.initiativeId}
                      actionId={content.actionId}
                      ticketsVersion={actionsVersion}
                      stakeholdersVersion={stakeholdersVersion}
                      onChanged={actionsChanged}
                      onClose={close}
                    />
                  )
                );
              case 'ticket':
                return (
                  <TicketPanel
                    initiativeId={content.initiativeId}
                    ticketId={content.ticketId}
                    ticketsVersion={actionsVersion}
                    stakeholdersVersion={stakeholdersVersion}
                    onChanged={actionsChanged}
                    onClose={close}
                  />
                );
              case 'createTicket': {
                const initiative = active.find((i) => i.id === content.initiativeId);
                return (
                  babok &&
                  initiative && (
                    <CreateTicketPanel
                      babok={babok}
                      initiative={initiative}
                      epicId={content.epicId}
                      myId={me?.id ?? null}
                      onCreated={actionsChanged}
                      onClose={close}
                    />
                  )
                );
              }
              case 'stakeholders':
                return (
                  <StakeholdersPanel initiativeId={content.initiativeId} version={stakeholdersVersion} onClose={close} />
                );
              case 'stakeholder':
                return (
                  <StakeholderPanel
                    babok={babok}
                    initiativeId={content.initiativeId}
                    stakeholderId={content.stakeholderId}
                    actionsVersion={actionsVersion}
                    needsVersion={needsVersion}
                    requirementsVersion={requirementsVersion}
                    onChanged={stakeholdersChanged}
                    onClose={close}
                  />
                );
              case 'need':
                return (
                  <NeedPanel
                    initiativeId={content.initiativeId}
                    needId={content.needId}
                    actionsVersion={actionsVersion}
                    stakeholdersVersion={stakeholdersVersion}
                    requirementsVersion={requirementsVersion}
                    onChanged={needsChanged}
                    onLinksChanged={actionsChanged}
                    onClose={close}
                  />
                );
              case 'requirement':
                return (
                  <RequirementPanel
                    initiativeId={content.initiativeId}
                    requirementId={content.requirementId}
                    actionsVersion={actionsVersion}
                    stakeholdersVersion={stakeholdersVersion}
                    needsVersion={needsVersion}
                    onChanged={requirementsChanged}
                    onLinksChanged={actionsChanged}
                    onClose={close}
                  />
                );
            }
          }}
        />
      </FabContext.Provider>
    </ReferencesProvider>
  );
}

/** Initiative, et objet éventuel, d'où le bouton « + Action » crée l'action depuis ce panneau. */
function actionOrigin(content: PanelContent): { initiativeId: string; from?: AnalysisObjectRef } | undefined {
  switch (content.kind) {
    case 'initiative':
    case 'dashboard':
    case 'action':
    case 'ticket':
    case 'createTicket':
    case 'stakeholders':
      return { initiativeId: content.initiativeId };
    case 'stakeholder':
      return { initiativeId: content.initiativeId, ...(content.stakeholderId && { from: { kind: 'stakeholder', id: content.stakeholderId } }) };
    case 'need':
      return { initiativeId: content.initiativeId, ...(content.needId && { from: { kind: 'need', id: content.needId } }) };
    case 'requirement':
      return {
        initiativeId: content.initiativeId,
        ...(content.requirementId && { from: { kind: 'requirement', id: content.requirementId } }),
      };
    default:
      return undefined;
  }
}

function InitiativeList({ initiatives, expandedId }: { initiatives: InitiativeDto[]; expandedId: string | null }) {
  const { t } = useI18n();
  const { screen, goTo, showInitiative } = useScreens();
  return (
    <ul className="nav-list">
      {initiatives.map((i) => (
        <li key={i.id}>
          {/* L'écran Tickets suit la fiche ouverte (précision de la décision 13, point 1). */}
          <button
            type="button"
            className="nav-item"
            onClick={() => showInitiative(i.id)}
          >
            <span className="code">{i.code}</span>
            <span>
              {i.name}
              <small>{t(`role.${i.myRole}`)}</small>
            </span>
          </button>
          {i.id === expandedId && (
            <>
              <button
                type="button"
                className="nav-item nav-sub"
                aria-current={screen.kind === 'tickets' && screen.initiativeId === i.id ? 'page' : undefined}
                onClick={() => void goTo({ kind: 'tickets', initiativeId: i.id })}
              >
                <Ticket />
                {t('tickets.title')}
              </button>
              <button
                type="button"
                className="nav-item nav-sub"
                aria-current={screen.kind === 'pages' && screen.initiativeId === i.id ? 'page' : undefined}
                onClick={() => void goTo({ kind: 'pages', initiativeId: i.id, pageId: null })}
              >
                <FileText />
                {t('pages.title')}
              </button>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

// Barre latérale masquée ou non : préférence de ce navigateur seulement.
const NAV_HIDDEN_KEY = 'acta.navHidden';

function readNavHidden(): boolean {
  try {
    return localStorage.getItem(NAV_HIDDEN_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeNavHidden(hidden: boolean) {
  try {
    localStorage.setItem(NAV_HIDDEN_KEY, String(hidden));
  } catch {
    // Stockage indisponible (navigation privée) : le choix vaut pour la session.
  }
}
