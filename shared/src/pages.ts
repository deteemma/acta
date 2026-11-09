// Pages (ticket 22, décisions 07 et 08, ADR-0019) : document d'une initiative,
// rangé dans une arborescence, écrit avec Tiptap et enregistré dans son format
// JSON. Règles écrites une seule fois ici, appliquées par l'API et le web, et
// reproduites par la base (migration 0020).
import { z } from 'zod';
import type { MemberNameDto } from './schemas.js';

export const PAGE_TITLE_MAX_LENGTH = 200;
/** Compté sur le texte du contenu, images non comprises (décision 07, point 1 ; limite à revoir à l'usage). */
export const PAGE_TEXT_MAX_LENGTH = 200_000;

// ── Contenu : JSON de Tiptap ─────────────────────────────────────────────────

/**
 * Nœuds et marques admis : la mise en forme de la décision 08 (point 2). Retirer
 * ou renommer l'un d'eux demande de migrer les pages enregistrées (ADR-0019). Les
 * images viennent avec le ticket 26.
 */
export const PAGE_NODE_TYPES = [
  'doc',
  'paragraph',
  'text',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'hardBreak',
  'table',
  'tableRow',
  'tableHeader',
  'tableCell',
] as const;
export type PageNodeType = (typeof PAGE_NODE_TYPES)[number];
export const PAGE_MARK_TYPES = ['bold', 'italic', 'link'] as const;
export type PageMarkType = (typeof PAGE_MARK_TYPES)[number];
export const PAGE_HEADING_LEVELS = [1, 2, 3] as const;

export interface PageMark {
  type: PageMarkType;
  attrs?: Record<string, unknown>;
}

/** Nœud du JSON de Tiptap. */
export interface PageNode {
  type: PageNodeType;
  attrs?: Record<string, unknown>;
  content?: PageNode[];
  marks?: PageMark[];
  text?: string;
}

/** Racine du contenu d'une page. */
export type PageDoc = PageNode & { type: 'doc' };

/** Lien : adresse http, https ou mailto seulement, comme les descriptions (rich-text.ts). */
export const isSafePageHref = (href: unknown): href is string =>
  typeof href === 'string' && /^(https?:\/\/|mailto:)/i.test(href);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const includes = <T extends string>(list: readonly T[], value: unknown): value is T =>
  list.some((item) => item === value);

function isValidMark(mark: unknown): boolean {
  if (!isRecord(mark) || !includes(PAGE_MARK_TYPES, mark.type)) return false;
  if (mark.attrs !== undefined && !isRecord(mark.attrs)) return false;
  return mark.type !== 'link' || isSafePageHref(mark.attrs?.href);
}

function isValidNode(node: unknown, root: boolean): boolean {
  if (!isRecord(node) || !includes(PAGE_NODE_TYPES, node.type)) return false;
  if ((node.type === 'doc') !== root) return false;
  if (node.attrs !== undefined && !isRecord(node.attrs)) return false;
  const attrs = node.attrs as Record<string, unknown> | undefined;
  if (node.type === 'heading' && !PAGE_HEADING_LEVELS.some((level) => level === attrs?.level)) return false;
  if (node.type === 'text') {
    // Tiptap n'écrit jamais de texte vide.
    if (typeof node.text !== 'string' || node.text === '' || node.content !== undefined) return false;
    return node.marks === undefined || (Array.isArray(node.marks) && node.marks.every(isValidMark));
  }
  if (node.text !== undefined || node.marks !== undefined) return false;
  return node.content === undefined || (Array.isArray(node.content) && node.content.every((child) => isValidNode(child, false)));
}

/** Nœud lu sans présumer de sa validité : le JSON de l'éditeur, avant envoi. */
export interface PageTextNode {
  text?: string;
  content?: readonly PageTextNode[];
}

/** Texte des nœuds texte, dans l'ordre du document. */
function collectText(node: PageTextNode, out: string[]): void {
  if (node.text !== undefined) out.push(node.text);
  for (const child of node.content ?? []) collectText(child, out);
}

/** Nombre de caractères du texte de la page (ADR-0019, point 2) : ni le JSON ni la mise en forme ne comptent. */
export function pageTextLength(doc: PageTextNode): number {
  const parts: string[] = [];
  collectText(doc, parts);
  // Par caractère et non par unité UTF-16, comme char_length en base.
  return parts.reduce((total, text) => total + [...text].length, 0);
}

/** Document sans rien, ou d'un seul paragraphe vide, tel que Tiptap écrit une page vide. */
export function isEmptyPageDoc(doc: PageDoc): boolean {
  const blocks = doc.content ?? [];
  return blocks.length === 0 || (blocks.length === 1 && blocks[0]!.type === 'paragraph' && !blocks[0]!.content?.length);
}

