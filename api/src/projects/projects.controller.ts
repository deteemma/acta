import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  addMemberSchema,
  createProjectSchema,
  updateProjectSchema,
  type AddMemberInput,
  type CreateProjectInput,
  type ProjectDto,
  type ProjectMemberDto,
  type UpdateProjectInput,
} from '@app/shared';
import { type AuthenticatedUser, CurrentUser } from '../auth/authenticated-user.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { RequireProjectRole } from './project-role.guard.js';
import { ProjectsService } from './projects.service.js';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<ProjectDto[]> {
    return this.projects.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createProjectSchema)) body: CreateProjectInput,
  ): Promise<ProjectDto> {
    return this.projects.create(user.id, body);
  }

  @Get(':projectId')
  @RequireProjectRole('view')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<ProjectDto> {
    return this.projects.get(user.id, projectId);
  }

  @Patch(':projectId')
  @RequireProjectRole('edit')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) body: UpdateProjectInput,
  ): Promise<ProjectDto> {
    return this.projects.update(user.id, projectId, body);
  }

  @Delete(':projectId')
  @HttpCode(204)
  @RequireProjectRole('delete')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<void> {
    return this.projects.remove(user.id, projectId);
  }

  @Get(':projectId/members')
  @RequireProjectRole('view')
  listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<ProjectMemberDto[]> {
    return this.projects.listMembers(user.id, projectId);
  }

  @Post(':projectId/members')
  @HttpCode(204)
  @RequireProjectRole('manageMembers')
  addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(addMemberSchema)) body: AddMemberInput,
  ): Promise<void> {
    return this.projects.addMember(user.id, projectId, body);
  }
}
