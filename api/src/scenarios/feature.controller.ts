import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import {
  type FeatureDto,
  saveBackgroundSchema,
  type SaveBackgroundInput,
  setFeatureLanguageSchema,
  type SetFeatureLanguageInput,
} from '@app/shared';
import { type AuthenticatedUser, CurrentUser } from '../auth/authenticated-user.js';
import { RequireInitiativeRole } from '../initiatives/initiative-role.guard.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { ScenariosService } from './scenarios.service.js';

/**
 * Fonctionnalité d'une exigence (phase 3, ticket 02) : sa langue et son Contexte.
 * Tout membre consulte ; propriétaires et contributeurs écrivent le Contexte et
 * changent la langue (D17). L'historique du Contexte (ticket 03) prendra place
 * sous `…/feature/background/history`.
 */
@Controller('initiatives/:initiativeId/requirements/:requirementId/feature')
export class FeatureController {
  constructor(private readonly scenarios: ScenariosService) {}

  @Get()
  @RequireInitiativeRole('view')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
  ): Promise<FeatureDto> {
    return this.scenarios.feature(user.id, initiativeId, requirementId);
  }

  @Put('language')
  @RequireInitiativeRole('editScenarios')
  setLanguage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Body(new ZodValidationPipe(setFeatureLanguageSchema)) body: SetFeatureLanguageInput,
  ): Promise<FeatureDto> {
    return this.scenarios.setLanguage(user.id, initiativeId, requirementId, body);
  }

  @Put('background')
  @RequireInitiativeRole('editScenarios')
  saveBackground(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Body(new ZodValidationPipe(saveBackgroundSchema)) body: SaveBackgroundInput,
  ): Promise<FeatureDto> {
    return this.scenarios.saveBackground(user.id, initiativeId, requirementId, body);
  }

  @Delete('background')
  @HttpCode(204)
  @RequireInitiativeRole('editScenarios')
  removeBackground(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
  ): Promise<void> {
    return this.scenarios.removeBackground(user.id, initiativeId, requirementId);
  }
}
