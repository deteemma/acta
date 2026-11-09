// Commentaires (phase 2, ticket 20, décision 05) : un fil simple sur un ticket, de
// tout type, et plus tard sur une page (ticket 25). Règles écrites une seule fois
// ici, appliquées par l'API et reproduites par la base (migration 0023). Un
// commentaire ne figure dans aucun historique.
import { z } from 'zod';
import { can, type InitiativeRole } from './roles.js';
import type { MemberNameDto } from './schemas.js';

/** Même texte mis en forme que la description d'un ticket (rich-text.ts), plus court. */
export const COMMENT_MAX_LENGTH = 5000;
export const commentBodySchema = z.string().trim().min(1).max(COMMENT_MAX_LENGTH);

/** Commentaire vu par les règles de droits : son auteur, et s'il ne reste que la ligne de trace. */
export interface CommentAuthorship {
  authorId: string;
  deleted: boolean;
}

/** Celui qui agit : son rôle dans l'initiative (null s'il n'est plus membre) et l'archivage. */
export interface CommentActor {
  userId: string;
  role: InitiativeRole | null;
  archived: boolean;
}

/** Ajouter un commentaire : propriétaire ou contributeur, initiative non archivée ; un ticket fermé reste commentable. */
export const canWriteComment = (actor: CommentActor) => can(actor.role, 'comment', actor);

/** Modifier : son auteur seul, tant qu'il est propriétaire ou contributeur. */
export const canEditComment = (comment: CommentAuthorship, actor: CommentActor) =>
  !comment.deleted && comment.authorId === actor.userId && canWriteComment(actor);

/** Supprimer : son auteur, tant qu'il est propriétaire ou contributeur, ou un propriétaire. */
export const canDeleteComment = (comment: CommentAuthorship, actor: CommentActor) =>
  !comment.deleted &&
  (comment.authorId === actor.userId ? canWriteComment(actor) : can(actor.role, 'deleteAnyComment', actor));

/** Ajout ou modification : le texte seul ; ni mention ni pièce jointe. */
export const commentInputSchema = z.object({ body: commentBodySchema });
export type CommentInput = z.infer<typeof commentInputSchema>;

/** Commentaire tel que renvoyé par l'API. */
export interface CommentDto {
  id: string;
  /** Texte mis en forme (rich-text.ts) ; null pour la ligne de trace d'un commentaire supprimé. */
  body: string | null;
  author: MemberNameDto;
  createdAt: string;
  /** Dernière modification du texte, null s'il n'a jamais changé ; l'ancien texte n'est pas gardé. */
  editedAt: string | null;
  /** Suppression : qui et quand ; la ligne reste à sa place dans le fil. */
  deletedBy: MemberNameDto | null;
  deletedAt: string | null;
}

/** Fil simple, sans réponses imbriquées : du plus ancien au plus récent. */
export function sortThread<C extends { id: string; createdAt: string }>(comments: readonly C[]): C[] {
  return [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

/**
 * Refus d'une écriture sur un commentaire, renvoyés par l'API (`refusal`) :
 * - `notCommentAuthor` : seul son auteur modifie un commentaire ;
 * - `cannotDeleteComment` : seuls son auteur ou un propriétaire le suppriment ;
 * - `commentDeleted` : le commentaire a déjà été supprimé.
 */
export const COMMENT_REFUSALS = ['notCommentAuthor', 'cannotDeleteComment', 'commentDeleted'] as const;
export type CommentRefusal = (typeof COMMENT_REFUSALS)[number];
export const isCommentRefusal = (value: unknown): value is CommentRefusal => COMMENT_REFUSALS.some((r) => r === value);
