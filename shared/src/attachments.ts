// Pièces jointes (phase 2, ticket 21, décision 10, ADR-0014) : fichiers rattachés à
// un ticket, de tout type, et plus tard à une page (ticket 26). Règles écrites une
// seule fois ici, appliquées par l'API et reproduites par la base (migration 0024).
// Une pièce jointe ne figure dans aucun historique.
import { z } from 'zod';
import type { MemberNameDto } from './schemas.js';

/** Format d'un fichier accepté, tel qu'affiché dans la liste (libellé `attachment.format.<format>`). */
export const ATTACHMENT_FORMATS = [
  'pdf',
  'word',
  'excel',
  'powerpoint',
  'opendocument',
  'text',
  'csv',
  'markdown',
  'png',
  'jpeg',
  'gif',
  'webp',
  'bpmn',
  'drawio',
  'visio',
  'email',
] as const;
export type AttachmentFormat = (typeof ATTACHMENT_FORMATS)[number];

/**
 * Liste fixe des extensions acceptées (décision 10, point 2), tout le reste est
 * refusé : programmes, archives, HTML et SVG, et formats Office à macros.
 * `mime` : type sous lequel l'API sert un fichier qui s'ouvre dans l'application ;
 * les autres sont servis comme `application/octet-stream`, à télécharger.
 */
export const ATTACHMENT_EXTENSIONS = {
  pdf: { format: 'pdf', mime: 'application/pdf' },
  doc: { format: 'word', mime: null },
  docx: { format: 'word', mime: null },
  xls: { format: 'excel', mime: null },
  xlsx: { format: 'excel', mime: null },
  ppt: { format: 'powerpoint', mime: null },
  pptx: { format: 'powerpoint', mime: null },
  odt: { format: 'opendocument', mime: null },
  ods: { format: 'opendocument', mime: null },
  odp: { format: 'opendocument', mime: null },
  odg: { format: 'opendocument', mime: null },
  txt: { format: 'text', mime: null },
  csv: { format: 'csv', mime: null },
  md: { format: 'markdown', mime: null },
  png: { format: 'png', mime: 'image/png' },
  jpg: { format: 'jpeg', mime: 'image/jpeg' },
  jpeg: { format: 'jpeg', mime: 'image/jpeg' },
  gif: { format: 'gif', mime: 'image/gif' },
  webp: { format: 'webp', mime: 'image/webp' },
  bpmn: { format: 'bpmn', mime: null },
  drawio: { format: 'drawio', mime: null },
  vsd: { format: 'visio', mime: null },
  vsdx: { format: 'visio', mime: null },
  eml: { format: 'email', mime: null },
  msg: { format: 'email', mime: null },
} as const satisfies Record<string, { format: AttachmentFormat; mime: string | null }>;
export type AttachmentExtension = keyof typeof ATTACHMENT_EXTENSIONS;

/** Extension d'un nom de fichier (après le dernier point, avec au moins un caractère avant), en minuscules. */
export function attachmentExtension(name: string): string | null {
  const match = /^.*[^.].*\.([^.]+)$/su.exec(name.trim());
  return match?.[1] ? match[1].toLowerCase() : null;
}

const isAcceptedExtension = (extension: string): extension is AttachmentExtension =>
  Object.hasOwn(ATTACHMENT_EXTENSIONS, extension);

/**
 * Format d'un fichier d'après son nom, ou null s'il n'est pas accepté.
 * `preview` : les images et le PDF s'ouvrent dans l'application, le reste se télécharge.
 */
export function attachmentFormat(name: string): { extension: AttachmentExtension; format: AttachmentFormat; mime: string | null; preview: boolean } | null {
  const extension = attachmentExtension(name);
  if (!extension || !isAcceptedExtension(extension)) return null;
  const { format, mime } = ATTACHMENT_EXTENSIONS[extension];
  return { extension, format, mime, preview: mime !== null };
}

const MEBIBYTE = 1024 * 1024;

/** Taille maximale d'un fichier : 10 Mo, fixe (ADR-0014). */
export const ATTACHMENT_MAX_BYTES = 10 * MEBIBYTE;

/**
 * Limite de pièces jointes d'une initiative, en Mo : valable pour toute
 * l'application, réglée par l'administration (ticket 31) entre ces bornes.
 */
export const ATTACHMENT_QUOTA_DEFAULT_MB = 500;
export const ATTACHMENT_QUOTA_MIN_MB = 10;
export const ATTACHMENT_QUOTA_MAX_MB = 1024;
export const attachmentQuotaBytes = (quotaMb: number) => quotaMb * MEBIBYTE;

