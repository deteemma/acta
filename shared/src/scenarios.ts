// Scénarios Gherkin (phase 3, tickets 01 et 02) : description d'un comportement
// attendu, rattachée à une exigence de solution fonctionnelle et à elle seule,
// avec le Contexte et la langue de sa Fonctionnalité. Règles écrites une seule
// fois ici, appliquées par l'API et reproduites par la base (migrations 0032 et
// 0033). Décisions D1 à D19 de .scratch/phase-3/spec.md.
import { z } from 'zod';
import { DEFAULT_LOCALE, type Locale, LOCALES } from './i18n.js';
import type { RequirementSubtype, RequirementType } from './requirements.js';

/** Même limite que le titre des autres objets d'analyse. */
export const SCENARIO_TITLE_MAX_LENGTH = 200;
/** D6 : texte Gherkin libre, étapes et Exemples compris. */
export const SCENARIO_TEXT_MAX_LENGTH = 10_000;

const scenarioFields = {
  title: z.string().trim().min(1).max(SCENARIO_TITLE_MAX_LENGTH),
  // Ni retouché ni contrôlé (D11) : les retraits et les lignes vides font partie du Gherkin.
  text: z.string().max(SCENARIO_TEXT_MAX_LENGTH),
};

/**
 * Création : la référence et la place (en dernier, D9) sont attribuées par la base.
 * `language` ne sert qu'au premier scénario, s'il n'y a pas encore de Contexte :
 * il fixe la langue de la Fonctionnalité (D5, newFeatureLanguage).
 */
export const createScenarioSchema = z.object({ ...scenarioFields, language: z.enum(LOCALES).optional() });
export type CreateScenarioInput = z.infer<typeof createScenarioSchema>;

/**
 * Modification (D14) : seuls les champs fournis changent ; `baseRowVersion` est
 * l'état du scénario à l'ouverture de la saisie (`ScenarioDto.rowVersion`).
 */
export const updateScenarioSchema = z.object({
  baseRowVersion: z.number().int().min(0),
  ...z.object(scenarioFields).partial().shape,
});
export type UpdateScenarioInput = z.infer<typeof updateScenarioSchema>;

/** D1 : seule une exigence de solution fonctionnelle a des scénarios (et un Contexte). */
export function acceptsScenarios(requirement: { type: RequirementType; subtype: RequirementSubtype | null }): boolean {
  return requirement.type === 'solution' && requirement.subtype === 'functional';
}

/**
 * D5 : la langue d'une Fonctionnalité est fixée à la création de son premier
 * scénario ou de son Contexte ; celle demandée par l'écran (la langue de
 * l'auteur), sinon la langue enregistrée de l'auteur, sinon le français.
 */
export function newFeatureLanguage(requested: Locale | undefined, authorLocale: Locale | null): Locale {
  return requested ?? authorLocale ?? DEFAULT_LOCALE;
}

/** D5 : changer la langue ne traduit aucun texte. */
export const setFeatureLanguageSchema = z.object({ language: z.enum(LOCALES) });
export type SetFeatureLanguageInput = z.infer<typeof setFeatureLanguageSchema>;

/** D12 : même limite que le texte d'un scénario. */
export const BACKGROUND_TEXT_MAX_LENGTH = 10_000;

/**
 * Création ou modification du Contexte (D12, D14). Sans titre ni référence ; un
 * texte vide ne fait pas un Contexte : on le supprime. `baseRowVersion` est
 * l'état à l'ouverture de la saisie (`BackgroundDto.rowVersion`), `null` s'il n'y
 * avait pas encore de Contexte. `language` comme pour un scénario.
 */
export const saveBackgroundSchema = z.object({
  baseRowVersion: z.number().int().min(0).nullable(),
  // Ni retouché ni contrôlé (D11) : seuls les espaces seuls sont refusés.
  text: z.string().max(BACKGROUND_TEXT_MAX_LENGTH).refine((t) => t.trim().length > 0),
  language: z.enum(LOCALES).optional(),
});
export type SaveBackgroundInput = z.infer<typeof saveBackgroundSchema>;

/** D9 : ordre complet des scénarios d'une exigence, du premier au dernier. */
export const reorderScenariosSchema = z.object({ scenarioIds: z.array(z.uuid()) });
export type ReorderScenariosInput = z.infer<typeof reorderScenariosSchema>;

/** Ordre affiché après avoir monté (-1) ou descendu (+1) un scénario. */
export function moveScenario(ids: readonly string[], id: string, offset: -1 | 1): string[] {
  const next = [...ids];
  const from = next.indexOf(id);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= next.length) return next;
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

/**
 * Un nouvel ordre reprend exactement les scénarios actuels de l'exigence, chacun
 * une fois ; sinon l'écran est dépassé (ajout ou suppression entre-temps).
 */
export function checkScenarioOrder(currentIds: readonly string[], proposedIds: readonly string[]): ScenarioRefusal | null {
  const same =
    proposedIds.length === currentIds.length &&
    new Set(proposedIds).size === proposedIds.length &&
    proposedIds.every((id) => currentIds.includes(id));
  return same ? null : 'scenarioOrderOutdated';
}

/** Scénario tel que renvoyé par l'API, dans l'ordre de l'exigence. */
export interface ScenarioDto {
  id: string;
  initiativeId: string;
  requirementId: string;
  /** Ex. CRM-SC-001 ; attribuée à la création, jamais réattribuée. */
  reference: string;
  title: string;
  text: string;
  /** État du scénario, à renvoyer comme `baseRowVersion` pour le modifier (D14). */
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

/** Contexte d'une Fonctionnalité, tel que renvoyé par l'API. */
export interface BackgroundDto {
  text: string;
  /** État du Contexte, à renvoyer comme `baseRowVersion` pour le modifier (D14). */
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

/** Fonctionnalité d'une exigence : sa langue (null tant qu'elle n'est pas fixée, D5) et son Contexte. */
export interface FeatureDto {
  language: Locale | null;
  background: BackgroundDto | null;
}

/** Corps d'un refus `backgroundChangedSince` : le Contexte dans son état actuel (null s'il a été supprimé). */
export interface BackgroundChangedSinceBody {
  statusCode: 409;
  refusal: 'backgroundChangedSince';
  background: BackgroundDto | null;
}

/** Corps d'un refus `scenarioChangedSince` : le scénario dans son état actuel. */
export interface ScenarioChangedSinceBody {
  statusCode: 409;
  refusal: 'scenarioChangedSince';
  scenario: ScenarioDto;
}

/**
 * Refus d'une écriture sur un scénario, renvoyés par l'API (`refusal`) :
 * - `notFunctionalRequirement` : l'exigence n'est pas de solution fonctionnelle (D1) ;
 * - `scenarioChangedSince` : le scénario a changé depuis l'ouverture de la saisie (D14) ;
 * - `scenarioOrderOutdated` : l'ordre envoyé ne reprend pas les scénarios actuels (D9) ;
 * - `backgroundChangedSince` : le Contexte a été créé, modifié ou supprimé depuis l'ouverture de la saisie (D14) ;
 * - `featureLanguageNotSet` : la langue n'est pas encore fixée, faute de scénario et de Contexte (D5).
 */
export const SCENARIO_REFUSALS = [
  'notFunctionalRequirement',
  'scenarioChangedSince',
  'scenarioOrderOutdated',
  'backgroundChangedSince',
  'featureLanguageNotSet',
] as const;
export type ScenarioRefusal = (typeof SCENARIO_REFUSALS)[number];
export const isScenarioRefusal = (value: unknown): value is ScenarioRefusal => SCENARIO_REFUSALS.some((r) => r === value);
