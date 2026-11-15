// Types de ticket et statuts paramétrables (ticket 29, décisions 03 et 14) : les
// six types livrés et leurs statuts, fixes, complétés par l'administration ;
// liste valable pour toute l'application. Règles écrites une seule fois ici,
// appliquées par l'API et reproduites par la base (migration 0029).
import { z } from 'zod';
import { LOCALES, type Locale, type MessageKey, translate } from './i18n.js';
import { ACRONYM_PATTERN, isReferenceCategory } from './references.js';
import { DELIVERED_TICKET_TONES, type StatusTone } from './status-tones.js';

/** Types livrés, dans l'ordre affiché, avant les types ajoutés ; un ticket garde son type à vie. */
export const TICKET_TYPES = ['action', 'question', 'decision', 'risk', 'change_request', 'epic'] as const;
export type DeliveredTicketType = (typeof TICKET_TYPES)[number];
/** Code d'un type : celui d'un type livré, ou l'identifiant d'un type ajouté. */
export type TicketType = string;
export const isDeliveredTicketType = (type: string): type is DeliveredTicketType => TICKET_TYPES.some((t) => t === type);

/**
 * Statuts livrés de chaque type, dans l'ordre affiché, avant les statuts ajoutés ;
 * le premier est le statut initial, tout statut peut passer à tout autre.
 */
export const TICKET_STATUSES = {
  action: ['todo', 'in_progress', 'on_hold', 'done', 'cancelled'],
  question: ['open', 'on_hold', 'answered', 'closed', 'rejected'],
  decision: ['proposed', 'on_hold', 'agreed', 'rejected'],
  risk: ['identified', 'on_hold', 'addressed', 'closed'],
  change_request: ['submitted', 'analysed', 'on_hold', 'accepted', 'rejected'],
  epic: ['todo', 'in_progress', 'on_hold', 'done', 'cancelled'],
} as const satisfies Record<DeliveredTicketType, readonly string[]>;
/** Code d'un statut : celui d'un statut livré, ou l'identifiant d'un statut ajouté. */
export type TicketStatus = string;

/** Statuts livrés fermés : le ticket est terminé. En attente n'en fait jamais partie. */
export const CLOSED_TICKET_STATUSES: Record<DeliveredTicketType, readonly string[]> = {
  action: ['done', 'cancelled'],
  question: ['closed', 'rejected'],
  decision: ['agreed', 'rejected'],
  risk: ['closed'],
  change_request: ['accepted', 'rejected'],
  epic: ['done', 'cancelled'],
};

/** Libellé d'un statut livré, qui dépend du type (Terminée pour l'Action, Terminé pour l'Epic). */
export function ticketStatusLabelKey(type: DeliveredTicketType, status: TicketStatus): MessageKey {
  return (type === 'action' ? `actionStatus.${status}` : `ticketStatus.${type}.${status}`) as MessageKey;
}

/** Libellés d'un type ou d'un statut, dans les deux langues (ADR-0013). */
export type TicketLabels = { fr: string; en: string };

/** Statut d'un type, tel que renvoyé par l'API, dans l'ordre où il est proposé. */
export interface TicketStatusDto {
  /** Code d'un statut livré (`todo`), ou identifiant d'un statut ajouté. */
  code: string;
  delivered: boolean;
  /** Pour un statut livré, ceux de l'interface (i18n.ts). */
  labels: TicketLabels;
  tone: StatusTone;
  /** Le ticket est terminé : plus d'alerte, rangé parmi les « fermés ». */
  closed: boolean;
  /** Désactivé : plus proposé, mais gardé par les tickets qui le portent. */
  active: boolean;
}

/** Type de ticket, avec ses statuts dans l'ordre ; le premier est le statut initial. */
export interface TicketTypeDto {
  /** Code d'un type livré (`risk`), ou identifiant d'un type ajouté. */
  code: string;
  delivered: boolean;
  /** Pour un type livré, ceux de l'interface (i18n.ts). */
  labels: TicketLabels;
  /** Désactivé : plus proposé à la création ; ses tickets restent consultables et modifiables. */
  active: boolean;
  statuses: TicketStatusDto[];
}

const bothLocales = (key: Parameters<typeof translate>[1]): TicketLabels => ({
  fr: translate('fr', key),
  en: translate('en', key),
});

