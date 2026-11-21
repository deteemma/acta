import {
  type AnalysisObjectRef,
  type BabokDto,
  type InitiativeDto,
  type InitiativeTreeNode,
  type MeDto,
  type Screen,
  screenInitiativeId,
  screenNodeKey,
} from '@app/shared';
import type { User } from 'oidc-client-ts';
import { BookOpen, ListChecks, LogOut, PanelLeft, Plus, Search, Settings2 } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { CreateActionDialog } from './actions';
import { PageTemplateScreen } from './admin-page-templates';
import { AdminScreen } from './admin-screen';
import { AlertsButton, AlertsScreen, useMyAlerts } from './alerts';
import { api } from './api';
import { BabokElementScreen, BabokScreen } from './babok-screens';
import { DialogHost, DialogsProvider, SCREEN_TITLE_ID, ScreenForms, useDialogs } from './dialogs';
import { EmptyState } from './empty-state';
import { login, loginErrorFromUrl, logout, shouldRedirectToLogin } from './auth';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { I18nProvider, LanguageSelector, useI18n } from './i18n';
import { Logotype } from './logotype';
import { CreateInitiativeDialog } from './initiative-sheet';
import { InitiativeDataScreen } from './initiative-screens';
import { InitiativeTree, nodeDestination, type PageMoves, useInitiativeData } from './initiative-tree';
import { MyActions } from './my-actions';
import { CreateNeedDialog } from './need-screen';
import { CreateStakeholderDialog } from './stakeholder-screen';
import { IS_MAC, Palette, usePaletteShortcut } from './palette';
import { canEditPages, CreatePageDialog } from './page-screen';
import { ReferencesProvider } from './references';
import { CreateRequirementDialog } from './requirement-screen';
import { CreateScenarioDialog } from './scenario-section';
import { ResizeHandle, SIDEBAR } from './resize';
import { ScreensProvider, useScreens } from './screens';
import { CreateTicketDialog } from './ticket-screen';

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
    <DialogsProvider>
      <ScreensProvider>
        <Shell user={user} />
      </ScreensProvider>
    </DialogsProvider>
  );
}

/** Petit écran (tablette, fenêtre étroite) : l'arborescence est repliée, ouverte par-dessus (N4). */
const NARROW_SHELL = '(max-width: 60rem)';

/**
 * Coque (ADR-0021) : à gauche le sélecteur d'initiative, son arborescence et, en
 * bas, « Mes actions », le référentiel et l'administration ; à droite l'écran de
 * données (N1, N3). Palette (Ctrl+K) et créations en fenêtres de dialogue,
 * bouton « + Action ».
 */