/** Occupation d'une initiative : les fichiers non supprimés, et sa limite. Visible par tout membre. */
export interface AttachmentUsage {
  usedBytes: number;
  quotaBytes: number;
}

/**
 * Envoi d'un fichier : format accepté, 10 Mo au plus, et place restante dans
 * l'initiative. Une limite baissée sous l'occupation ne supprime rien : seuls les
 * ajouts sont refusés.
 */
export function checkAttachmentUpload(
  file: { name: string; sizeBytes: number },
  usage: AttachmentUsage,
): 'formatNotAccepted' | 'fileTooLarge' | 'quotaExceeded' | null {
  if (!attachmentFormat(file.name)) return 'formatNotAccepted';
  if (file.sizeBytes > ATTACHMENT_MAX_BYTES) return 'fileTooLarge';
  if (usage.usedBytes + file.sizeBytes > usage.quotaBytes) return 'quotaExceeded';
  return null;
}

/** Longueur maximale d'un nom de fichier, extension comprise. */
export const ATTACHMENT_NAME_MAX_LENGTH = 255;

/** Nom d'un fichier : sans chemin ni caractère de contrôle ; deux fichiers peuvent porter le même. */
export const attachmentNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(ATTACHMENT_NAME_MAX_LENGTH)
  .refine((name) => !/[/\\\p{Cc}]/u.test(name));

/** Nom sans son extension : ce qu'on saisit pour renommer. */
export function attachmentBaseName(name: string): string {
  const extension = attachmentExtension(name);
  return extension ? name.slice(0, name.length - extension.length - 1) : name;
}

/** Nouveau nom d'un fichier renommé : le nom saisi suivi de l'extension d'origine, ou null s'il n'est pas valide. */
export function renamedAttachment(currentName: string, baseName: string): string | null {
  const extension = currentName.slice(attachmentBaseName(currentName).length);
  const parsed = attachmentNameSchema.safeParse(`${baseName.trim()}${extension}`);
  return parsed.success && baseName.trim() !== '' ? parsed.data : null;
}

/** Taille lisible : octets, puis Ko, Mo et Go (multiples de 1 024), à une décimale. */
export function fileSize(bytes: number): { value: number; unit: 'B' | 'KB' | 'MB' | 'GB' } {
  const units = ['B', 'KB', 'MB', 'GB'] as const;
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return { value: i === 0 ? value : Math.round(value * 10) / 10, unit: units[i]! };
}

/** Liste des fichiers d'un ticket, du plus ancien au plus récent ; une ligne de trace garde sa place. */
export function sortAttachments<A extends { id: string; createdAt: string }>(attachments: readonly A[]): A[] {
  return [...attachments].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

/** Renommer : le nom saisi, sans l'extension, qui reste celle du fichier. */
export const renameAttachmentInputSchema = z.object({ baseName: z.string().max(ATTACHMENT_NAME_MAX_LENGTH) });
export type RenameAttachmentInput = z.infer<typeof renameAttachmentInputSchema>;

/** Pièce jointe telle que renvoyée par l'API (sans son contenu, téléchargé à part). */
export interface AttachmentDto {
  id: string;
  /** Nom affiché, extension comprise. */
  name: string;
  format: AttachmentFormat;
  /** Image ou PDF : s'ouvre dans l'application ; sinon se télécharge. */
  preview: boolean;
  sizeBytes: number;
  author: MemberNameDto;
  createdAt: string;
  /** Suppression définitive : qui et quand ; seule la ligne de trace reste, avec le nom. */
  deletedBy: MemberNameDto | null;
  deletedAt: string | null;
}

/** Fichiers d'un ticket et occupation de son initiative. */
export interface AttachmentsDto {
  attachments: AttachmentDto[];
  usage: AttachmentUsage;
}

/**
 * Refus d'une écriture sur une pièce jointe, renvoyés par l'API (`refusal`) :
 * - `formatNotAccepted` : format hors de la liste acceptée ;
 * - `fileTooLarge` : plus de 10 Mo ;
 * - `quotaExceeded` : la limite de pièces jointes de l'initiative serait dépassée ;
 * - `attachmentDeleted` : le fichier a déjà été supprimé.
 */
export const ATTACHMENT_REFUSALS = ['formatNotAccepted', 'fileTooLarge', 'quotaExceeded', 'attachmentDeleted'] as const;
export type AttachmentRefusal = (typeof ATTACHMENT_REFUSALS)[number];
export const isAttachmentRefusal = (value: unknown): value is AttachmentRefusal =>
  ATTACHMENT_REFUSALS.some((r) => r === value);
