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
  renamedAttachment,
  sortAttachments,
} from '@app/shared';
import { sql } from 'kysely';
import { DatabaseService, type Tx } from '../db/database.service.js';
import { isConstraintViolation } from '../db/pg-errors.js';

export function attachmentRefusal(refusal: AttachmentRefusal): HttpException {
  switch (refusal) {
    case 'formatNotAccepted':
      return new BadRequestException({ statusCode: 400, refusal });
    case 'fileTooLarge':
      return new PayloadTooLargeException({ statusCode: 413, refusal });
    case 'quotaExceeded':
    case 'attachmentDeleted':
      return new ConflictException({ statusCode: 409, refusal });
  }
}

/** Objet qui porte les fichiers : un ticket de tout type ; une page au ticket 26. */
export type AttachmentSubject = { ticketId: string };

/** Contenu d'un fichier et la façon de le servir. */
export interface AttachmentContent {
  name: string;
  content: Buffer;
  /** Type sous lequel le fichier s'ouvre dans l'application (image, PDF), ou null : à télécharger. */
  mime: string | null;
}

/**
 * Pièces jointes (ticket 21, décision 10, ADR-0014) : fichiers d'un ticket, stockés
 * en base. Ni le ticket ni son historique ne changent. Le rôle et l'archivage sont
 * vérifiés par le guard ; format, taille et limite de l'initiative, ici, puis par
 * la base.
 */
@Injectable()
export class AttachmentsService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Transferts de contenu vers ou depuis la base menés à la fois. Un fichier de
   * 10 Mo occupe plusieurs fois sa taille en mémoire pendant le transfert (lu en
   * hexadécimal) : au-delà, les suivants attendent, pour tenir dans la mémoire de
   * l'API (384 Mo, compose.yaml).
   */
  private readonly transfers = new Semaphore(4);

  list(userId: string, initiativeId: string, subject: AttachmentSubject): Promise<AttachmentsDto> {
    return this.database.asUser(userId, async (tx) => {
      await checkSubject(tx, initiativeId, subject);
      return loadAttachments(tx, initiativeId, subject);
    });
  }

  create(userId: string, initiativeId: string, subject: AttachmentSubject, name: string, content: Buffer): Promise<AttachmentsDto> {
    const parsedName = attachmentNameSchema.safeParse(name);
    if (!parsedName.success) throw new BadRequestException();
    return this.transfers.run(() => this.database.asUser(userId, async (tx) => {
      await checkSubject(tx, initiativeId, subject);
      const refusal = checkAttachmentUpload(
        { name: parsedName.data, sizeBytes: content.length },
        await loadUsage(tx, initiativeId),
      );
      if (refusal) throw attachmentRefusal(refusal);
      await write(() =>
        tx
          .insertInto('attachment')
          .values({ id: randomUUID(), initiative_id: initiativeId, ticket_id: subject.ticketId, name: parsedName.data, content })
          .execute(),
      );
      return loadAttachments(tx, initiativeId, subject);
    }));
  }

  /** Tout membre ouvre ou télécharge ; un fichier supprimé n'a plus de contenu. */
  content(userId: string, initiativeId: string, attachmentId: string): Promise<AttachmentContent> {
    return this.transfers.run(() => this.database.asUser(userId, async (tx) => {
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

  /** Suppression définitive : la place est libérée ; renvoie la ligne de trace. */
  remove(userId: string, initiativeId: string, attachmentId: string): Promise<AttachmentDto> {
    return this.database.asUser(userId, async (tx) => {
      const current = await loadState(tx, initiativeId, attachmentId);
      if (current.deleted) throw attachmentRefusal('attachmentDeleted');
      await write(() => tx.updateTable('attachment').set({ content: null }).where('id', '=', attachmentId).execute());
      return loadAttachment(tx, initiativeId, attachmentId);
    });
  }
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

/** L'objet existe dans l'initiative ; sinon 404. */
async function checkSubject(tx: Tx, initiativeId: string, subject: AttachmentSubject): Promise<void> {
  const found = await tx
    .selectFrom('ticket')
    .select('id')
    .where('initiative_id', '=', initiativeId)
    .where('id', '=', subject.ticketId)
    .executeTakeFirst();
  if (!found) throw new NotFoundException();
}

async function loadState(tx: Tx, initiativeId: string, attachmentId: string) {
  const r = await tx
    .selectFrom('attachment')
    .select(['name', 'deleted_at'])
    .where('initiative_id', '=', initiativeId)
    .where('id', '=', attachmentId)
    .executeTakeFirst();
  if (!r) throw new NotFoundException();
  return { name: r.name, deleted: r.deleted_at !== null };
}

/** Occupation de l'initiative et limite de l'application (paramètre réglé au ticket 31). */
async function loadUsage(tx: Tx, initiativeId: string): Promise<AttachmentUsage> {
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

function toDto(r: AttachmentRow): AttachmentDto {
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
  };
}

async function loadAttachments(tx: Tx, initiativeId: string, subject: AttachmentSubject): Promise<AttachmentsDto> {
  const rows = await selectAttachments(tx, initiativeId).where('a.ticket_id', '=', subject.ticketId).execute();
  return { attachments: sortAttachments(rows.map(toDto)), usage: await loadUsage(tx, initiativeId) };
}

async function loadAttachment(tx: Tx, initiativeId: string, attachmentId: string): Promise<AttachmentDto> {
  return toDto(await selectAttachments(tx, initiativeId).where('a.id', '=', attachmentId).executeTakeFirstOrThrow());
}

/** Écriture refusée par la base (seconde barrière) : motif lisible par le client. */
async function write(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (isConstraintViolation(error, 'attachment_quota')) throw attachmentRefusal('quotaExceeded');
    if (isConstraintViolation(error, 'attachment_format')) throw attachmentRefusal('formatNotAccepted');
    if (isConstraintViolation(error, 'attachment_size')) throw attachmentRefusal('fileTooLarge');
    if (isConstraintViolation(error, 'attachment_deleted')) throw attachmentRefusal('attachmentDeleted');
    if (isConstraintViolation(error, 'attachment_name_valid')) throw new BadRequestException();
    throw error;
  }
}
