import type {
  AccountDto,
  ActionDto,
  CreateActionInput,
  UpdateActionInput,
  AddMemberInput,
  BabokDto,
  CreateAccountInput,
  CreateInitiativeInput,
  InitiativeDto,
  InitiativeMemberDto,
  MeDto,
  OrphanInitiativeDto,
  OwnerDesignationDto,
  CreateNeedInput,
  CreateRequirementInput,
  CreateStakeholderInput,
  NeedDto,
  RequirementDto,
  RequirementVersionDto,
  UpdateRequirementInput,
  ReferenceCategory,
  ReferenceCategoryDto,
  ReferenceDto,
  UpdateNeedInput,
  UpdateReferenceCategoryInput,
  StakeholderDto,
  UpdateStakeholderInput,
  UpdateAccountInput,
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
  babok: () => request<BabokDto>('/babok'),
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
  // Actions (ticket 07).
  listMyActions: () => request<ActionDto[]>('/actions/mine'),
  listActions: (id: string) => request<ActionDto[]>(`/initiatives/${id}/actions`),
  getAction: (id: string, actionId: string) => request<ActionDto>(`/initiatives/${id}/actions/${actionId}`),
  createAction: (id: string, input: CreateActionInput) =>
    request<ActionDto>(`/initiatives/${id}/actions`, { method: 'POST', body: JSON.stringify(input) }),
  updateAction: (id: string, actionId: string, input: UpdateActionInput) =>
    request<ActionDto>(`/initiatives/${id}/actions/${actionId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteAction: (id: string, actionId: string) =>
    request<void>(`/initiatives/${id}/actions/${actionId}`, { method: 'DELETE' }),
  // Parties prenantes (ticket 08).
  listStakeholders: (id: string) => request<StakeholderDto[]>(`/initiatives/${id}/stakeholders`),
  createStakeholder: (id: string, input: CreateStakeholderInput) =>
    request<StakeholderDto>(`/initiatives/${id}/stakeholders`, { method: 'POST', body: JSON.stringify(input) }),
  updateStakeholder: (id: string, stakeholderId: string, input: UpdateStakeholderInput) =>
    request<StakeholderDto>(`/initiatives/${id}/stakeholders/${stakeholderId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  deleteStakeholder: (id: string, stakeholderId: string) =>
    request<void>(`/initiatives/${id}/stakeholders/${stakeholderId}`, { method: 'DELETE' }),
  // Besoins et références (ticket 09).
  listReferences: () => request<ReferenceDto[]>('/references'),
  listNeeds: (id: string) => request<NeedDto[]>(`/initiatives/${id}/needs`),
  getNeed: (id: string, needId: string) => request<NeedDto>(`/initiatives/${id}/needs/${needId}`),
  createNeed: (id: string, input: CreateNeedInput) =>
    request<NeedDto>(`/initiatives/${id}/needs`, { method: 'POST', body: JSON.stringify(input) }),
  updateNeed: (id: string, needId: string, input: UpdateNeedInput) =>
    request<NeedDto>(`/initiatives/${id}/needs/${needId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteNeed: (id: string, needId: string) => request<void>(`/initiatives/${id}/needs/${needId}`, { method: 'DELETE' }),
  // Exigences (ticket 10).
  listRequirements: (id: string) => request<RequirementDto[]>(`/initiatives/${id}/requirements`),
  getRequirement: (id: string, requirementId: string) =>
    request<RequirementDto>(`/initiatives/${id}/requirements/${requirementId}`),
  requirementHistory: (id: string, requirementId: string) =>
    request<RequirementVersionDto[]>(`/initiatives/${id}/requirements/${requirementId}/history`),
  createRequirement: (id: string, input: CreateRequirementInput) =>
    request<RequirementDto>(`/initiatives/${id}/requirements`, { method: 'POST', body: JSON.stringify(input) }),
  updateRequirement: (id: string, requirementId: string, input: UpdateRequirementInput) =>
    request<RequirementDto>(`/initiatives/${id}/requirements/${requirementId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  deleteRequirement: (id: string, requirementId: string) =>
    request<void>(`/initiatives/${id}/requirements/${requirementId}`, { method: 'DELETE' }),
  // Administration (rôle administrateur, tickets 05 et 09).
  listReferenceCategories: () => request<ReferenceCategoryDto[]>('/admin/reference-categories'),
  updateReferenceCategory: (category: ReferenceCategory, input: UpdateReferenceCategoryInput) =>
    request<ReferenceCategoryDto[]>(`/admin/reference-categories/${category}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  listAccounts: () => request<AccountDto[]>('/admin/accounts'),
  createAccount: (input: CreateAccountInput) =>
    request<AccountDto>('/admin/accounts', { method: 'POST', body: JSON.stringify(input) }),
  updateAccount: (id: string, input: UpdateAccountInput) =>
    request<AccountDto>(`/admin/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  listOrphanInitiatives: () => request<OrphanInitiativeDto[]>('/admin/orphan-initiatives'),
  designateOwner: (id: string, userId: string) =>
    request<void>(`/admin/orphan-initiatives/${id}/owner-designations`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
};
