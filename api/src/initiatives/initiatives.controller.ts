import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import {
  type InitiativeRole,
  addMemberSchema,
  createInitiativeSchema,
  updateInitiativeSchema,
  updateMemberSchema,
  type AddMemberInput,
  type CreateInitiativeInput,
  type InitiativeDto,
  type InitiativeMemberDto,
  type OwnerDesignationDto,
  type UpdateInitiativeInput,
  type UpdateMemberInput,
} from '@app/shared';
import { type AuthenticatedUser, CurrentUser } from '../auth/authenticated-user.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { CurrentInitiativeRole, RequireInitiativeRole } from './initiative-role.guard.js';
import { InitiativesService } from './initiatives.service.js';

@Controller('initiatives')
export class InitiativesController {
  constructor(private readonly initiatives: InitiativesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<InitiativeDto[]> {
    return this.initiatives.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createInitiativeSchema)) body: CreateInitiativeInput,
  ): Promise<InitiativeDto> {
    return this.initiatives.create(user.id, body);
  }

  @Get(':initiativeId')
  @RequireInitiativeRole('view')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
  ): Promise<InitiativeDto> {
    return this.initiatives.get(user.id, initiativeId);
  }

  @Patch(':initiativeId')
  @RequireInitiativeRole('edit')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentInitiativeRole() role: InitiativeRole,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body(new ZodValidationPipe(updateInitiativeSchema)) body: UpdateInitiativeInput,
  ): Promise<InitiativeDto> {
    return this.initiatives.update(user.id, role, initiativeId, body);
  }

  @Put(':initiativeId/archive')
  @RequireInitiativeRole('archive')
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
  ): Promise<InitiativeDto> {
    return this.initiatives.setArchived(user.id, initiativeId, true);
  }

  @Delete(':initiativeId/archive')
  @RequireInitiativeRole('archive')
  unarchive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
  ): Promise<InitiativeDto> {
    return this.initiatives.setArchived(user.id, initiativeId, false);
  }

  @Delete(':initiativeId')
  @HttpCode(204)
  @RequireInitiativeRole('delete')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
  ): Promise<void> {
    return this.initiatives.remove(user.id, initiativeId);
  }

  @Get(':initiativeId/members')
  @RequireInitiativeRole('view')
  listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
  ): Promise<InitiativeMemberDto[]> {
    return this.initiatives.listMembers(user.id, initiativeId);
  }

  @Post(':initiativeId/members')
  @HttpCode(204)
  @RequireInitiativeRole('manageMembers')
  addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body(new ZodValidationPipe(addMemberSchema)) body: AddMemberInput,
  ): Promise<void> {
    return this.initiatives.addMember(user.id, initiativeId, body);
  }

  @Patch(':initiativeId/members/:userId')
  @HttpCode(204)
  @RequireInitiativeRole('changeTeam')
  updateMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('userId') memberId: string,
    @Body(new ZodValidationPipe(updateMemberSchema)) body: UpdateMemberInput,
  ): Promise<void> {
    return this.initiatives.updateMember(user.id, initiativeId, memberId, body);
  }

  /** Retirer un membre, ou quitter l'initiative si `userId` est l'utilisateur courant. */
  @Delete(':initiativeId/members/:userId')
  @HttpCode(204)
  @RequireInitiativeRole('changeTeam')
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('userId') memberId: string,
  ): Promise<void> {
    return this.initiatives.removeMember(user.id, initiativeId, memberId);
  }

  @Get(':initiativeId/owner-designations')
  @RequireInitiativeRole('view')
  listOwnerDesignations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
  ): Promise<OwnerDesignationDto[]> {
    return this.initiatives.listOwnerDesignations(user.id, initiativeId);
  }
}
