import type { CreateInitiativeInput, InitiativeDto, UpdateInitiativeInput } from '@app/shared';
import { API_URL } from './config';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function createApi(getToken: () => string) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_URL}/api${path}`, {
      ...init,
      headers: {
        // Fastify refuse un corps JSON vide (ex. DELETE) : en-tête seulement si corps.
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${getToken()}`,
      },
    });
    if (!response.ok) throw new ApiError(response.status, await response.text());
    return (response.status === 204 ? undefined : await response.json()) as T;
  }

  return {
    listInitiatives: () => request<InitiativeDto[]>('/initiatives'),
    createInitiative: (input: CreateInitiativeInput) =>
      request<InitiativeDto>('/initiatives', { method: 'POST', body: JSON.stringify(input) }),
    updateInitiative: (id: string, input: UpdateInitiativeInput) =>
      request<InitiativeDto>(`/initiatives/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    deleteInitiative: (id: string) => request<void>(`/initiatives/${id}`, { method: 'DELETE' }),
  };
}

export type Api = ReturnType<typeof createApi>;
