import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ActionsController } from './actions/actions.controller.js';
import { ActionsService } from './actions/actions.service.js';
import { AdminController } from './admin/admin.controller.js';
import { AdminService } from './admin/admin.service.js';
import { ReferenceCategoriesController } from './admin/reference-categories.controller.js';
import { ReferenceCategoriesService } from './admin/reference-categories.service.js';
import { KeycloakAdmin } from './admin/keycloak-admin.service.js';
import { BabokController } from './babok/babok.controller.js';
import { BabokService } from './babok/babok.service.js';
import { AuthGuard } from './auth/auth.guard.js';
import { OidcVerifier } from './auth/oidc-verifier.service.js';
import { AppConfig } from './config/app-config.js';
import { DatabaseService } from './db/database.service.js';
import { HealthController } from './health/health.controller.js';
import { InitiativesController } from './initiatives/initiatives.controller.js';
import { InitiativeRoleGuard } from './initiatives/initiative-role.guard.js';
import { InitiativesService } from './initiatives/initiatives.service.js';
import { NeedsController } from './needs/needs.controller.js';
import { NeedsService } from './needs/needs.service.js';
import { RequirementsController } from './requirements/requirements.controller.js';
import { RequirementsService } from './requirements/requirements.service.js';
import { StakeholdersController } from './stakeholders/stakeholders.controller.js';
import { StakeholdersService } from './stakeholders/stakeholders.service.js';
import { MeController } from './users/me.controller.js';
import { UsersService } from './users/users.service.js';

@Module({
  controllers: [
    ActionsController,
    AdminController,
    BabokController,
    HealthController,
    InitiativesController,
    MeController,
    NeedsController,
    ReferenceCategoriesController,
    RequirementsController,
    StakeholdersController,
  ],
  providers: [
    { provide: AppConfig, useFactory: () => new AppConfig() },
    DatabaseService,
    OidcVerifier,
    UsersService,
    InitiativesService,
    InitiativeRoleGuard,
    KeycloakAdmin,
    AdminService,
    BabokService,
    ActionsService,
    StakeholdersService,
    NeedsService,
    ReferenceCategoriesService,
    RequirementsService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