function Shell({ user }: { user: User }) {
  const { t } = useI18n();
  const { open, leaveScreen } = useDialogs();
  const { screen, goTo, replaceScreen, initiativeGone } = useScreens();
  const [initiatives, setInitiatives] = useState<InitiativeDto[] | null>(null);
  const [me, setMe] = useState<MeDto | null>(null);
  const [meError, setMeError] = useState<UiError | null>(null);
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
  // Page tout juste créée : elle s'ouvre en écriture (décision du 21.11.2026).
  const [editPageId, setEditPageId] = useState<string | null>(null);
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
    api.me().then(setMe, (e: unknown) => setMeError(toUiError(e)));
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
  const { data, pending: dataPending, error: dataError } = useInitiativeData(shownId, dataVersion);
  const selectedKey = screenInitiative && screenInitiative === shownId ? screenNodeKey(screen) : null;

  useTitleFocus(screen);

  const selectNode = (node: InitiativeTreeNode) => {
    if (!shownId) return;
    setTreeOpen(false);
    void goTo(nodeDestination(shownId, node.ref));
  };
  const showTicket = (initiativeId: string, ticketId: string) =>
    void goTo({ kind: 'ticket', initiativeId, ticketId, tab: 'sheet' });

  // Rangement des pages dans l'arborescence, pour qui peut les modifier (N9).
  const pageMoves: PageMoves | undefined =
    data && canEditPages(data.initiative)
      ? {
          pages: data.pages,
          onMove: async (pageId, placement) => {
            try {
              await api.movePage(data.initiative.id, pageId, placement);
              setError(null);
              pagesChanged();
            } catch (e) {
              setError(toUiError(e));
              throw e;
            }
          },
          onAddChild: (parentId) => {
            setTreeOpen(false);
            open({ kind: 'createPage', initiativeId: data.initiative.id, parentId });
          },
        }
      : undefined;

  const initiativeChanged = (changed: InitiativeDto) => {
    setInitiatives((list) => list && list.map((i) => (i.id === changed.id ? changed : i)));
    setInitiativeVersion((v) => v + 1);
  };
  const initiativeRemoved = (id: string) => {
    setInitiatives((list) => list && list.filter((i) => i.id !== id));
    initiativeGone(id);
  };

  // La création rapide propose l'initiative de l'écran, et part de son élément (ticket 13).
  const fabOrigin = screenActionOrigin(screen);
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

  // Administration : réservée à l'administrateur, comme son entrée dans le menu.
  const adminOnly = (content: () => ReactNode) =>
    !me ? (
      meError ? <ErrorMessage error={meError} /> : <p>{t('common.loading')}</p>
    ) : me.isAdmin ? (
      content()
    ) : (
      <p className="error" role="alert">
        {t('admin.forbidden')}
      </p>
    );

  const dataZone = (() => {
    switch (screen.kind) {
      case 'myActions':
        return (
          <>
            <h1 id={SCREEN_TITLE_ID} tabIndex={-1}>
              {t('actions.title')}
            </h1>
            <MyActions initiatives={[...active, ...archived]} babok={babok} version={actionsVersion} />
          </>
        );
      case 'alerts':
        return <AlertsScreen alerts={alerts} onSeen={setMe} />;
      case 'babok':
        return <BabokScreen babok={babok} tab={screen.tab} />;
      case 'babokElement':
        return <BabokElementScreen babok={babok} elementId={screen.elementId} />;
      case 'admin':
        return adminOnly(() => <AdminScreen myId={me!.id} babok={babok} tab={screen.tab} />);
      case 'pageTemplate':
        return adminOnly(() => <PageTemplateScreen babok={babok} templateId={screen.templateId} />);
    }
    if (!data || data.initiative.id !== screen.initiativeId) {
      // Tickets ou pages d'une initiative dont je ne suis pas membre, ou disparue :
      // le refus de l'écran Tickets (ticket 17) ou Pages (ticket 22).
      const refusal = refusalMessage(screen);
      if (dataError && refusal && isRefusal(dataError)) {
        return (
          <p className="error" role="alert">
            {t(refusal)}
          </p>
        );
      }
      return dataError ? <ErrorMessage error={dataError} /> : <p>{t('common.loading')}</p>;
    }
    return (
        <InitiativeDataScreen
          screen={screen}
          data={data}
          pending={dataPending}
          babok={babok}
          actionsVersion={actionsVersion}
          myId={me?.id ?? null}
          onNavigate={(next) => void goTo(next)}
          onReplace={replaceScreen}
          onSelectNode={selectNode}
          onInitiativeChanged={initiativeChanged}
          // Mon rôle a pu changer : l'initiative est relue, la liste et l'arborescence suivent.
          onTeamChanged={() => void api.getInitiative(screen.initiativeId).then(initiativeChanged, (e: unknown) => setError(toUiError(e)))}
          onInitiativeGone={initiativeRemoved}
          onActionCreated={actionsChanged}
          onStakeholdersChanged={stakeholdersChanged}
          onNeedsChanged={needsChanged}
          onRequirementsChanged={requirementsChanged}
          onTicketsChanged={actionsChanged}
          onPagesChanged={pagesChanged}
          onAddPage={(parent) => open({ kind: 'createPage', initiativeId: screen.initiativeId, ...(parent && { parentId: parent.id }) })}
          editPageId={editPageId}
          onPageEditStarted={() => setEditPageId(null)}
          onLinksChanged={actionsChanged}
        />
    );
  })();

  return (
    // Les références citées dans un texte suivent les besoins, exigences, tickets et pages créés, modifiés ou supprimés.
    <ReferencesProvider version={needsVersion + requirementsVersion + actionsVersion + pagesVersion}>
      <>
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
                  <InitiativeTree tree={data.tree} selectedKey={selectedKey} onSelect={selectNode} pageMoves={pageMoves} />
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
                <button
                  type="button"
                  className="nav-item"
                  aria-current={screen.kind === 'babok' || screen.kind === 'babokElement' ? 'page' : undefined}
                  onClick={() => {
                    setTreeOpen(false);
                    void goTo({ kind: 'babok', tab: 'areas' });
                  }}
                >
                  <BookOpen />
                  {t('babok.open')}
                </button>
                {me?.isAdmin && (
                  <button
                    type="button"
                    className="nav-item"
                    aria-current={screen.kind === 'admin' || screen.kind === 'pageTemplate' ? 'page' : undefined}
                    onClick={() => {
                      setTreeOpen(false);
                      void goTo({ kind: 'admin', tab: 'accounts' });
                    }}
                  >
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
                <AlertsButton alerts={alerts} current={screen.kind === 'alerts'} />
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
              {/* Autre élément ou autre initiative : les formulaires repartent de l'élément affiché. */}
              <ScreenForms key={screenElementKey(screen)}>{dataZone}</ScreenForms>
            </main>
          </div>
          {fab}
        </div>
        <DialogHost
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
              case 'createAction':
                return (
                  babok && (
                    <CreateActionDialog
                      babok={babok}
                      initiatives={active}
                      initiativeId={content.initiativeId}
                      from={content.from}
                      onCreated={(created) => {
                        actionsChanged();
                        showTicket(created.initiative.id, created.id);
                      }}
                      onClose={close}
                    />
                  )
                );
              case 'createTicket': {
                const initiative = active.find((i) => i.id === content.initiativeId);
                return (
                  babok &&
                  initiative && (
                    <CreateTicketDialog
                      babok={babok}
                      initiative={initiative}
                      epicId={content.epicId}
                      myId={me?.id ?? null}
                      onCreated={(ticketId) => {
                        actionsChanged();
                        showTicket(initiative.id, ticketId);
                      }}
                      onClose={close}
                    />
                  )
                );
              }
              case 'createStakeholder':
                return (
                  data?.initiative.id === content.initiativeId && (
                    <CreateStakeholderDialog
                      initiativeId={content.initiativeId}
                      members={data.members}
                      stakeholders={data.stakeholders}
                      onCreated={(created) => {
                        stakeholdersChanged();
                        void goTo({ kind: 'stakeholder', initiativeId: created.initiativeId, stakeholderId: created.id, tab: 'sheet' });
                      }}
                      onClose={close}
                    />
                  )
                );
              case 'createNeed':
                return (
                  data?.initiative.id === content.initiativeId && (
                    <CreateNeedDialog
                      initiativeId={content.initiativeId}
                      stakeholders={data.stakeholders}
                      onCreated={(created) => {
                        needsChanged();
                        void goTo({ kind: 'need', initiativeId: created.initiativeId, needId: created.id, tab: 'sheet' });
                      }}
                      onClose={close}
                    />
                  )
                );
              case 'createRequirement':
                return (
                  data?.initiative.id === content.initiativeId && (
                    <CreateRequirementDialog
                      initiativeId={content.initiativeId}
                      stakeholders={data.stakeholders}
                      needs={data.needs}
                      requirements={data.requirements}
                      onCreated={(created) => {
                        requirementsChanged();
                        void goTo({ kind: 'requirement', initiativeId: created.initiativeId, requirementId: created.id, tab: 'sheet' });
                      }}
                      onClose={close}
                    />
                  )
                );
              case 'createPage':
                return (
                  data?.initiative.id === content.initiativeId && (
                    <CreatePageDialog
                      initiative={data.initiative}
                      parent={data.pages.find((p) => p.id === content.parentId) ?? null}
                      babok={babok}
                      onCreated={(created) => {
                        pagesChanged();
                        // En écriture seulement si elle s'ouvre bien : sinon, elle s'ouvrira plus tard en lecture.
                        void goTo({ kind: 'page', initiativeId: created.initiativeId, pageId: created.id, tab: 'content' }).then(
                          (opened) => opened && setEditPageId(created.id),
                        );
                      }}
                      onClose={close}
                    />
                  )
                );
              case 'createScenario':
                return (
                  <CreateScenarioDialog
                    initiativeId={content.initiativeId}
                    requirementId={content.requirementId}
                    language={content.language}
                    onCreated={(created) => {
                      requirementsChanged();
                      void goTo({
                        kind: 'scenario',
                        initiativeId: content.initiativeId,
                        requirementId: created.requirementId,
                        scenarioId: created.id,
                      });
                    }}
                    onClose={close}
                  />
                );
            }
          }}
        />
      </>
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

/** Refus d'accès propre à l'écran (tickets 17 et 22) ; null : l'erreur telle quelle. */
function refusalMessage(screen: Screen): 'tickets.refused' | 'pages.refused' | null {
  switch (screen.kind) {
    case 'tickets':
    case 'ticket':
      return 'tickets.refused';
    case 'pages':
    case 'page':
      return 'pages.refused';
    default:
      return null;
  }
}

/** Le non-membre reçoit 404 de l'API : même refus pour une initiative disparue. */
const isRefusal = (error: UiError) =>
  'key' in error && error.key === 'error.http' && (error.params?.status === 403 || error.params?.status === 404);

/** Initiative, et élément éventuel, d'où le bouton « + Action » crée l'action depuis l'écran de données. */
function screenActionOrigin(screen: Screen): { initiativeId: string; from?: AnalysisObjectRef } | undefined {
  switch (screen.kind) {
    case 'stakeholder':
      return { initiativeId: screen.initiativeId, from: { kind: 'stakeholder', id: screen.stakeholderId } };
    case 'need':
      return { initiativeId: screen.initiativeId, from: { kind: 'need', id: screen.needId } };
    case 'requirement':
    case 'scenario':
      return { initiativeId: screen.initiativeId, from: { kind: 'requirement', id: screen.requirementId } };
    default: {
      // Hors de toute initiative (« Mes actions », référentiel…) : rien n'est proposé.
      const initiativeId = screenInitiativeId(screen);
      return initiativeId ? { initiativeId } : undefined;
    }
  }
}

/**
 * Élément affiché, quel que soit son onglet : en changer remet ses formulaires à
 * zéro et déplace le focus sur son titre.
 */
function screenElementKey(screen: Screen): string {
  switch (screen.kind) {
    case 'myActions':
    case 'alerts':
    case 'babok':
    case 'admin':
      return screen.kind;
    case 'babokElement':
      return `babok:${screen.elementId}`;
    case 'pageTemplate':
      return `pageTemplate:${screen.templateId ?? 'new'}`;
    case 'member':
      return `${screen.initiativeId}:member:${screen.userId}`;
    default:
      return `${screen.initiativeId}:${screenNodeKey(screen)}`;
  }
}

/**
 * Focus sur le titre de l'écran de données à chaque changement d'élément
 * (accessibilité), sauf au démarrage et quand une fenêtre de dialogue vient de s'ouvrir par-dessus.
 */
function useTitleFocus(screen: Screen) {
  const element = screenElementKey(screen);
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
