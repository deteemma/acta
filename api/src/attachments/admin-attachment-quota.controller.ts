import { Body, Controller, Get, Put } from '@nestjs/common';
import {
  APP_ADMIN_ROLE,
  type AttachmentQuotaDto,
  type AttachmentQuotaInput,
  attachmentQuotaInputSchema,
} from '@app/shared';
import { type AuthenticatedUser, CurrentUser, RequireAppRole } from '../auth/authenticated-user.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { AdminAttachmentQuotaService } from './admin-attachment-quota.service.js';

/**
 * Limite de pièces jointes par initiative (ticket 31) : réservée à
 * l'administrateur ; une valeur hors des bornes est refusée (400).
 */
@Controller('admin/attachment-quota')
@RequireAppRole(APP_ADMIN_ROLE)
export class AdminAttachmentQuotaController {
  constructor(private readonly quota: AdminAttachmentQuotaService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<AttachmentQuotaDto> {
    return this.quota.get(user.id);
  }

  @Put()
  set(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(attachmentQuotaInputSchema)) body: AttachmentQuotaInput,
  ): Promise<AttachmentQuotaDto> {
    return this.quota.set(user.id, body.quotaMb);
  }
}
