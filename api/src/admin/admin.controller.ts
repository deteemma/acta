import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  APP_ADMIN_ROLE,
  createAccountSchema,
  designateOwnerSchema,
  updateAccountSchema,
  type AccountDto,
  type CreateAccountInput,
  type DesignateOwnerInput,
  type OrphanInitiativeDto,
  type UpdateAccountInput,
} from '@app/shared';
import { type AuthenticatedUser, CurrentUser, RequireAppRole } from '../auth/authenticated-user.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { AdminService } from './admin.service.js';

/** Écrans d'administration des comptes (ticket 05) : réservés au rôle administrateur. */
@Controller('admin')
@RequireAppRole(APP_ADMIN_ROLE)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('accounts')
  listAccounts(): Promise<AccountDto[]> {
    return this.admin.listAccounts();
  }

  @Post('accounts')
  createAccount(@Body(new ZodValidationPipe(createAccountSchema)) body: CreateAccountInput): Promise<AccountDto> {
    return this.admin.createAccount(body);
  }

  /** Activer ou désactiver un compte, donner ou retirer le rôle administrateur. Jamais de suppression. */
  @Patch('accounts/:accountId')
  updateAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body(new ZodValidationPipe(updateAccountSchema)) body: UpdateAccountInput,
  ): Promise<AccountDto> {
    return this.admin.updateAccount(user.id, accountId, body);
  }

  @Get('orphan-initiatives')
  listOrphanInitiatives(@CurrentUser() user: AuthenticatedUser): Promise<OrphanInitiativeDto[]> {
    return this.admin.listOrphanInitiatives(user.id);
  }

  @Post('orphan-initiatives/:initiativeId/owner-designations')
  @HttpCode(204)
  designateOwner(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Body(new ZodValidationPipe(designateOwnerSchema)) body: DesignateOwnerInput,
  ): Promise<void> {
    return this.admin.designateOwner(user.id, initiativeId, body.userId);
  }
}
