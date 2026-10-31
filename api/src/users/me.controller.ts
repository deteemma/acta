import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import {
  type MarkAlertsSeenInput,
  markAlertsSeenSchema,
  type MeDto,
  type UpdateMeInput,
  updateMeSchema,
} from '@app/shared';
import { type AuthenticatedUser, CurrentUser } from '../auth/authenticated-user.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { UsersService } from './users.service.js';

/** Compte de l'utilisateur courant (langue d'interface, ADR-0013 ; alertes vues, ticket 15). */
@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<MeDto> {
    return this.users.me(user);
  }

  @Patch()
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateMeSchema)) body: UpdateMeInput,
  ): Promise<MeDto> {
    return this.users.updateMe(user, body);
  }

  /** Ouverture du panneau des alertes (ticket 15). */
  @Put('alerts-seen')
  markAlertsSeen(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(markAlertsSeenSchema)) body: MarkAlertsSeenInput,
  ): Promise<MeDto> {
    return this.users.markAlertsSeen(user, body);
  }
}
