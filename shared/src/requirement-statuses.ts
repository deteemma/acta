// Statuts d'exigence (tickets 10 et 11) : les 6 du BABOK, complétés par
// l'administration ; liste valable pour toute l'application. Règles écrites une
// seule fois ici, appliquées par l'API et reproduites par la base (migration 0017).
import { z } from 'zod';
import { LOCALES, type Locale, translate } from './i18n.js';

/** Statuts du BABOK, ni renommés, ni désactivés, ni supprimés ; tout statut peut passer à tout autre. */
export const BABOK_REQUIREMENT_STATUSES = ['proposed', 'verified', 'validated', 'approved', 'deferred', 'rejected'] as const;
export type BabokRequirementStatus = (typeof BABOK_REQUIREMENT_STATUSES)[number];
/** Code d'un statut : celui d'un statut du BABOK, ou l'identifiant d'un statut ajouté. */
export type RequirementStatus = string;
export const isBabokRequirementStatus = (code: string): code is BabokRequirementStatus =>
  BABOK_REQUIREMENT_STATUSES.some((s) => s === code);
/** Statut d'une exigence créée. */
export const INITIAL_REQUIREMENT_STATUS: BabokRequirementStatus = 'proposed';

export const REQUIREMENT_STATUS_LABEL_MAX_LENGTH = 50;
const labelSchema = z.string().trim().min(1).max(REQUIREMENT_STATUS_LABEL_MAX_LENGTH);
/** Libellés d'un statut ajouté : obligatoires dans les deux langues (ADR-0013). */
export const requirementStatusLabelsSchema = z.object({ fr: labelSchema, en: labelSchema });
export type RequirementStatusLabels = z.infer<typeof requirementStatusLabelsSchema>;

/** Statut tel que renvoyé par l'API, dans l'ordre où il est proposé. */
export interface RequirementStatusDto {
  code: RequirementStatus;
  babok: boolean;
  /** Pour un statut du BABOK, ceux de l'interface (i18n.ts). */
  labels: RequirementStatusLabels;
  /** Un statut désactivé n'est plus proposé, mais reste sur les exigences qui le portent. */
  active: boolean;
  /** Date d'ajout (ISO) ; null pour un statut du BABOK. */
  createdAt: string | null;
}

/** Les 6 statuts du BABOK, avec les libellés de l'interface. */
export function babokRequirementStatuses(): RequirementStatusDto[] {
  return BABOK_REQUIREMENT_STATUSES.map((code) => ({
    code,
    babok: true,
    labels: { fr: translate('fr', `requirementStatus.${code}`), en: translate('en', `requirementStatus.${code}`) },
    active: true,
    createdAt: null,
  }));
}

/** Libellé comparé : sans espaces autour, majuscules ni accents. */
const comparable = (label: string) =>
  label.trim().normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('en');

/**
 * Vérifie les libellés du statut `code` (null : statut à ajouter) ; null s'ils
 * sont permis : aucun ne reprend, dans la même langue, celui d'un autre statut,
 * BABOK compris.
 */
export function checkStatusLabels(
  statuses: readonly RequirementStatusDto[],
  code: RequirementStatus | null,
  labels: RequirementStatusLabels,
): RequirementStatusRefusal | null {
  const taken = statuses.some(
    (s) => s.code !== code && LOCALES.some((locale: Locale) => comparable(s.labels[locale]) === comparable(labels[locale])),
  );
  return taken ? 'labelTaken' : null;
}

/** Ajout d'un statut (administrateur) : actif dès sa création. */
export const createRequirementStatusSchema = z.object({ labels: requirementStatusLabelsSchema });
export type CreateRequirementStatusInput = z.infer<typeof createRequirementStatusSchema>;

/** Modification d'un statut ajouté : seuls les champs fournis changent. */
export const updateRequirementStatusSchema = z.object({
  labels: requirementStatusLabelsSchema.optional(),
  active: z.boolean().optional(),
});
export type UpdateRequirementStatusInput = z.infer<typeof updateRequirementStatusSchema>;

/** Statut tel que l'administration le montre. */
export interface AdminRequirementStatusDto extends RequirementStatusDto {
  /** Porté par une exigence, ou présent dans l'historique d'une exigence : ne se supprime plus. */
  used: boolean;
}

