import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import {
  createPageSchema,
  type CreatePageInput,
  movePageSchema,
  type MovePageInput,
  type PageDto,
  type PageRow,
  updatePageSchema,
  type UpdatePageInput,
} from '@app/shared';
import { type AuthenticatedUser, CurrentUser } from '../auth/authenticated-user.js';
import { RequireInitiativeRole } from '../initiatives/initiative-role.guard.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { PagesService } from './pages.service.js';

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
