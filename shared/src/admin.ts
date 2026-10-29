// Administration des comptes (ticket 05, ADR-0005) : écrit une seule fois ici,
// appliqué par l'API et reproduit en base pour la désignation d'un propriétaire.
import type { InitiativeRole } from './roles.js';
import type { UpdateAccountInput } from './schemas.js';

/** Motifs de refus de l'administration, renvoyés par l'API (champ `refusal`) et traduits (`admin.refusal.*`). */
export const ADMIN_REFUSALS = ['self', 'hasActiveOwner', 'notMember', 'inactiveAccount', 'accountExists'] as const;
export type AdminRefusal = (typeof ADMIN_REFUSALS)[number];

export const isAdminRefusal = (value: unknown): value is AdminRefusal => ADMIN_REFUSALS.some((r) => r === value);

/** Vérifie un changement du compte `targetId` demandé par l'administrateur `actorId` ; null s'il est permis. */
export function checkAccountChange(actorId: string, targetId: string, change: UpdateAccountInput): AdminRefusal | null {
  // Ni se désactiver, ni se retirer le rôle : l'application garde un administrateur.
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
