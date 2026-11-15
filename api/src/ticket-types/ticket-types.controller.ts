import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  type AdminTicketTypeDto,
  APP_ADMIN_ROLE,
  createTicketStatusSchema,
  type CreateTicketStatusInput,
  createTicketTypeSchema,
  type CreateTicketTypeInput,
  type TicketTypeDto,
  updateTicketStatusSchema,
  type UpdateTicketStatusInput,
  updateTicketTypeSchema,
  type UpdateTicketTypeInput,
} from '@app/shared';
import { type AuthenticatedUser, CurrentUser, RequireAppRole } from '../auth/authenticated-user.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { TicketTypesService } from './ticket-types.service.js';

/** Types de ticket et leurs statuts (ticket 29) : consultables par tout utilisateur connecté (guard global). */
@Controller('ticket-types')
export class TicketTypesController {
  constructor(private readonly types: TicketTypesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<TicketTypeDto[]> {
    return this.types.list(user.id);
  }
}

/**
 * Types de ticket et leurs statuts (ticket 29) : complétés par l'administration,
 * sans accès au contenu des initiatives ; chaque route renvoie toute la liste, à jour.
 */
@Controller('admin/ticket-types')
@RequireAppRole(APP_ADMIN_ROLE)
export class AdminTicketTypesController {
  constructor(private readonly types: TicketTypesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<AdminTicketTypeDto[]> {
    return this.types.adminList(user.id);
  }

  @Post()
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createTicketTypeSchema)) body: CreateTicketTypeInput,
  ): Promise<AdminTicketTypeDto[]> {
    return this.types.add(user.id, body);
  }

  @Patch(':type')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('type') type: string,
    @Body(new ZodValidationPipe(updateTicketTypeSchema)) body: UpdateTicketTypeInput,
  ): Promise<AdminTicketTypeDto[]> {
    return this.types.update(user.id, type, body);
  }

  @Delete(':type')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('type') type: string): Promise<AdminTicketTypeDto[]> {
    return this.types.remove(user.id, type);
  }

  @Post(':type/statuses')
  addStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('type') type: string,
    @Body(new ZodValidationPipe(createTicketStatusSchema)) body: CreateTicketStatusInput,
  ): Promise<AdminTicketTypeDto[]> {
    return this.types.addStatus(user.id, type, body);
  }

  @Patch(':type/statuses/:status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('type') type: string,
    @Param('status') status: string,
    @Body(new ZodValidationPipe(updateTicketStatusSchema)) body: UpdateTicketStatusInput,
  ): Promise<AdminTicketTypeDto[]> {
    return this.types.updateStatus(user.id, type, status, body);
  }

  @Delete(':type/statuses/:status')
  removeStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('type') type: string,
    @Param('status') status: string,
  ): Promise<AdminTicketTypeDto[]> {
    return this.types.removeStatus(user.id, type, status);
  }
}
