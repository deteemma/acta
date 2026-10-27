// Équipe d'une initiative (ADR-0015) : écrit une seule fois ici, appliqué par
// l'API et reproduit en base (déclencheurs et RLS, ADR-0006).
import type { InitiativeRole } from './roles.js';

export interface TeamMember {
  userId: string;
  role: InitiativeRole;
  isTeamBa: boolean;
}

export type TeamChange =
  | { kind: 'invite'; userId: string; role: InitiativeRole; isTeamBa: boolean }
  | { kind: 'setRole'; userId: string; role: InitiativeRole }
  | { kind: 'setTeamBa'; userId: string; isTeamBa: boolean }
  | { kind: 'remove'; userId: string };

/** Motifs de refus, renvoyés par l'API (champ `refusal`) et traduits (`team.refusal.*`). */
export const TEAM_CHANGE_REFUSALS = [
  'forbidden',
  'alreadyMember',
  'notMember',
  'lastOwner',
  'lastTeamBa',
  'readerCannotBeTeamBa',
  'removeTeamBaFirst',
] as const;
export type TeamChangeRefusal = (typeof TEAM_CHANGE_REFUSALS)[number];

/**
 * Vérifie un changement de l'équipe demandé par `actorId` ; null s'il est permis.
 * L'archivage (lecture seule) est vérifié à part, par `can` (roles.ts).
 */
export function checkTeamChange(
  team: readonly TeamMember[],
  actorId: string,
  change: TeamChange,
): TeamChangeRefusal | null {
  const actor = team.find((m) => m.userId === actorId);
  if (!actor) return 'forbidden';
  const isOwner = actor.role === 'owner';
  const self = change.userId === actorId;
  const target = team.find((m) => m.userId === change.userId);

  let after: TeamMember[];
  if (change.kind === 'invite') {
    if (!isOwner) return 'forbidden';
    if (target) return 'alreadyMember';
    after = [...team, { userId: change.userId, role: change.role, isTeamBa: change.isTeamBa }];
  } else {
    if (!target) return 'notMember';
    switch (change.kind) {
      case 'setRole': {
        // Subsidiarité : un BA de l'équipe peut seulement ajouter un propriétaire.
        const designatesOwner = change.role === 'owner' && target.role !== 'owner';
        if (!isOwner && !(actor.isTeamBa && designatesOwner)) return 'forbidden';
        // L'indication n'est pas retirée d'office : on la retire d'abord.
        if (target.isTeamBa && change.role === 'reader') return 'removeTeamBaFirst';
        after = team.map((m) => (m.userId === change.userId ? { ...m, role: change.role } : m));
        break;
      }
      case 'setTeamBa':
        if (!isOwner && !actor.isTeamBa) return 'forbidden';
        // Sur soi-même, l'indication se retire mais ne s'attribue pas.
        if (self && change.isTeamBa) return 'forbidden';
        after = team.map((m) => (m.userId === change.userId ? { ...m, isTeamBa: change.isTeamBa } : m));
        break;
      case 'remove':
        // Tout membre peut quitter l'initiative ; seul un propriétaire retire un autre membre.
        if (!self && !isOwner) return 'forbidden';
        after = team.filter((m) => m.userId !== change.userId);
        break;
    }
  }

  if (after.some((m) => m.isTeamBa && m.role === 'reader')) return 'readerCannotBeTeamBa';
  // Une initiative a toujours au moins un propriétaire…
  if (!after.some((m) => m.role === 'owner')) return 'lastOwner';
  // … et au moins un BA de l'équipe.
  if (!after.some((m) => m.isTeamBa)) return 'lastTeamBa';
  return null;
}
