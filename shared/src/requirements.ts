// Exigences (ticket 10) : représentation utilisable d'un besoin, d'un des types
// du BABOK, identifiée par une référence (references.ts). Règles écrites une
// seule fois ici, appliquées par l'API et reproduites par la base (migration 0013).
import { z } from 'zod';
import { needIdsSchema, type NeedRefDto } from './needs.js';
import type { MemberNameDto } from './schemas.js';
import { stakeholderIdsSchema, type StakeholderRefDto } from './stakeholders.js';

/** Types d'exigence du BABOK. */
export const REQUIREMENT_TYPES = ['business', 'stakeholder', 'solution', 'transition'] as const;
export type RequirementType = (typeof REQUIREMENT_TYPES)[number];

/** Sous-type, porté par les seules exigences de solution. */
export const REQUIREMENT_SUBTYPES = ['functional', 'non_functional'] as const;
export type RequirementSubtype = (typeof REQUIREMENT_SUBTYPES)[number];

/** Statuts d'une exigence ; tout statut peut passer à tout autre. */
export const REQUIREMENT_STATUSES = ['proposed', 'verified', 'validated', 'approved', 'deferred', 'rejected'] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];
/** Statut d'une exigence créée. */
export const INITIAL_REQUIREMENT_STATUS: RequirementStatus = 'proposed';

export const REQUIREMENT_TITLE_MAX_LENGTH = 200;
/** Texte mis en forme (rich-text.ts), même limite que la description d'un besoin. */
export const REQUIREMENT_STATEMENT_MAX_LENGTH = 20000;

const requirementFields = {
  title: z.string().trim().min(1).max(REQUIREMENT_TITLE_MAX_LENGTH),
  statement: z.string().trim().min(1).max(REQUIREMENT_STATEMENT_MAX_LENGTH),
  type: z.enum(REQUIREMENT_TYPES),
  /** Null pour une exigence qui n'est pas de solution. */
  subtype: z.enum(REQUIREMENT_SUBTYPES).nullable(),
  status: z.enum(REQUIREMENT_STATUSES),
  /** Sources : parties prenantes de la même initiative ; aucune ou plusieurs. */
  stakeholderIds: stakeholderIdsSchema,
  /** Besoins auxquels l'exigence répond, de la même initiative. */
  needIds: needIdsSchema,
  /** Exigence parente, de la même initiative ; null : aucune. */
  parentId: z.uuid().nullable(),
};

/** Exigences liées à une action, de la même initiative ; un doublon est ignoré. */
export const requirementIdsSchema = z.array(z.uuid()).transform((ids) => [...new Set(ids)]);

/** Ce que vérifie checkRequirementShape : l'exigence telle qu'elle sera enregistrée. */
export interface RequirementShape {
  type: RequirementType;
  subtype: RequirementSubtype | null;
  needIds: readonly string[];
  parentId: string | null;
}

/**
 * Vérifie une exigence complète ; null si elle est permise :
 * - le sous-type est obligatoire pour une exigence de solution, absent sinon ;
 * - une exigence répond à au moins un besoin ou dérive d'une exigence parente.
 */
export function checkRequirementShape(shape: RequirementShape): RequirementRefusal | null {
  if ((shape.type === 'solution') !== (shape.subtype != null)) return 'subtypeMismatch';
  if (shape.needIds.length === 0 && shape.parentId == null) return 'originRequired';
  return null;
}

/**
 * Vrai si donner `parentId` pour parente à l'exigence `id` créerait une boucle :
 * la parente serait l'exigence elle-même ou l'une de ses descendantes.
 */
export function createsParentCycle(
  requirements: readonly { id: string; parentId: string | null }[],
  id: string,
  parentId: string | null,
): boolean {
  const parentOf = new Map(requirements.map((r) => [r.id, r.parentId]));
  // Remonte les ancêtres de la future parente ; `seen` arrête une boucle déjà présente.
  const seen = new Set<string>();
  for (let current = parentId; current != null && !seen.has(current); current = parentOf.get(current) ?? null) {
    if (current === id) return true;
    seen.add(current);
  }
  return false;
}

/** Création : la référence est attribuée par la base, le statut est Proposée. */
export const createRequirementSchema = z
  .object({
    title: requirementFields.title,
    statement: requirementFields.statement,
    type: requirementFields.type,
    subtype: requirementFields.subtype.optional(),
    stakeholderIds: requirementFields.stakeholderIds.optional(),
    needIds: requirementFields.needIds.optional(),
    parentId: requirementFields.parentId.optional(),
  })
  .superRefine((input, ctx) => {
    const refusal = checkRequirementShape({
      type: input.type,
      subtype: input.subtype ?? null,
      needIds: input.needIds ?? [],
      parentId: input.parentId ?? null,
    });
    if (refusal) ctx.addIssue({ code: 'custom', message: refusal });
  });
export type CreateRequirementInput = z.infer<typeof createRequirementSchema>;

/**
 * Modification : seuls les champs fournis changent ; `stakeholderIds` et
 * `needIds` remplacent l'ensemble. L'API vérifie l'exigence complète
 * (checkRequirementShape) et l'absence de boucle.
 */
