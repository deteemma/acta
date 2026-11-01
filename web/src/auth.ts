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

export async function login(): Promise<void> {
  if (!manager) throw new Error('initAuth() non appelé');
  await manager.signinRedirect();
}

// Déconnexion volontaire : au retour, l'écran d'accueil d'ACTA s'affiche au
// lieu de renvoyer aussitôt vers Keycloak (refonte du design, ticket 05).
const SIGNED_OUT_KEY = 'acta.signedOut';

export const logout = () => {
  try {
    sessionStorage.setItem(SIGNED_OUT_KEY, 'true');
  } catch {
    // Stockage indisponible : l'accueil renverra vers Keycloak.
  }
  return manager?.signoutRedirect();
};

/**
 * Vrai si l'accueil doit renvoyer directement vers la connexion Keycloak :
 * ni retour de déconnexion volontaire, ni erreur renvoyée par Keycloak (qui
 * ferait boucler). Décidé une seule fois par chargement de la page :
 * l'indication de déconnexion est alors effacée.
 */
let redirectToLogin: boolean | undefined;

export function shouldRedirectToLogin(): boolean {
  redirectToLogin ??= decideRedirectToLogin();
  return redirectToLogin;
}

function decideRedirectToLogin(): boolean {
  let signedOut = false;
  try {
    signedOut = sessionStorage.getItem(SIGNED_OUT_KEY) === 'true';
    sessionStorage.removeItem(SIGNED_OUT_KEY);
  } catch {
    // Stockage indisponible : comme sans déconnexion.
  }
  return !signedOut && !new URLSearchParams(window.location.search).has('error');
}

/** Message d'erreur renvoyé par Keycloak dans l'adresse, s'il y en a un. */
export function loginErrorFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('error_description') ?? params.get('error');
}

export async function accessToken(): Promise<string> {
  const user = await manager?.getUser();
  if (!user || user.expired) throw new Error('Session expirée');
  return user.access_token;
}
