// Connexion OIDC (code + PKCE) au realm Keycloak de l'application (ADR-0005).
import type { PublicConfigDto } from '@app/shared';
import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';

let manager: UserManager | null = null;

export async function initAuth(): Promise<UserManager> {
  const config = (await (await fetch('/api/config')).json()) as PublicConfigDto;
  manager = new UserManager({
    authority: config.oidcIssuerUrl,
    client_id: config.webClientId,
    redirect_uri: `${window.location.origin}/`,
    post_logout_redirect_uri: `${window.location.origin}/`,
    scope: 'openid profile email',
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    automaticSilentRenew: true,
  });
  return manager;
}

/** Termine la connexion au retour de Keycloak, puis renvoie l'utilisateur connecté. */
export async function currentUser(): Promise<User | null> {
  if (!manager) throw new Error('initAuth() non appelé');
  const params = new URLSearchParams(window.location.search);
  if (params.has('code') && params.has('state')) {
    const user = await manager.signinRedirectCallback();
    window.history.replaceState({}, '', '/');
    return user;
  }
  const user = await manager.getUser();
  return user && !user.expired ? user : null;
}

export const login = () => manager?.signinRedirect();
export const logout = () => manager?.signoutRedirect();

export async function accessToken(): Promise<string> {
  const user = await manager?.getUser();
  if (!user || user.expired) throw new Error('Session expirée');
  return user.access_token;
}
