import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  createNeedSchema,
  type CreateNeedInput,
  type NeedDto,
  type ReferenceDto,
  updateNeedSchema,
  type UpdateNeedInput,
} from '@app/shared';
import { type AuthenticatedUser, CurrentUser } from '../auth/authenticated-user.js';
import { RequireInitiativeRole } from '../initiatives/initiative-role.guard.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { NeedsService } from './needs.service.js';

/** Besoins d'une initiative (ticket 09) : tout membre consulte, propriétaires et contributeurs écrivent. */
@Controller()
export class NeedsController {
  constructor(private readonly needs: NeedsService) {}

  /** Palette : références de toutes les initiatives dont je suis membre, la RLS limitant le reste. */
  @Get('references')
  listReferences(@CurrentUser() user: AuthenticatedUser): Promise<ReferenceDto[]> {
    return this.needs.listReferences(user.id);
  }

  @Get('initiatives/:initiativeId/needs')
  @RequireInitiativeRole('view')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
  ): Promise<NeedDto[]> {
    return this.needs.listForInitiative(user.id, initiativeId);
  }

  @Post('initiatives/:initiativeId/needs')
  @RequireInitiativeRole('editNeeds')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body(new ZodValidationPipe(createNeedSchema)) body: CreateNeedInput,
  ): Promise<NeedDto> {
    return this.needs.create(user.id, initiativeId, body);
  }

  @Get('initiatives/:initiativeId/needs/:needId')
  @RequireInitiativeRole('view')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('needId', ParseUUIDPipe) needId: string,
  ): Promise<NeedDto> {
    return this.needs.get(user.id, initiativeId, needId);
  }

  @Patch('initiatives/:initiativeId/needs/:needId')
  @RequireInitiativeRole('editNeeds')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('needId', ParseUUIDPipe) needId: string,
    @Body(new ZodValidationPipe(updateNeedSchema)) body: UpdateNeedInput,
  ): Promise<NeedDto> {
    return this.needs.update(user.id, initiativeId, needId, body);
  }

  @Delete('initiatives/:initiativeId/needs/:needId')
  @HttpCode(204)
  @RequireInitiativeRole('editNeeds')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('needId', ParseUUIDPipe) needId: string,
  ): Promise<void> {
    return this.needs.remove(user.id, initiativeId, needId);
  }
}
