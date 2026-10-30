import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  createStakeholderSchema,
  type CreateStakeholderInput,
  type StakeholderDto,
  updateStakeholderSchema,
  type UpdateStakeholderInput,
} from '@app/shared';
import { type AuthenticatedUser, CurrentUser } from '../auth/authenticated-user.js';
import { RequireInitiativeRole } from '../initiatives/initiative-role.guard.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { StakeholdersService } from './stakeholders.service.js';

/** Parties prenantes d'une initiative (ticket 08) : tout membre consulte, propriétaires et contributeurs écrivent. */
@Controller('initiatives/:initiativeId/stakeholders')
export class StakeholdersController {
  constructor(private readonly stakeholders: StakeholdersService) {}

  @Get()
  @RequireInitiativeRole('view')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
  ): Promise<StakeholderDto[]> {
    return this.stakeholders.listForInitiative(user.id, initiativeId);
  }

  @Post()
  @RequireInitiativeRole('editStakeholders')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body(new ZodValidationPipe(createStakeholderSchema)) body: CreateStakeholderInput,
  ): Promise<StakeholderDto> {
    return this.stakeholders.create(user.id, initiativeId, body);
  }

  @Get(':stakeholderId')
  @RequireInitiativeRole('view')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('stakeholderId', ParseUUIDPipe) stakeholderId: string,
  ): Promise<StakeholderDto> {
    return this.stakeholders.get(user.id, initiativeId, stakeholderId);
  }

  @Patch(':stakeholderId')
  @RequireInitiativeRole('editStakeholders')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('stakeholderId', ParseUUIDPipe) stakeholderId: string,
    @Body(new ZodValidationPipe(updateStakeholderSchema)) body: UpdateStakeholderInput,
  ): Promise<StakeholderDto> {
    return this.stakeholders.update(user.id, initiativeId, stakeholderId, body);
  }

  @Delete(':stakeholderId')
  @HttpCode(204)
  @RequireInitiativeRole('editStakeholders')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('stakeholderId', ParseUUIDPipe) stakeholderId: string,
  ): Promise<void> {
    return this.stakeholders.remove(user.id, initiativeId, stakeholderId);
  }
}
