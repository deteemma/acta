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
import { can, type InitiativeAction, type InitiativeRole } from '@app/shared';
import type { FastifyRequest } from 'fastify';
import { sql } from 'kysely';
import { DatabaseService } from '../db/database.service.js';

declare module 'fastify' {
  interface FastifyRequest {
    initiativeRole?: InitiativeRole;
  }
}

const INITIATIVE_ACTION = 'initiativeAction';

/**
 * Exige un rôle suffisant sur l’initiative `:initiativeId` pour l'action donnée
 * (propriétaire, contributeur, lecteur — règles dans @app/shared).
 * Première barrière ; la RLS PostgreSQL est la seconde (ADR-0006).
 */
export const RequireInitiativeRole = (action: InitiativeAction) =>
  applyDecorators(SetMetadata(INITIATIVE_ACTION, action), UseGuards(InitiativeRoleGuard));

@Injectable()
export class InitiativeRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly database: DatabaseService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const action = this.reflector.get<InitiativeAction>(INITIATIVE_ACTION, ctx.getHandler());
    const request = ctx.switchToHttp().getRequest<FastifyRequest<{ Params: { initiativeId?: string } }>>();
    const initiativeId = request.params.initiativeId;
    const user = request.user;
    if (!user || !initiativeId) throw new ForbiddenException();

    const role = await this.database.asUser(user.id, async (tx) => {
      const { rows } = await sql<{ role: InitiativeRole | null }>`
        SELECT current_initiative_role(${initiativeId}::uuid) AS role`.execute(tx);
      return rows[0]?.role ?? null;
    });

    // Un non-membre ne doit pas apprendre que l’initiative existe.
    if (!role) throw new NotFoundException();
    if (!can(role, action)) throw new ForbiddenException();
    request.initiativeRole = role;
    return true;
  }
}
