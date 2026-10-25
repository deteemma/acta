// Connexion OIDC (code + PKCE) dans le navigateur du système (ADR-0005).
import {
  exchangeCodeAsync,
  makeRedirectUri,
  useAuthRequest,
  useAutoDiscovery,
} from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { setAccessToken } from './session';

WebBrowser.maybeCompleteAuthSession();

export interface Session {
  accessToken: string;
  expiresAt: number;
}

export function useLogin(issuer: string, clientId: string) {
  const discovery = useAutoDiscovery(issuer);
  // Scheme lu dans app.json (« scheme ») ; exp://… dans Expo Go.
  const redirectUri = makeRedirectUri({ path: 'auth' });
  const [request, response, promptAsync] = useAuthRequest(
    { clientId, redirectUri, scopes: ['openid', 'profile', 'email'], usePKCE: true },
    discovery,
  );
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (response?.type !== 'success' || !discovery || !request?.codeVerifier) return;
    exchangeCodeAsync(
      {
        clientId,
        redirectUri,
        code: response.params.code ?? '',
        extraParams: { code_verifier: request.codeVerifier },
      },
      discovery,
    ).then(
      (token) => {
        setAccessToken(token.accessToken);
        setSession({
          accessToken: token.accessToken,
          expiresAt: Date.now() + (token.expiresIn ?? 300) * 1000,
        });
      },
      (e: unknown) => setError(String(e)),
    );
  }, [response, discovery, request, clientId, redirectUri]);

  return {
    ready: !!request,
    login: () => promptAsync(),
    logout: () => {
      setAccessToken('');
      setSession(null);
    },
    session,
    error,
  };
}
