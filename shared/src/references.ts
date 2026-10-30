// Références (ticket 09) : identifiant lisible d'un objet d'analyse, de la forme
// CODE-ACRONYME-NUMÉRO. Règles écrites une seule fois ici, appliquées par l'API
// et reproduites par la base (migration 0012).
import { z } from 'zod';
import type { RequirementStatus, RequirementSubtype, RequirementType } from './requirements.js';
import { matchesEveryWord } from './search.js';

/** Catégories d'objets qui portent une référence ; chacune a son acronyme. */
export const REFERENCE_CATEGORIES = ['need', 'requirement'] as const;
export type ReferenceCategory = (typeof REFERENCE_CATEGORIES)[number];
export const referenceCategorySchema = z.enum(REFERENCE_CATEGORIES);

/** Acronymes d'origine, paramétrables ensuite par l'administration. */
export const DEFAULT_ACRONYMS: Record<ReferenceCategory, string> = { need: 'BE', requirement: 'EX' };

/** Acronyme : 2 à 4 lettres majuscules. */
export const ACRONYM_PATTERN = /^[A-Z]{2,4}$/;

export const updateReferenceCategorySchema = z.object({ acronym: z.string().trim().regex(ACRONYM_PATTERN) });
export type UpdateReferenceCategoryInput = z.infer<typeof updateReferenceCategorySchema>;

/** Acronyme d'une catégorie, tel que l'administration le montre. */
export interface ReferenceCategoryDto {
  category: ReferenceCategory;
  acronym: string;
  /** Tous les acronymes que la catégorie a portés, l'actuel compris : réservés à elle seule. */
  usedAcronyms: string[];
}

/** Le numéro s'écrit sur 3 chiffres au moins : CRM-BE-001 … CRM-BE-999, puis CRM-BE-1000. */
export function formatReference(code: string, acronym: string, number: number): string {
  return `${code}-${acronym}-${String(number).padStart(3, '0')}`;
}

/**
 * Refus, renvoyés par l'API (`refusal`) :
 * - `invalidAcronym` : l'acronyme ne compte pas 2 à 4 lettres majuscules ;
 * - `acronymTaken` : l'acronyme est ou a été celui d'une autre catégorie ;
 * - `codeFrozen` : une référence a déjà été attribuée dans l'initiative, son code ne change plus.
 */
export const REFERENCE_REFUSALS = ['invalidAcronym', 'acronymTaken', 'codeFrozen'] as const;
export type ReferenceRefusal = (typeof REFERENCE_REFUSALS)[number];
export const isReferenceRefusal = (value: unknown): value is ReferenceRefusal =>
  REFERENCE_REFUSALS.some((r) => r === value);

/**
 * Vérifie le nouvel acronyme d'une catégorie ; null s'il est permis. Un acronyme
 * n'est jamais repris par une autre catégorie, pour qu'aucune référence ne
 * désigne deux objets ; une catégorie peut reprendre l'un de ses anciens.
 * Les références déjà attribuées ne changent pas.
 */
export function checkAcronymChange(
  categories: readonly Pick<ReferenceCategoryDto, 'category' | 'usedAcronyms'>[],
  category: ReferenceCategory,
  acronym: string,
): ReferenceRefusal | null {
  if (!ACRONYM_PATTERN.test(acronym)) return 'invalidAcronym';
  const taken = categories.some((c) => c.category !== category && c.usedAcronyms.includes(acronym));
  return taken ? 'acronymTaken' : null;
}

/** Objet référencé, tel que la palette le propose (toutes initiatives dont je suis membre). */
export interface ReferenceDto {
  category: ReferenceCategory;
  id: string;
  initiativeId: string;
  initiativeArchived: boolean;
  reference: string;
  title: string;
  /** Exigence : son type et son statut, montrés par l'aperçu au survol ; null pour un besoin. */
  requirement: { type: RequirementType; subtype: RequirementSubtype | null; status: RequirementStatus } | null;
}

/** Par code, acronyme puis numéro (CRM-BE-999 avant CRM-BE-1000). */
export function sortByReference<T extends { reference: string }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => a.reference.localeCompare(b.reference, 'en', { numeric: true }));
}

/** Références qui correspondent à la saisie : chaque mot saisi figure dans la référence ou le titre. */
export function searchReferences<T extends { reference: string; title: string }>(items: readonly T[], query: string): T[] {
  return sortByReference(items.filter((item) => matchesEveryWord(`${item.reference} ${item.title}`, query)));
}