/** Le statut ajouté `code`, ou le refus : statut inconnu, ou du BABOK, qui ne change pas. */
function addedStatus<T extends RequirementStatusDto>(
  statuses: readonly T[],
  code: RequirementStatus,
): T | RequirementStatusRefusal {
  const status = statuses.find((s) => s.code === code);
  if (!status) return 'unknownStatus';
  return status.babok ? 'babokStatusLocked' : status;
}

/** Vérifie la modification d'un statut ; null si elle est permise. */
export function checkStatusUpdate(
  statuses: readonly RequirementStatusDto[],
  code: RequirementStatus,
  change: UpdateRequirementStatusInput,
): RequirementStatusRefusal | null {
  const status = addedStatus(statuses, code);
  if (typeof status === 'string') return status;
  return change.labels ? checkStatusLabels(statuses, code, change.labels) : null;
}

/** Vérifie la suppression d'un statut ; null si elle est permise : un statut ajouté jamais utilisé. */
export function checkStatusDeletion(
  statuses: readonly AdminRequirementStatusDto[],
  code: RequirementStatus,
): RequirementStatusRefusal | null {
  const status = addedStatus(statuses, code);
  if (typeof status === 'string') return status;
  return status.used ? 'statusUsed' : null;
}

/**
 * Vérifie le statut `next` donné à une exigence qui porte `current` (null :
 * exigence à créer) ; null s'il est permis. Un statut désactivé n'est plus
 * attribué, mais l'exigence qui le porte le garde.
 */
export function checkRequirementStatus(
  statuses: readonly RequirementStatusDto[],
  current: RequirementStatus | null,
  next: RequirementStatus,
): RequirementStatusRefusal | null {
  if (!statuses.some((s) => s.code === next)) return 'unknownStatus';
  const selectable = current == null ? statuses.filter((s) => s.active) : selectableStatuses(statuses, current);
  return selectable.some((s) => s.code === next) ? null : 'inactiveStatus';
}

/** Ordre où les statuts sont proposés : ceux du BABOK dans leur ordre, puis les ajoutés par date d'ajout. */
export function sortRequirementStatuses(statuses: readonly RequirementStatusDto[]): RequirementStatusDto[] {
  const rank = (s: RequirementStatusDto) =>
    isBabokRequirementStatus(s.code) ? BABOK_REQUIREMENT_STATUSES.indexOf(s.code) : Infinity;
  return [...statuses].sort((a, b) => rank(a) - rank(b) || (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
}

/** Statuts proposés pour une exigence qui porte `current` : les actifs, et l'actuel même désactivé. */
export function selectableStatuses(
  statuses: readonly RequirementStatusDto[],
  current: RequirementStatus,
): RequirementStatusDto[] {
  return statuses.filter((s) => s.active || s.code === current);
}

/** Libellé d'un statut dans la langue de l'utilisateur ; son code s'il est inconnu. */
export function requirementStatusLabel(
  statuses: readonly RequirementStatusDto[],
  code: RequirementStatus,
  locale: Locale,
): string {
  return statuses.find((s) => s.code === code)?.labels[locale] ?? code;
}

/**
 * Refus, renvoyés par l'API (`refusal`) :
 * - `labelTaken` : un libellé reprend celui d'un autre statut dans la même langue ;
 * - `babokStatusLocked` : un statut du BABOK n'est ni renommé, ni désactivé, ni supprimé ;
 * - `statusUsed` : le statut est ou a été porté par une exigence, il ne se supprime pas ;
 * - `unknownStatus` : le statut n'existe pas ;
 * - `inactiveStatus` : le statut est désactivé, il n'est plus attribué.
 */
export const REQUIREMENT_STATUS_REFUSALS = [
  'labelTaken',
  'babokStatusLocked',
  'statusUsed',
  'unknownStatus',
  'inactiveStatus',
] as const;
export type RequirementStatusRefusal = (typeof REQUIREMENT_STATUS_REFUSALS)[number];
export const isRequirementStatusRefusal = (value: unknown): value is RequirementStatusRefusal =>
  REQUIREMENT_STATUS_REFUSALS.some((r) => r === value);
