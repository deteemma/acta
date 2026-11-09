// Enregistrements et versions de page (ticket 23, décisions 07 points 4 et 5, 08
// points 6 et 8, ADR-0019). Règles écrites une seule fois ici, appliquées par
// l'API et le web, et reproduites par la base (migration 0021).
import { z } from 'zod';
import type { PageDoc, PageNode } from './pages.js';
import type { MemberNameDto } from './schemas.js';

/** Ce que les règles lisent d'un enregistrement. */
export interface PageRevisionItem {
  id: string;
  /** Ordre chronologique des enregistrements d'une page, attribué par la base. */
  sequence: number;
  /** Numéro de version ; null pour un simple enregistrement. */
  versionNumber: number | null;
  /** Non null : enregistrement supprimé, dont seule la trace reste. */
  deletedAt: string | null;
}

/** Numéro de la prochaine version : jamais celui d'une version, même supprimée (décision 07, point 5). */
export function nextPageVersionNumber(revisions: readonly PageRevisionItem[]): number {
  return Math.max(0, ...revisions.map((r) => r.versionNumber ?? 0)) + 1;
}

/**
 * Refus d'une écriture sur un enregistrement, renvoyés par l'API (`refusal`) :
 * - `pageVersionNotAfterLast` : seul un enregistrement postérieur à la dernière version se déclare ;
 * - `alreadyPageVersion` : une version le reste, sans redevenir un simple enregistrement ;
 * - `pageRevisionDeleted` : un enregistrement supprimé n'a plus de contenu ;
 * - `lastPageRevision` : le dernier enregistrement, l'état actuel de la page, ne se supprime pas ;
 * - `notPageVersion` : seule une version porte une note ;
 * - `currentPageRevision` : l'enregistrement est déjà l'état actuel de la page.
 */
export const PAGE_REVISION_REFUSALS = [
  'pageVersionNotAfterLast',
  'alreadyPageVersion',
  'pageRevisionDeleted',
  'lastPageRevision',
  'notPageVersion',
  'currentPageRevision',
] as const;
export type PageRevisionRefusal = (typeof PAGE_REVISION_REFUSALS)[number];
export const isPageRevisionRefusal = (value: unknown): value is PageRevisionRefusal =>
  PAGE_REVISION_REFUSALS.some((r) => r === value);

/**
 * Déclarer un enregistrement comme version, au moment d'enregistrer ou après coup
 * (décision 07, point 5) ; null si c'est permis. Une version supprimée compte
 * encore : un enregistrement antérieur à elle ne devient pas une version plus
 * récente qu'elle.
 */
export function checkPageVersionDeclare(revisions: readonly PageRevisionItem[], revisionId: string): PageRevisionRefusal | null {
  const revision = revisions.find((r) => r.id === revisionId);
  if (!revision) return null;
  if (revision.deletedAt) return 'pageRevisionDeleted';
  if (revision.versionNumber !== null) return 'alreadyPageVersion';
  const lastVersion = Math.max(0, ...revisions.filter((r) => r.versionNumber !== null).map((r) => r.sequence));
  return revision.sequence > lastVersion ? null : 'pageVersionNotAfterLast';
}

/** Enregistrements encore présents, du plus ancien au plus récent. */
const kept = <T extends PageRevisionItem>(revisions: readonly T[]) =>
  revisions.filter((r) => !r.deletedAt).sort((a, b) => a.sequence - b.sequence);

/** Dernier enregistrement encore présent : l'état actuel de la page, celui que tout membre voit. */
export const currentPageRevision = <T extends PageRevisionItem>(revisions: readonly T[]): T | undefined =>
  kept(revisions).at(-1);

/**
 * Supprimer définitivement un enregistrement (décision 07, point 4) ; null si
 * c'est permis. Le dernier, l'état actuel de la page, ne se supprime pas, même
 * s'il est une version.
 */
export function checkPageRevisionDelete(revisions: readonly PageRevisionItem[], revisionId: string): PageRevisionRefusal | null {
  const revision = revisions.find((r) => r.id === revisionId);
  if (!revision) return null;
  if (revision.deletedAt) return 'pageRevisionDeleted';
  return currentPageRevision(revisions)?.id === revision.id ? 'lastPageRevision' : null;
}

/** Corriger la note d'une version ; null si c'est permis. */
export function checkPageVersionNote(revisions: readonly PageRevisionItem[], revisionId: string): PageRevisionRefusal | null {
  const revision = revisions.find((r) => r.id === revisionId);
  if (!revision) return null;
  if (revision.deletedAt) return 'pageRevisionDeleted';
  return revision.versionNumber === null ? 'notPageVersion' : null;
}

