// Écrans en pleine page (ticket 17, décision 13) et leur adresse : recharger reste
// au même endroit. Les panneaux, eux, n'ont pas d'adresse.

export type Screen = { kind: 'myActions' } | { kind: 'tickets'; initiativeId: string };

const TICKETS_PATH = /^\/initiatives\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/tickets\/?$/i;

export function screenPath(screen: Screen): string {
  return screen.kind === 'tickets' ? `/initiatives/${screen.initiativeId}/tickets` : '/';
}

/** Écran d'une adresse ; une adresse inconnue mène à l'accueil. */
export function parseScreenPath(path: string): Screen {
  const initiativeId = TICKETS_PATH.exec(path)?.[1];
  return initiativeId ? { kind: 'tickets', initiativeId } : { kind: 'myActions' };
}

export const sameScreen = (a: Screen, b: Screen) => screenPath(a) === screenPath(b);
