import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ActionsController } from './actions/actions.controller.js';
import { ActionsService } from './actions/actions.service.js';
import { AdminAttachmentQuotaController } from './attachments/admin-attachment-quota.controller.js';
import { AdminAttachmentQuotaService } from './attachments/admin-attachment-quota.service.js';
import { AttachmentsController } from './attachments/attachments.controller.js';
import { AttachmentsService } from './attachments/attachments.service.js';
import { CommentsController } from './comments/comments.controller.js';
import { CommentsService } from './comments/comments.service.js';
import { LinksController } from './links/links.controller.js';
import { LinksService } from './links/links.service.js';
import { AdminTicketTypesController, TicketTypesController } from './ticket-types/ticket-types.controller.js';
import { TicketTypesService } from './ticket-types/ticket-types.service.js';
import { TicketsController } from './tickets/tickets.controller.js';
import { TicketsService } from './tickets/tickets.service.js';
import { AdminController } from './admin/admin.controller.js';
import { AdminService } from './admin/admin.service.js';
import { ReferenceCategoriesController } from './admin/reference-categories.controller.js';
import { ReferenceCategoriesService } from './admin/reference-categories.service.js';
import { KeycloakAdmin } from './admin/keycloak-admin.service.js';
import { BabokController } from './babok/babok.controller.js';
import { BabokService } from './babok/babok.service.js';
import { AuthGuard } from './auth/auth.guard.js';
import { OidcVerifier } from './auth/oidc-verifier.service.js';
import { AssistantAvailability } from './assistant/assistant-availability.js';
import { AssistantContextService } from './assistant/assistant-context.service.js';
import { DatabaseAssistantQueue } from './assistant/assistant-queue.service.js';
import { AssistantRequestsController } from './assistant/assistant-requests.controller.js';
import { AssistantRequestsService } from './assistant/assistant-requests.service.js';
import { AssistantWorker } from './assistant/assistant-worker.service.js';
import { HermesClient } from './assistant/hermes-client.service.js';
import { AppConfig } from './config/app-config.js';
import { DatabaseService } from './db/database.service.js';
import { HealthController } from './health/health.controller.js';
import { InitiativesController } from './initiatives/initiatives.controller.js';
import { InitiativeRoleGuard } from './initiatives/initiative-role.guard.js';
import { InitiativesService } from './initiatives/initiatives.service.js';
import { NeedsController } from './needs/needs.controller.js';
import { NeedsService } from './needs/needs.service.js';
import { AdminPageTemplatesService } from './pages/admin-page-templates.service.js';
import { AdminPageTemplatesController, PageTemplatesController } from './pages/page-templates.controller.js';
import { PagesController } from './pages/pages.controller.js';
import { PagesService } from './pages/pages.service.js';
import {
  AdminRequirementStatusesController,
  RequirementStatusesController,
} from './requirement-statuses/requirement-statuses.controller.js';
import { RequirementStatusesService } from './requirement-statuses/requirement-statuses.service.js';
import { RequirementsController } from './requirements/requirements.controller.js';
import { RequirementsService } from './requirements/requirements.service.js';
import { FeatureController } from './scenarios/feature.controller.js';
import { ScenariosController } from './scenarios/scenarios.controller.js';
import { ScenariosService } from './scenarios/scenarios.service.js';
import { StakeholdersController } from './stakeholders/stakeholders.controller.js';
import { StakeholdersService } from './stakeholders/stakeholders.service.js';
import { SuggestedActionsController } from './suggested-actions/suggested-actions.controller.js';
import { SuggestedActionsService } from './suggested-actions/suggested-actions.service.js';
import { MeController } from './users/me.controller.js';
import { UsersService } from './users/users.service.js';

@Module({
  controllers: [
    ActionsController,
    AssistantRequestsController,
    LinksController,
    CommentsController,
    AttachmentsController,
    AdminAttachmentQuotaController,
    TicketsController,
    AdminController,
    AdminRequirementStatusesController,
    AdminTicketTypesController,
    BabokController,
    HealthController,
    InitiativesController,
    MeController,
    NeedsController,
    PagesController,
    PageTemplatesController,
    AdminPageTemplatesController,
    ReferenceCategoriesController,
    RequirementStatusesController,
    TicketTypesController,
    RequirementsController,
    ScenariosController,
    FeatureController,
    StakeholdersController,
    SuggestedActionsController,
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
    LinksService,
    CommentsService,
    AttachmentsService,
    AdminAttachmentQuotaService,
    TicketsService,
    StakeholdersService,
    NeedsService,
    PagesService,
    AdminPageTemplatesService,
    ReferenceCategoriesService,
    RequirementStatusesService,
    TicketTypesService,
    RequirementsService,
    ScenariosService,
    SuggestedActionsService,
    HermesClient,
    AssistantContextService,
    AssistantRequestsService,
    AssistantAvailability,
    DatabaseAssistantQueue,
    AssistantWorker,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
