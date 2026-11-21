import {
  type AnalysisObjectRef,
  type BabokDto,
  findBabokElement,
  type InitiativeDto,
  type InitiativeTreeNode,
  type MeDto,
  type Screen,
  screenInitiativeId,
  screenNodeKey,
} from '@app/shared';
import type { User } from 'oidc-client-ts';
import { BookOpen, ListChecks, LogOut, PanelLeft, Plus, Search, Settings2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ActionPanel, CreateActionPanel } from './action-panels';
import { AdminPanel } from './admin-panel';
import { PageTemplatePanel } from './admin-page-templates';
import { AlertsButton, AlertsPanel, useMyAlerts } from './alerts';
import { api } from './api';
import { BabokElementPanel, BabokPanel } from './babok-panels';
import { EmptyState } from './empty-state';
import { login, loginErrorFromUrl, logout, shouldRedirectToLogin } from './auth';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { I18nProvider, LanguageSelector, useI18n } from './i18n';
import { Logotype } from './logotype';
import { CreateInitiativeDialog, MemberPanel } from './initiative-panels';
import { InitiativeDataScreen } from './initiative-screens';
import { InitiativeTree, nodeDestination, useInitiativeData } from './initiative-tree';
import { MyActions } from './my-actions';
import { NeedPanel } from './need-panels';
import { StakeholderPanel, StakeholdersPanel } from './stakeholder-panels';
import { IS_MAC, Palette, usePaletteShortcut } from './palette';
import { PagesScreen } from './pages-screen';
import { FabContext, PanelHost, type PanelContent, PanelsProvider, SCREEN_TITLE_ID, ScreenForms, usePanels } from './panels';
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
        <Logotype as="h1" />
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

/** Petit écran (tablette, fenêtre étroite) : l'arborescence est repliée, ouverte par-dessus (N4). */
const NARROW_SHELL = '(max-width: 60rem)';

/**
 * Coque (ADR-0021) : à gauche le sélecteur d'initiative, son arborescence et, en
 * bas, « Mes actions », le référentiel et l'administration ; à droite l'écran de
 * données. Palette (Ctrl+K), bouton « + Action » et panneaux pas encore repris.
 */
