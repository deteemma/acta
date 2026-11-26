import type {
  AccountDto,
  AssistantRequestDto,
  CreateAssistantRequestInput,
  AttachmentDto,
  AttachmentQuotaDto,
  AttachmentQuotaInput,
  AttachmentsDto,
  ActionDto,
  CommentDto,
  CommentInput,
  CreateNeedLinkInput,
  CreatePageLinkInput,
  CreateRequirementLinkInput,
  CreateTicketLinkInput,
  InitiativeLinksDto,
  PageLinkObjectKind,
  CreateTicketInput,
  CreatePageInput,
  DeclarePageVersionInput,
  MovePageInput,
  PageDto,
  PageRevisionDto,
  PageRevisionRow,
  PageRow,
  PageTemplateDto,
  PageTemplateInput,
  TaskPageDto,
  UpdatePageInput,
  UpdatePageVersionNoteInput,
  TicketDto,
  TicketRow,
  TicketVersionDto,
  UpdateTicketInput,
  AdminRequirementStatusDto,
  AdminPageTemplateDto,
  AdminTicketTypeDto,
  CreateTicketStatusInput,
  CreateTicketTypeInput,
  TicketTypeDto,
  UpdateTicketStatusInput,
  UpdatePageTemplateInput,
  UpdateTicketTypeInput,
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
  BackgroundHistoryDto,
  CreateScenarioInput,
  FeatureDto,
  ReorderScenariosInput,
  SaveBackgroundInput,
  SetFeatureLanguageInput,
  ScenarioDto,
  ScenarioHistoryDto,
  UpdateScenarioInput,
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
  CreatePageWithImagesInput,
  UpdatePageWithImagesInput,
} from '@app/shared';
import { ATTACHMENT_EXTENSIONS, PAGE_SAVE_WITH_IMAGES_TYPE } from '@app/shared';
import { accessToken } from './auth';

