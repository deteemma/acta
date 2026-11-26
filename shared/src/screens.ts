// Écrans et leur adresse (tickets 17 et 22, décision 13 ; navigation par
// arborescence, ADR-0021, N12) : chaque élément de l'arborescence et chacun de
// ses onglets a son adresse. Recharger reste au même endroit, « Précédent »
// revient à l'élément ou à l'onglet d'avant, et un lien peut être envoyé à un
// membre. Les éléments pas encore repris dans l'écran de données s'ouvrent
// encore dans leur panneau, sans adresse.
// Un scénario n'a pas d'écran propre : son adresse ouvre l'onglet Scénarios de
// son exigence, le scénario mis en évidence (N16).

/**
 * Onglets de l'initiative (N11) ; le premier est celui de l'adresse nue.
 * « Assistant » : les demandes de l'auteur sans élément choisi (AS22), absent sans assistant installé (AS25).
 */
export const INITIATIVE_TABS = ['overview', 'members', 'designations', 'settings', 'assistant'] as const;
export type InitiativeTab = (typeof INITIATIVE_TABS)[number];
/** Onglets du tableau de bord : Tâches BABOK, Actions suggérées. */
export const DASHBOARD_TABS = ['tasks', 'suggested'] as const;
export type DashboardTab = (typeof DASHBOARD_TABS)[number];
/** Onglets de l'équipe : Membres, Désignations. */
export const TEAM_TABS = ['members', 'designations'] as const;
export type TeamTab = (typeof TEAM_TABS)[number];
/** Onglets du nœud Parties prenantes : Liste, Matrice influence × intérêt. */
export const STAKEHOLDERS_TABS = ['list', 'matrix'] as const;
export type StakeholdersTab = (typeof STAKEHOLDERS_TABS)[number];
/** Onglets d'une partie prenante : Fiche, « À l'origine de ». */
export const STAKEHOLDER_TABS = ['sheet', 'origin'] as const;
export type StakeholderTab = (typeof STAKEHOLDER_TABS)[number];
/** Onglets d'un besoin : Fiche, Exigences, Liens. */
export const NEED_TABS = ['sheet', 'requirements', 'links'] as const;
export type NeedTab = (typeof NEED_TABS)[number];
/** Onglets d'une exigence : Fiche, Scénarios (fonctionnelle seulement), Traçabilité, Liens, Historique. */
export const REQUIREMENT_TABS = ['sheet', 'scenarios', 'trace', 'links', 'history'] as const;
export type RequirementTab = (typeof REQUIREMENT_TABS)[number];
/**
 * Onglets d'un ticket, de tout type : Fiche, Tickets de l'Epic (Epic seulement),
 * Liens, Commentaires, Pièces jointes, Historique.
 */
export const TICKET_TABS = ['sheet', 'epic', 'links', 'comments', 'attachments', 'history'] as const;
export type TicketTab = (typeof TICKET_TABS)[number];
/** Onglets d'une page : Contenu, Liens, Commentaires, Pièces jointes, Historique. */
export const PAGE_TABS = ['content', 'links', 'comments', 'attachments', 'history'] as const;
export type PageTab = (typeof PAGE_TABS)[number];
/**
 * Onglets du référentiel : Domaines et tâches, Techniques, puis ceux de
 * l'Extension Agile, Principes agiles, Horizons, Techniques agiles (D7).
 */
export const AGILE_BABOK_TABS = ['principles', 'horizons', 'agile-techniques'] as const;
export const BABOK_TABS = ['areas', 'techniques', ...AGILE_BABOK_TABS] as const;
export type BabokTab = (typeof BABOK_TABS)[number];
/** Onglet de l'Extension Agile. */
export const isAgileBabokTab = (tab: BabokTab): boolean => (AGILE_BABOK_TABS as readonly string[]).includes(tab);
/**
 * Onglets de l'administration : Comptes, Initiatives sans propriétaire,
 * Acronymes, Statuts d'exigence, Types de ticket, Modèles de page, Pièces jointes.
 */
export const ADMIN_TABS = ['accounts', 'orphans', 'references', 'statuses', 'ticket-types', 'page-templates', 'attachments'] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];

