// Référentiel BABOK v3 (ADR-0012), livré par la migration 0009 et servi par
// GET /api/babok. Identifiant stable = numéro de section du guide BABOK v3.
// Le référentiel de l'Extension Agile v2 (migration 0035, Extension Agile D1,
// D2) suit les mêmes règles ; identifiant stable = « ae- » et la section.
import type { Locale } from './i18n.js';
import { matchesEveryWord } from './search.js';

/** Texte du référentiel, dans les deux langues (ADR-0013). */
export type BabokText = Record<Locale, string>;

interface BabokElementBase {
  /** Identifiant stable, référencé par les autres objets (ex. `3.1`, `10.33`). */
  id: string;
  /** Renvoi de section du guide BABOK v3. */
  section: string;
  /** Nom officiel. */
  name: BabokText;
  /** Résumé rédigé pour ACTA ; aucun texte de l'IIBA. */
  summary: BabokText;
}

export interface KnowledgeAreaDto extends BabokElementBase {
  kind: 'knowledgeArea';
}

export interface BabokTaskDto extends BabokElementBase {
  kind: 'task';
  knowledgeAreaId: string;
  /** Techniques que le BABOK associe à la tâche, dans l'ordre du référentiel. */
  techniqueIds: string[];
}

export interface TechniqueDto extends BabokElementBase {
  kind: 'technique';
}

/** Principe agile de l'Extension Agile (ch. 4). */
export interface AgilePrincipleDto extends BabokElementBase {
  kind: 'agilePrinciple';
}

/** Horizon de l'Extension Agile (ch. 5). */
export interface AgileHorizonDto extends BabokElementBase {
  kind: 'agileHorizon';
}

/** Technique agile de l'Extension Agile (ch. 7). */
export interface AgileTechniqueDto extends BabokElementBase {
  kind: 'agileTechnique';
  /** Horizons où l'ouvrage dit qu'elle s'applique, dans l'ordre du référentiel (D2). */
  horizonIds: string[];
}

export type AgileElementDto = AgilePrincipleDto | AgileHorizonDto | AgileTechniqueDto;
export type BabokElementDto = KnowledgeAreaDto | BabokTaskDto | TechniqueDto | AgileElementDto;

/** Référentiel de l'Extension Agile, chaque liste dans l'ordre des sections de l'ouvrage. */
export interface AgileDto {
  principles: AgilePrincipleDto[];
  horizons: AgileHorizonDto[];
  techniques: AgileTechniqueDto[];
}

/** Le référentiel complet, chaque liste dans l'ordre des sections du guide. */
export interface BabokDto {
  knowledgeAreas: KnowledgeAreaDto[];
  tasks: BabokTaskDto[];
  techniques: TechniqueDto[];
  /** Extension Agile : consultable partout, même hors d'une initiative où le module est activé (D6). */
  agile: AgileDto;
}

const AGILE_KINDS: ReadonlySet<BabokElementDto['kind']> = new Set(['agilePrinciple', 'agileHorizon', 'agileTechnique']);

/** Élément de l'Extension Agile, et non du BABOK v3. */
export const isAgileElement = (element: BabokElementDto): element is AgileElementDto => AGILE_KINDS.has(element.kind);

/** Préfixe du numéro d'un élément agile, selon la langue (D5). */
const AGILE_PREFIX: Record<Locale, string> = { fr: 'EA', en: 'AE' };

/**
 * Numéro affiché d'un élément : sa section, précédée de « EA » (français) ou
 * « AE » (anglais) pour un élément de l'Extension Agile ; sans préfixe pour le
 * BABOK (D5).
 */
export function babokSectionLabel(element: BabokElementDto, locale: Locale): string {
  return isAgileElement(element) ? `${AGILE_PREFIX[locale]} ${element.section}` : element.section;
}

/**
 * Info-bulle d'un élément du référentiel : son nom anglais, langue de référence
 * du BABOK, quand l'interface est en français ; rien en anglais (ADR-0013).
 */
export function babokEnglishName(element: BabokElementDto, locale: Locale): string | undefined {
  return locale === 'en' ? undefined : element.name.en;
}

/**
 * Tous les éléments, dans l'ordre des onglets du référentiel (D7) : domaines,
 * tâches, techniques, puis principes agiles, horizons et techniques agiles.
 */
const allElements = (babok: BabokDto): BabokElementDto[] => [
  ...babok.knowledgeAreas,
  ...babok.tasks,
  ...babok.techniques,
  ...babok.agile.principles,
  ...babok.agile.horizons,
  ...babok.agile.techniques,
];

/** Élément par son identifiant (unique, tous types confondus). */
export function findBabokElement(babok: BabokDto, id: string): BabokElementDto | undefined {
  return allElements(babok).find((element) => element.id === id);
}

/** Tâches d'un domaine de connaissance, dans l'ordre du référentiel. */
export function tasksOfKnowledgeArea(babok: BabokDto, knowledgeAreaId: string): BabokTaskDto[] {
  return babok.tasks.filter((task) => task.knowledgeAreaId === knowledgeAreaId);
}

/** Techniques associées à une tâche, dans l'ordre du référentiel. */
export function techniquesOfTask(babok: BabokDto, task: BabokTaskDto): TechniqueDto[] {
  return babok.techniques.filter((technique) => task.techniqueIds.includes(technique.id));
}

/** Tâches qui utilisent une technique, dans l'ordre du référentiel. */
export function tasksUsingTechnique(babok: BabokDto, techniqueId: string): BabokTaskDto[] {
  return babok.tasks.filter((task) => task.techniqueIds.includes(techniqueId));
}

/** Horizons où s'applique une technique agile, dans l'ordre du référentiel (D8). */
export function horizonsOfAgileTechnique(babok: BabokDto, technique: AgileTechniqueDto): AgileHorizonDto[] {
  return babok.agile.horizons.filter((horizon) => technique.horizonIds.includes(horizon.id));
}

/** Techniques agiles qui s'appliquent à un horizon, dans l'ordre du référentiel (D8). */
export function agileTechniquesOfHorizon(babok: BabokDto, horizonId: string): AgileTechniqueDto[] {
  return babok.agile.techniques.filter((technique) => technique.horizonIds.includes(horizonId));
}

/** Texte cherché par la palette : numéros affichés dans les deux langues et noms. */
const searchText = (element: BabokElementDto): string =>
  [...new Set([babokSectionLabel(element, 'fr'), babokSectionLabel(element, 'en')]), element.name.fr, element.name.en].join(' ');

/**
 * Éléments du référentiel qui correspondent à la saisie de la palette : chaque
 * mot figure dans le numéro de section (préfixé « EA » ou « AE » pour un
 * élément agile, D5) ou le nom, français ou anglais. Dans l'ordre des onglets
 * du référentiel (D9). Saisie vide : aucun élément, la palette ne présente
 * alors que les initiatives (ticket 02).
 */
export function searchBabok(babok: BabokDto, query: string): BabokElementDto[] {
  if (!query.trim()) return [];
  return allElements(babok).filter((element) => matchesEveryWord(searchText(element), query));
}