/** Les six types livrés et leurs statuts, avec les libellés de l'interface. */
export function deliveredTicketTypes(): TicketTypeDto[] {
  return TICKET_TYPES.map((type) => ({
    code: type,
    delivered: true,
    labels: bothLocales(`ticketType.${type}`),
    active: true,
    statuses: TICKET_STATUSES[type].map((status: string) => ({
      code: status,
      delivered: true,
      labels: bothLocales(ticketStatusLabelKey(type, status)),
      tone: DELIVERED_TICKET_TONES[status]!,
      closed: CLOSED_TICKET_STATUSES[type].includes(status),
      active: true,
    })),
  }));
}

export const findTicketType = (types: readonly TicketTypeDto[], type: string) => types.find((t) => t.code === type);

export const findTicketStatus = (types: readonly TicketTypeDto[], type: string, status: string) =>
  findTicketType(types, type)?.statuses.find((s) => s.code === status);

/**
 * Statuts proposés pour un ticket du type qui porte `current` (null : ticket à
 * créer) : les actifs, et l'actuel même désactivé.
 */
export const selectableTicketStatuses = (
  types: readonly TicketTypeDto[],
  type: string,
  current: string | null,
): TicketStatusDto[] => findTicketType(types, type)?.statuses.filter((s) => s.active || s.code === current) ?? [];

/** Statut dans lequel tout ticket du type est créé : le premier de sa liste. */
export const initialTicketStatus = (types: readonly TicketTypeDto[], type: string): string | undefined =>
  findTicketType(types, type)?.statuses[0]?.code;

/** Statut fermé : le ticket est terminé. Un statut inconnu n'est pas fermé. */
export const isClosedTicketStatus = (types: readonly TicketTypeDto[], type: string, status: string): boolean =>
  findTicketStatus(types, type, status)?.closed ?? false;

/** Famille d'un statut ; neutre s'il est inconnu. */
export const ticketStatusTone = (types: readonly TicketTypeDto[], type: string, status: string): StatusTone =>
  findTicketStatus(types, type, status)?.tone ?? 'neutral';

/** Libellé d'un type dans la langue de l'utilisateur ; son code s'il est inconnu. */
export const ticketTypeLabel = (types: readonly TicketTypeDto[], type: string, locale: Locale): string =>
  findTicketType(types, type)?.labels[locale] ?? type;

/** Libellé d'un statut dans la langue de l'utilisateur ; son code s'il est inconnu. */
export const ticketStatusLabel = (types: readonly TicketTypeDto[], type: string, status: string, locale: Locale): string =>
  findTicketStatus(types, type, status)?.labels[locale] ?? status;

/**
 * Libellé d'une catégorie de référence : celui du type de ticket qu'elle
 * désigne, ou celui de l'interface pour le besoin, l'exigence et la page.
 */
export const referenceCategoryLabel = (types: readonly TicketTypeDto[], category: string, locale: Locale): string =>
  findTicketType(types, category)?.labels[locale] ??
  (isReferenceCategory(category) ? translate(locale, `referenceCategory.${category}`) : category);

export const TICKET_LABEL_MAX_LENGTH = 50;
const labelSchema = z.string().trim().min(1).max(TICKET_LABEL_MAX_LENGTH);
/** Libellés d'un type ou d'un statut ajouté : obligatoires dans les deux langues (ADR-0013). */
export const ticketLabelsSchema = z.object({ fr: labelSchema, en: labelSchema });

/** Familles proposées pour un statut ajouté ; « neutre atténué » reste aux statuts livrés (point 3). */
export const ADDED_STATUS_TONES = ['neutral', 'progress', 'positive', 'attention', 'negative'] as const;
export type AddedStatusTone = (typeof ADDED_STATUS_TONES)[number];

/** Un type ajouté a au moins deux statuts, dont un fermé (point 7). */
export const MIN_TICKET_STATUSES = 2;

/**
 * Ordre des types : livrés dans leur ordre, puis ajoutés par date d'ajout
 * (point 10). `createdAt` : null pour un type livré.
 */
export function sortTicketTypes<T extends { code: string; createdAt: Date | string | null }>(types: readonly T[]): T[] {
  const rank = (code: string) => {
    const index = TICKET_TYPES.findIndex((t) => t === code);
    return index < 0 ? TICKET_TYPES.length : index;
  };
  const time = (date: Date | string | null) => (date === null ? 0 : new Date(date).getTime());
  return [...types].sort(
    (a, b) => rank(a.code) - rank(b.code) || time(a.createdAt) - time(b.createdAt) || a.code.localeCompare(b.code),
  );
}

