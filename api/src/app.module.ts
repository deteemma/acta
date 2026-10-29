import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AdminController } from './admin/admin.controller.js';
import { AdminService } from './admin/admin.service.js';
import { KeycloakAdmin } from './admin/keycloak-admin.service.js';
import { AuthGuard } from './auth/auth.guard.js';
import { OidcVerifier } from './auth/oidc-verifier.service.js';
import { AppConfig } from './config/app-config.js';
import { DatabaseService } from './db/database.service.js';
import { HealthController } from './health/health.controller.js';
import { InitiativesController } from './initiatives/initiatives.controller.js';
import { InitiativeRoleGuard } from './initiatives/initiative-role.guard.js';
import { InitiativesService } from './initiatives/initiatives.service.js';
import { MeController } from './users/me.controller.js';
import { UsersService } from './users/users.service.js';

@Module({
  controllers: [AdminController, HealthController, InitiativesController, MeController],
  providers: [
    { provide: AppConfig, useFactory: () => new AppConfig() },
    DatabaseService,
    OidcVerifier,
    UsersService,
    InitiativesService,
    InitiativeRoleGuard,
    KeycloakAdmin,
    AdminService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
