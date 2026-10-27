import type {
  AddMemberInput,
  CreateInitiativeInput,
  InitiativeDto,
  InitiativeMemberDto,
  MeDto,
  OwnerDesignationDto,
  UpdateInitiativeInput,
  UpdateMeInput,
  UpdateMemberInput,
} from '@app/shared';
import { accessToken } from './auth';

export class ApiError extends Error {
  /** Motif de refus renvoyé par l'API (ex. règles d'équipe : `lastOwner`). */
  constructor(
    readonly status: number,
    readonly refusal?: string,
  ) {
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
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { refusal?: unknown } | null;
    throw new ApiError(response.status, typeof body?.refusal === 'string' ? body.refusal : undefined);
  }
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
  addMember: (id: string, input: AddMemberInput) =>
    request<void>(`/initiatives/${id}/members`, { method: 'POST', body: JSON.stringify(input) }),
  updateMember: (id: string, userId: string, input: UpdateMemberInput) =>
    request<void>(`/initiatives/${id}/members/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  removeMember: (id: string, userId: string) =>
    request<void>(`/initiatives/${id}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
  listOwnerDesignations: (id: string) => request<OwnerDesignationDto[]>(`/initiatives/${id}/owner-designations`),
};
