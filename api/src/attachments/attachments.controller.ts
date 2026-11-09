import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  type AttachmentDto,
  type AttachmentsDto,
  type RenameAttachmentInput,
  renameAttachmentInputSchema,
} from '@app/shared';
import type { FastifyReply } from 'fastify';
import { type AuthenticatedUser, CurrentUser } from '../auth/authenticated-user.js';
import { RequireInitiativeRole } from '../initiatives/initiative-role.guard.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { AttachmentsService } from './attachments.service.js';

/**
 * Pièces jointes (ticket 21) : tout membre liste, ouvre et télécharge les fichiers
 * d'un ticket ; propriétaires et contributeurs en ajoutent, en renomment et en
 * suppriment. Le contenu s'envoie brut (`application/octet-stream`, 10 Mo au plus,
 * main.ts), le nom dans `?name=`. Renommer, supprimer et télécharger ne dépendent
 * pas de l'objet : ils serviront aussi aux pages (ticket 26).
 */
@Controller('initiatives/:initiativeId')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get('tickets/:ticketId/attachments')
  @RequireInitiativeRole('view')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ): Promise<AttachmentsDto> {
    return this.attachments.list(user.id, initiativeId, { ticketId });
  }

  @Post('tickets/:ticketId/attachments')
  @RequireInitiativeRole('editAttachments')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Query('name') name: unknown,
    @Body() body: unknown,
  ): Promise<AttachmentsDto> {
    // Sans corps, Fastify ne passe pas par l'analyseur : fichier vide.
    const content = body === undefined || body === null ? Buffer.alloc(0) : body;
    if (typeof name !== 'string' || !Buffer.isBuffer(content)) throw new BadRequestException();
    return this.attachments.create(user.id, initiativeId, { ticketId }, name, content);
  }

  /**
   * Contenu d'un fichier, jamais exécuté : une image ou un PDF est servi sous son
   * type, pour s'ouvrir dans l'application ; tout autre format comme une suite
   * d'octets à télécharger. Le navigateur ne devine pas le type (`nosniff`) et le
   * fichier n'a droit à aucun script.
   */
  @Get('attachments/:attachmentId/content')
  @RequireInitiativeRole('view')
  async content(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<StreamableFile> {
    const file = await this.attachments.content(user.id, initiativeId, attachmentId);
    const fallback = file.name.replace(/[^\x20-\x7e]|["\\]/g, '_');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    reply.header('Cache-Control', 'private, no-store');
    return new StreamableFile(file.content, {
      type: file.mime ?? 'application/octet-stream',
      disposition: `${file.mime ? 'inline' : 'attachment'}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      length: file.content.length,
    });
  }

  @Patch('attachments/:attachmentId')
  @RequireInitiativeRole('editAttachments')
  rename(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Body(new ZodValidationPipe(renameAttachmentInputSchema)) body: RenameAttachmentInput,
  ): Promise<AttachmentDto> {
    return this.attachments.rename(user.id, initiativeId, attachmentId, body.baseName);
  }

  /** Renvoie la ligne de trace qui remplace le fichier. */
  @Delete('attachments/:attachmentId')
  @RequireInitiativeRole('editAttachments')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ): Promise<AttachmentDto> {
    return this.attachments.remove(user.id, initiativeId, attachmentId);
  }
}
