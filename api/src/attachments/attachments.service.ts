import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import {
  type AttachmentDto,
  type AttachmentRefusal,
  type AttachmentsDto,
  type AttachmentUsage,
  attachmentFormat,
  attachmentNameSchema,
  attachmentQuotaBytes,
  checkAttachmentUpload,
  checkPageAttachmentDelete,
  type PageRevisionRow,
  pageImageIds,
  renamedAttachment,
  sortAttachments,
} from '@app/shared';
import { sql } from 'kysely';
import { DatabaseService, type Tx } from '../db/database.service.js';
import { isConstraintViolation } from '../db/pg-errors.js';

/** Refus lisible par le client ; `name` : le fichier visé, parmi ceux envoyés avec une page (ticket 26). */
export function attachmentRefusal(refusal: AttachmentRefusal, name?: string | null): HttpException {
  const body = { refusal, ...(name !== undefined && { name }) };
  switch (refusal) {
    case 'formatNotAccepted':
    case 'notAnImage':
    case 'unknownUpload':
    case 'imageNotOnPage':
      return new BadRequestException({ statusCode: 400, ...body });
    case 'fileTooLarge':
      return new PayloadTooLargeException({ statusCode: 413, ...body });
    case 'quotaExceeded':
    case 'attachmentDeleted':
    case 'imageInLastRevision':
      return new ConflictException({ statusCode: 409, ...body });
  }
}

/** Objet qui porte les fichiers : un ticket de tout type, ou une page (ticket 26). */
export type AttachmentSubject = { ticketId: string } | { pageId: string };

/** Contenu d'un fichier et la façon de le servir. */
export interface AttachmentContent {
  name: string;
  content: Buffer;
  /** Type sous lequel le fichier s'ouvre dans l'application (image, PDF), ou null : à télécharger. */
  mime: string | null;
}

/** Au plus `limit` tâches à la fois ; les suivantes attendent leur tour, dans l'ordre. */
class Semaphore {
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) await new Promise<void>((resolve) => this.waiting.push(resolve));
    else this.active++;
    try {
      return await task();
    } finally {
      // Le tour passe directement au suivant, sans libérer la place.
      const next = this.waiting.shift();
      if (next) next();
      else this.active--;
    }
  }
}

/**
 * Transferts de contenu vers ou depuis la base menés à la fois, dans toute l'API :
 * fichiers des tickets et des pages, enregistrement d'une page avec ses images. Un
 * fichier de 10 Mo occupe plusieurs fois sa taille en mémoire pendant le transfert
 * (lu en hexadécimal) : au-delà, les suivants attendent, pour tenir dans la mémoire
 * de l'API (384 Mo, compose.yaml).
 */
export const transfers = new Semaphore(4);

/**
 * Pièces jointes (ticket 21, décision 10, ADR-0014) : fichiers d'un ticket ou d'une
 * page (ticket 26), stockés en base. Ni l'objet ni son historique ne changent. Le
 * rôle et l'archivage sont vérifiés par le guard ; format, taille et limite de
 * l'initiative, ici, puis par la base.
 */
@Injectable()
export class AttachmentsService {
  constructor(private readonly database: DatabaseService) {}

  list(userId: string, initiativeId: string, subject: AttachmentSubject): Promise<AttachmentsDto> {
    return this.database.asUser(userId, async (tx) => {
      await checkSubject(tx, initiativeId, subject);
      return loadAttachments(tx, initiativeId, subject);
    });
  }

  create(userId: string, initiativeId: string, subject: AttachmentSubject, name: string, content: Buffer): Promise<AttachmentsDto> {
    const parsedName = attachmentNameSchema.safeParse(name);
    if (!parsedName.success) throw new BadRequestException();
    return transfers.run(() => this.database.asUser(userId, async (tx) => {
      await checkSubject(tx, initiativeId, subject);
      const refusal = checkAttachmentUpload(
        { name: parsedName.data, sizeBytes: content.length },
        await loadUsage(tx, initiativeId),
      );
      if (refusal) throw attachmentRefusal(refusal);
      await write(() =>
        tx
          .insertInto('attachment')
          .values({ id: randomUUID(), initiative_id: initiativeId, ...subjectColumns(subject), name: parsedName.data, content })
          .execute(),
      );
      return loadAttachments(tx, initiativeId, subject);
    }));
  }

