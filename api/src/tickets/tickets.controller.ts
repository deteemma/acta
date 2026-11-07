import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  createTicketSchema,
  type CreateTicketInput,
  type TicketDto,
  type TicketRow,
  type TicketVersionDto,
  updateTicketSchema,
  type UpdateTicketInput,
} from '@app/shared';
import { type AuthenticatedUser, CurrentUser } from '../auth/authenticated-user.js';
import { RequireInitiativeRole } from '../initiatives/initiative-role.guard.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { TicketsService } from './tickets.service.js';

/** Tickets d'une initiative (ticket 18) : mêmes droits que l'action, pour tous les types. */
@Controller('initiatives/:initiativeId/tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  @RequireInitiativeRole('view')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
  ): Promise<TicketRow[]> {
    return this.tickets.list(user.id, initiativeId);
  }

  @Post()
  @RequireInitiativeRole('editActions')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body(new ZodValidationPipe(createTicketSchema)) body: CreateTicketInput,
  ): Promise<TicketDto> {
    return this.tickets.create(user.id, initiativeId, body);
  }

  @Get(':ticketId')
  @RequireInitiativeRole('view')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ): Promise<TicketDto> {
    return this.tickets.get(user.id, initiativeId, ticketId);
  }

  /** Historique : tout membre le consulte, y compris sur une initiative archivée. */
  @Get(':ticketId/history')
  @RequireInitiativeRole('view')
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ): Promise<TicketVersionDto[]> {
    return this.tickets.history(user.id, initiativeId, ticketId);
  }

  @Patch(':ticketId')
  @RequireInitiativeRole('editActions')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body(new ZodValidationPipe(updateTicketSchema)) body: UpdateTicketInput,
  ): Promise<TicketDto> {
    return this.tickets.update(user.id, initiativeId, ticketId, body);
  }

  @Delete(':ticketId')
  @HttpCode(204)
  @RequireInitiativeRole('editActions')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ): Promise<void> {
    return this.tickets.remove(user.id, initiativeId, ticketId);
  }
}
