// Administration des modèles de page (ticket 30, décisions 09 point 6 et 14
// point 3) : un modèle livré ne se modifie pas, mais se désactive ; un modèle
// ajouté a un nom et un contenu dans les deux langues et une tâche BABOK
// facultative, se modifie, se désactive, et ne se supprime que s'il n'a jamais
// servi. Un modèle désactivé n'est plus proposé ; les pages créées avec lui ne
// changent pas. Règles reproduites par la base (migration 0030).
import { z } from 'zod';
import { LOCALES, type Locale } from './i18n.js';
import type { PageTemplateDto } from './page-templates.js';
import { type PageDoc, type PageNode, pageContentSchema } from './pages.js';

/** Nom et contenu d'un modèle ajouté, dans les deux langues (ADR-0013), et sa tâche BABOK facultative. */
export type PageTemplateInput = z.infer<typeof pageTemplateInputSchema>;

/** Même limite que le titre de la page, qu'il préremplit (migration 0025). */
export const PAGE_TEMPLATE_NAME_MAX_LENGTH = 200;
const templateName = z.string().trim().min(1).max(PAGE_TEMPLATE_NAME_MAX_LENGTH);

/** Le document contient au moins un mot. */
const hasWords = (node: PageNode): boolean =>
  (node.text !== undefined && node.text.trim() !== '') || (node.content ?? []).some(hasWords);

/** Le document contient une image : un modèle n'en a pas (décision 14, point 3). */
const hasImage = (node: PageNode): boolean => node.type === 'image' || (node.content ?? []).some(hasImage);

/** Contenu d'un modèle : celui d'une page, d'au moins un mot (choix validé le 13.11.2026), sans image. */
const templateContent = pageContentSchema.refine(
  (doc): doc is PageDoc => doc !== null && hasWords(doc) && !hasImage(doc),
  { message: 'contenu de modèle vide ou avec image' },
);

/** Ajout ou modification d'un modèle ajouté : tous ses champs. */
export const pageTemplateInputSchema = z.object({
  name: z.object({ fr: templateName, en: templateName }),
  content: z.object({ fr: templateContent, en: templateContent }),
  taskId: z.string().min(1).nullable(),
});

/** Nom comparé : sans espaces autour, majuscules ni accents. */
const comparable = (name: string) => name.trim().normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('en');

/** Un des noms reprend, dans la même langue, celui d'un des modèles `others`. */
const nameTaken = (others: readonly Pick<PageTemplateDto, 'name'>[], name: Record<Locale, string>) =>
  others.some((o) => LOCALES.some((locale) => comparable(o.name[locale]) === comparable(name[locale])));

/**
 * Vérifie l'ajout d'un modèle ; null s'il est permis. Le nom est unique dans
 * chaque langue parmi tous les modèles, livrés compris (choix validé le 13.11.2026).
 * `taskIds` : identifiants des tâches du référentiel.
 */
export function checkPageTemplateCreation(
  templates: readonly Pick<PageTemplateDto, 'name'>[],
  input: PageTemplateInput,
  taskIds: readonly string[],
): PageTemplateRefusal | null {
  if (nameTaken(templates, input.name)) return 'nameTaken';
  return input.taskId !== null && !taskIds.includes(input.taskId) ? 'unknownTask' : null;
}

/** Seul un modèle ajouté se modifie (nom, contenu, tâche) ; un modèle livré ne fait que changer d'état. */
export const isEditablePageTemplate = (template: Pick<PageTemplateDto, 'origin'>): boolean => template.origin === 'added';

/** Modification d'un modèle : tous ses champs (modèle ajouté seulement), ou son seul état. */
export const updatePageTemplateSchema = z.union([
  pageTemplateInputSchema.extend({ active: z.boolean().optional() }),
  z.object({ active: z.boolean() }),
]);
export type UpdatePageTemplateInput = z.infer<typeof updatePageTemplateSchema>;

/** Modèle tel que l'administration le montre. */
export interface AdminPageTemplateDto extends PageTemplateDto {
  /** Une page a déjà été créée depuis ce modèle : il ne se supprime plus. */
  used: boolean;
}

/** Vérifie la modification d'un modèle ; null si elle est permise. Un modèle livré ne fait que changer d'état. */
export function checkPageTemplateUpdate(
  templates: readonly PageTemplateDto[],
  id: string,
  change: UpdatePageTemplateInput,
  taskIds: readonly string[],
): PageTemplateRefusal | null {
  const template = templates.find((t) => t.id === id);
  if (!template) return 'unknownTemplate';
  if (!('name' in change)) return null;
  if (!isEditablePageTemplate(template)) return 'deliveredTemplateLocked';
  return checkPageTemplateCreation(
    templates.filter((t) => t.id !== id),
    change,
    taskIds,
  );
}

/** Vérifie la suppression d'un modèle ; null si elle est permise : un modèle ajouté qui n'a jamais servi. */
export function checkPageTemplateDeletion(templates: readonly AdminPageTemplateDto[], id: string): PageTemplateRefusal | null {
  const template = templates.find((t) => t.id === id);
  if (!template) return 'unknownTemplate';
  if (!isEditablePageTemplate(template)) return 'deliveredTemplateLocked';
  return template.used ? 'templateUsed' : null;
}

/**
 * Refus de l'administration des modèles, renvoyés par l'API (`refusal`) :
 * - `nameTaken` : un nom reprend celui d'un autre modèle dans la même langue ;
 * - `unknownTask` : la tâche BABOK n'existe pas ;
 * - `deliveredTemplateLocked` : un modèle livré se désactive ou se réactive, mais ne se modifie ni ne se supprime ;
 * - `templateUsed` : une page a déjà été créée depuis ce modèle, il ne se supprime pas ;
 * - `unknownTemplate` : le modèle n'existe pas.
 */
export const PAGE_TEMPLATE_REFUSALS = [
  'nameTaken',
  'unknownTask',
  'deliveredTemplateLocked',
  'templateUsed',
  'unknownTemplate',
] as const;
export type PageTemplateRefusal = (typeof PAGE_TEMPLATE_REFUSALS)[number];
export const isPageTemplateRefusal = (value: unknown): value is PageTemplateRefusal =>
  PAGE_TEMPLATE_REFUSALS.some((r) => r === value);
