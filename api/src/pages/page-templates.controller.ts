import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  type AdminPageTemplateDto,
  APP_ADMIN_ROLE,
  type PageTemplateDto,
  type PageTemplateInput,
  pageTemplateInputSchema,
  type TaskPageDto,
  updatePageTemplateSchema,
  type UpdatePageTemplateInput,
} from '@app/shared';
import { type AuthenticatedUser, CurrentUser, RequireAppRole } from '../auth/authenticated-user.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { AdminPageTemplatesService } from './admin-page-templates.service.js';
import { PagesService } from './pages.service.js';

/**
 * Modèles de page (ticket 27) : valables pour toute l'application, consultables par
 * tout utilisateur connecté (guard global) ; créer une page reste réservé aux
 * propriétaires et contributeurs de l'initiative (PagesController).
 */
@Controller()
export class PageTemplatesController {
  constructor(private readonly pages: PagesService) {}

  @Get('page-templates')
  list(@CurrentUser() user: AuthenticatedUser): Promise<PageTemplateDto[]> {
    return this.pages.listTemplates(user.id);
  }

  /** Fiche de la tâche BABOK : les pages créées depuis un modèle de cette tâche, dans mes initiatives. */
  @Get('babok/tasks/:taskId/pages')
  taskPages(@CurrentUser() user: AuthenticatedUser, @Param('taskId') taskId: string): Promise<TaskPageDto[]> {
    return this.pages.listTaskPages(user.id, taskId);
  }
}

/**
 * Administration des modèles de page (ticket 30) : réservée à l'administrateur,
 * sans accès au contenu des initiatives ; chaque route renvoie toute la liste, à jour.
 */
@Controller('admin/page-templates')
@RequireAppRole(APP_ADMIN_ROLE)
export class AdminPageTemplatesController {
  constructor(private readonly templates: AdminPageTemplatesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<AdminPageTemplateDto[]> {
    return this.templates.list(user.id);
  }

  @Post()
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(pageTemplateInputSchema)) body: PageTemplateInput,
  ): Promise<AdminPageTemplateDto[]> {
    return this.templates.add(user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updatePageTemplateSchema)) body: UpdatePageTemplateInput,
  ): Promise<AdminPageTemplateDto[]> {
    return this.templates.update(user.id, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<AdminPageTemplateDto[]> {
    return this.templates.remove(user.id, id);
  }
}
