// Administration des comptes (ticket 05, ADR-0005) : écrit une seule fois ici,
// appliqué par l'API et reproduit en base pour la désignation d'un propriétaire.
import type { InitiativeRole } from './roles.js';
import type { UpdateAccountInput } from './schemas.js';

/** Motifs de refus de l'administration, renvoyés par l'API (champ `refusal`) et traduits (`admin.refusal.*`). */
export const ADMIN_REFUSALS = ['forbidden', 'self', 'hasActiveOwner', 'notMember', 'inactiveAccount', 'accountExists'] as const;
export type AdminRefusal = (typeof ADMIN_REFUSALS)[number];

export const isAdminRefusal = (value: unknown): value is AdminRefusal => ADMIN_REFUSALS.some((r) => r === value);

/** État actuel d'un compte dans Keycloak. */
export interface AccountState {
  id: string;
  enabled: boolean;
  isAdmin: boolean;
}

/**
 * Vérifie un changement du compte `targetId` demandé par `actorId`, d'après
 * l'état actuel des comptes ; null s'il est permis.
 *
 * L'application garde toujours au moins un administrateur actif : l'auteur doit
 * l'être encore (son jeton peut dater d'avant le retrait de son rôle) et ne peut
 * ni se désactiver, ni se retirer le rôle. Il reste donc lui-même après le changement.
 */
export function checkAccountChange(
  accounts: readonly AccountState[],
  actorId: string,
  targetId: string,
  change: UpdateAccountInput,
): AdminRefusal | null {
  const actor = accounts.find((a) => a.id === actorId);
  if (!actor?.enabled || !actor.isAdmin) return 'forbidden';
  const removesOwnAccess = 'enabled' in change ? !change.enabled : !change.isAdmin;
  return actorId === targetId && removesOwnAccess ? 'self' : null;
}

/** Membre d'une initiative, vu par l'administrateur : son compte est-il actif (non désactivé) ? */
export interface AccountMember {
  userId: string;
  role: InitiativeRole;
  active: boolean;
}

/** Une initiative est « sans propriétaire actif » quand tous ses propriétaires ont un compte désactivé. */
export const hasActiveOwner = (members: readonly AccountMember[]): boolean =>
  members.some((m) => m.role === 'owner' && m.active);

/**
 * Vérifie la désignation de `targetId` comme propriétaire par l'administrateur,
 * même sur une initiative archivée ; null si elle est permise.
 */
export function checkAdminOwnerDesignation(members: readonly AccountMember[], targetId: string): AdminRefusal | null {
  if (hasActiveOwner(members)) return 'hasActiveOwner';
  const target = members.find((m) => m.userId === targetId);
  if (!target) return 'notMember';
  if (!target.active) return 'inactiveAccount';
  return null;
}
