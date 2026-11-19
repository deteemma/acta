import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import {
  createScenarioSchema,
  type CreateScenarioInput,
  reorderScenariosSchema,
  type ReorderScenariosInput,
  type ScenarioDto,
  type ScenarioHistoryDto,
  updateScenarioSchema,
  type UpdateScenarioInput,
} from '@app/shared';
import { type AuthenticatedUser, CurrentUser } from '../auth/authenticated-user.js';
import { RequireInitiativeRole } from '../initiatives/initiative-role.guard.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { ScenariosService } from './scenarios.service.js';

/**
 * Scénarios Gherkin d'une exigence (phase 3, tickets 01 et 03) : tout membre
 * consulte, historique compris ; propriétaires et contributeurs écrivent (D17).
 * Le Contexte et la langue (ticket 02) sont sous `…/feature` (FeatureController).
 */
@Controller('initiatives/:initiativeId/requirements/:requirementId/scenarios')
export class ScenariosController {
  constructor(private readonly scenarios: ScenariosService) {}

  @Get()
  @RequireInitiativeRole('view')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
  ): Promise<ScenarioDto[]> {
    return this.scenarios.list(user.id, initiativeId, requirementId);
  }

  @Post()
  @RequireInitiativeRole('editScenarios')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Body(new ZodValidationPipe(createScenarioSchema)) body: CreateScenarioInput,
  ): Promise<ScenarioDto> {
    return this.scenarios.create(user.id, initiativeId, requirementId, body);
  }

  @Put('order')
  @RequireInitiativeRole('editScenarios')
  reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Body(new ZodValidationPipe(reorderScenariosSchema)) body: ReorderScenariosInput,
  ): Promise<ScenarioDto[]> {
    return this.scenarios.reorder(user.id, initiativeId, requirementId, body);
  }

  @Patch(':scenarioId')
  @RequireInitiativeRole('editScenarios')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Param('scenarioId', ParseUUIDPipe) scenarioId: string,
    @Body(new ZodValidationPipe(updateScenarioSchema)) body: UpdateScenarioInput,
  ): Promise<ScenarioDto> {
    return this.scenarios.update(user.id, initiativeId, requirementId, scenarioId, body);
  }

  /** Historique propre au scénario, consultable par tout membre (D13). */
  @Get(':scenarioId/history')
  @RequireInitiativeRole('view')
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Param('scenarioId', ParseUUIDPipe) scenarioId: string,
  ): Promise<ScenarioHistoryDto> {
    return this.scenarios.history(user.id, initiativeId, requirementId, scenarioId);
  }

  @Delete(':scenarioId')
  @HttpCode(204)
  @RequireInitiativeRole('editScenarios')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('initiativeId', ParseUUIDPipe) initiativeId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @Param('scenarioId', ParseUUIDPipe) scenarioId: string,
  ): Promise<void> {
    return this.scenarios.remove(user.id, initiativeId, requirementId, scenarioId);
  }
}
