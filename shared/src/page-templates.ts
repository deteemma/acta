// Modèles de page (ticket 27, décision 09) : plan de titres et textes d'aide, en
// français et en anglais, valables pour toute l'application. Le contenu est copié
// à la création de la page, dans la langue d'interface de son auteur ; la page
// garde la mention du modèle, sous le nom qu'il portait, et sa tâche BABOK, sans
// la rendre couverte. Règles reproduites par la base (migration 0025).
import { z } from 'zod';
import type { BabokDto, KnowledgeAreaDto } from './babok.js';
import { LOCALES, type Locale } from './i18n.js';
import type { PageDoc } from './pages.js';

/** « Livré » avec l'application, ou « ajouté » par l'administration (ticket 30). */
export const PAGE_TEMPLATE_ORIGINS = ['delivered', 'added'] as const;
export type PageTemplateOrigin = (typeof PAGE_TEMPLATE_ORIGINS)[number];

/** Modèle tel que renvoyé par l'API. */
export interface PageTemplateDto {
  id: string;
  name: Record<Locale, string>;
  /** JSON de Tiptap (ADR-0019), une version par langue. */
  content: Record<Locale, PageDoc>;
  /** Tâche BABOK du livrable ; facultative pour un modèle ajouté. */
  taskId: string | null;
  origin: PageTemplateOrigin;
  /** Désactivé : plus proposé ; les pages créées avec lui ne changent pas. */
  active: boolean;
}

/** Seul un modèle actif est proposé, et sert à créer une page (décision 09, point 6). */
export const isOfferedPageTemplate = (template: Pick<PageTemplateDto, 'active'>): boolean => template.active;

/** Groupe de la liste « Nouvelle page », ou de l'administration : un domaine de connaissance, ou null pour les modèles sans tâche. */
export interface PageTemplateGroup<T extends PageTemplateDto = PageTemplateDto> {
  knowledgeArea: KnowledgeAreaDto | null;
  templates: T[];
}

/**
 * Modèles proposés par « Nouvelle page » (décision 09, point 9) : les modèles
 * actifs, par domaine de connaissance dans l'ordre du référentiel, puis par tâche,
 * puis par nom dans la langue de l'interface. Les modèles sans tâche viennent à la fin.
 * `withInactive` : l'administration (ticket 30) les liste tous, désactivés compris.
 */
export function pageTemplateGroups<T extends PageTemplateDto>(
  babok: BabokDto,
  templates: readonly T[],
  locale: Locale,
  { withInactive = false }: { withInactive?: boolean } = {},
): PageTemplateGroup<T>[] {
  const taskRank = new Map(babok.tasks.map((task, rank) => [task.id, rank]));
  const areaOf = new Map(babok.tasks.map((task) => [task.id, task.knowledgeAreaId]));
  const sorted = templates
    .filter((t) => withInactive || isOfferedPageTemplate(t))
    .sort(
      (a, b) =>
        (taskRank.get(a.taskId ?? '') ?? Infinity) - (taskRank.get(b.taskId ?? '') ?? Infinity) ||
        a.name[locale].localeCompare(b.name[locale], locale),
    );
  const groups: PageTemplateGroup<T>[] = babok.knowledgeAreas.map((knowledgeArea) => ({
    knowledgeArea,
    templates: sorted.filter((t) => t.taskId !== null && areaOf.get(t.taskId) === knowledgeArea.id),
  }));
  groups.push({ knowledgeArea: null, templates: sorted.filter((t) => t.taskId === null || !areaOf.has(t.taskId)) });
  return groups.filter((g) => g.templates.length > 0);
}

/** Modèle choisi à la création d'une page, et langue d'interface de son auteur, dont la page prend le contenu. */
export const pageTemplateChoiceSchema = z.object({
  id: z.uuid(),
  locale: z.enum(LOCALES),
});
export type PageTemplateChoice = z.infer<typeof pageTemplateChoiceSchema>;

/** Mention du modèle d'origine sur la page : le nom qu'il portait à la création, dans la langue de la page. */
export interface PageTemplateMention {
  id: string;
  name: string;
}

/** Page créée depuis un modèle d'une tâche, listée par la fiche de cette tâche. */
export interface TaskPageDto {
  id: string;
  initiativeId: string;
  reference: string;
  title: string;
}

