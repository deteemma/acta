import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  SetMetadata,
  UseGuards,
  applyDecorators,
  createParamDecorator,
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
 * (propriétaire, contributeur, lecteur — règles dans @app/shared), en tenant
 * compte de l'archivage (lecture seule).
 * Première barrière ; la RLS PostgreSQL est la seconde (ADR-0006).
 */
export const RequireInitiativeRole = (action: InitiativeAction) =>
  applyDecorators(SetMetadata(INITIATIVE_ACTION, action), UseGuards(InitiativeRoleGuard));

/** Rôle de l'utilisateur sur l'initiative, établi par `RequireInitiativeRole`. */
export const CurrentInitiativeRole = createParamDecorator((_data: unknown, ctx: ExecutionContext): InitiativeRole => {
  const role = ctx.switchToHttp().getRequest<FastifyRequest>().initiativeRole;
  if (!role) throw new Error('CurrentInitiativeRole utilisé sans RequireInitiativeRole');
  return role;
});

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

    const { role, archived } = await this.database.asUser(user.id, async (tx) => {
      const { rows } = await sql<{ role: InitiativeRole | null; archived: boolean }>`
        SELECT current_initiative_role(${initiativeId}::uuid) AS role,
               initiative_is_archived(${initiativeId}::uuid) AS archived`.execute(tx);
      return { role: rows[0]?.role ?? null, archived: rows[0]?.archived ?? false };
    });

    // Un non-membre ne doit pas apprendre que l’initiative existe.
    if (!role) throw new NotFoundException();
    if (!can(role, action, { archived })) throw new ForbiddenException();
    request.initiativeRole = role;
    return true;
  }
}
