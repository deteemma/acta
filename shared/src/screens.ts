// Écrans et leur adresse (tickets 17 et 22, décision 13 ; navigation par
// arborescence, ADR-0021, N12) : chaque élément de l'arborescence et chacun de
// ses onglets a son adresse. Recharger reste au même endroit, « Précédent »
// revient à l'élément ou à l'onglet d'avant, et un lien peut être envoyé à un
// membre. Les éléments pas encore repris dans l'écran de données s'ouvrent
// encore dans leur panneau, sans adresse.
// Un scénario n'a pas d'écran propre : son adresse ouvre l'onglet Scénarios de
// son exigence, le scénario mis en évidence (N16).

/** Onglets de l'initiative (N11) ; le premier est celui de l'adresse nue. */
export const INITIATIVE_TABS = ['overview', 'members', 'designations', 'settings'] as const;
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

export type Screen =
  | { kind: 'myActions' }
  | { kind: 'initiative'; initiativeId: string; tab: InitiativeTab }
  | { kind: 'dashboard'; initiativeId: string; tab: DashboardTab }
  | { kind: 'team'; initiativeId: string; tab: TeamTab }
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
  /** Arborescence des pages ; `pageId` : la page ouverte, null si aucune. */
  | { kind: 'pages'; initiativeId: string; pageId: string | null };

/** Écran d'une initiative, quel qu'il soit. */
export type InitiativeScreen = Exclude<Screen, { kind: 'myActions' }>;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ID = new RegExp(`^${UUID}$`, 'i');
const INITIATIVE_PATH = new RegExp(`^/initiatives/(${UUID})((?:/[^/]+)*)/?$`, 'i');

/** Segment d'onglet : absent pour le premier onglet. */
const tabSegment = (tabs: readonly string[], tab: string) => (tab === tabs[0] ? '' : `/${tab}`);

export function screenPath(screen: Screen): string {
  if (screen.kind === 'myActions') return '/';
  const base = `/initiatives/${screen.initiativeId}`;
  switch (screen.kind) {
    case 'initiative':
      return base + tabSegment(INITIATIVE_TABS, screen.tab);
    case 'dashboard':
      return `${base}/dashboard${tabSegment(DASHBOARD_TABS, screen.tab)}`;
    case 'team':
      return `${base}/team${tabSegment(TEAM_TABS, screen.tab)}`;
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
    case 'needs':
    case 'requirements':
    case 'tickets':
      return `${base}/${screen.kind}`;
    case 'pages':
      return `${base}/pages${screen.pageId ? `/${screen.pageId}` : ''}`;
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
  return parseInitiativePath(path) ?? { kind: 'myActions' };
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
      if (rest.length === 0) return { kind: 'pages', initiativeId, pageId: null };
      return rest.length === 1 && ID.test(rest[0]!) ? { kind: 'pages', initiativeId, pageId: rest[0]! } : null;
    }
    default: {
      const tab = readTab(INITIATIVE_TABS, segments);
      return tab && { kind: 'initiative', initiativeId, tab };
    }
  }
}

export const sameScreen = (a: Screen, b: Screen) => screenPath(a) === screenPath(b);

/** Initiative que montre l'écran, null pour « Mes actions ». */
export const screenInitiativeId = (screen: Screen): string | null =>
  screen.kind === 'myActions' ? null : screen.initiativeId;