  /** Tout membre ouvre ou télécharge ; un fichier supprimé n'a plus de contenu. */
  content(userId: string, initiativeId: string, attachmentId: string): Promise<AttachmentContent> {
    return transfers.run(() => this.database.asUser(userId, async (tx) => {
      const r = await tx
        .selectFrom('attachment')
        .select(['name', 'content'])
        .where('initiative_id', '=', initiativeId)
        .where('id', '=', attachmentId)
        .executeTakeFirst();
      if (!r) throw new NotFoundException();
      if (!r.content) throw attachmentRefusal('attachmentDeleted');
      return { name: r.name, content: r.content, mime: attachmentFormat(r.name)?.mime ?? null };
    }));
  }

  rename(userId: string, initiativeId: string, attachmentId: string, baseName: string): Promise<AttachmentDto> {
    return this.database.asUser(userId, async (tx) => {
      const current = await loadState(tx, initiativeId, attachmentId);
      if (current.deleted) throw attachmentRefusal('attachmentDeleted');
      const name = renamedAttachment(current.name, baseName);
      if (!name) throw new BadRequestException();
      await write(() => tx.updateTable('attachment').set({ name }).where('id', '=', attachmentId).execute());
      return loadAttachment(tx, initiativeId, attachmentId);
    });
  }

  /**
   * Suppression définitive : la place est libérée ; renvoie la ligne de trace. Une
   * image du dernier enregistrement d'une page ne se supprime pas (ticket 26).
   */
  remove(userId: string, initiativeId: string, attachmentId: string): Promise<AttachmentDto> {
    return this.database.asUser(userId, async (tx) => {
      const current = await loadState(tx, initiativeId, attachmentId);
      if (current.deleted) throw attachmentRefusal('attachmentDeleted');
      const refusal = current.pageId && checkPageAttachmentDelete(attachmentId, await lockPageContent(tx, current.pageId));
      if (refusal) throw attachmentRefusal(refusal);
      await write(() => tx.updateTable('attachment').set({ content: null }).where('id', '=', attachmentId).execute());
      return loadAttachment(tx, initiativeId, attachmentId);
    });
  }

  /**
   * Enregistrements de la page qui affichent cette image, du plus récent au plus
   * ancien : l'avertissement avant sa suppression les signale (décision 10, point 9).
   */
  revisionsShowing(userId: string, initiativeId: string, pageId: string, attachmentId: string): Promise<PageRevisionRow[]> {
    return this.database.asUser(userId, async (tx) => {
      const found = await tx
        .selectFrom('attachment')
        .select('id')
        .where('initiative_id', '=', initiativeId)
        .where('page_id', '=', pageId)
        .where('id', '=', attachmentId)
        .executeTakeFirst();
      if (!found) throw new NotFoundException();
      const rows = await tx
        .selectFrom('page_revision as r')
        .leftJoin('app_user as cu', 'cu.id', 'r.created_by')
        .select([
          'r.id',
          'r.sequence',
          'r.created_at',
          'r.created_by',
          'cu.email as created_by_email',
          'cu.display_name as created_by_display_name',
          'r.version_number',
          'r.version_note',
        ])
        .where('r.page_id', '=', pageId)
        .where('r.deleted_at', 'is', null)
        .where(sql<boolean>`${attachmentId} IN (SELECT page_image_ids(r.content))`)
        .orderBy('r.sequence', 'desc')
        .execute();
      return rows.map((r) => ({
        id: r.id,
        sequence: Number(r.sequence),
        createdAt: r.created_at.toISOString(),
        createdBy: { userId: r.created_by, email: r.created_by_email, displayName: r.created_by_display_name },
        versionNumber: r.version_number,
        versionNote: r.version_note,
        deletedAt: null,
        deletedBy: null,
      }));
    });
  }
}

const subjectColumns = (subject: AttachmentSubject) =>
  'ticketId' in subject ? { ticket_id: subject.ticketId } : { page_id: subject.pageId };

/** L'objet existe dans l'initiative ; sinon 404. */
async function checkSubject(tx: Tx, initiativeId: string, subject: AttachmentSubject): Promise<void> {
  const query = (table: 'ticket' | 'page', id: string) =>
    tx.selectFrom(table).select('id').where('initiative_id', '=', initiativeId).where('id', '=', id).executeTakeFirst();
  const found = 'ticketId' in subject ? await query('ticket', subject.ticketId) : await query('page', subject.pageId);
  if (!found) throw new NotFoundException();
}

async function loadState(tx: Tx, initiativeId: string, attachmentId: string) {
  const r = await tx
    .selectFrom('attachment')
    .select(['name', 'deleted_at', 'page_id'])
    .where('initiative_id', '=', initiativeId)
    .where('id', '=', attachmentId)
    .executeTakeFirst();
  if (!r) throw new NotFoundException();
  return { name: r.name, deleted: r.deleted_at !== null, pageId: r.page_id };
}