/** Contenu d'une page ; un document vide est enregistré sans contenu (null). */
export const pageContentSchema = z
  .custom<PageDoc>((value) => isValidNode(value, true), { message: 'contenu de page invalide' })
  .refine((doc) => pageTextLength(doc) <= PAGE_TEXT_MAX_LENGTH, { message: 'texte trop long' })
  .transform((doc) => (isEmptyPageDoc(doc) ? null : doc));

// ── Création, modification, déplacement ─────────────────────────────────────

const pageTitle = z.string().trim().min(1).max(PAGE_TITLE_MAX_LENGTH);

/**
 * Création, au premier enregistrement seulement (la page n'existe pas avant) :
 * la référence est attribuée par la base, la page se place en dernier parmi ses sœurs.
 */
export const createPageSchema = z.object({
  title: pageTitle,
  content: pageContentSchema.nullable().default(null),
  /** Page parente de la même initiative ; null pour une page de premier niveau. */
  parentId: z.uuid().nullable().default(null),
});
export type CreatePageInput = z.infer<typeof createPageSchema>;

/** Modification du titre et du contenu : seuls les champs fournis changent. */
export const updatePageSchema = z.object({ title: pageTitle, content: pageContentSchema.nullable() }).partial();
export type UpdatePageInput = z.infer<typeof updatePageSchema>;

/** Page telle que renvoyée par l'API. */
export interface PageDto {
  id: string;
  initiativeId: string;
  /** Ex. CRM-PA-007 ; attribuée au premier enregistrement, ne change plus. */
  reference: string;
  title: string;
  /** JSON de Tiptap ; null si la page n'a pas de contenu. */
  content: PageDoc | null;
  parentId: string | null;
  position: number;
  createdAt: string;
  createdBy: MemberNameDto;
  updatedAt: string;
  updatedBy: MemberNameDto;
}

/** Ligne de l'arborescence : sans le contenu. */
export type PageRow = Pick<PageDto, 'id' | 'reference' | 'title' | 'parentId' | 'position'>;

// ── Arborescence ─────────────────────────────────────────────────────────────

/** Ce que l'arborescence lit d'une page. */
export interface PageTreeItem {
  id: string;
  parentId: string | null;
  position: number;
}

/** Ligne de l'arborescence affichée, dans l'ordre de lecture. */
export interface PageTreeNode<T extends PageTreeItem> {
  page: T;
  depth: number;
  hasChildren: boolean;
}

/** Place d'une page : sa parente (null au premier niveau) et son rang parmi ses sœurs, elle exceptée. */
export interface PagePlacement {
  parentId: string | null;
  index: number;
}

export const movePageSchema = z.object({
  parentId: z.uuid().nullable(),
  index: z.number().int().min(0),
});
export type MovePageInput = z.infer<typeof movePageSchema>;

/**
 * Refus d'une écriture sur une page, renvoyés par l'API (`refusal`) :
 * - `unknownPage` : la page parente n'est pas une page de l'initiative ;
 * - `pageUnderItself` : une page ne se range pas sous elle-même ni sous l'une de ses sous-pages ;
 * - `pageHasSubpages` : une page qui a des sous-pages ne se supprime pas.
 */
export const PAGE_REFUSALS = ['unknownPage', 'pageUnderItself', 'pageHasSubpages'] as const;
export type PageRefusal = (typeof PAGE_REFUSALS)[number];
export const isPageRefusal = (value: unknown): value is PageRefusal => PAGE_REFUSALS.some((r) => r === value);

/** Pages sœurs dans leur ordre libre. */
function childrenOf<T extends PageTreeItem>(pages: readonly T[], parentId: string | null): T[] {
  return pages.filter((p) => p.parentId === parentId).sort((a, b) => a.position - b.position);
}

/** Toutes les pages, en profondeur d'abord, chaque niveau dans l'ordre de ses pages sœurs. */
export function flattenPageTree<T extends PageTreeItem>(pages: readonly T[]): PageTreeNode<T>[] {
  const out: PageTreeNode<T>[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const page of childrenOf(pages, parentId)) {
      const node = { page, depth, hasChildren: pages.some((p) => p.parentId === page.id) };
      out.push(node);
      visit(page.id, depth + 1);
    }
  };
  visit(null, 0);
  return out;
}

/** Vrai si `id` est `ancestorId` ou l'une de ses sous-pages, à toute profondeur. */
function isInSubtree(pages: readonly PageTreeItem[], ancestorId: string, id: string | null): boolean {
  const byId = new Map(pages.map((p) => [p.id, p]));
  for (let current = id, steps = 0; current !== null && steps <= pages.length; steps++) {
    if (current === ancestorId) return true;
    current = byId.get(current)?.parentId ?? null;
  }
  return false;
}

/** Vérifie la nouvelle parente d'une page ; null si le déplacement est permis. */
export function checkPageMove(pages: readonly PageTreeItem[], pageId: string, parentId: string | null): PageRefusal | null {
  if (parentId !== null && !pages.some((p) => p.id === parentId)) return 'unknownPage';
  return isInSubtree(pages, pageId, parentId) ? 'pageUnderItself' : null;
}