function Shell({ user }: { user: User }) {
  const { t } = useI18n();
  const { stack, open, leaveScreen } = usePanels();
  const { screen, goTo, initiativeGone } = useScreens();
  const [initiatives, setInitiatives] = useState<InitiativeDto[] | null>(null);
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
  const narrow = useMediaQuery(NARROW_SHELL);
  const [navHidden, setNavHidden] = useState(() => readNavHidden());
  const [treeOpen, setTreeOpen] = useState(false);
  const navShown = narrow ? treeOpen : !navHidden;
  const toggleNav = () => {
    if (narrow) {
      setTreeOpen((o) => !o);
      return;
    }
    setNavHidden(!navHidden);
    writeNavHidden(!navHidden);
  };

  useEffect(() => {
    api.listInitiatives().then(setInitiatives, (e: unknown) => setError(toUiError(e)));
    // Sans réponse, pas d'accès à l'administration : l'API la refuse de toute façon.
    api.me().then(setMe, () => undefined);
    api.babok().then(setBabok, (e: unknown) => setError(toUiError(e)));
  }, []);

  const active = (initiatives ?? []).filter((i) => !i.archivedAt);
  const archived = (initiatives ?? []).filter((i) => i.archivedAt);
  const screenInitiative = screenInitiativeId(screen);
  // Initiative du sélecteur : celle de l'écran, sinon la dernière consultée sur ce
  // navigateur, sinon la première (N2).
  const [lastId, setLastId] = useState(() => readLastInitiative());
  if (screenInitiative && screenInitiative !== lastId) setLastId(screenInitiative);
  useEffect(() => {
    if (lastId) writeLastInitiative(lastId);
  }, [lastId]);
  // Liste pas encore chargée : la dernière initiative est supposée encore accessible.
  const isAccessible = (id: string | null) => !!id && (!initiatives || initiatives.some((i) => i.id === id));
  const shownId = screenInitiative ?? (isAccessible(lastId) ? lastId : (active[0]?.id ?? archived[0]?.id ?? null));
  const dataVersion = [actionsVersion, stakeholdersVersion, needsVersion, requirementsVersion, pagesVersion, initiativeVersion].join('-');
  const { data, error: dataError } = useInitiativeData(shownId, dataVersion);
  const selectedKey = screenInitiative && screenInitiative === shownId ? screenNodeKey(screen) : null;

  useTitleFocus(screen);

  const selectNode = (node: InitiativeTreeNode) => {
    if (!shownId) return;
    const { screen: next, panel } = nodeDestination(shownId, node.ref);
    setTreeOpen(false);
    void goTo(next, panel);
  };

  const initiativeChanged = (changed: InitiativeDto) => {
    setInitiatives((list) => list && list.map((i) => (i.id === changed.id ? changed : i)));
    setInitiativeVersion((v) => v + 1);
  };
  const initiativeRemoved = (id: string) => {
    setInitiatives((list) => list && list.filter((i) => i.id !== id));
    initiativeGone(id);
  };

  // Panneau le plus haut qui montre un objet d'une initiative : la création rapide
  // propose cette initiative, et part de cet objet (ticket 13) ; sans panneau,
  // l'initiative de l'écran.
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

  const screenInitiativeDto = screenInitiative ? initiatives?.find((i) => i.id === screenInitiative) : undefined;
  const dataZone = (() => {
    if (screen.kind === 'myActions') {
      return (
        <>
          <h1 id={SCREEN_TITLE_ID} tabIndex={-1}>
            {t('actions.title')}
          </h1>
          <MyActions initiatives={[...active, ...archived]} babok={babok} version={actionsVersion} />
        </>
      );
    }
    if (screen.kind === 'pages') {
      return (
        // La page en écriture est gardée par l'alerte comme un panneau.
        <ScreenForms>
          <PagesScreen
            key={screen.initiativeId}
            initiativeId={screen.initiativeId}
            pageId={screen.pageId}
            initiative={screenInitiativeDto}
            babok={babok}
            version={pagesVersion}
            onChanged={pagesChanged}
            myId={me?.id ?? null}
            linksVersion={actionsVersion}
            onLinksChanged={actionsChanged}
          />
        </ScreenForms>
      );
    }
    if (screen.kind === 'tickets') {
      return (
        <TicketsScreen
          key={screen.initiativeId}
          initiativeId={screen.initiativeId}
          initiative={screenInitiativeDto}
          version={actionsVersion}
          onChanged={actionsChanged}
        />
      );
    }
    if (!data || data.initiative.id !== screen.initiativeId) {
      return dataError ? <ErrorMessage error={dataError} /> : <p>{t('common.loading')}</p>;
    }
    return (
      <ScreenForms>
        <InitiativeDataScreen
          // Autre élément ou autre initiative : les formulaires repartent de l'élément affiché.
          key={`${screen.initiativeId}:${screen.kind}`}
          screen={screen}
          data={data}
          babok={babok}
          actionsVersion={actionsVersion}
          onNavigate={(next) => void goTo(next)}
          onSelectNode={selectNode}
          onInitiativeChanged={initiativeChanged}
          // Mon rôle a pu changer : l'initiative est relue, la liste et l'arborescence suivent.
          onTeamChanged={() => void api.getInitiative(screen.initiativeId).then(initiativeChanged, (e: unknown) => setError(toUiError(e)))}
          onInitiativeGone={initiativeRemoved}
          onActionCreated={actionsChanged}
        />
      </ScreenForms>
    );
  })();

  return (
    // Les références citées dans un texte suivent les besoins, exigences, tickets et pages créés, modifiés ou supprimés.
    <ReferencesProvider version={needsVersion + requirementsVersion + actionsVersion + pagesVersion}>
      <FabContext.Provider value={fab}>
        <div className={`shell${narrow ? ' shell-narrow' : ''}`}>
          {navShown && narrow && <div className="sidebar-backdrop" aria-hidden="true" onClick={() => setTreeOpen(false)} />}
          {navShown && (
            <nav
              id="sidebar"
              className={`sidebar${narrow ? ' sidebar-overlay' : ''}`}
              aria-label={t('shell.navigation')}
              onKeyDown={(e) => {
                if (narrow && e.key === 'Escape') setTreeOpen(false);
              }}
            >
              {!narrow && <ResizeHandle area={SIDEBAR} label={t('shell.resizeNav')} className="sidebar-resize" />}
              <Logotype />
              <div className="initiative-picker">
                <label>
                  <span className="visually-hidden">{t('shell.initiativePicker')}</span>
                  <select
                    value={shownId ?? ''}
                    disabled={!initiatives || initiatives.length === 0}
                    onChange={(e) => {
                      setTreeOpen(false);
                      void goTo({ kind: 'initiative', initiativeId: e.target.value, tab: 'overview' });
                    }}
                  >
                    {!shownId && <option value="">{t('initiatives.title')}</option>}
                    {/* Les actives, puis les archivées (N2). */}
                    <optgroup label={t('shell.activeInitiatives')}>
                      <InitiativeOptions initiatives={active} />
                    </optgroup>
                    {archived.length > 0 && (
                      <optgroup label={t('shell.archivedInitiatives')}>
                        <InitiativeOptions initiatives={archived} />
                      </optgroup>
                    )}
                  </select>
                </label>
                <button
                  type="button"
                  className="ghost icon-only"
                  aria-label={t('initiatives.new')}
                  title={t('initiatives.new')}
                  onClick={() => open({ kind: 'createInitiative' })}
                >
                  <Plus />
                </button>
              </div>
              <div className="tree-scroll">
                {initiatives?.length === 0 && (
                  <EmptyState subject="initiatives" compact title={t('initiatives.empty')} hint={t('empty.initiativesHint')} />
                )}
                {shownId && data?.initiative.id === shownId && (
                  <InitiativeTree tree={data.tree} selectedKey={selectedKey} onSelect={selectNode} />
                )}
                {shownId && data?.initiative.id !== shownId && !dataError && <p className="muted">{t('tree.loading')}</p>}
              </div>
              {/* Hors de l'arborescence, affichés dans la zone de droite (N3). */}
              <div className="sidebar-end">
                <button
                  type="button"
                  className="nav-item"
                  aria-current={screen.kind === 'myActions' ? 'page' : undefined}
                  onClick={() => {
                    setTreeOpen(false);
                    void goTo({ kind: 'myActions' });
                  }}
                >
                  <ListChecks />
                  {t('actions.title')}
                </button>
                <button type="button" className="nav-item" disabled={!babok} onClick={() => open({ kind: 'babok' })}>
                  <BookOpen />
                  {t('babok.open')}
                </button>
                {me?.isAdmin && (
                  <button type="button" className="nav-item" onClick={() => open({ kind: 'admin' })}>
                    <Settings2 />
                    {t('admin.open')}
                  </button>
                )}
              </div>
            </nav>
          )}
          <div className="shell-main">
            <header className="topbar">
              <button
                type="button"
                className="ghost icon-only"
                aria-controls="sidebar"
                aria-expanded={navShown}
                aria-label={t(navShown ? 'shell.hideNav' : 'shell.showNav')}
                title={t(navShown ? 'shell.hideNav' : 'shell.showNav')}
                onClick={toggleNav}
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
              {dataZone}
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
                  <CreateInitiativeDialog
                    onCreated={(i) => {
                      setInitiatives((list) => [i, ...(list ?? [])]);
                      void goTo({ kind: 'initiative', initiativeId: i.id, tab: 'overview' });
                    }}
                    onClose={close}
                  />
                );
              case 'alerts':
                return <AlertsPanel alerts={alerts} onSeen={setMe} onClose={close} />;
              case 'member':
                return <MemberPanel member={content.member} onClose={close} />;
              case 'admin':
                return me && <AdminPanel myId={me.id} babok={babok} onClose={close} />;
              case 'pageTemplate':
                return babok && <PageTemplatePanel babok={babok} templateId={content.templateId} onClose={close} />;
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
                      myId={me?.id ?? null}
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
                    myId={me?.id ?? null}
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
                    scenarioId={content.scenarioId}
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

function InitiativeOptions({ initiatives }: { initiatives: InitiativeDto[] }) {
  return initiatives.map((i) => (
    <option key={i.id} value={i.id}>
      {i.code} — {i.name}
    </option>
  ));
}

/** Initiative, et objet éventuel, d'où le bouton « + Action » crée l'action depuis ce panneau. */
function actionOrigin(content: PanelContent): { initiativeId: string; from?: AnalysisObjectRef } | undefined {
  switch (content.kind) {
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

/**
 * Focus sur le titre de l'écran de données à chaque changement d'élément
 * (accessibilité), sauf au démarrage et quand un panneau vient de s'ouvrir par-dessus.
 */
function useTitleFocus(screen: Screen) {
  const element = screen.kind === 'myActions' ? 'myActions' : `${screen.initiativeId}:${screenNodeKey(screen)}`;
  const previous = useRef(element);
  useEffect(() => {
    if (previous.current === element) return;
    previous.current = element;
    requestAnimationFrame(() => {
      if (document.activeElement?.closest('dialog')) return;
      document.getElementById(SCREEN_TITLE_ID)?.focus();
    });
  }, [element]);
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

// Préférences de ce navigateur seulement ; stockage indisponible (navigation
// privée) : elles valent pour la session.
const NAV_HIDDEN_KEY = 'acta.navHidden';
const LAST_INITIATIVE_KEY = 'acta.lastInitiative';

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
    // Le choix vaut pour la session.
  }
}

/** Dernière initiative consultée sur ce navigateur (N2). */
function readLastInitiative(): string | null {
  try {
    return localStorage.getItem(LAST_INITIATIVE_KEY);
  } catch {
    return null;
  }
}

function writeLastInitiative(initiativeId: string) {
  try {
    localStorage.setItem(LAST_INITIATIVE_KEY, initiativeId);
  } catch {
    // Retenue pour la session seulement.
  }
}
