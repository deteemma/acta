import { randomUUID } from 'node:crypto';
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  canDeleteComment,
  canEditComment,
  type CommentDto,
  type CommentInput,
  type CommentRefusal,
  type InitiativeRole,
  sortThread,
} from '@app/shared';
import { DatabaseService, type Tx } from '../db/database.service.js';
import { isConstraintViolation } from '../db/pg-errors.js';

export function commentRefusal(refusal: CommentRefusal) {
  return refusal === 'commentDeleted'
    ? new ConflictException({ statusCode: 409, refusal })
    : new ForbiddenException({ statusCode: 403, refusal });
}

/** Objet commenté : un ticket de tout type ; une page au ticket 25. */
export type CommentSubject = { ticketId: string };

/**
 * Commentaires (ticket 20, décision 05) : fil simple d'un ticket. Ni le ticket ni
 * son historique ne changent. Le rôle et l'archivage sont vérifiés par le guard ;
 * l'auteur et le propriétaire, ici, puis par la base.
 */
@Injectable()
export class CommentsService {
  constructor(private readonly database: DatabaseService) {}

  list(userId: string, initiativeId: string, subject: CommentSubject): Promise<CommentDto[]> {
    return this.database.asUser(userId, async (tx) => {
      await checkSubject(tx, initiativeId, subject);
      return loadThread(tx, initiativeId, subject);
    });
  }

  create(userId: string, initiativeId: string, subject: CommentSubject, input: CommentInput): Promise<CommentDto[]> {
    return this.database.asUser(userId, async (tx) => {
      await checkSubject(tx, initiativeId, subject);
      await tx
        .insertInto('comment')
        .values({ id: randomUUID(), initiative_id: initiativeId, ticket_id: subject.ticketId, body: input.body })
        .execute();
      return loadThread(tx, initiativeId, subject);
    });
  }

  update(userId: string, role: InitiativeRole, initiativeId: string, commentId: string, input: CommentInput): Promise<CommentDto> {
    return this.database.asUser(userId, async (tx) => {
      const { comment, archived } = await loadCommentAndArchive(tx, initiativeId, commentId);
      if (comment.deleted) throw commentRefusal('commentDeleted');
      if (!canEditComment(comment, { userId, role, archived })) throw commentRefusal('notCommentAuthor');
      await write(() => tx.updateTable('comment').set({ body: input.body }).where('id', '=', commentId).execute());
      return loadComment(tx, initiativeId, commentId);
    });
  }

  /** Suppression définitive du texte ; renvoie la ligne de trace. */
  remove(userId: string, role: InitiativeRole, initiativeId: string, commentId: string): Promise<CommentDto> {
    return this.database.asUser(userId, async (tx) => {
      const { comment, archived } = await loadCommentAndArchive(tx, initiativeId, commentId);
      if (comment.deleted) throw commentRefusal('commentDeleted');
      if (!canDeleteComment(comment, { userId, role, archived })) throw commentRefusal('cannotDeleteComment');
      await write(() => tx.updateTable('comment').set({ body: null }).where('id', '=', commentId).execute());
      return loadComment(tx, initiativeId, commentId);
    });
  }
}

/** L'objet commenté existe dans l'initiative ; sinon 404. */
async function checkSubject(tx: Tx, initiativeId: string, subject: CommentSubject): Promise<void> {
  const found = await tx
    .selectFrom('ticket')
    .select('id')
    .where('initiative_id', '=', initiativeId)
    .where('id', '=', subject.ticketId)
    .executeTakeFirst();
  if (!found) throw new NotFoundException();
}

/** Le commentaire vu par les règles de droits (auteur, supprimé ou non), et l'archivage de son initiative. */
async function loadCommentAndArchive(tx: Tx, initiativeId: string, commentId: string) {
  const r = await tx
    .selectFrom('comment as c')
    .innerJoin('initiative as i', 'i.id', 'c.initiative_id')
    .select(['c.created_by', 'c.deleted_at', 'i.archived_at'])
    .where('c.initiative_id', '=', initiativeId)
    .where('c.id', '=', commentId)
    .executeTakeFirst();
  if (!r) throw new NotFoundException();
  return { comment: { authorId: r.created_by, deleted: r.deleted_at !== null }, archived: r.archived_at !== null };
}

function selectComments(tx: Tx, initiativeId: string) {
  return tx
    .selectFrom('comment as c')
    .leftJoin('app_user as au', 'au.id', 'c.created_by')
    .leftJoin('app_user as du', 'du.id', 'c.deleted_by')
    .select([
      'c.id',
      'c.body',
      'c.created_by',
      'au.email as created_by_email',
      'au.display_name as created_by_display_name',
      'c.created_at',
      'c.edited_at',
      'c.deleted_by',
      'du.email as deleted_by_email',
      'du.display_name as deleted_by_display_name',
      'c.deleted_at',
    ])
    .where('c.initiative_id', '=', initiativeId);
}

type CommentRow = Awaited<ReturnType<ReturnType<typeof selectComments>['executeTakeFirstOrThrow']>>;

function toDto(r: CommentRow): CommentDto {
  return {
    id: r.id,
    body: r.body,
    author: { userId: r.created_by, email: r.created_by_email, displayName: r.created_by_display_name },
    createdAt: r.created_at.toISOString(),
    editedAt: r.edited_at?.toISOString() ?? null,
    deletedBy: r.deleted_by
      ? { userId: r.deleted_by, email: r.deleted_by_email, displayName: r.deleted_by_display_name }
      : null,
    deletedAt: r.deleted_at?.toISOString() ?? null,
  };
}

async function loadThread(tx: Tx, initiativeId: string, subject: CommentSubject): Promise<CommentDto[]> {
  const rows = await selectComments(tx, initiativeId).where('c.ticket_id', '=', subject.ticketId).execute();
  return sortThread(rows.map(toDto));
}

async function loadComment(tx: Tx, initiativeId: string, commentId: string): Promise<CommentDto> {
  return toDto(await selectComments(tx, initiativeId).where('c.id', '=', commentId).executeTakeFirstOrThrow());
}

/** Écriture refusée par la base (seconde barrière) : motif lisible par le client. */
async function write(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (isConstraintViolation(error, 'comment_deleted')) throw commentRefusal('commentDeleted');
    if (isConstraintViolation(error, 'comment_edit_allowed')) throw commentRefusal('notCommentAuthor');
    if (isConstraintViolation(error, 'comment_delete_allowed')) throw commentRefusal('cannotDeleteComment');
    throw error;
  }
}
