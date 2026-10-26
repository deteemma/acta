// Rôles et permissions : écrits une seule fois ici (ADR-0002), appliqués par
// les guards de l'API et reproduits par les politiques RLS (ADR-0006).

/** Rôles d'un membre sur une initiative (l'ENTITÉ PARTAGÉE d'ACTA). */
export const INITIATIVE_ROLES = ['owner', 'contributor', 'reader'] as const;
export type InitiativeRole = (typeof INITIATIVE_ROLES)[number];

/** Rôle global de l'application, porté par le jeton Keycloak (ADR-0005). */
export const APP_ADMIN_ROLE = 'administrateur';

const RANK: Record<InitiativeRole, number> = { reader: 1, contributor: 2, owner: 3 };

/** Vrai si `role` donne au moins les droits de `required`. */
export function hasAtLeast(role: InitiativeRole | null | undefined, required: InitiativeRole): boolean {
  return role != null && RANK[role] >= RANK[required];
}

/** Rôle minimal requis pour chaque action sur une initiative. */
export const INITIATIVE_PERMISSIONS = {
  view: 'reader',
  edit: 'contributor',
  manageMembers: 'owner',
  delete: 'owner',
} as const satisfies Record<string, InitiativeRole>;

export type InitiativeAction = keyof typeof INITIATIVE_PERMISSIONS;

export function can(role: InitiativeRole | null | undefined, action: InitiativeAction): boolean {
  return hasAtLeast(role, INITIATIVE_PERMISSIONS[action]);
}
