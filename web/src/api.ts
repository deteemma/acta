import type { CreateInitiativeInput, InitiativeDto } from '@app/shared';
import { accessToken } from './auth';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      // Fastify refuse un corps JSON vide (ex. DELETE) : en-tête seulement si corps.
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${await accessToken()}`,
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`Erreur ${response.status}`);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export const api = {
  listInitiatives: () => request<InitiativeDto[]>('/initiatives'),
  createInitiative: (input: CreateInitiativeInput) =>
    request<InitiativeDto>('/initiatives', { method: 'POST', body: JSON.stringify(input) }),
};
