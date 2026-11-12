import { Controller, Get, Param } from '@nestjs/common';
import type { PageTemplateDto, TaskPageDto } from '@app/shared';
import { type AuthenticatedUser, CurrentUser } from '../auth/authenticated-user.js';
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
