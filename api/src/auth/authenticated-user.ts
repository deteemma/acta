import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

/** Utilisateur extrait d'un jeton OIDC vérifié. */
export interface AuthenticatedUser {
  id: string;
  email: string | null;
  displayName: string | null;
  appRoles: string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

export const IS_PUBLIC = 'isPublic';
/** Route accessible sans jeton. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const APP_ROLES = 'appRoles';
/** Route réservée aux porteurs d'un rôle d'application (ex. « administrateur »). */
export const RequireAppRole = (...roles: string[]) => SetMetadata(APP_ROLES, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const user = ctx.switchToHttp().getRequest<FastifyRequest>().user;
    if (!user) throw new Error('CurrentUser utilisé sur une route publique');
    return user;
  },
);