/** Statut ajouté : famille neutre par défaut ; l'administrateur indique s'il est fermé. */
export const createTicketStatusSchema = z.object({
  labels: ticketLabelsSchema,
  tone: z.enum(ADDED_STATUS_TONES).default('neutral'),
  closed: z.boolean(),
});
export type CreateTicketStatusInput = z.infer<typeof createTicketStatusSchema>;

/** Type ajouté : actif dès sa création ; le premier statut est le statut initial. */
export const createTicketTypeSchema = z.object({
  labels: ticketLabelsSchema,
  acronym: z.string().trim().regex(ACRONYM_PATTERN),
  statuses: z.array(createTicketStatusSchema).min(MIN_TICKET_STATUSES),
});
export type CreateTicketTypeInput = z.infer<typeof createTicketTypeSchema>;

/** Libellé comparé : sans espaces autour, majuscules ni accents. */
const comparable = (label: string) =>
  label.trim().normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('en');

/** Un des libellés reprend, dans la même langue, celui d'un autre élément de la liste. */
const labelsTaken = (others: readonly { labels: TicketLabels }[], labels: TicketLabels) =>
  others.some((o) => LOCALES.some((locale) => comparable(o.labels[locale]) === comparable(labels[locale])));

/**
 * Vérifie l'ajout d'un type ; null s'il est permis. `categories` : acronymes
 * portés par chaque catégorie de référence, réservés à elle seule.
 */
export function checkTicketTypeCreation(
  types: readonly TicketTypeDto[],
  categories: readonly { usedAcronyms: readonly string[] }[],
  input: CreateTicketTypeInput,
): TicketTypeRefusal | null {
  if (labelsTaken(types, input.labels)) return 'labelTaken';
  if (categories.some((c) => c.usedAcronyms.includes(input.acronym))) return 'acronymTaken';
  if (!input.statuses.some((s) => s.closed)) return 'noClosedStatus';
  const duplicate = input.statuses.some((s, i) => labelsTaken(input.statuses.slice(0, i), s.labels));
  return duplicate ? 'statusLabelTaken' : null;
}

/** Modification d'un type ajouté : seuls les champs fournis changent. */
export const updateTicketTypeSchema = z.object({ labels: ticketLabelsSchema.optional(), active: z.boolean().optional() });
export type UpdateTicketTypeInput = z.infer<typeof updateTicketTypeSchema>;

/** Modification d'un statut ajouté : seuls les champs fournis changent. */
export const updateTicketStatusSchema = z.object({ labels: ticketLabelsSchema.optional(), active: z.boolean().optional() });
export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;

/** Statut tel que l'administration le montre. */
export interface AdminTicketStatusDto extends TicketStatusDto {
  /** Déjà porté par un ticket : ne se supprime plus. */
  used: boolean;
}

/** Type tel que l'administration le montre. */
export interface AdminTicketTypeDto extends TicketTypeDto {
  /** Acronyme actuel de ses références. */
  acronym: string;
  /** Un ticket de ce type a déjà été créé : ne se supprime plus. */
  used: boolean;
  statuses: AdminTicketStatusDto[];
}

/** Le type ajouté `code`, ou le refus : type inconnu, ou livré, qui ne change pas. */
function addedType<T extends TicketTypeDto>(types: readonly T[], code: string): T | TicketTypeRefusal {
  const type = findTicketType(types, code) as T | undefined;
  if (!type) return 'unknownType';
  return type.delivered ? 'deliveredTypeLocked' : type;
}

/** Vérifie la modification d'un type ; null si elle est permise. */
export function checkTicketTypeUpdate(
  types: readonly TicketTypeDto[],
  code: string,
  change: UpdateTicketTypeInput,
): TicketTypeRefusal | null {
  const type = addedType(types, code);
  if (typeof type === 'string') return type;
  const others = types.filter((t) => t.code !== code);
  return change.labels && labelsTaken(others, change.labels) ? 'labelTaken' : null;
}

/** Vérifie la suppression d'un type ; null si elle est permise : un type ajouté dont aucun ticket n'a jamais été créé. */
export function checkTicketTypeDeletion(types: readonly AdminTicketTypeDto[], code: string): TicketTypeRefusal | null {
  const type = addedType(types, code);
  if (typeof type === 'string') return type;
  return type.used ? 'typeUsed' : null;
}

