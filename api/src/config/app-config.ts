// Le module ne connaît le socle que par ses variables d'environnement (ADR-0007).
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  PUBLIC_URL: z.url(),
  OIDC_ISSUER_URL: z.url(),
  // Adresse interne des clés de Keycloak ; par défaut, celle de l'émetteur.
  OIDC_JWKS_URL: z.url().optional(),
  OIDC_AUDIENCE: z.string().min(1).default('api'),
  WEB_DIST_DIR: z.string().optional(),
  COMPOSE_PROFILES: z.string().default(''),
});

export class AppConfig {
  readonly port: number;
  readonly databaseUrl: string;
  readonly publicUrl: string;
  readonly oidcIssuerUrl: string;
  readonly oidcJwksUrl: string;
  readonly oidcAudience: string;
  readonly webDistDir: string | undefined;
  readonly offlineMobile: boolean;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    const parsed = envSchema.parse(env);
    this.port = parsed.PORT;
    this.databaseUrl = parsed.DATABASE_URL;
    this.publicUrl = parsed.PUBLIC_URL.replace(/\/$/, '');
    this.oidcIssuerUrl = parsed.OIDC_ISSUER_URL.replace(/\/$/, '');
    this.oidcJwksUrl =
      parsed.OIDC_JWKS_URL ?? `${this.oidcIssuerUrl}/protocol/openid-connect/certs`;
    this.oidcAudience = parsed.OIDC_AUDIENCE;
    this.webDistDir = parsed.WEB_DIST_DIR;
    this.offlineMobile = parsed.COMPOSE_PROFILES.split(',').includes('mobile-hors-ligne');
  }
}
