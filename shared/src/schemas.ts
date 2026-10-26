// Schémas de validation partagés par l'API, le web et le mobile.
import { z } from 'zod';
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

export const updateInitiativeSchema = z.object({
  name: initiativeNameSchema,
});
export type UpdateInitiativeInput = z.infer<typeof updateInitiativeSchema>;

export const addMemberSchema = z.object({
  email: z.email(),
  role: initiativeRoleSchema,
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

/** Initiative telle que renvoyée par l'API, avec le rôle de l'utilisateur courant. */
export interface InitiativeDto {
  id: string;
  code: string;
  name: string;
  createdAt: string;
  myRole: z.infer<typeof initiativeRoleSchema>;
}

export interface InitiativeMemberDto {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: z.infer<typeof initiativeRoleSchema>;
  /** Membre de l'équipe BA de l'initiative (ADR-0015). */
  isTeamBa: boolean;
}

/** Configuration publique servie par l'API à /api/config (web et mobile). */
export interface PublicConfigDto {
  oidcIssuerUrl: string;
  webClientId: string;
  mobileClientId: string;
  powersyncUrl: string | null;
}
