import type {
  CreateInitiativeInput,
  InitiativeDto,
  InitiativeMemberDto,
  MeDto,
  UpdateInitiativeInput,
  UpdateMeInput,
} from '@app/shared';
import { accessToken } from './auth';

export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

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
  if (!response.ok) throw new ApiError(response.status);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export const api = {
  me: () => request<MeDto>('/me'),
  updateMe: (input: UpdateMeInput) => request<MeDto>('/me', { method: 'PATCH', body: JSON.stringify(input) }),
  listInitiatives: () => request<InitiativeDto[]>('/initiatives'),
  getInitiative: (id: string) => request<InitiativeDto>(`/initiatives/${id}`),
  listMembers: (id: string) => request<InitiativeMemberDto[]>(`/initiatives/${id}/members`),
  createInitiative: (input: CreateInitiativeInput) =>
    request<InitiativeDto>('/initiatives', { method: 'POST', body: JSON.stringify(input) }),
  updateInitiative: (id: string, input: UpdateInitiativeInput) =>
    request<InitiativeDto>(`/initiatives/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  archiveInitiative: (id: string) => request<InitiativeDto>(`/initiatives/${id}/archive`, { method: 'PUT' }),
  unarchiveInitiative: (id: string) => request<InitiativeDto>(`/initiatives/${id}/archive`, { method: 'DELETE' }),
  deleteInitiative: (id: string) => request<void>(`/initiatives/${id}`, { method: 'DELETE' }),
};
