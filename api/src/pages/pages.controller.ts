import { Readable } from 'node:stream';
import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import {
  createPageSchema,
  type CreatePageInput,
  declarePageVersionSchema,
  type DeclarePageVersionInput,
  movePageSchema,
  type MovePageInput,
  type PageDto,
  type PageRevisionDto,
  type PageRevisionRow,
  type PageRow,
  updatePageSchema,
  type UpdatePageInput,
  updatePageVersionNoteSchema,
  type UpdatePageVersionNoteInput,
} from '@app/shared';
import { type AuthenticatedUser, CurrentUser } from '../auth/authenticated-user.js';
import { RequireInitiativeRole } from '../initiatives/initiative-role.guard.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { PageSaveStream } from './page-save-stream.js';
import { PagesService } from './pages.service.js';

/**
 * Corps d'un enregistrement avec images : le flux de la requête (main.ts). En cas
 * de refus, le reste du corps est lu et jeté, pour que la réponse parvienne au
 * navigateur qui envoie encore.
 */
async function withSaveStream<T>(body: unknown, save: (stream: PageSaveStream) => Promise<T>): Promise<T> {
  if (!(body instanceof Readable)) throw new BadRequestException();
  try {
    return await save(new PageSaveStream(body));
  } catch (error) {
    body.resume();
    throw error;
  }
}

/** Pages d'une initiative (ticket 22) : tout membre consulte, propriétaires et contributeurs écrivent. */
@Controller('initiatives/:initiativeId/pages')
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Get()
  @RequireInitiativeRole('view')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
  ): Promise<PageRow[]> {
    return this.pages.listTree(user.id, initiativeId);
  }

  @Post()
  @RequireInitiativeRole('editPages')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body(new ZodValidationPipe(createPageSchema)) body: CreatePageInput,
  ): Promise<PageDto> {
    return this.pages.create(user.id, initiativeId, body);
  }

  /**
   * Création avec les fichiers des images insérées dans la saisie (ticket 26) :
   * corps PAGE_SAVE_WITH_IMAGES_TYPE, lu au fil de l'eau (main.ts).
   */
  @Post('with-images')
  @RequireInitiativeRole('editPages')
  createWithImages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body() body: unknown,
  ): Promise<PageDto> {
    return withSaveStream(body, (stream) => this.pages.saveWithImages(user.id, initiativeId, null, stream));
  }

  /** Modification avec les fichiers des images insérées depuis l'ouverture de la saisie (ticket 26). */
  @Patch(':pageId/with-images')
  @RequireInitiativeRole('editPages')
  updateWithImages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() body: unknown,
  ): Promise<PageDto> {
    return withSaveStream(body, (stream) => this.pages.saveWithImages(user.id, initiativeId, pageId, stream));
  }

  @Get(':pageId')
  @RequireInitiativeRole('view')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
  ): Promise<PageDto> {
    return this.pages.get(user.id, initiativeId, pageId);
  }

  @Patch(':pageId')
  @RequireInitiativeRole('editPages')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body(new ZodValidationPipe(updatePageSchema)) body: UpdatePageInput,
  ): Promise<PageDto> {
    return this.pages.update(user.id, initiativeId, pageId, body);
  }

  /** Déplacer ou réordonner ; renvoie l'arborescence. */
  @Put(':pageId/placement')
  @RequireInitiativeRole('editPages')
  move(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body(new ZodValidationPipe(movePageSchema)) body: MovePageInput,
  ): Promise<PageRow[]> {
    return this.pages.move(user.id, initiativeId, pageId, body);
  }

  // ── Enregistrements et versions (ticket 23) ────────────────────────────────

  @Get(':pageId/revisions')
  @RequireInitiativeRole('view')
  listRevisions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
  ): Promise<PageRevisionRow[]> {
    return this.pages.listRevisions(user.id, initiativeId, pageId);
  }

  @Get(':pageId/revisions/:revisionId')
  @RequireInitiativeRole('view')
  getRevision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Param('revisionId', ParseUUIDPipe) revisionId: string,
  ): Promise<PageRevisionDto> {
    return this.pages.getRevision(user.id, initiativeId, pageId, revisionId);
  }

  /** Déclarer après coup un enregistrement comme version ; renvoie l'historique. */
  @Post(':pageId/revisions/:revisionId/version')
  @RequireInitiativeRole('editPages')
  declareVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Param('revisionId', ParseUUIDPipe) revisionId: string,
    @Body(new ZodValidationPipe(declarePageVersionSchema)) body: DeclarePageVersionInput,
  ): Promise<PageRevisionRow[]> {
    return this.pages.declareVersion(user.id, initiativeId, pageId, revisionId, body);
  }

  /** Corriger la note d'une version ; renvoie l'historique. */
  @Patch(':pageId/revisions/:revisionId/version')
  @RequireInitiativeRole('editPages')
  updateVersionNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Param('revisionId', ParseUUIDPipe) revisionId: string,
    @Body(new ZodValidationPipe(updatePageVersionNoteSchema)) body: UpdatePageVersionNoteInput,
  ): Promise<PageRevisionRow[]> {
    return this.pages.updateVersionNote(user.id, initiativeId, pageId, revisionId, body);
  }

  /** Restaurer : nouvel enregistrement, sans version ; renvoie la page. */
  @Post(':pageId/revisions/:revisionId/restore')
  @HttpCode(200)
  @RequireInitiativeRole('editPages')
  restoreRevision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Param('revisionId', ParseUUIDPipe) revisionId: string,
  ): Promise<PageDto> {
    return this.pages.restoreRevision(user.id, initiativeId, pageId, revisionId);
  }

  /** Supprimer un enregistrement, sauf le dernier ; la trace reste. Renvoie l'historique. */
  @Delete(':pageId/revisions/:revisionId')
  @RequireInitiativeRole('editPages')
  deleteRevision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Param('revisionId', ParseUUIDPipe) revisionId: string,
  ): Promise<PageRevisionRow[]> {
    return this.pages.deleteRevision(user.id, initiativeId, pageId, revisionId);
  }

  @Delete(':pageId')
  @HttpCode(204)
  @RequireInitiativeRole('editPages')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
  ): Promise<void> {
    return this.pages.remove(user.id, initiativeId, pageId);
  }
}
