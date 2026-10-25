// Schémas de validation partagés par l'API, le web et le mobile.
import { z } from 'zod';
import { PROJECT_ROLES } from './roles.js';

export const projectRoleSchema = z.enum(PROJECT_ROLES);

export const projectNameSchema = z.string().trim().min(1).max(120);

export const createProjectSchema = z.object({
  // Fourni par le mobile hors ligne, qui crée le projet localement avant de le
  // synchroniser ; généré par l'API sinon.
  id: z.uuid().optional(),
  name: projectNameSchema,
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: projectNameSchema,
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const addMemberSchema = z.object({
  email: z.email(),
  role: projectRoleSchema,
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

/** Projet tel que renvoyé par l'API, avec le rôle de l'utilisateur courant. */
export interface ProjectDto {
  id: string;
  name: string;
  createdAt: string;
  myRole: z.infer<typeof projectRoleSchema>;
}

export interface ProjectMemberDto {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: z.infer<typeof projectRoleSchema>;
}

/** Configuration publique servie par l'API à /api/config (web et mobile). */
export interface PublicConfigDto {
  oidcIssuerUrl: string;
  webClientId: string;
  mobileClientId: string;
  powersyncUrl: string | null;
}
