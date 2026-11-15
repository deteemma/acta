import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { type CommentDto, type CommentInput, commentInputSchema, type InitiativeRole } from '@app/shared';
import { type AuthenticatedUser, CurrentUser } from '../auth/authenticated-user.js';
import { CurrentInitiativeRole, RequireInitiativeRole } from '../initiatives/initiative-role.guard.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { CommentsService } from './comments.service.js';

/**
 * Commentaires (tickets 20 et 25) : tout membre lit le fil d'un ticket ou d'une
 * page ; propriétaires et contributeurs commentent ; l'auteur modifie, l'auteur ou
 * un propriétaire supprime. Modification et suppression ne dépendent pas de l'objet
 * commenté.
 */
@Controller('initiatives/:initiativeId')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('tickets/:ticketId/comments')
  @RequireInitiativeRole('view')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ): Promise<CommentDto[]> {
    return this.comments.list(user.id, initiativeId, { ticketId });
  }

  @Post('tickets/:ticketId/comments')
  @RequireInitiativeRole('comment')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body(new ZodValidationPipe(commentInputSchema)) body: CommentInput,
  ): Promise<CommentDto[]> {
    return this.comments.create(user.id, initiativeId, { ticketId }, body);
  }

  @Get('pages/:pageId/comments')
  @RequireInitiativeRole('view')
  listForPage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
  ): Promise<CommentDto[]> {
    return this.comments.list(user.id, initiativeId, { pageId });
  }

  @Post('pages/:pageId/comments')
  @RequireInitiativeRole('comment')
  createForPage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body(new ZodValidationPipe(commentInputSchema)) body: CommentInput,
  ): Promise<CommentDto[]> {
    return this.comments.create(user.id, initiativeId, { pageId }, body);
  }

  @Patch('comments/:commentId')
  @RequireInitiativeRole('comment')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentInitiativeRole() role: InitiativeRole,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body(new ZodValidationPipe(commentInputSchema)) body: CommentInput,
  ): Promise<CommentDto> {
    return this.comments.update(user.id, role, initiativeId, commentId, body);
  }

  /** Renvoie la ligne de trace qui remplace le commentaire. */
  @Delete('comments/:commentId')
  @RequireInitiativeRole('comment')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentInitiativeRole() role: InitiativeRole,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ): Promise<CommentDto> {
    return this.comments.remove(user.id, role, initiativeId, commentId);
  }
}