/**
 * Restaurer un enregistrement ou une version : la page reprend son titre et son
 * contenu, dans un nouvel enregistrement qui n'est pas une version (décision 07,
 * point 4) ; null si c'est permis.
 */
export function checkPageRevisionRestore(revisions: readonly PageRevisionItem[], revisionId: string): PageRevisionRefusal | null {
  if (revisions.find((r) => r.id === revisionId)?.deletedAt) return 'pageRevisionDeleted';
  return currentPageRevision(revisions)?.id === revisionId ? 'currentPageRevision' : null;
}

/** Ce que la page affiche de ses versions (décision 07, point 5). */
export interface PageVersionStatus {
  /** Numéro de la dernière version encore présente ; null si la page n'en a aucune. */
  lastVersion: number | null;
  /** Vrai si la page a été enregistrée depuis sa dernière version. */
  modifiedSinceLastVersion: boolean;
  /** Numéro que prendrait une version déclarée maintenant. */
  nextVersion: number;
}

export function pageVersionStatus(revisions: readonly PageRevisionItem[]): PageVersionStatus {
  const present = kept(revisions);
  const versions = present.filter((r) => r.versionNumber !== null);
  const last = versions.at(-1);
  return {
    lastVersion: last?.versionNumber ?? null,
    modifiedSinceLastVersion: !!last && present.at(-1)?.id !== last.id,
    nextVersion: nextPageVersionNumber(revisions),
  };
}

// ── Comparaison de deux enregistrements (décision 08, point 8 ; ADR-0019, point 2) ──

/** Texte d'un bloc de texte ; un retour à la ligne y reste un retour à la ligne. */
function inlineText(node: PageNode): string {
  return (node.content ?? []).map((child) => (child.type === 'hardBreak' ? '\n' : (child.text ?? ''))).join('');
}

/** Lignes d'un nœud : un bloc par ligne, une ligne de tableau avec ses cellules séparées par « | ». */
function blockLines(node: PageNode): string[] {
  switch (node.type) {
    case 'paragraph':
    case 'heading':
      return [inlineText(node)];
    case 'tableRow':
      return [(node.content ?? []).map((cell) => blockLines(cell).join(' ')).join(' | ')];
    default:
      return (node.content ?? []).flatMap(blockLines);
  }
}

/**
 * Texte d'un contenu de page tel que la comparaison le lit : la mise en forme
 * n'y figure pas, un changement de mise en forme seul ne s'y voit donc pas.
 */
export function pageComparisonText(doc: PageNode | null): string {
  return doc ? blockLines(doc).join('\n') : '';
}

/** Partie du texte comparé : commune aux deux enregistrements, ajoutée ou supprimée. */
export interface PageDiffPart {
  kind: 'same' | 'added' | 'removed';
  text: string;
}

type DiffOp = { kind: PageDiffPart['kind']; token: string };

/**
 * Au-delà de ce nombre de différences, un passage est montré entièrement
 * supprimé puis entièrement ajouté : la comparaison reste immédiate.
 */
const MAX_DIFF_COST = 1000;

/** Plus courte suite d'ajouts et de suppressions (Myers) ; null au-delà de MAX_DIFF_COST. */
function shortestEdit(a: readonly string[], b: readonly string[]): DiffOp[] | null {
  const n = a.length;
  const m = b.length;
  const limit = Math.min(n + m, MAX_DIFF_COST);
  const offset = limit + 1;
  const v = new Int32Array(2 * offset + 1);
  const trace: Int32Array[] = [];
  for (let d = 0; d <= limit; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!) ? v[offset + k + 1]! : v[offset + k - 1]! + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) return backtrack(a, b, trace, offset);
    }
  }
  return null;
}

function backtrack(a: readonly string[], b: readonly string[], trace: Int32Array[], offset: number): DiffOp[] {
  const ops: DiffOp[] = [];
  let x = a.length;
  let y = b.length;
  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d]!;
    const k = x - y;
    const prevK = k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!) ? k + 1 : k - 1;
    const prevX = d === 0 ? 0 : v[offset + prevK]!;
    const prevY = d === 0 ? 0 : prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push({ kind: 'same', token: a[--x]! });
      y--;
    }
    if (d > 0) {
      if (x === prevX) ops.push({ kind: 'added', token: b[--y]! });
      else ops.push({ kind: 'removed', token: a[--x]! });
    }
  }
  return ops.reverse();
}

