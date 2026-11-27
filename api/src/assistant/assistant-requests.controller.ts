import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  type AssistantRequestDto,
  type CreateAssistantRequest,
  createAssistantRequestSchema,
} from '@app/shared';
import { type AuthenticatedUser, CurrentUser } from '../auth/authenticated-user.js';
import { AppConfig } from '../config/app-config.js';
import { RequireInitiativeRole } from '../initiatives/initiative-role.guard.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { AssistantRequestsService } from './assistant-requests.service.js';

/**
 * Demandes à l'assistant sur une initiative (AS1, AS9, AS40) : tout membre, lecteur
 * et initiative archivée compris, pose une demande et voit les siennes seulement.
 * Sans assistant installé, ces routes n'existent pas (AS25).
 */
@Controller('initiatives/:initiativeId/assistant-requests')
export class AssistantRequestsController {
  constructor(
    private readonly requests: AssistantRequestsService,
    private readonly config: AppConfig,
  ) {}

  @Get()
  @RequireInitiativeRole('viewAssistantRequests')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
  ): Promise<AssistantRequestDto[]> {
    this.requireInstalled();
    return this.requests.list(user.id, initiativeId);
  }

  @Post()
  @RequireInitiativeRole('askAssistant')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body(new ZodValidationPipe(createAssistantRequestSchema)) body: CreateAssistantRequest,
  ): Promise<AssistantRequestDto> {
    this.requireInstalled();
    return this.requests.create(user.id, initiativeId, body);
  }

  /** Annuler sa demande non terminée (AS6) ; seul l'auteur la voit, donc l'annule (AS9). */
  @Post(':requestId/cancel')
  @RequireInitiativeRole('cancelAssistantRequest')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ): Promise<AssistantRequestDto> {
    this.requireInstalled();
    return this.requests.cancel(user.id, initiativeId, requestId);
  }

  private requireInstalled(): void {
    if (!this.config.assistant) throw new NotFoundException();
  }
}
