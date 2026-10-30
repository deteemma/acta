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
  editCode: 'owner',
  /** Archiver et désarchiver. */
  archive: 'owner',
  /** Inviter un membre. */
  manageMembers: 'owner',
  /**
   * Changer le rôle ou l'indication « BA de l'équipe » d'un membre, retirer un
   * membre ou quitter l'initiative : le détail est vérifié par checkTeamChange (team.ts).
   */
  changeTeam: 'reader',
  delete: 'owner',
  /** Créer, modifier et supprimer une action (ticket 07). */
  editActions: 'contributor',
  /** Créer, modifier et supprimer une partie prenante (ticket 08). */
  editStakeholders: 'contributor',
} as const satisfies Record<string, InitiativeRole>;

export type InitiativeAction = keyof typeof INITIATIVE_PERMISSIONS;

/**
 * Une initiative archivée est en lecture seule : on peut seulement la désarchiver,
 * la supprimer ou la quitter (changeTeam, restreint au départ par checkTeamChange).
 */
const ALLOWED_WHEN_ARCHIVED: readonly InitiativeAction[] = ['view', 'archive', 'delete', 'changeTeam'];

export function can(
  role: InitiativeRole | null | undefined,
  action: InitiativeAction,
  initiative: { archived: boolean } = { archived: false },
): boolean {
  if (initiative.archived && !ALLOWED_WHEN_ARCHIVED.includes(action)) return false;
  return hasAtLeast(role, INITIATIVE_PERMISSIONS[action]);
}
