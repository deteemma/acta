import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  createRequirementSchema,
  type CreateRequirementInput,
  type RequirementDto,
  type RequirementVersionDto,
  updateRequirementSchema,
  type UpdateRequirementInput,
} from '@app/shared';
import { type AuthenticatedUser, CurrentUser } from '../auth/authenticated-user.js';
import { RequireInitiativeRole } from '../initiatives/initiative-role.guard.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { RequirementsService } from './requirements.service.js';

/** Exigences d'une initiative (ticket 10) : tout membre consulte, propriétaires et contributeurs écrivent. */
@Controller('initiatives/:initiativeId/requirements')
export class RequirementsController {
  constructor(private readonly requirements: RequirementsService) {}

  @Get()
  @RequireInitiativeRole('view')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
  ): Promise<RequirementDto[]> {
    return this.requirements.listForInitiative(user.id, initiativeId);
  }

  @Post()
  @RequireInitiativeRole('editRequirements')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body(new ZodValidationPipe(createRequirementSchema)) body: CreateRequirementInput,
  ): Promise<RequirementDto> {
    return this.requirements.create(user.id, initiativeId, body);
  }

  @Get(':requirementId')
  @RequireInitiativeRole('view')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
  ): Promise<RequirementDto> {
    return this.requirements.get(user.id, initiativeId, requirementId);
  }

  @Get(':requirementId/history')
  @RequireInitiativeRole('view')
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
  ): Promise<RequirementVersionDto[]> {
    return this.requirements.history(user.id, initiativeId, requirementId);
  }

  @Patch(':requirementId')
  @RequireInitiativeRole('editRequirements')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Body(new ZodValidationPipe(updateRequirementSchema)) body: UpdateRequirementInput,
  ): Promise<RequirementDto> {
    return this.requirements.update(user.id, initiativeId, requirementId, body);
  }

  @Delete(':requirementId')
  @HttpCode(204)
  @RequireInitiativeRole('editRequirements')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
  ): Promise<void> {
    return this.requirements.remove(user.id, initiativeId, requirementId);
  }
}
