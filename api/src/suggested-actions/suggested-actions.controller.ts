import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { type SuggestedAction, suggestionKeySchema } from '@app/shared';
import { type AuthenticatedUser, CurrentUser } from '../auth/authenticated-user.js';
import { RequireInitiativeRole } from '../initiatives/initiative-role.guard.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { SuggestedActionsService } from './suggested-actions.service.js';

/**
 * Encart « Actions suggérées » (ticket 14) : tout membre le consulte (G3) ;
 * propriétaires et contributeurs écartent une suggestion. La création passe
 * par la route de création d'une action, avec `suggestionKey`.
 */
@Controller('initiatives/:initiativeId/suggested-actions')
export class SuggestedActionsController {
  constructor(private readonly suggestedActions: SuggestedActionsService) {}

  @Get()
  @RequireInitiativeRole('view')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
  ): Promise<SuggestedAction[]> {
    return this.suggestedActions.list(user.id, initiativeId);
  }

  @Put(':suggestionKey/dismissal')
  @HttpCode(204)
  @RequireInitiativeRole('dismissSuggestedActions')
  dismiss(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('suggestionKey', new ZodValidationPipe(suggestionKeySchema)) suggestionKey: string,
  ): Promise<void> {
    return this.suggestedActions.dismiss(user.id, initiativeId, suggestionKey);
  }
}