export type Screen =
  | { kind: 'myActions' }
  /** Hors de l'arborescence, dans la zone de droite (N3). */
  | { kind: 'alerts' }
  | { kind: 'babok'; tab: BabokTab }
  /**
   * Domaine, tâche ou technique, désigné par sa section (ex. « 3.1 ») ; principe,
   * horizon ou technique agile, par son identifiant stable (ex. « ae-7.17 »).
   */
  | { kind: 'babokElement'; elementId: string }
  | { kind: 'admin'; tab: AdminTab }
  /** Modèle de page de l'administration ; `null` : ajout d'un modèle. */
  | { kind: 'pageTemplate'; templateId: string | null }
  | { kind: 'initiative'; initiativeId: string; tab: InitiativeTab }
  | { kind: 'dashboard'; initiativeId: string; tab: DashboardTab }
  | { kind: 'team'; initiativeId: string; tab: TeamTab }
  /** Membre de l'équipe, par l'identifiant de son compte. */
  | { kind: 'member'; initiativeId: string; userId: string }
  | { kind: 'stakeholders'; initiativeId: string; tab: StakeholdersTab }
  | { kind: 'stakeholder'; initiativeId: string; stakeholderId: string; tab: StakeholderTab }
  | { kind: 'need'; initiativeId: string; needId: string; tab: NeedTab }
  | { kind: 'needs'; initiativeId: string }
  | { kind: 'requirements'; initiativeId: string }
  | { kind: 'requirement'; initiativeId: string; requirementId: string; tab: RequirementTab }
  /** Onglet Scénarios de son exigence, le scénario mis en évidence (N16). */
  | { kind: 'scenario'; initiativeId: string; requirementId: string; scenarioId: string }
  | { kind: 'tickets'; initiativeId: string }
  /** Ticket de tout type, ouvert ou fermé (N8). */
  | { kind: 'ticket'; initiativeId: string; ticketId: string; tab: TicketTab }
  /** Nœud Pages : la liste des pages. */
  | { kind: 'pages'; initiativeId: string }
  | { kind: 'page'; initiativeId: string; pageId: string; tab: PageTab };

/** Écrans hors de toute initiative. */
export type GlobalScreen = Extract<Screen, { kind: 'myActions' | 'alerts' | 'babok' | 'babokElement' | 'admin' | 'pageTemplate' }>;
/** Écran d'une initiative, quel qu'il soit. */
export type InitiativeScreen = Exclude<Screen, GlobalScreen>;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ID = new RegExp(`^${UUID}$`, 'i');
const INITIATIVE_PATH = new RegExp(`^/initiatives/(${UUID})((?:/[^/]+)*)/?$`, 'i');
/** Segment de l'ajout d'un modèle de page. */
const NEW_TEMPLATE = 'new';
/** Identifiant d'un élément du référentiel : sa section, précédée de « ae- » pour l'Extension Agile. */
const BABOK_ELEMENT = /^(?:ae-)?\d+(?:\.\d+)*$/;

/** Segment d'onglet : absent pour le premier onglet. */
const tabSegment = (tabs: readonly string[], tab: string) => (tab === tabs[0] ? '' : `/${tab}`);

export function screenPath(screen: Screen): string {
  switch (screen.kind) {
    case 'myActions':
      return '/';
    case 'alerts':
      return '/alerts';
    case 'babok':
      return `/babok${tabSegment(BABOK_TABS, screen.tab)}`;
    case 'babokElement':
      return `/babok/${screen.elementId}`;
    case 'admin':
      return `/admin${tabSegment(ADMIN_TABS, screen.tab)}`;
    case 'pageTemplate':
      return `/admin/page-templates/${screen.templateId ?? NEW_TEMPLATE}`;
  }
  const base = `/initiatives/${screen.initiativeId}`;
  switch (screen.kind) {
    case 'initiative':
      return base + tabSegment(INITIATIVE_TABS, screen.tab);
    case 'dashboard':
      return `${base}/dashboard${tabSegment(DASHBOARD_TABS, screen.tab)}`;
    case 'team':
      return `${base}/team${tabSegment(TEAM_TABS, screen.tab)}`;
    case 'member':
      return `${base}/team/members/${encodeURIComponent(screen.userId)}`;
    case 'stakeholders':
      return `${base}/stakeholders${tabSegment(STAKEHOLDERS_TABS, screen.tab)}`;
    case 'stakeholder':
      return `${base}/stakeholders/${screen.stakeholderId}${tabSegment(STAKEHOLDER_TABS, screen.tab)}`;
    case 'need':
      return `${base}/needs/${screen.needId}${tabSegment(NEED_TABS, screen.tab)}`;
    case 'requirement':
      return `${base}/requirements/${screen.requirementId}${tabSegment(REQUIREMENT_TABS, screen.tab)}`;
    case 'scenario':
      return `${base}/requirements/${screen.requirementId}/scenarios/${screen.scenarioId}`;
    case 'ticket':
      return `${base}/tickets/${screen.ticketId}${tabSegment(TICKET_TABS, screen.tab)}`;
    case 'page':
      return `${base}/pages/${screen.pageId}${tabSegment(PAGE_TABS, screen.tab)}`;
    case 'needs':
    case 'requirements':
    case 'tickets':
    case 'pages':
      return `${base}/${screen.kind}`;
  }
}

/** Onglet d'un segment : le premier sans segment, null si l'onglet est inconnu. */
function readTab<T extends string>(tabs: readonly T[], segments: readonly string[]): T | null {
  if (segments.length === 0) return tabs[0]!;
  if (segments.length > 1) return null;
  return tabs.find((tab) => tab === segments[0]) ?? null;
}

