import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  type ActionDto,
  createActionSchema,
  type CreateActionInput,
  updateActionSchema,
  type UpdateActionInput,
} from '@app/shared';
import { type AuthenticatedUser, CurrentUser } from '../auth/authenticated-user.js';
import { RequireInitiativeRole } from '../initiatives/initiative-role.guard.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { ActionsService } from './actions.service.js';

/** Actions d'une initiative (ticket 07) : tout membre consulte, propriétaires et contributeurs écrivent. */
@Controller()
export class ActionsController {
  constructor(private readonly actions: ActionsService) {}

  /** « Mes actions » : toutes initiatives confondues, la RLS limitant aux initiatives dont je suis membre. */
  @Get('actions/mine')
  listMine(@CurrentUser() user: AuthenticatedUser): Promise<ActionDto[]> {
    return this.actions.listMine(user.id);
  }

  @Get('initiatives/:initiativeId/actions')
  @RequireInitiativeRole('view')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
  ): Promise<ActionDto[]> {
    return this.actions.listForInitiative(user.id, initiativeId);
  }

  @Post('initiatives/:initiativeId/actions')
  @RequireInitiativeRole('editActions')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body(new ZodValidationPipe(createActionSchema)) body: CreateActionInput,
  ): Promise<ActionDto> {
    return this.actions.create(user.id, initiativeId, body);
  }

  @Get('initiatives/:initiativeId/actions/:actionId')
  @RequireInitiativeRole('view')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('actionId', ParseUUIDPipe) actionId: string,
  ): Promise<ActionDto> {
    return this.actions.get(user.id, initiativeId, actionId);
  }

  @Patch('initiatives/:initiativeId/actions/:actionId')
  @RequireInitiativeRole('editActions')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('actionId', ParseUUIDPipe) actionId: string,
    @Body(new ZodValidationPipe(updateActionSchema)) body: UpdateActionInput,
  ): Promise<ActionDto> {
    return this.actions.update(user.id, initiativeId, actionId, body);
  }

  @Delete('initiatives/:initiativeId/actions/:actionId')
  @HttpCode(204)
  @RequireInitiativeRole('editActions')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('actionId', ParseUUIDPipe) actionId: string,
  ): Promise<void> {
    return this.actions.remove(user.id, initiativeId, actionId);
  }
}
