import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  createNeedLinkSchema,
  type CreateNeedLinkInput,
  createRequirementLinkSchema,
  type CreateRequirementLinkInput,
  createTicketLinkSchema,
  type CreateTicketLinkInput,
  type InitiativeLinksDto,
} from '@app/shared';
import { type AuthenticatedUser, CurrentUser } from '../auth/authenticated-user.js';
import { RequireInitiativeRole } from '../initiatives/initiative-role.guard.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { LinksService } from './links.service.js';

/** Liens d'une initiative (ticket 19) : tout membre consulte, propriétaires et contributeurs créent et retirent. */
@Controller('initiatives/:initiativeId/links')
export class LinksController {
  constructor(private readonly links: LinksService) {}

  @Get()
  @RequireInitiativeRole('view')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
  ): Promise<InitiativeLinksDto> {
    return this.links.list(user.id, initiativeId);
  }

  @Post('tickets')
  @RequireInitiativeRole('editLinks')
  createTicketLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body(new ZodValidationPipe(createTicketLinkSchema)) body: CreateTicketLinkInput,
  ): Promise<InitiativeLinksDto> {
    return this.links.createTicketLink(user.id, initiativeId, body);
  }

  @Delete('tickets/:ticketId/:otherTicketId')
  @HttpCode(204)
  @RequireInitiativeRole('editLinks')
  removeTicketLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Param('otherTicketId', ParseUUIDPipe) otherTicketId: string,
  ): Promise<void> {
    return this.links.removeTicketLink(user.id, initiativeId, ticketId, otherTicketId);
  }

  @Post('needs')
  @RequireInitiativeRole('editLinks')
  createNeedLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body(new ZodValidationPipe(createNeedLinkSchema)) body: CreateNeedLinkInput,
  ): Promise<InitiativeLinksDto> {
    return this.links.createNeedLink(user.id, initiativeId, body);
  }

  @Delete('needs/:ticketId/:needId')
  @HttpCode(204)
  @RequireInitiativeRole('editLinks')
  removeNeedLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Param('needId', ParseUUIDPipe) needId: string,
  ): Promise<void> {
    return this.links.removeNeedLink(user.id, initiativeId, ticketId, needId);
  }

  @Post('requirements')
  @RequireInitiativeRole('editLinks')
  createRequirementLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body(new ZodValidationPipe(createRequirementLinkSchema)) body: CreateRequirementLinkInput,
  ): Promise<InitiativeLinksDto> {
    return this.links.createRequirementLink(user.id, initiativeId, body);
  }

  @Delete('requirements/:ticketId/:requirementId')
  @HttpCode(204)
  @RequireInitiativeRole('editLinks')
  removeRequirementLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
  ): Promise<void> {
    return this.links.removeRequirementLink(user.id, initiativeId, ticketId, requirementId);
  }
}