/** Rang d'une nouvelle page : en dernier parmi ses sœurs. */
/** Vérifie la suppression d'une page ; null si elle est permise. Les liens viendront avec le ticket 25. */
export function checkPageDelete(pages: readonly PageTreeItem[], pageId: string): PageRefusal | null {
  return pages.some((p) => p.parentId === pageId) ? 'pageHasSubpages' : null;
}

export function nextPagePosition(pages: readonly PageTreeItem[], parentId: string | null): number {
  return Math.max(-1, ...pages.filter((p) => p.parentId === parentId).map((p) => p.position)) + 1;
}

/**
 * Pages après le déplacement, avec ses sous-pages : les nouvelles sœurs sont
 * renumérotées 0, 1, 2… Le déplacement doit avoir été vérifié (checkPageMove).
 */
export function movePage<T extends PageTreeItem>(pages: readonly T[], pageId: string, placement: PagePlacement): T[] {
  const moved = pages.find((p) => p.id === pageId);
  if (!moved) return [...pages];
  const siblings = childrenOf(pages, placement.parentId).filter((p) => p.id !== pageId);
  siblings.splice(Math.min(placement.index, siblings.length), 0, moved);
  const positions = new Map(siblings.map((p, position) => [p.id, position]));
  return pages.map((p) =>
    positions.has(p.id) ? { ...p, parentId: placement.parentId, position: positions.get(p.id)! } : p,
  );
}

/** Place actuelle d'une page. */
function placementOf(pages: readonly PageTreeItem[], page: PageTreeItem): PagePlacement {
  return { parentId: page.parentId, index: childrenOf(pages, page.parentId).findIndex((p) => p.id === page.id) };
}

/** Le déplacement est permis et change quelque chose ; sinon null. */
function effective(pages: readonly PageTreeItem[], page: PageTreeItem, placement: PagePlacement): PagePlacement | null {
  if (checkPageMove(pages, page.id, placement.parentId)) return null;
  const current = placementOf(pages, page);
  return current.parentId === placement.parentId && current.index === placement.index ? null : placement;
}

/**
 * Glisser une page sur une ligne (décision 08, point 7) : sur le haut de la
 * ligne, avant elle ; sur le reste, en dernière sous-page. Null si c'est interdit
 * ou sans effet.
 */
export function dropPlacement(
  pages: readonly PageTreeItem[],
  pageId: string,
  targetId: string,
  zone: 'before' | 'inside',
): PagePlacement | null {
  const page = pages.find((p) => p.id === pageId);
  const target = pages.find((p) => p.id === targetId);
  if (!page || !target || page.id === target.id) return null;
  const placement =
    zone === 'inside'
      ? { parentId: target.id, index: childrenOf(pages, target.id).filter((p) => p.id !== pageId).length }
      : {
          parentId: target.parentId,
          index: childrenOf(pages, target.parentId)
            .filter((p) => p.id !== pageId)
            .findIndex((p) => p.id === target.id),
        };
  return effective(pages, page, placement);
}

/** Déplacements au clavier de la page sélectionnée dans l'arborescence. */
export const PAGE_KEYBOARD_MOVES = ['up', 'down', 'indent', 'outdent'] as const;
export type PageKeyboardMove = (typeof PAGE_KEYBOARD_MOVES)[number];

/**
 * Au clavier : monter ou descendre parmi ses sœurs, devenir la dernière sous-page
 * de la sœur précédente, ou remonter d'un niveau juste après sa parente. Une
 * sous-page déjà première (ou dernière) de son niveau en sort : elle se place
 * juste avant (ou juste après) sa parente (validé le 09.11.2026). Null si c'est
 * impossible : première ou dernière du premier niveau, sans sœur précédente, déjà
 * au premier niveau.
 */
export function keyboardPlacement(pages: readonly PageTreeItem[], pageId: string, move: PageKeyboardMove): PagePlacement | null {
  const page = pages.find((p) => p.id === pageId);
  if (!page) return null;
  const { parentId, index } = placementOf(pages, page);
  const siblings = childrenOf(pages, parentId);
  const parent = pages.find((p) => p.id === parentId);
  // Rang de la parente parmi ses propres sœurs : la page y est insérée avant (+0) ou après (+1).
  const besideParent = (offset: 0 | 1) =>
    parent ? { parentId: parent.parentId, index: placementOf(pages, parent).index + offset } : null;
  switch (move) {
    case 'up':
      return index > 0 ? { parentId, index: index - 1 } : besideParent(0);
    case 'down':
      return index < siblings.length - 1 ? { parentId, index: index + 1 } : besideParent(1);
    case 'indent': {
      const previous = siblings[index - 1];
      return previous ? { parentId: previous.id, index: childrenOf(pages, previous.id).length } : null;
    }
    case 'outdent':
      return besideParent(1);
  }
}
