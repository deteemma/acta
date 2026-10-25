import { Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { AppConfig } from '../config/app-config.js';
import type { AuthenticatedUser } from './authenticated-user.js';

interface KeycloakClaims extends JWTPayload {
  email?: string;
  name?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
}

/** Vérifie les jetons OIDC émis par le realm Keycloak de l'application (ADR-0005). */
@Injectable()
export class OidcVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly config: AppConfig) {
    this.jwks = createRemoteJWKSet(new URL(config.oidcJwksUrl));
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    const { payload } = await jwtVerify<KeycloakClaims>(token, this.jwks, {
      issuer: this.config.oidcIssuerUrl,
      audience: this.config.oidcAudience,
    });
    if (!payload.sub) throw new Error('Jeton sans « sub »');
    return {
      id: payload.sub,
      email: payload.email ?? null,
      displayName: payload.name ?? payload.preferred_username ?? null,
      appRoles: payload.realm_access?.roles ?? [],
    };
  }
}