export const updateRequirementSchema = z.object(requirementFields).partial();
export type UpdateRequirementInput = z.infer<typeof updateRequirementSchema>;

/** Exigence telle que renvoyée par l'API. */
export interface RequirementDto {
  id: string;
  initiativeId: string;
  /** Ex. CRM-EX-012 ; attribuée à la création, ne change plus. */
  reference: string;
  title: string;
  /** Texte mis en forme (voir rich-text.ts). */
  statement: string;
  type: RequirementType;
  subtype: RequirementSubtype | null;
  status: RequirementStatus;
  /** Sources, par ordre alphabétique. */
  stakeholders: StakeholderRefDto[];
  /** Besoins liés, par référence. */
  needs: NeedRefDto[];
  parent: RequirementRefDto | null;
  createdAt: string;
  createdBy: MemberNameDto;
  updatedAt: string;
  updatedBy: MemberNameDto;
}

/** Exigence liée à un autre objet, telle que cet objet la montre. */
export interface RequirementRefDto {
  id: string;
  reference: string;
  title: string;
}

/** État d'une exigence enregistré par la base à chaque modification (migration 0013). */
export interface RequirementSnapshot {
  title: string;
  statement: string;
  type: RequirementType;
  subtype: RequirementSubtype | null;
  status: RequirementStatus;
  stakeholders: StakeholderRefDto[];
  needs: NeedRefDto[];
  parent: RequirementRefDto | null;
}

/** Version d'une exigence, telle que renvoyée par l'API, la plus ancienne d'abord. */
export interface RequirementVersionDto {
  changedAt: string;
  changedBy: MemberNameDto;
  snapshot: RequirementSnapshot;
}

type ValueField = 'title' | 'statement' | 'type' | 'subtype' | 'status';
type ListField = 'stakeholders' | 'needs';

/** Champ modifié : ancienne et nouvelle valeur. */
export type RequirementChange =
  | { [F in ValueField]: { field: F; from: RequirementSnapshot[F]; to: RequirementSnapshot[F] } }[ValueField]
  | { [F in ListField]: { field: F; from: RequirementSnapshot[F]; to: RequirementSnapshot[F] } }[ListField]
  | { field: 'parent'; from: RequirementRefDto | null; to: RequirementRefDto | null };

export interface RequirementHistoryEntry {
  changedAt: string;
  changedBy: MemberNameDto;
  kind: 'created' | 'updated';
  /** Vide pour la création. */
  changes: RequirementChange[];
}

const VALUE_FIELDS: readonly ValueField[] = ['title', 'statement', 'type', 'subtype', 'status'];
const LIST_FIELDS: readonly ListField[] = ['stakeholders', 'needs'];

const sameIdSet = (a: readonly { id: string }[], b: readonly { id: string }[]) =>
  a.length === b.length && a.every((x) => b.some((y) => y.id === x.id));

function changesBetween(before: RequirementSnapshot, after: RequirementSnapshot): RequirementChange[] {
  const changes: RequirementChange[] = [];
  for (const field of VALUE_FIELDS) {
    if (before[field] !== after[field]) changes.push({ field, from: before[field], to: after[field] } as RequirementChange);
  }
  // Un lien change si l'ensemble des objets liés change, pas leur ordre ni leur titre.
  for (const field of LIST_FIELDS) {
    if (!sameIdSet(before[field], after[field])) changes.push({ field, from: before[field], to: after[field] } as RequirementChange);
  }
  if (before.parent?.id !== after.parent?.id) changes.push({ field: 'parent', from: before.parent, to: after.parent });
  return changes;
}

/**
 * Historique d'une exigence d'après ses versions (la plus ancienne d'abord) :
 * la création, puis chaque modification visible, la plus récente en tête.
 */
export function requirementHistory(versions: readonly RequirementVersionDto[]): RequirementHistoryEntry[] {
  const entries: RequirementHistoryEntry[] = [];
  versions.forEach((version, index) => {
    const previous = versions[index - 1];
    const { changedAt, changedBy } = version;
    if (!previous) {
      entries.push({ changedAt, changedBy, kind: 'created', changes: [] });
      return;
    }
    const changes = changesBetween(previous.snapshot, version.snapshot);
    if (changes.length > 0) entries.push({ changedAt, changedBy, kind: 'updated', changes });
  });
  return entries.reverse();
}

/**
 * Refus d'une écriture sur une exigence, renvoyés par l'API (`refusal`) :
 * - `subtypeMismatch` : sous-type absent pour une exigence de solution, ou présent pour une autre ;
 * - `originRequired` : ni besoin lié ni exigence parente ;
 * - `parentCycle` : l'exigence parente descend de l'exigence elle-même ;
 * - `unknownRequirement` : un objet est lié à une exigence absente de l'initiative ;
 * - `requirementLinked` : l'exigence est liée à une action ou a des exigences enfants.
 */
export const REQUIREMENT_REFUSALS = [
  'subtypeMismatch',
  'originRequired',
  'parentCycle',
  'unknownRequirement',
  'requirementLinked',
] as const;
export type RequirementRefusal = (typeof REQUIREMENT_REFUSALS)[number];
export const isRequirementRefusal = (value: unknown): value is RequirementRefusal =>
  REQUIREMENT_REFUSALS.some((r) => r === value);
