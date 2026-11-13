// Images et pièces jointes des pages (phase 2, ticket 26, décision 10 points 7 à
// 9, décision 08 point 5). Une image insérée dans le texte est une pièce jointe de
// la page comme une autre ; elle ne lui est rattachée qu'à l'enregistrement de la
// saisie. Règles écrites une seule fois ici, appliquées par l'API et le web, et
// reproduites par la base (migration 0028).
import { z } from 'zod';
import {
  type AttachmentRefusal,
  type AttachmentUsage,
  attachmentFormat,
  attachmentNameSchema,
  checkAttachmentUpload,
} from './attachments.js';

/** Nœud lu sans présumer de sa validité : le JSON de l'éditeur, ou un enregistrement. */
export interface PageImageNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: readonly PageImageNode[];
}

/**
 * Image insérée depuis l'ouverture de la saisie, pas encore envoyée : elle désigne
 * le fichier joint à l'enregistrement par sa clé (`upload:<clé>`). L'API la
 * remplace par l'identifiant de la pièce jointe créée ; aucun enregistrement n'en
 * garde.
 */
export const PAGE_UPLOAD_PREFIX = 'upload:';
const UPLOAD_KEY = /^[a-z0-9-]{1,64}$/;

export const pageUploadRef = (key: string) => `${PAGE_UPLOAD_PREFIX}${key}`;

export const isPageUploadRef = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith(PAGE_UPLOAD_PREFIX) && UPLOAD_KEY.test(value.slice(PAGE_UPLOAD_PREFIX.length));

/** Valeurs `attachmentId` des images, dans l'ordre du document, chacune une fois. */
function imageRefs(doc: PageImageNode | null): string[] {
  const found = new Set<string>();
  const visit = (node: PageImageNode) => {
    const id = node.attrs?.attachmentId;
    if (node.type === 'image' && typeof id === 'string') found.add(id);
    for (const child of node.content ?? []) visit(child);
  };
  if (doc) visit(doc);
  return [...found];
}

/** Pièces jointes affichées dans le texte, dans l'ordre du document, chacune une fois. */
export function pageImageIds(doc: PageImageNode | null): string[] {
  return imageRefs(doc).filter((ref) => !isPageUploadRef(ref));
}

/** Clés des images insérées encore dans le texte, dans l'ordre du document, chacune une fois : les fichiers à envoyer. */
export function pageUploadKeys(doc: PageImageNode | null): string[] {
  return imageRefs(doc)
    .filter(isPageUploadRef)
    .map((ref) => ref.slice(PAGE_UPLOAD_PREFIX.length));
}

/** Image sous chacune de ses formes acceptées (décision 10, point 2) : PNG, JPEG, GIF, WebP. */
export const isImageAttachment = (name: string) => attachmentFormat(name)?.mime?.startsWith('image/') ?? false;

/** Fichier envoyé avec l'enregistrement d'une saisie, pour une image insérée (`upload:<clé>`). */
export const pageUploadSchema = z.object({
  key: z.string().regex(UPLOAD_KEY),
  name: attachmentNameSchema,
  sizeBytes: z.number().int().min(0),
});
export type PageUpload = z.infer<typeof pageUploadSchema>;

/** Refus d'un fichier envoyé, avec son nom pour le message ; null si le refus ne vise aucun fichier. */
export interface PageUploadRefusal {
  refusal: AttachmentRefusal;
  name: string | null;
}

/**
 * Fichiers envoyés avec une saisie : un par image insérée, chacun dans le texte
 * (une image retirée avant l'enregistrement n'est pas envoyée), des images
 * seulement, avec la taille par fichier et la limite de l'initiative des pièces
 * jointes, comptées ensemble.
 */
export function checkPageUploads(
  content: PageImageNode | null,
  uploads: readonly PageUpload[],
  usage: AttachmentUsage,
): PageUploadRefusal | null {
  const refs = new Set(imageRefs(content).filter(isPageUploadRef));
  const keys = new Set<string>();
  for (const upload of uploads) {
    const ref = pageUploadRef(upload.key);
    if (keys.has(ref) || !refs.has(ref)) return { refusal: 'unknownUpload', name: upload.name };
    keys.add(ref);
  }
  if ([...refs].some((ref) => !keys.has(ref))) return { refusal: 'unknownUpload', name: null };
  let used = usage.usedBytes;
  for (const upload of uploads) {
    const refusal = checkAttachmentUpload(upload, { ...usage, usedBytes: used });
    if (refusal) return { refusal, name: upload.name };
    if (!isImageAttachment(upload.name)) return { refusal: 'notAnImage', name: upload.name };
    used += upload.sizeBytes;
  }
  return null;
}

/** Contenu enregistré : chaque image insérée désigne la pièce jointe créée pour son fichier. */
export function resolvePageUploads<T extends PageImageNode>(doc: T, attachmentIds: Readonly<Record<string, string>>): T {
  const visit = (node: PageImageNode): PageImageNode => {
    const id = node.attrs?.attachmentId;
    if (node.type === 'image' && isPageUploadRef(id)) {
      const resolved = attachmentIds[id.slice(PAGE_UPLOAD_PREFIX.length)];
      return resolved ? { ...node, attrs: { ...node.attrs, attachmentId: resolved } } : node;
    }
    return node.content ? { ...node, content: node.content.map(visit) } : node;
  };
  return visit(doc) as T;
}

/**
 * Les images du texte sont des pièces jointes de la page, au format image ; une
 * image supprimée reste désignée (« image supprimée » à sa place), par exemple
 * après la restauration d'un ancien enregistrement (décision 10, point 9).
 */
export function checkPageImages(
  content: PageImageNode | null,
  pageAttachments: readonly { id: string; name: string }[],
): 'imageNotOnPage' | null {
  const images = new Set(pageAttachments.filter((a) => isImageAttachment(a.name)).map((a) => a.id));
  return pageImageIds(content).every((id) => images.has(id)) ? null : 'imageNotOnPage';
}

/**
 * Supprimer une pièce jointe de la page : refusé si c'est une image du dernier
 * enregistrement (la retirer du texte et enregistrer d'abord) ; permis si elle ne
 * figure que dans d'anciens, qui afficheront « image supprimée » (décision 10, point 9).
 */
export function checkPageAttachmentDelete(attachmentId: string, currentContent: PageImageNode | null): 'imageInLastRevision' | null {
  return pageImageIds(currentContent).includes(attachmentId) ? 'imageInLastRevision' : null;
}
