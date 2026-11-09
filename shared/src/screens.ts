// Écrans en pleine page (tickets 17 et 22, décision 13) et leur adresse : recharger
// reste au même endroit, et le lien d'une page peut être envoyé à un membre. Les
// panneaux, eux, n'ont pas d'adresse.

export type Screen =
  | { kind: 'myActions' }
  | { kind: 'tickets'; initiativeId: string }
  /** Arborescence des pages ; `pageId` : la page ouverte, null si aucune. */
  | { kind: 'pages'; initiativeId: string; pageId: string | null };

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const TICKETS_PATH = new RegExp(`^/initiatives/(${UUID})/tickets/?$`, 'i');
const PAGES_PATH = new RegExp(`^/initiatives/(${UUID})/pages(?:/(${UUID}))?/?$`, 'i');

export function screenPath(screen: Screen): string {
  switch (screen.kind) {
    case 'tickets':
      return `/initiatives/${screen.initiativeId}/tickets`;
    case 'pages':
      return `/initiatives/${screen.initiativeId}/pages${screen.pageId ? `/${screen.pageId}` : ''}`;
    case 'myActions':
      return '/';
  }
}

/** Écran d'une adresse ; une adresse inconnue mène à l'accueil. */
export function parseScreenPath(path: string): Screen {
  const tickets = TICKETS_PATH.exec(path);
  if (tickets) return { kind: 'tickets', initiativeId: tickets[1]! };
  const pages = PAGES_PATH.exec(path);
  if (pages) return { kind: 'pages', initiativeId: pages[1]!, pageId: pages[2] ?? null };
  return { kind: 'myActions' };
}

export const sameScreen = (a: Screen, b: Screen) => screenPath(a) === screenPath(b);

/** Initiative que montre l'écran, null pour « Mes actions ». */
export const screenInitiativeId = (screen: Screen): string | null =>
  screen.kind === 'myActions' ? null : screen.initiativeId;
