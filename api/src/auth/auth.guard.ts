import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { UsersService } from '../users/users.service.js';
import { APP_ROLES, IS_PUBLIC } from './authenticated-user.js';
import { OidcVerifier } from './oidc-verifier.service.js';

/** Guard global : toute route exige un jeton valide, sauf celles marquées @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: OidcVerifier,
    private readonly users: UsersService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException();

    try {
      request.user = await this.verifier.verify(token);
    } catch {
      throw new UnauthorizedException();
    }
    await this.users.remember(request.user);

    const required = this.reflector.getAllAndOverride<string[] | undefined>(APP_ROLES, targets);
    if (required && !required.some((role) => request.user?.appRoles.includes(role))) {
      throw new ForbiddenException();
    }
    return true;
  }
}
