import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { APP_ADMIN_ROLE, type AccountDto, type CreateAccountInput } from '@app/shared';
import { AppConfig, type KeycloakAdminConfig } from '../config/app-config.js';

interface KeycloakUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  createdTimestamp?: number;
}

interface KeycloakRole {
  id: string;
  name: string;
}

/** Comptes lus par page : le realm d'une application en compte peu. */
const PAGE_SIZE = 100;
/** Marge avant l'expiration du jeton du compte technique. */
const TOKEN_MARGIN_MS = 30_000;

/**
 * Pilote les comptes du realm de l'application par l'API d'administration de
 * Keycloak (ADR-0005), avec le compte technique « api-admin » (keycloak/realm.json).
 * Aucun compte n'est jamais supprimé : cette classe n'en offre pas le moyen.
 */
@Injectable()
export class KeycloakAdmin {
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: AppConfig) {}

  async listAccounts(): Promise<AccountDto[]> {
    const [users, adminIds] = await Promise.all([
      this.paged<KeycloakUser>('/users?briefRepresentation=false'),
      this.paged<KeycloakUser>(`/roles/${APP_ADMIN_ROLE}/users?briefRepresentation=true`).then(
        (admins) => new Set(admins.map((u) => u.id)),
      ),
    ]);
    return users.map((u) => toAccount(u, adminIds.has(u.id)));
  }

  async getAccount(id: string): Promise<AccountDto> {
    const [user, roles] = await Promise.all([
      this.request<KeycloakUser>(`/users/${encodeURIComponent(id)}`),
      this.request<KeycloakRole[]>(`/users/${encodeURIComponent(id)}/role-mappings/realm`),
    ]);
    return toAccount(user, roles.some((r) => r.name === APP_ADMIN_ROLE));
  }

  /** Crée un compte actif avec un mot de passe temporaire ; renvoie son identifiant. */
  async createAccount(input: CreateAccountInput): Promise<string> {
    const response = await this.send('/users', {
      method: 'POST',
      body: JSON.stringify({
        username: input.username,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        enabled: true,
        credentials: [{ type: 'password', value: input.temporaryPassword, temporary: true }],
      }),
    });
    // Identifiant ou courriel déjà utilisé.
    if (response.status === 409) throw new ConflictException({ statusCode: 409, refusal: 'accountExists' });
    // Saisie refusée par Keycloak (ex. politique de mot de passe du realm).
    if (response.status === 400) throw new BadRequestException();
    await ensureOk(response);
    const id = response.headers.get('location')?.split('/').pop();
    if (!id) throw new Error('Keycloak n’a pas renvoyé l’identifiant du compte créé');
    return id;
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const path = `/users/${encodeURIComponent(id)}`;
    // Représentation complète : avec le profil utilisateur de Keycloak, un champ
    // absent d'un PUT peut être effacé.
    const user = await this.request<KeycloakUser>(path);
    await this.request(path, { method: 'PUT', body: JSON.stringify({ ...user, enabled }) });
  }

  /** Ferme les sessions ouvertes du compte. */
  async logout(id: string): Promise<void> {
    await this.request(`/users/${encodeURIComponent(id)}/logout`, { method: 'POST' });
  }

  async setAdmin(id: string, isAdmin: boolean): Promise<void> {
    const role = await this.request<KeycloakRole>(`/roles/${APP_ADMIN_ROLE}`);
    await this.request(`/users/${encodeURIComponent(id)}/role-mappings/realm`, {
      method: isAdmin ? 'POST' : 'DELETE',
      body: JSON.stringify([{ id: role.id, name: role.name }]),
    });
  }

  private async paged<T>(path: string): Promise<T[]> {
    const all: T[] = [];
    const separator = path.includes('?') ? '&' : '?';
    for (let first = 0; ; first += PAGE_SIZE) {
      const page = await this.request<T[]>(`${path}${separator}first=${first}&max=${PAGE_SIZE}`);
      all.push(...page);
      if (page.length < PAGE_SIZE) return all;
    }
  }

  private async request<T = void>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.send(path, init);
    await ensureOk(response);
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  private async send(path: string, init: RequestInit): Promise<Response> {
    const config = this.adminConfig();
    return fetch(`${config.adminUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${await this.accessToken(config)}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  }

  /** Jeton du compte technique (client_credentials), gardé jusqu'à peu avant son expiration. */
  private async accessToken(config: KeycloakAdminConfig): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt) return this.token.value;
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
    await ensureOk(response);
    const { access_token, expires_in } = (await response.json()) as { access_token: string; expires_in: number };
    this.token = { value: access_token, expiresAt: Date.now() + expires_in * 1000 - TOKEN_MARGIN_MS };
    return access_token;
  }

  private adminConfig(): KeycloakAdminConfig {
    // Secret absent de .env : le socle n'a pas encore appliqué le realm à jour.
    if (!this.config.keycloakAdmin) throw new ServiceUnavailableException();
    return this.config.keycloakAdmin;
  }
}

async function ensureOk(response: Response): Promise<void> {
  if (response.ok) return;
  if (response.status === 404) throw new NotFoundException();
  throw new Error(`Keycloak : HTTP ${response.status} ${await response.text()}`);
}

function toAccount(user: KeycloakUser, isAdmin: boolean): AccountDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email ?? null,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    enabled: user.enabled,
    isAdmin,
    createdAt: user.createdTimestamp ? new Date(user.createdTimestamp).toISOString() : null,
  };
}
