import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  SetMetadata,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { can, type ProjectAction, type ProjectRole } from '@app/shared';
import type { FastifyRequest } from 'fastify';
import { sql } from 'kysely';
import { DatabaseService } from '../db/database.service.js';

declare module 'fastify' {
  interface FastifyRequest {
    projectRole?: ProjectRole;
  }
}

const PROJECT_ACTION = 'projectAction';

/**
 * Exige un rôle suffisant sur le projet `:projectId` pour l'action donnée
 * (propriétaire, contributeur, lecteur — règles dans @app/shared).
 * Première barrière ; la RLS PostgreSQL est la seconde (ADR-0006).
 */
export const RequireProjectRole = (action: ProjectAction) =>
  applyDecorators(SetMetadata(PROJECT_ACTION, action), UseGuards(ProjectRoleGuard));

@Injectable()
export class ProjectRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly database: DatabaseService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const action = this.reflector.get<ProjectAction>(PROJECT_ACTION, ctx.getHandler());
    const request = ctx.switchToHttp().getRequest<FastifyRequest<{ Params: { projectId?: string } }>>();
    const projectId = request.params.projectId;
    const user = request.user;
    if (!user || !projectId) throw new ForbiddenException();

    const role = await this.database.asUser(user.id, async (tx) => {
      const { rows } = await sql<{ role: ProjectRole | null }>`
        SELECT current_project_role(${projectId}::uuid) AS role`.execute(tx);
      return rows[0]?.role ?? null;
    });

    // Un non-membre ne doit pas apprendre que le projet existe.
    if (!role) throw new NotFoundException();
    if (!can(role, action)) throw new ForbiddenException();
    request.projectRole = role;
    return true;
  }
}
