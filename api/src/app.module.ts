import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard.js';
import { OidcVerifier } from './auth/oidc-verifier.service.js';
import { AppConfig } from './config/app-config.js';
import { DatabaseService } from './db/database.service.js';
import { HealthController } from './health/health.controller.js';
import { ProjectsController } from './projects/projects.controller.js';
import { ProjectRoleGuard } from './projects/project-role.guard.js';
import { ProjectsService } from './projects/projects.service.js';
import { UsersService } from './users/users.service.js';

@Module({
  controllers: [HealthController, ProjectsController],
  providers: [
    { provide: AppConfig, useFactory: () => new AppConfig() },
    DatabaseService,
    OidcVerifier,
    UsersService,
    ProjectsService,
    ProjectRoleGuard,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
