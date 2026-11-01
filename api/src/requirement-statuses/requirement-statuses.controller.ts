import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  type AdminRequirementStatusDto,
  APP_ADMIN_ROLE,
  createRequirementStatusSchema,
  type CreateRequirementStatusInput,
  type RequirementStatusDto,
  updateRequirementStatusSchema,
  type UpdateRequirementStatusInput,
} from '@app/shared';
import { type AuthenticatedUser, CurrentUser, RequireAppRole } from '../auth/authenticated-user.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { RequirementStatusesService } from './requirement-statuses.service.js';

/** Statuts d'exigence (ticket 11) : consultables par tout utilisateur connecté (guard global). */
@Controller('requirement-statuses')
export class RequirementStatusesController {
  constructor(private readonly statuses: RequirementStatusesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<RequirementStatusDto[]> {
    return this.statuses.list(user.id);
  }
}

/** Statuts d'exigence (ticket 11) : complétés par l'administration ; chaque route renvoie toute la liste, à jour. */
@Controller('admin/requirement-statuses')
@RequireAppRole(APP_ADMIN_ROLE)
export class AdminRequirementStatusesController {
  constructor(private readonly statuses: RequirementStatusesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<AdminRequirementStatusDto[]> {
    return this.statuses.adminList(user.id);
  }

  @Post()
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createRequirementStatusSchema)) body: CreateRequirementStatusInput,
  ): Promise<AdminRequirementStatusDto[]> {
    return this.statuses.add(user.id, body);
  }

  @Patch(':code')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
    @Body(new ZodValidationPipe(updateRequirementStatusSchema)) body: UpdateRequirementStatusInput,
  ): Promise<AdminRequirementStatusDto[]> {
    return this.statuses.update(user.id, code, body);
  }

  @Delete(':code')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('code') code: string): Promise<AdminRequirementStatusDto[]> {
    return this.statuses.remove(user.id, code);
  }
}
