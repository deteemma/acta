// Référentiel BABOK v3 (ADR-0012), livré par la migration 0009 et servi par
// GET /api/babok. Identifiant stable = numéro de section du guide BABOK v3.
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

export type BabokElementDto = KnowledgeAreaDto | BabokTaskDto | TechniqueDto;

/** Le référentiel complet, chaque liste dans l'ordre des sections du guide. */
export interface BabokDto {
  knowledgeAreas: KnowledgeAreaDto[];
  tasks: BabokTaskDto[];
  techniques: TechniqueDto[];
}

/**
 * Info-bulle d'un élément du référentiel : son nom anglais, langue de référence
 * du BABOK, quand l'interface est en français ; rien en anglais (ADR-0013).
 */
export function babokEnglishName(element: BabokElementDto, locale: Locale): string | undefined {
  return locale === 'en' ? undefined : element.name.en;
}

/** Tous les éléments : domaines, puis tâches, puis techniques. */
const allElements = (babok: BabokDto): BabokElementDto[] => [...babok.knowledgeAreas, ...babok.tasks, ...babok.techniques];

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

/**
 * Éléments du référentiel qui correspondent à la saisie de la palette : chaque
 * mot figure dans le numéro de section ou le nom, français ou anglais. Domaines,
 * puis tâches, puis techniques. Saisie vide : aucun élément, la palette ne
 * présente alors que les initiatives (ticket 02).
 */
export function searchBabok(babok: BabokDto, query: string): BabokElementDto[] {
  if (!query.trim()) return [];
  return allElements(babok).filter((element) =>
    matchesEveryWord(`${element.section} ${element.name.fr} ${element.name.en}`, query),
  );
}
