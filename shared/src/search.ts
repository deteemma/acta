// Recherche de la palette de commandes (ticket 02).

/** Minuscules, sans accents. */
const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Initiatives qui correspondent à la saisie : chaque mot saisi figure dans le
 * code ou le nom, sans tenir compte des majuscules ni des accents.
 */
export function searchInitiatives<T extends { code: string; name: string }>(items: readonly T[], query: string): T[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    const text = normalize(`${item.code} ${item.name}`);
    return words.every((word) => text.includes(word));
  });
}