/** Différences de deux suites, ou tout supprimé puis tout ajouté si elles sont trop nombreuses. */
function diffTokens(a: readonly string[], b: readonly string[]): DiffOp[] {
  return (
    shortestEdit(a, b) ?? [
      ...a.map((token) => ({ kind: 'removed' as const, token })),
      ...b.map((token) => ({ kind: 'added' as const, token })),
    ]
  );
}

/** Lignes non vides, chacune en mots ; tout espace (insécable compris) sépare deux mots. */
const linesOf = (text: string): string[][] =>
  text
    .split('\n')
    .map((line) => line.split(/\s+/u).filter(Boolean))
    .filter((words) => words.length > 0);

/** Mots d'une suite de lignes, chaque ligne terminée par un retour à la ligne. */
const tokensOf = (lines: readonly string[][]) => lines.flatMap((words) => [...words, '\n']);

/**
 * Compare deux textes (pageComparisonText, ou deux titres) mot à mot, dans un
 * seul texte (décision 08, point 8). Les espaces ne comptent pas : seuls les mots
 * et les retours à la ligne diffèrent. Les lignes sont d'abord appariées, puis
 * les mots des lignes qui ont changé.
 */
export function diffPageTexts(before: string, after: string): PageDiffPart[] {
  const oldLines = linesOf(before);
  const newLines = linesOf(after);
  const ops: DiffOp[] = [];
  let removed: string[][] = [];
  let added: string[][] = [];
  const flush = () => {
    ops.push(...diffTokens(tokensOf(removed), tokensOf(added)));
    removed = [];
    added = [];
  };
  const lineOps = diffTokens(
    oldLines.map((w) => w.join(' ')),
    newLines.map((w) => w.join(' ')),
  );
  let i = 0;
  let j = 0;
  for (const op of lineOps) {
    if (op.kind === 'removed') removed.push(oldLines[i++]!);
    else if (op.kind === 'added') added.push(newLines[j++]!);
    else {
      flush();
      ops.push(...tokensOf([oldLines[i++]!]).map((token) => ({ kind: 'same' as const, token })));
      j++;
    }
  }
  flush();
  return toParts(ops);
}

/** Texte des parties : un espace entre deux mots, compté dans la partie commune quand il les sépare de types différents. */
function toParts(ops: readonly DiffOp[]): PageDiffPart[] {
  const parts: PageDiffPart[] = [];
  const append = (kind: PageDiffPart['kind'], text: string) => {
    const last = parts.at(-1);
    if (last?.kind === kind) last.text += text;
    else parts.push({ kind, text });
  };
  let previous: DiffOp | null = null;
  for (const op of ops) {
    if (previous && previous.token !== '\n' && op.token !== '\n') append(previous.kind === op.kind ? op.kind : 'same', ' ');
    append(op.kind, op.token);
    previous = op;
  }
  // Le dernier retour à la ligne de chaque texte ne se montre pas.
  for (let p = parts.length - 1; p >= 0; p--) {
    const part = parts[p]!;
    if (part.text.endsWith('\n')) part.text = part.text.slice(0, -1);
    if (part.text === '') parts.splice(p, 1);
    else break;
  }
  return parts;
}

// ── Saisie ───────────────────────────────────────────────────────────────────

export const PAGE_VERSION_NOTE_MAX_LENGTH = 500;

/** Note facultative d'une version, que tout propriétaire ou contributeur corrige ; vide, elle est retirée. */
export const pageVersionNoteSchema = z
  .string()
  .trim()
  .max(PAGE_VERSION_NOTE_MAX_LENGTH)
  .transform((note) => note || null)
  .nullable();

/** Déclarer une version, après coup ou en enregistrant (« Enregistrer comme version N »). */
export const declarePageVersionSchema = z.object({ note: pageVersionNoteSchema.default(null) });
export type DeclarePageVersionInput = z.infer<typeof declarePageVersionSchema>;

/** Corriger la note d'une version. */
export const updatePageVersionNoteSchema = z.object({ note: pageVersionNoteSchema });
export type UpdatePageVersionNoteInput = z.infer<typeof updatePageVersionNoteSchema>;

// ── Réponses de l'API ───────────────────────────────────────────────────────

/** Ligne de l'historique, sans le contenu, du plus récent au plus ancien. */
export interface PageRevisionRow extends PageRevisionItem {
  createdAt: string;
  createdBy: MemberNameDto;
  /** Null pour un simple enregistrement, ou une fois l'enregistrement supprimé. */
  versionNote: string | null;
  deletedBy: MemberNameDto | null;
}

/** Enregistrement ouvert depuis l'historique. */
export interface PageRevisionDto extends PageRevisionRow {
  /** Null une fois l'enregistrement supprimé. */
  title: string | null;
  content: PageDoc | null;
}
