// Recherche de la palette de commandes (ticket 02).

/** Minuscules, sans accents. */
const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Chaque mot saisi figure dans le texte, sans tenir compte des majuscules ni des accents. */
export function matchesEveryWord(text: string, query: string): boolean {
  const haystack = normalize(text);
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/** Initiatives qui correspondent à la saisie : chaque mot saisi figure dans le code ou le nom. */
export function searchInitiatives<T extends { code: string; name: string }>(items: readonly T[], query: string): T[] {
  return items.filter((item) => matchesEveryWord(`${item.code} ${item.name}`, query));
}