/**
 * Contenu actuel de la page, sa ligne verrouillée : une suppression d'image et un
 * enregistrement de la page passent l'un après l'autre.
 */
async function lockPageContent(tx: Tx, pageId: string) {
  const page = await tx.selectFrom('page').select('content').where('id', '=', pageId).forUpdate().executeTakeFirst();
  return page?.content ?? null;
}

/** Occupation de l'initiative et limite de l'application (paramètre réglé au ticket 31). */
export async function loadUsage(tx: Tx, initiativeId: string): Promise<AttachmentUsage> {
  const { rows } = await sql<{ used: string; quota_mb: number }>`
    SELECT attachment_usage_bytes(${initiativeId}::uuid) AS used,
           (SELECT attachment_quota_mb FROM app_settings) AS quota_mb`.execute(tx);
  const row = rows[0]!;
  return { usedBytes: Number(row.used), quotaBytes: attachmentQuotaBytes(row.quota_mb) };
}

/** Les colonnes de la liste, jamais le contenu. */
function selectAttachments(tx: Tx, initiativeId: string) {
  return tx
    .selectFrom('attachment as a')
    .leftJoin('app_user as au', 'au.id', 'a.created_by')
    .leftJoin('app_user as du', 'du.id', 'a.deleted_by')
    .select([
      'a.id',
      'a.page_id',
      'a.name',
      'a.size_bytes',
      'a.created_by',
      'au.email as created_by_email',
      'au.display_name as created_by_display_name',
      'a.created_at',
      'a.deleted_by',
      'du.email as deleted_by_email',
      'du.display_name as deleted_by_display_name',
      'a.deleted_at',
    ])
    .where('a.initiative_id', '=', initiativeId);
}

type AttachmentRow = Awaited<ReturnType<ReturnType<typeof selectAttachments>['executeTakeFirstOrThrow']>>;

function toDto(r: AttachmentRow, inText: ReadonlySet<string>): AttachmentDto {
  // Le format est garanti par la base (attachment_format).
  const format = attachmentFormat(r.name)!;
  return {
    id: r.id,
    name: r.name,
    format: format.format,
    preview: format.preview,
    sizeBytes: r.size_bytes,
    author: { userId: r.created_by, email: r.created_by_email, displayName: r.created_by_display_name },
    createdAt: r.created_at.toISOString(),
    deletedBy: r.deleted_by
      ? { userId: r.deleted_by, email: r.deleted_by_email, displayName: r.deleted_by_display_name }
      : null,
    deletedAt: r.deleted_at?.toISOString() ?? null,
    inText: inText.has(r.id),
  };
}

/** Images affichées dans le texte d'une page : celles de son dernier enregistrement. */
async function imagesInText(tx: Tx, pageId: string | null): Promise<Set<string>> {
  if (!pageId) return new Set();
  const page = await tx.selectFrom('page').select('content').where('id', '=', pageId).executeTakeFirst();
  return new Set(pageImageIds(page?.content ?? null));
}

export async function loadAttachments(tx: Tx, initiativeId: string, subject: AttachmentSubject): Promise<AttachmentsDto> {
  const query = selectAttachments(tx, initiativeId);
  const rows = await ('ticketId' in subject
    ? query.where('a.ticket_id', '=', subject.ticketId)
    : query.where('a.page_id', '=', subject.pageId)
  ).execute();
  const inText = await imagesInText(tx, 'pageId' in subject ? subject.pageId : null);
  return { attachments: sortAttachments(rows.map((r) => toDto(r, inText))), usage: await loadUsage(tx, initiativeId) };
}

async function loadAttachment(tx: Tx, initiativeId: string, attachmentId: string): Promise<AttachmentDto> {
  const row = await selectAttachments(tx, initiativeId).where('a.id', '=', attachmentId).executeTakeFirstOrThrow();
  return toDto(row, await imagesInText(tx, row.page_id));
}

/** Écriture refusée par la base (seconde barrière) : motif lisible par le client. */
export async function write(run: () => Promise<unknown>, name?: string): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (isConstraintViolation(error, 'attachment_quota')) throw attachmentRefusal('quotaExceeded', name);
    if (isConstraintViolation(error, 'attachment_format')) throw attachmentRefusal('formatNotAccepted', name);
    if (isConstraintViolation(error, 'attachment_size')) throw attachmentRefusal('fileTooLarge', name);
    if (isConstraintViolation(error, 'attachment_deleted')) throw attachmentRefusal('attachmentDeleted');
    if (isConstraintViolation(error, 'attachment_image_in_last_revision')) throw attachmentRefusal('imageInLastRevision');
    if (isConstraintViolation(error, 'attachment_name_valid')) throw new BadRequestException();
    throw error;
  }
}