/** Vérifie l'ajout d'un statut au type `typeCode`, livré ou ajouté ; null s'il est permis. */
export function checkTicketStatusCreation(
  types: readonly TicketTypeDto[],
  typeCode: string,
  input: CreateTicketStatusInput,
): TicketTypeRefusal | null {
  const type = findTicketType(types, typeCode);
  if (!type) return 'unknownType';
  return labelsTaken(type.statuses, input.labels) ? 'statusLabelTaken' : null;
}

/** Le statut ajouté `code` de son type, ou le refus : statut inconnu, ou livré, qui ne change pas. */
function addedStatus<T extends TicketTypeDto>(
  types: readonly T[],
  typeCode: string,
  code: string,
): { type: T; status: T['statuses'][number] } | TicketTypeRefusal {
  const type = findTicketType(types, typeCode) as T | undefined;
  const status = type?.statuses.find((s) => s.code === code);
  if (!type || !status) return 'unknownStatus';
  return status.delivered ? 'deliveredStatusLocked' : { type, status };
}

/** Un statut qui cesse d'être proposé (désactivé ou supprimé) : ni le statut initial, ni le dernier fermé actif. */
function withdrawalRefusal(type: TicketTypeDto, status: TicketStatusDto): TicketTypeRefusal | null {
  if (type.statuses[0] === status) return 'initialStatus';
  const lastClosed = status.closed && status.active && !type.statuses.some((s) => s !== status && s.closed && s.active);
  return lastClosed ? 'noClosedStatus' : null;
}

/** Vérifie la modification d'un statut ; null si elle est permise. */
export function checkTicketStatusUpdate(
  types: readonly TicketTypeDto[],
  typeCode: string,
  code: string,
  change: UpdateTicketStatusInput,
): TicketTypeRefusal | null {
  const found = addedStatus(types, typeCode, code);
  if (typeof found === 'string') return found;
  if (change.active === false) {
    const refusal = withdrawalRefusal(found.type, found.status);
    if (refusal) return refusal;
  }
  const others = found.type.statuses.filter((s) => s.code !== code);
  return change.labels && labelsTaken(others, change.labels) ? 'statusLabelTaken' : null;
}

/** Vérifie la suppression d'un statut ; null si elle est permise : un statut ajouté jamais porté. */
export function checkTicketStatusDeletion(
  types: readonly AdminTicketTypeDto[],
  typeCode: string,
  code: string,
): TicketTypeRefusal | null {
  const found = addedStatus(types, typeCode, code);
  if (typeof found === 'string') return found;
  return found.status.used ? 'statusUsed' : withdrawalRefusal(found.type, found.status);
}

/**
 * Refus, renvoyés par l'API (`refusal`) :
 * - `labelTaken` : un libellé reprend celui d'un autre type dans la même langue ;
 * - `statusLabelTaken` : un libellé reprend celui d'un autre statut du type dans la même langue ;
 * - `acronymTaken` : l'acronyme est ou a été celui d'une autre catégorie ;
 * - `noClosedStatus` : le type n'aurait plus de statut fermé actif ;
 * - `initialStatus` : le statut initial d'un type ne se désactive ni ne se supprime ;
 * - `deliveredTypeLocked`, `deliveredStatusLocked` : un type ou un statut livré n'est ni renommé, ni désactivé, ni supprimé ;
 * - `typeUsed` : un ticket de ce type a déjà été créé, il ne se supprime pas ;
 * - `statusUsed` : le statut a déjà été porté par un ticket, il ne se supprime pas ;
 * - `unknownType`, `unknownStatus` : le type ou le statut n'existe pas.
 */
export const TICKET_TYPE_REFUSALS = [
  'labelTaken',
  'statusLabelTaken',
  'acronymTaken',
  'noClosedStatus',
  'initialStatus',
  'deliveredTypeLocked',
  'deliveredStatusLocked',
  'typeUsed',
  'statusUsed',
  'unknownType',
  'unknownStatus',
] as const;
export type TicketTypeRefusal = (typeof TICKET_TYPE_REFUSALS)[number];
export const isTicketTypeRefusal = (value: unknown): value is TicketTypeRefusal =>
  TICKET_TYPE_REFUSALS.some((r) => r === value);