export class ApiError extends Error {
  /** Motif de refus renvoyé par l'API (ex. règles d'équipe : `lastOwner`). */
  constructor(
    readonly status: number,
    readonly refusal?: string,
    /** Corps entier de la réponse : certains refus y joignent l'état actuel (ex. `PageChangedSinceBody`). */
    readonly body?: unknown,
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
  if (!response.ok) throw await toApiError(response);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

/** Contenu d'une pièce jointe : les octets seuls, que l'appelant type lui-même (attachments.tsx). */
async function requestBlob(path: string): Promise<ArrayBuffer> {
  const response = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${await accessToken()}` } });
  if (!response.ok) throw await toApiError(response);
  return response.arrayBuffer();
}

/** Réponse en erreur : son statut et, s'il y en a un, le motif de refus de l'API. */
async function toApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as { refusal?: unknown } | null;
  return new ApiError(response.status, typeof body?.refusal === 'string' ? body.refusal : undefined, body ?? undefined);
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
  // Liens (ticket 19) : ceux de toute l'initiative, que chaque fiche croise avec ses objets.
  listLinks: (id: string) => request<InitiativeLinksDto>(`/initiatives/${id}/links`),
  listTicketComments: (id: string, ticketId: string) =>
    request<CommentDto[]>(`/initiatives/${id}/tickets/${ticketId}/comments`),
  createTicketComment: (id: string, ticketId: string, input: CommentInput) =>
    request<CommentDto[]>(`/initiatives/${id}/tickets/${ticketId}/comments`, { method: 'POST', body: JSON.stringify(input) }),
  listPageComments: (id: string, pageId: string) => request<CommentDto[]>(`/initiatives/${id}/pages/${pageId}/comments`),
  createPageComment: (id: string, pageId: string, input: CommentInput) =>
    request<CommentDto[]>(`/initiatives/${id}/pages/${pageId}/comments`, { method: 'POST', body: JSON.stringify(input) }),
  updateComment: (id: string, commentId: string, input: CommentInput) =>
    request<CommentDto>(`/initiatives/${id}/comments/${commentId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteComment: (id: string, commentId: string) =>
    request<CommentDto>(`/initiatives/${id}/comments/${commentId}`, { method: 'DELETE' }),
  // Pièces jointes (ticket 21) : contenu envoyé brut, nom dans l'adresse.
  listTicketAttachments: (id: string, ticketId: string) =>
    request<AttachmentsDto>(`/initiatives/${id}/tickets/${ticketId}/attachments`),
  uploadTicketAttachment: (id: string, ticketId: string, file: File) =>
    request<AttachmentsDto>(`/initiatives/${id}/tickets/${ticketId}/attachments?name=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      body: file,
      headers: { 'Content-Type': 'application/octet-stream' },
    }),
  renameAttachment: (id: string, attachmentId: string, baseName: string) =>
    request<AttachmentDto>(`/initiatives/${id}/attachments/${attachmentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ baseName }),
    }),
  deleteAttachment: (id: string, attachmentId: string) =>
    request<AttachmentDto>(`/initiatives/${id}/attachments/${attachmentId}`, { method: 'DELETE' }),
  attachmentContent: (id: string, attachmentId: string) => requestBlob(`/initiatives/${id}/attachments/${attachmentId}/content`),
  /** Image affichée dans le texte d'une page : ses octets, sous le type d'image servi par l'API (liste fixe des formats). */
  attachmentImage: async (id: string, attachmentId: string) => {
    const response = await fetch(`/api/initiatives/${id}/attachments/${attachmentId}/content`, {
      headers: { Authorization: `Bearer ${await accessToken()}` },
    });
    if (!response.ok) throw await toApiError(response);
    const type = response.headers.get('Content-Type') ?? '';
    // Jamais sous un autre type que l'une des images de la liste fixe des formats (pas de SVG : refusé à l'envoi).
    const isImage = Object.values(ATTACHMENT_EXTENSIONS).some((e) => e.mime === type && type.startsWith('image/'));
    return new Blob([await response.arrayBuffer()], { type: isImage ? type : 'application/octet-stream' });
  },
  // Pièces jointes d'une page (ticket 26) ; ses images arrivent avec son enregistrement (savePageWithImages).
  listPageAttachments: (id: string, pageId: string) =>
    request<AttachmentsDto>(`/initiatives/${id}/pages/${pageId}/attachments`),
  uploadPageAttachment: (id: string, pageId: string, file: File) =>
    request<AttachmentsDto>(`/initiatives/${id}/pages/${pageId}/attachments?name=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      body: file,
      headers: { 'Content-Type': 'application/octet-stream' },
    }),
  pageImageRevisions: (id: string, pageId: string, attachmentId: string) =>
    request<PageRevisionRow[]>(`/initiatives/${id}/pages/${pageId}/attachments/${attachmentId}/revisions`),
  /**
   * Enregistrement d'une saisie et des fichiers de ses images insérées, en une
   * requête (PAGE_SAVE_WITH_IMAGES_TYPE) : longueur de l'en-tête, en-tête JSON,
   * puis les fichiers dans l'ordre de `uploads`. Le navigateur lit les fichiers au
   * fil de l'envoi. `pageId` null : création.
   */
  savePageWithImages: (
    id: string,
    pageId: string | null,
    input: CreatePageWithImagesInput | UpdatePageWithImagesInput,
    files: readonly Blob[],
  ) => {
    const header = new TextEncoder().encode(JSON.stringify(input));
    const length = new Uint8Array(4);
    new DataView(length.buffer).setUint32(0, header.length);
    return request<PageDto>(`/initiatives/${id}/pages/${pageId ? `${pageId}/with-images` : 'with-images'}`, {
      method: pageId ? 'PATCH' : 'POST',
      body: new Blob([length, header, ...files]),
      headers: { 'Content-Type': PAGE_SAVE_WITH_IMAGES_TYPE },
    });
  },
  createTicketLink: (id: string, input: CreateTicketLinkInput) =>
    request<InitiativeLinksDto>(`/initiatives/${id}/links/tickets`, { method: 'POST', body: JSON.stringify(input) }),
  removeTicketLink: (id: string, ticketId: string, otherTicketId: string) =>
    request<void>(`/initiatives/${id}/links/tickets/${ticketId}/${otherTicketId}`, { method: 'DELETE' }),
  createNeedLink: (id: string, input: CreateNeedLinkInput) =>
    request<InitiativeLinksDto>(`/initiatives/${id}/links/needs`, { method: 'POST', body: JSON.stringify(input) }),
  removeNeedLink: (id: string, ticketId: string, needId: string) =>
    request<void>(`/initiatives/${id}/links/needs/${ticketId}/${needId}`, { method: 'DELETE' }),
  createPageLink: (id: string, input: CreatePageLinkInput) =>
    request<InitiativeLinksDto>(`/initiatives/${id}/links/pages`, { method: 'POST', body: JSON.stringify(input) }),
  removePageLink: (id: string, pageId: string, kind: PageLinkObjectKind, objectId: string) =>
    request<void>(`/initiatives/${id}/links/pages/${pageId}/${kind}/${objectId}`, { method: 'DELETE' }),
  createRequirementLink: (id: string, input: CreateRequirementLinkInput) =>
    request<InitiativeLinksDto>(`/initiatives/${id}/links/requirements`, { method: 'POST', body: JSON.stringify(input) }),
  removeRequirementLink: (id: string, ticketId: string, requirementId: string) =>
    request<void>(`/initiatives/${id}/links/requirements/${ticketId}/${requirementId}`, { method: 'DELETE' }),
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
  // Modèles de page (ticket 27).
  listPageTemplates: () => request<PageTemplateDto[]>('/page-templates'),
  listTaskPages: (taskId: string) => request<TaskPageDto[]>(`/babok/tasks/${encodeURIComponent(taskId)}/pages`),
  /** Administration des modèles de page (ticket 30) : chaque appel renvoie toute la liste, à jour. */
  listAdminPageTemplates: () => request<AdminPageTemplateDto[]>('/admin/page-templates'),
  addPageTemplate: (input: PageTemplateInput) =>
    request<AdminPageTemplateDto[]>('/admin/page-templates', { method: 'POST', body: JSON.stringify(input) }),
  updatePageTemplate: (id: string, input: UpdatePageTemplateInput) =>
    request<AdminPageTemplateDto[]>(`/admin/page-templates/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deletePageTemplate: (id: string) => request<AdminPageTemplateDto[]>(`/admin/page-templates/${id}`, { method: 'DELETE' }),
  /** Administration de la limite de pièces jointes par initiative (ticket 31). */
  getAttachmentQuota: () => request<AttachmentQuotaDto>('/admin/attachment-quota'),
  setAttachmentQuota: (input: AttachmentQuotaInput) =>
    request<AttachmentQuotaDto>('/admin/attachment-quota', { method: 'PUT', body: JSON.stringify(input) }),
  // Enregistrements et versions de page (ticket 23).
  listPageRevisions: (id: string, pageId: string) =>
    request<PageRevisionRow[]>(`/initiatives/${id}/pages/${pageId}/revisions`),
  getPageRevision: (id: string, pageId: string, revisionId: string) =>
    request<PageRevisionDto>(`/initiatives/${id}/pages/${pageId}/revisions/${revisionId}`),
  declarePageVersion: (id: string, pageId: string, revisionId: string, input: DeclarePageVersionInput) =>
    request<PageRevisionRow[]>(`/initiatives/${id}/pages/${pageId}/revisions/${revisionId}/version`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updatePageVersionNote: (id: string, pageId: string, revisionId: string, input: UpdatePageVersionNoteInput) =>
    request<PageRevisionRow[]>(`/initiatives/${id}/pages/${pageId}/revisions/${revisionId}/version`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  restorePageRevision: (id: string, pageId: string, revisionId: string) =>
    request<PageDto>(`/initiatives/${id}/pages/${pageId}/revisions/${revisionId}/restore`, { method: 'POST' }),
  deletePageRevision: (id: string, pageId: string, revisionId: string) =>
    request<PageRevisionRow[]>(`/initiatives/${id}/pages/${pageId}/revisions/${revisionId}`, { method: 'DELETE' }),
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
  /** Mes demandes à l'assistant sur l'initiative, de la plus récente à la plus ancienne (AS9). */
  listAssistantRequests: (id: string) => request<AssistantRequestDto[]>(`/initiatives/${id}/assistant-requests`),
  createAssistantRequest: (id: string, input: CreateAssistantRequestInput) =>
    request<AssistantRequestDto>(`/initiatives/${id}/assistant-requests`, { method: 'POST', body: JSON.stringify(input) }),
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
  // Scénarios Gherkin d'une exigence (phase 3, ticket 01).
  listScenarios: (id: string, requirementId: string) =>
    request<ScenarioDto[]>(`/initiatives/${id}/requirements/${requirementId}/scenarios`),
  createScenario: (id: string, requirementId: string, input: CreateScenarioInput) =>
    request<ScenarioDto>(`/initiatives/${id}/requirements/${requirementId}/scenarios`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateScenario: (id: string, requirementId: string, scenarioId: string, input: UpdateScenarioInput) =>
    request<ScenarioDto>(`/initiatives/${id}/requirements/${requirementId}/scenarios/${scenarioId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  reorderScenarios: (id: string, requirementId: string, input: ReorderScenariosInput) =>
    request<ScenarioDto[]>(`/initiatives/${id}/requirements/${requirementId}/scenarios/order`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  deleteScenario: (id: string, requirementId: string, scenarioId: string) =>
    request<void>(`/initiatives/${id}/requirements/${requirementId}/scenarios/${scenarioId}`, { method: 'DELETE' }),
  // Historiques d'un scénario et du Contexte (phase 3, ticket 03).
  scenarioHistory: (id: string, requirementId: string, scenarioId: string) =>
    request<ScenarioHistoryDto>(`/initiatives/${id}/requirements/${requirementId}/scenarios/${scenarioId}/history`),
  backgroundHistory: (id: string, requirementId: string) =>
    request<BackgroundHistoryDto>(`/initiatives/${id}/requirements/${requirementId}/feature/background/history`),
  // Langue et Contexte de la Fonctionnalité (phase 3, ticket 02).
  getFeature: (id: string, requirementId: string) => request<FeatureDto>(`/initiatives/${id}/requirements/${requirementId}/feature`),
  setFeatureLanguage: (id: string, requirementId: string, input: SetFeatureLanguageInput) =>
    request<FeatureDto>(`/initiatives/${id}/requirements/${requirementId}/feature/language`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  saveBackground: (id: string, requirementId: string, input: SaveBackgroundInput) =>
    request<FeatureDto>(`/initiatives/${id}/requirements/${requirementId}/feature/background`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  deleteBackground: (id: string, requirementId: string) =>
    request<void>(`/initiatives/${id}/requirements/${requirementId}/feature/background`, { method: 'DELETE' }),
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
  ticketTypes: () => request<TicketTypeDto[]>('/ticket-types'),
  /** Administration des types de ticket (ticket 29) : chaque appel renvoie toute la liste, à jour. */
  listTicketTypes: () => request<AdminTicketTypeDto[]>('/admin/ticket-types'),
  addTicketType: (input: CreateTicketTypeInput) =>
    request<AdminTicketTypeDto[]>('/admin/ticket-types', { method: 'POST', body: JSON.stringify(input) }),
  updateTicketType: (type: string, input: UpdateTicketTypeInput) =>
    request<AdminTicketTypeDto[]>(`/admin/ticket-types/${encodeURIComponent(type)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  deleteTicketType: (type: string) =>
    request<AdminTicketTypeDto[]>(`/admin/ticket-types/${encodeURIComponent(type)}`, { method: 'DELETE' }),
  addTicketStatus: (type: string, input: CreateTicketStatusInput) =>
    request<AdminTicketTypeDto[]>(`/admin/ticket-types/${encodeURIComponent(type)}/statuses`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateTicketStatus: (type: string, status: string, input: UpdateTicketStatusInput) =>
    request<AdminTicketTypeDto[]>(
      `/admin/ticket-types/${encodeURIComponent(type)}/statuses/${encodeURIComponent(status)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    ),
  deleteTicketStatus: (type: string, status: string) =>
    request<AdminTicketTypeDto[]>(
      `/admin/ticket-types/${encodeURIComponent(type)}/statuses/${encodeURIComponent(status)}`,
      { method: 'DELETE' },
    ),
  listReferenceCategories: () => request<ReferenceCategoryDto[]>('/admin/reference-categories'),
  updateReferenceCategory: (category: ReferenceCategory, input: UpdateReferenceCategoryInput) =>
    request<ReferenceCategoryDto[]>(`/admin/reference-categories/${encodeURIComponent(category)}`, {
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
