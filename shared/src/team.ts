// Équipe d'une initiative (ADR-0015) : écrit une seule fois ici, appliqué par
// l'API et reproduit en base (déclencheurs et RLS, ADR-0006).
import { INITIATIVE_ROLES, type InitiativeRole } from './roles.js';

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

/** Motifs de refus d'un changement, renvoyés par l'API (champ `refusal`) et traduits (`team.refusal.*`). */
export const TEAM_CHANGE_REFUSALS = [
  'forbidden',
  'archived',
  'alreadyMember',
  'notMember',
  'lastOwner',
  'lastTeamBa',
  'readerCannotBeTeamBa',
  'removeTeamBaFirst',
] as const;
export type TeamChangeRefusal = (typeof TEAM_CHANGE_REFUSALS)[number];

/** Tous les refus de l'équipe : ceux de checkTeamChange, plus ceux de checkInvitee. */
export const TEAM_REFUSALS = [...TEAM_CHANGE_REFUSALS, 'userNotFound', 'inactiveAccount'] as const;
export type TeamRefusal = (typeof TEAM_REFUSALS)[number];

/**
 * Vérifie la personne invitée, trouvée par son courriel (null si inconnue) :
 * elle s'est connectée au moins une fois et son compte n'est pas désactivé.
 */
export function checkInvitee(invitee: { userId: string; active: boolean } | null): 'userNotFound' | 'inactiveAccount' | null {
  if (!invitee) return 'userNotFound';
  return invitee.active ? null : 'inactiveAccount';
}

export const isTeamRefusal = (value: unknown): value is TeamRefusal => TEAM_REFUSALS.some((r) => r === value);

/** L'indication « BA de l'équipe » est réservée aux propriétaires et contributeurs. */
export const canCarryTeamBa = (role: InitiativeRole): boolean => role !== 'reader';

/** Vérifie un changement de l'équipe demandé par `actorId` ; null s'il est permis. */
export function checkTeamChange(
  team: readonly TeamMember[],
  actorId: string,
  change: TeamChange,
  initiative: { archived: boolean } = { archived: false },
): TeamChangeRefusal | null {
  const actor = team.find((m) => m.userId === actorId);
  if (!actor) return 'forbidden';
  const isOwner = actor.role === 'owner';
  const self = change.userId === actorId;
  const target = team.find((m) => m.userId === change.userId);
  // Initiative archivée : lecture seule, mais chacun peut encore la quitter.
  if (initiative.archived && !(change.kind === 'remove' && self)) return 'archived';

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

  if (after.some((m) => m.isTeamBa && !canCarryTeamBa(m.role))) return 'readerCannotBeTeamBa';
  // Une initiative a toujours au moins un propriétaire…
  if (!after.some((m) => m.role === 'owner')) return 'lastOwner';
  // … et au moins un BA de l'équipe.
  if (!after.some((m) => m.isTeamBa)) return 'lastTeamBa';
  return null;
}

/** Contrôles à proposer à `actorId` sur le membre `targetId` (écran de l'équipe). */
export interface TeamControls {
  /** Choisir n'importe quel rôle (propriétaire). */
  setRole: boolean;
  /** Désigner propriétaire, sans autre changement de rôle (BA de l'équipe non propriétaire). */
  designateOwner: boolean;
  /** Attribuer ou retirer l'indication « BA de l'équipe ». */
  toggleTeamBa: boolean;
  /** Retirer le membre, ou quitter l'initiative s'il s'agit de soi. */
  remove: boolean;
}

/**
 * Un contrôle est proposé quand l'utilisateur en a le droit ; les autres refus
 * (dernier propriétaire, dernier BA…) s'affichent quand il s'en sert.
 */
export function teamControls(
  team: readonly TeamMember[],
  actorId: string,
  targetId: string,
  initiative: { archived: boolean } = { archived: false },
): TeamControls {
  const target = team.find((m) => m.userId === targetId);
  if (!target) return { setRole: false, designateOwner: false, toggleTeamBa: false, remove: false };
  const allowed = (change: TeamChange) => {
    const refusal = checkTeamChange(team, actorId, change, initiative);
    return refusal !== 'forbidden' && refusal !== 'archived';
  };
  const setRole = INITIATIVE_ROLES.every((role) => allowed({ kind: 'setRole', userId: targetId, role }));
  return {
    setRole,
    designateOwner:
      !setRole && target.role !== 'owner' && allowed({ kind: 'setRole', userId: targetId, role: 'owner' }),
    toggleTeamBa:
      canCarryTeamBa(target.role) && allowed({ kind: 'setTeamBa', userId: targetId, isTeamBa: !target.isTeamBa }),
    remove: allowed({ kind: 'remove', userId: targetId }),
  };
}
