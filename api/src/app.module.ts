import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ActionsController } from './actions/actions.controller.js';
import { ActionsService } from './actions/actions.service.js';
import { AdminController } from './admin/admin.controller.js';
import { AdminService } from './admin/admin.service.js';
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
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
