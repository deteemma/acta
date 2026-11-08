import type {
  AccountDto,
  ActionDto,
  CreateTicketInput,
  CreatePageInput,
  MovePageInput,
  PageDto,
  PageRow,
  UpdatePageInput,
  TicketDto,
  TicketRow,
  TicketVersionDto,
  UpdateTicketInput,
  AdminRequirementStatusDto,
  CreateActionInput,
  UpdateActionInput,
  AddMemberInput,
  BabokDto,
  CreateAccountInput,
  CreateInitiativeInput,
  InitiativeDto,
  InitiativeMemberDto,
  MarkAlertsSeenInput,
  MeDto,
  OrphanInitiativeDto,
  OwnerDesignationDto,
  CreateNeedInput,
  CreateRequirementInput,
  CreateRequirementStatusInput,
  CreateStakeholderInput,
  NeedDto,
  RequirementDto,
  RequirementStatusDto,
  RequirementVersionDto,
  UpdateRequirementInput,
  UpdateRequirementStatusInput,
  ReferenceCategory,
  ReferenceCategoryDto,
  ReferenceDto,
  TechniqueCounts,
  UpdateNeedInput,
  UpdateReferenceCategoryInput,
  StakeholderDto,
  SuggestedAction,
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
  markAlertsSeen: (input: MarkAlertsSeenInput) =>
    request<MeDto>('/me/alerts-seen', { method: 'PUT', body: JSON.stringify(input) }),
  babok: () => request<BabokDto>('/babok'),
  techniqueUsage: () => request<TechniqueCounts>('/babok/technique-usage'),
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
  // Pages (ticket 22).
  listPages: (id: string) => request<PageRow[]>(`/initiatives/${id}/pages`),
  getPage: (id: string, pageId: string) => request<PageDto>(`/initiatives/${id}/pages/${pageId}`),
  createPage: (id: string, input: CreatePageInput) =>
    request<PageDto>(`/initiatives/${id}/pages`, { method: 'POST', body: JSON.stringify(input) }),
  updatePage: (id: string, pageId: string, input: UpdatePageInput) =>
    request<PageDto>(`/initiatives/${id}/pages/${pageId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  movePage: (id: string, pageId: string, input: MovePageInput) =>
    request<PageRow[]>(`/initiatives/${id}/pages/${pageId}/placement`, { method: 'PUT', body: JSON.stringify(input) }),
  deletePage: (id: string, pageId: string) => request<void>(`/initiatives/${id}/pages/${pageId}`, { method: 'DELETE' }),
  listTickets: (id: string) => request<TicketRow[]>(`/initiatives/${id}/tickets`),
  getTicket: (id: string, ticketId: string) => request<TicketDto>(`/initiatives/${id}/tickets/${ticketId}`),
  ticketHistory: (id: string, ticketId: string) =>
    request<TicketVersionDto[]>(`/initiatives/${id}/tickets/${ticketId}/history`),
  createTicket: (id: string, input: CreateTicketInput) =>
    request<TicketDto>(`/initiatives/${id}/tickets`, { method: 'POST', body: JSON.stringify(input) }),
  updateTicket: (id: string, ticketId: string, input: UpdateTicketInput) =>
    request<TicketDto>(`/initiatives/${id}/tickets/${ticketId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteTicket: (id: string, ticketId: string) =>
    request<void>(`/initiatives/${id}/tickets/${ticketId}`, { method: 'DELETE' }),
  listActions: (id: string) => request<ActionDto[]>(`/initiatives/${id}/actions`),
  getAction: (id: string, actionId: string) => request<ActionDto>(`/initiatives/${id}/actions/${actionId}`),
  actionHistory: (id: string, actionId: string) =>
    request<TicketVersionDto[]>(`/initiatives/${id}/actions/${actionId}/history`),
  createAction: (id: string, input: CreateActionInput) =>
    request<ActionDto>(`/initiatives/${id}/actions`, { method: 'POST', body: JSON.stringify(input) }),
  updateAction: (id: string, actionId: string, input: UpdateActionInput) =>
    request<ActionDto>(`/initiatives/${id}/actions/${actionId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteAction: (id: string, actionId: string) =>
    request<void>(`/initiatives/${id}/actions/${actionId}`, { method: 'DELETE' }),
  // Encart « Actions suggérées » (ticket 14).
  listSuggestedActions: (id: string) => request<SuggestedAction[]>(`/initiatives/${id}/suggested-actions`),
  dismissSuggestedAction: (id: string, key: string) =>
    request<void>(`/initiatives/${id}/suggested-actions/${encodeURIComponent(key)}/dismissal`, { method: 'PUT' }),
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
  requirementStatuses: () => request<RequirementStatusDto[]>('/requirement-statuses'),
  // Administration (rôle administrateur, tickets 05, 09 et 11).
  listRequirementStatuses: () => request<AdminRequirementStatusDto[]>('/admin/requirement-statuses'),
  addRequirementStatus: (input: CreateRequirementStatusInput) =>
    request<AdminRequirementStatusDto[]>('/admin/requirement-statuses', { method: 'POST', body: JSON.stringify(input) }),
  updateRequirementStatus: (code: string, input: UpdateRequirementStatusInput) =>
    request<AdminRequirementStatusDto[]>(`/admin/requirement-statuses/${encodeURIComponent(code)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  deleteRequirementStatus: (code: string) =>
    request<AdminRequirementStatusDto[]>(`/admin/requirement-statuses/${encodeURIComponent(code)}`, {
      method: 'DELETE',
    }),
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
