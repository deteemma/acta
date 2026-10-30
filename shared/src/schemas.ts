// Schémas de validation partagés par l'API, le web et le mobile.
import { z } from 'zod';
import { LOCALES } from './i18n.js';
import { INITIATIVE_ROLES } from './roles.js';

export const initiativeRoleSchema = z.enum(INITIATIVE_ROLES);

export const initiativeNameSchema = z.string().trim().min(1).max(120);

/** Code d'initiative : 2 à 10 lettres majuscules ou chiffres, commençant par une lettre. */
export const INITIATIVE_CODE_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;
export const initiativeCodeSchema = z.string().trim().regex(INITIATIVE_CODE_PATTERN);

export const createInitiativeSchema = z.object({
  // Fourni par le mobile hors ligne, qui crée l’initiative localement avant de la
  // synchroniser ; généré par l'API sinon.
  id: z.uuid().optional(),
  code: initiativeCodeSchema,
  name: initiativeNameSchema,
});
export type CreateInitiativeInput = z.infer<typeof createInitiativeSchema>;

/** Approche d'analyse d'une initiative (tâche BABOK 3.1). */
export const ANALYSIS_APPROACHES = ['predictive', 'adaptive'] as const;
export type AnalysisApproach = (typeof ANALYSIS_APPROACHES)[number];
export const analysisApproachSchema = z.enum(ANALYSIS_APPROACHES);

/** Texte libre facultatif, sans mise en forme ; vide = pas de description. */
export const INITIATIVE_DESCRIPTION_MAX_LENGTH = 4000;
export const initiativeDescriptionSchema = z
  .string()
  .trim()
  .max(INITIATIVE_DESCRIPTION_MAX_LENGTH)
  .transform((text) => text || null)
  .nullable();

/** Date sans heure, au format AAAA-MM-JJ. */
const optionalDateSchema = z.iso.date().nullable();

/**
 * Modification de la fiche : seuls les champs fournis changent (le mobile hors
 * ligne n'envoie que le nom). Le code n'est modifiable que par le propriétaire.
 */
export const updateInitiativeSchema = z
  .object({
    code: initiativeCodeSchema,
    name: initiativeNameSchema,
    description: initiativeDescriptionSchema,
    analysisApproach: analysisApproachSchema.nullable(),
    startDate: optionalDateSchema,
    plannedEndDate: optionalDateSchema,
  })
  .partial()
  // Si les deux dates sont fournies, la fin prévue ne précède pas le début ;
  // la base vérifie aussi le cas où une seule des deux change.
  .refine((i) => !i.startDate || !i.plannedEndDate || i.plannedEndDate >= i.startDate, {
    path: ['plannedEndDate'],
  });
export type UpdateInitiativeInput = z.infer<typeof updateInitiativeSchema>;

/** Invitation d'un utilisateur connecté au moins une fois (règles d'équipe : team.ts). */
export const addMemberSchema = z.object({
  email: z.email(),
  role: initiativeRoleSchema,
  isTeamBa: z.boolean().default(false),
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

/** Une modification de membre change soit son rôle, soit son indication « BA de l'équipe ». */
export const updateMemberSchema = z.union([
  z.strictObject({ role: initiativeRoleSchema }),
  z.strictObject({ isTeamBa: z.boolean() }),
]);
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

/** Initiative telle que renvoyée par l'API, avec le rôle de l'utilisateur courant. */
export interface InitiativeDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  analysisApproach: AnalysisApproach | null;
  /** AAAA-MM-JJ */
  startDate: string | null;
  /** AAAA-MM-JJ */
  plannedEndDate: string | null;
  /** Date d'archivage ; null pour une initiative active. */
  archivedAt: string | null;
  createdAt: string;
  myRole: z.infer<typeof initiativeRoleSchema>;
  /** Une référence a déjà été attribuée dans l'initiative : son code ne change plus (ticket 09). */
  codeFrozen: boolean;
}

export interface InitiativeMemberDto {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: z.infer<typeof initiativeRoleSchema>;
  /** Membre de l'équipe BA de l'initiative (ADR-0015). */
  isTeamBa: boolean;
  /** Vrai pour l'utilisateur courant. */
  isMe: boolean;
}

/** Désignation d'un propriétaire, tracée à chaque passage au rôle de propriétaire (ADR-0015). */
export interface OwnerDesignationDto {
  /** Nouveau propriétaire. */
  user: MemberNameDto;
  /** Auteur de la désignation ; null si faite hors de l'application. */
  designatedBy: MemberNameDto | null;
  designatedAt: string;
}

/** Nom d'un utilisateur, qu'il soit encore membre ou non. */
export interface MemberNameDto {
  userId: string;
  email: string | null;
  displayName: string | null;
}

export const localeSchema = z.enum(LOCALES);

export const updateMeSchema = z.object({
  locale: localeSchema,
});
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

/** Utilisateur courant ; `locale` vaut null tant qu'il n'a pas choisi sa langue. */
export interface MeDto {
  id: string;
  email: string | null;
  displayName: string | null;
  locale: z.infer<typeof localeSchema> | null;
  /** Porte le rôle administrateur de l'application (ADR-0005). */
  isAdmin: boolean;
}

/**
 * Création d'un compte par l'administrateur (ticket 05). Le mot de passe est
 * temporaire : la personne le change à sa première connexion.
 */
export const TEMPORARY_PASSWORD_MIN_LENGTH = 6;
export const createAccountSchema = z.object({
  username: z.string().trim().min(1).max(255),
  email: z.email(),
  firstName: z.string().trim().min(1).max(255),
  lastName: z.string().trim().min(1).max(255),
  temporaryPassword: z.string().min(TEMPORARY_PASSWORD_MIN_LENGTH),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

/** Une modification de compte l'active ou le désactive, ou donne ou retire le rôle administrateur. */
export const updateAccountSchema = z.union([
  z.strictObject({ enabled: z.boolean() }),
  z.strictObject({ isAdmin: z.boolean() }),
]);
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

/** Compte de l'application, tel que Keycloak le connaît. Jamais supprimé, seulement désactivé. */
export interface AccountDto {
  id: string;
  username: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  enabled: boolean;
  isAdmin: boolean;
  createdAt: string | null;
}

/**
 * Initiative sans propriétaire actif, vue par l'administrateur : son nom, son
 * code et ses membres, rien d'autre de son contenu.
 */
export interface OrphanInitiativeDto {
  id: string;
  code: string;
  name: string;
  members: OrphanInitiativeMemberDto[];
}

export interface OrphanInitiativeMemberDto extends MemberNameDto {
  role: z.infer<typeof initiativeRoleSchema>;
  /** Compte non désactivé. */
  active: boolean;
}

export const designateOwnerSchema = z.object({ userId: z.string().min(1) });
export type DesignateOwnerInput = z.infer<typeof designateOwnerSchema>;

/** Configuration publique servie par l'API à /api/config (web et mobile). */
export interface PublicConfigDto {
  oidcIssuerUrl: string;
  webClientId: string;
  mobileClientId: string;
  powersyncUrl: string | null;
}