/** Écran d'une adresse ; une adresse inconnue mène à l'accueil. */
export function parseScreenPath(path: string): Screen {
  return parseGlobalPath(path) ?? parseInitiativePath(path) ?? { kind: 'myActions' };
}

function parseGlobalPath(path: string): Screen | null {
  const [first, ...rest] = path.split('/').filter(Boolean);
  switch (first) {
    case 'alerts':
      return rest.length === 0 ? { kind: 'alerts' } : null;
    case 'babok': {
      const [elementId, ...extra] = rest;
      if (elementId && BABOK_ELEMENT.test(elementId)) return extra.length === 0 ? { kind: 'babokElement', elementId } : null;
      const tab = readTab(BABOK_TABS, rest);
      return tab && { kind: 'babok', tab };
    }
    case 'admin': {
      const [tabName, templateId, ...extra] = rest;
      if (tabName === 'page-templates' && templateId !== undefined) {
        if (extra.length > 0) return null;
        if (templateId === NEW_TEMPLATE) return { kind: 'pageTemplate', templateId: null };
        return ID.test(templateId) ? { kind: 'pageTemplate', templateId } : null;
      }
      const tab = readTab(ADMIN_TABS, rest);
      return tab && { kind: 'admin', tab };
    }
    default:
      return null;
  }
}

function parseInitiativePath(path: string): Screen | null {
  const match = INITIATIVE_PATH.exec(path);
  if (!match) return null;
  const initiativeId = match[1]!;
  const segments = match[2]!.split('/').filter(Boolean);
  const [first, ...rest] = segments;
  switch (first) {
    case 'dashboard': {
      const tab = readTab(DASHBOARD_TABS, rest);
      return tab && { kind: 'dashboard', initiativeId, tab };
    }
    case 'team': {
      const [tabName, userId, ...extra] = rest;
      if (tabName === 'members' && userId !== undefined) {
        return extra.length === 0 ? { kind: 'member', initiativeId, userId: decodeURIComponent(userId) } : null;
      }
      const tab = readTab(TEAM_TABS, rest);
      return tab && { kind: 'team', initiativeId, tab };
    }
    case 'stakeholders': {
      // Une partie prenante (son identifiant), sinon un onglet du nœud.
      const [stakeholderId, ...tabs] = rest;
      if (stakeholderId && ID.test(stakeholderId)) {
        const tab = readTab(STAKEHOLDER_TABS, tabs);
        return tab && { kind: 'stakeholder', initiativeId, stakeholderId, tab };
      }
      const tab = readTab(STAKEHOLDERS_TABS, rest);
      return tab && { kind: 'stakeholders', initiativeId, tab };
    }
    case 'needs': {
      const [needId, ...tabs] = rest;
      if (!needId) return { kind: 'needs', initiativeId };
      if (!ID.test(needId)) return null;
      const tab = readTab(NEED_TABS, tabs);
      return tab && { kind: 'need', initiativeId, needId, tab };
    }
    case 'requirements': {
      const [requirementId, ...tabs] = rest;
      if (!requirementId) return { kind: 'requirements', initiativeId };
      if (!ID.test(requirementId)) return null;
      const [tabName, scenarioId, ...extra] = tabs;
      if (tabName === 'scenarios' && scenarioId !== undefined) {
        return ID.test(scenarioId) && extra.length === 0 ? { kind: 'scenario', initiativeId, requirementId, scenarioId } : null;
      }
      const tab = readTab(REQUIREMENT_TABS, tabs);
      return tab && { kind: 'requirement', initiativeId, requirementId, tab };
    }
    case 'tickets': {
      const [ticketId, ...tabs] = rest;
      if (!ticketId) return { kind: 'tickets', initiativeId };
      if (!ID.test(ticketId)) return null;
      const tab = readTab(TICKET_TABS, tabs);
      return tab && { kind: 'ticket', initiativeId, ticketId, tab };
    }
    case 'pages': {
      const [pageId, ...tabs] = rest;
      if (!pageId) return { kind: 'pages', initiativeId };
      if (!ID.test(pageId)) return null;
      const tab = readTab(PAGE_TABS, tabs);
      return tab && { kind: 'page', initiativeId, pageId, tab };
    }
    default: {
      const tab = readTab(INITIATIVE_TABS, segments);
      return tab && { kind: 'initiative', initiativeId, tab };
    }
  }
}

export const sameScreen = (a: Screen, b: Screen) => screenPath(a) === screenPath(b);

/** Initiative que montre l'écran, null hors de toute initiative (« Mes actions », alertes…). */
export const screenInitiativeId = (screen: Screen): string | null =>
  'initiativeId' in screen ? screen.initiativeId : null;
