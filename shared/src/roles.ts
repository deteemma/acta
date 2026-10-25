// Rôles et permissions : écrits une seule fois ici (ADR-0002), appliqués par
// les guards de l'API et reproduits par les politiques RLS (ADR-0006).

/** Rôles d'un membre sur un projet (l'ENTITÉ PARTAGÉE d'exemple). */
export const PROJECT_ROLES = ['owner', 'contributor', 'reader'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

/** Rôle global de l'application, porté par le jeton Keycloak (ADR-0005). */
export const APP_ADMIN_ROLE = 'administrateur';

const RANK: Record<ProjectRole, number> = { reader: 1, contributor: 2, owner: 3 };

/** Vrai si `role` donne au moins les droits de `required`. */
export function hasAtLeast(role: ProjectRole | null | undefined, required: ProjectRole): boolean {
  return role != null && RANK[role] >= RANK[required];
}

/** Rôle minimal requis pour chaque action sur un projet. */
export const PROJECT_PERMISSIONS = {
  view: 'reader',
  edit: 'contributor',
  manageMembers: 'owner',
  delete: 'owner',
} as const satisfies Record<string, ProjectRole>;

export type ProjectAction = keyof typeof PROJECT_PERMISSIONS;

export function can(role: ProjectRole | null | undefined, action: ProjectAction): boolean {
  return hasAtLeast(role, PROJECT_PERMISSIONS[action]);
}
