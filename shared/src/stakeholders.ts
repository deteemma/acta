// Parties prenantes (ticket 08) : objet d'analyse d'une initiative, positionné
// sur la matrice influence × intérêt. Règles écrites une seule fois ici,
// appliquées par l'API et reproduites par la base (migration 0011).
import { z } from 'zod';
import type { MemberNameDto } from './schemas.js';

/** Nature d'une partie prenante. */
export const STAKEHOLDER_KINDS = ['person', 'group', 'organization'] as const;
export type StakeholderKind = (typeof STAKEHOLDER_KINDS)[number];

/** Les 11 rôles de parties prenantes du BABOK v3 (§2.4), dans l'ordre du guide. */
export const STAKEHOLDER_ROLES = [
  'business_analyst',
  'customer',
  'domain_sme',
  'end_user',
  'implementation_sme',
  'operational_support',
  'project_manager',
  'regulator',
  'sponsor',
  'supplier',
  'tester',
] as const;
export type StakeholderRole = (typeof STAKEHOLDER_ROLES)[number];

/** Niveau d'influence ou d'intérêt ; facultatif (fiche pas encore évaluée). */
export const STAKEHOLDER_LEVELS = ['low', 'medium', 'high'] as const;
export type StakeholderLevel = (typeof STAKEHOLDER_LEVELS)[number];

export const STAKEHOLDER_NAME_MAX_LENGTH = 200;
export const STAKEHOLDER_CONTACT_MAX_LENGTH = 1000;
/** Notes : texte mis en forme (rich-text.ts), même limite que la description d'une action. */
export const STAKEHOLDER_NOTES_MAX_LENGTH = 20000;

/** Parties prenantes liées à un autre objet, de la même initiative ; un doublon est ignoré. */
export const stakeholderIdsSchema = z.array(z.uuid()).transform((ids) => [...new Set(ids)]);

/** Texte facultatif : vide = absent. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((text) => text || null)
    .nullable();

const stakeholderFields = {
  name: z.string().trim().min(1).max(STAKEHOLDER_NAME_MAX_LENGTH),
  kind: z.enum(STAKEHOLDER_KINDS),
  /** Un ou plusieurs rôles ; un doublon est ignoré. */
  roles: z
    .array(z.enum(STAKEHOLDER_ROLES))
    .min(1)
    .transform((roles) => [...new Set(roles)]),
  influence: z.enum(STAKEHOLDER_LEVELS).nullable(),
  interest: z.enum(STAKEHOLDER_LEVELS).nullable(),
  contact: optionalText(STAKEHOLDER_CONTACT_MAX_LENGTH),
  notes: optionalText(STAKEHOLDER_NOTES_MAX_LENGTH),
  /** Compte utilisateur relié : un membre de l'initiative, quel que soit son rôle. */
  userId: z.string().min(1).nullable(),
};

/** Création : nom, nature et rôles obligatoires ; le reste facultatif. */
export const createStakeholderSchema = z.object({
  name: stakeholderFields.name,
  kind: stakeholderFields.kind,
  roles: stakeholderFields.roles,
  influence: stakeholderFields.influence.optional(),
  interest: stakeholderFields.interest.optional(),
  contact: stakeholderFields.contact.optional(),
  notes: stakeholderFields.notes.optional(),
  userId: stakeholderFields.userId.optional(),
});
export type CreateStakeholderInput = z.infer<typeof createStakeholderSchema>;

/** Modification : seuls les champs fournis changent. */
export const updateStakeholderSchema = z.object(stakeholderFields).partial();
export type UpdateStakeholderInput = z.infer<typeof updateStakeholderSchema>;

/** Partie prenante telle que renvoyée par l'API. */
export interface StakeholderDto {
  id: string;
  initiativeId: string;
  name: string;
  kind: StakeholderKind;
  roles: StakeholderRole[];
  influence: StakeholderLevel | null;
  interest: StakeholderLevel | null;
  contact: string | null;
  /** Texte mis en forme (voir rich-text.ts) ; null si vide. */
  notes: string | null;
  /** Compte relié ; `member` : encore membre de l'initiative (le lien reste sinon, signalé). */
  user: (MemberNameDto & { member: boolean }) | null;
  createdAt: string;
  createdBy: MemberNameDto;
  updatedAt: string;
  updatedBy: MemberNameDto;
}

/** Partie prenante liée à une action, telle que l'action la montre. */
export interface StakeholderRefDto {
  id: string;
  name: string;
}

type Cells<T> = Record<StakeholderLevel, Record<StakeholderLevel, T[]>>;

/** Par ordre alphabétique du nom, sans tenir compte de la casse ni des accents. */
export function sortByName<T extends { name: string }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/**
 * Matrice influence × intérêt : `cells[influence][interest]`, chaque case par
 * ordre alphabétique ; sans influence ou sans intérêt, à part (`unpositioned`).
 */
export function stakeholderMatrix<T extends Pick<StakeholderDto, 'name' | 'influence' | 'interest'>>(
  stakeholders: readonly T[],
): { cells: Cells<T>; unpositioned: T[] } {
  const row = () => ({ low: [] as T[], medium: [] as T[], high: [] as T[] });
  const cells: Cells<T> = { low: row(), medium: row(), high: row() };
  const unpositioned: T[] = [];
  for (const s of sortByName(stakeholders)) {
    if (s.influence && s.interest) cells[s.influence][s.interest].push(s);
    else unpositioned.push(s);
  }
  return { cells, unpositioned };
}

/**
 * Comptes que l'on peut relier à une fiche : les membres de l'initiative, quel
 * que soit leur rôle, sauf ceux déjà reliés à une autre fiche (un utilisateur
 * est relié à au plus une fiche par initiative). `stakeholderId` : la fiche
 * modifiée, null à la création.
 */
export function linkableMembers<M extends { userId: string }>(
  members: readonly M[],
  stakeholders: readonly Pick<StakeholderDto, 'id' | 'user'>[],
  stakeholderId: string | null,
): M[] {
  const taken = new Set(stakeholders.filter((s) => s.id !== stakeholderId).map((s) => s.user?.userId));
  return members.filter((m) => !taken.has(m.userId));
}

/**
 * Refus d'une écriture sur une partie prenante, renvoyés par l'API (`refusal`) :
 * - `userNotMember` : le compte à relier n'est pas membre de l'initiative ;
 * - `userAlreadyLinked` : ce compte est déjà relié à une autre fiche de l'initiative ;
 * - `unknownStakeholder` : une action est liée à une partie prenante absente de l'initiative ;
 * - `stakeholderLinked` : la partie prenante est liée à une action, à l’origine d’un besoin ou source d’une exigence.
 */
export const STAKEHOLDER_REFUSALS = ['userNotMember', 'userAlreadyLinked', 'unknownStakeholder', 'stakeholderLinked'] as const;
export type StakeholderRefusal = (typeof STAKEHOLDER_REFUSALS)[number];
export const isStakeholderRefusal = (value: unknown): value is StakeholderRefusal =>
  STAKEHOLDER_REFUSALS.some((r) => r === value);
