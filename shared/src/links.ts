// Liens (phase 2, ticket 19, décision 04) : entre deux tickets, avec une nature,
// et d'un ticket vers un besoin ou une exigence, sans nature. Règles écrites une
// seule fois ici, appliquées par l'API et reproduites par la base (migration 0022).
// Ni la création ni le retrait d'un lien ne figurent dans un historique.
import { z } from 'zod';
import { sortByReference } from './references.js';

/** Natures enregistrées, liste fixe : « bloque » et « duplique » sont orientés, « est lié à » ne l'est pas. */
export const LINK_KINDS = ['blocks', 'duplicates', 'relates_to'] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

/** Nature vue depuis l'un des deux tickets : c'est ce que l'on choisit et ce que chaque côté affiche. */
export const LINK_SIDES = ['blocks', 'blocked_by', 'duplicates', 'duplicated_by', 'relates_to'] as const;
export type LinkSide = (typeof LINK_SIDES)[number];

/** Lien entre deux tickets, tel qu'enregistré : la source « bloque » ou « duplique » la cible. */
export interface OrientedTicketLink {
  sourceId: string;
  targetId: string;
  kind: LinkKind;
}

const REVERSED_SIDES: Partial<Record<LinkSide, LinkKind>> = { blocked_by: 'blocks', duplicated_by: 'duplicates' };

/** Lien créé depuis `ticketId` vers `otherTicketId`, avec la nature vue depuis `ticketId`. */
export function orientTicketLink(ticketId: string, otherTicketId: string, side: LinkSide): OrientedTicketLink {
  const reversed = REVERSED_SIDES[side];
  return reversed
    ? { sourceId: otherTicketId, targetId: ticketId, kind: reversed }
    : { sourceId: ticketId, targetId: otherTicketId, kind: side as LinkKind };
}

/** Nature du lien telle que l'affiche le ticket `ticketId`, l'un de ses deux bouts. */
export function linkSide(link: OrientedTicketLink, ticketId: string): LinkSide {
  if (link.kind === 'relates_to' || link.sourceId === ticketId) return link.kind;
  return link.kind === 'blocks' ? 'blocked_by' : 'duplicated_by';
}

/**
 * Refus d'une écriture sur un lien, renvoyés par l'API (`refusal`) :
 * - `selfLink` : un ticket ne se lie pas à lui-même ;
 * - `alreadyLinked` : ces deux objets sont déjà liés (entre deux tickets, quelle que soit la nature) ;
 * - `unknownTicket` : ce ticket n'existe pas dans l'initiative.
 */
export const LINK_REFUSALS = ['selfLink', 'alreadyLinked', 'unknownTicket'] as const;
export type LinkRefusal = (typeof LINK_REFUSALS)[number];
export const isLinkRefusal = (value: unknown): value is LinkRefusal => LINK_REFUSALS.some((r) => r === value);

/** Vrai si le lien relie ces deux tickets, dans un sens ou dans l'autre. */
export const linksPair = (link: OrientedTicketLink, a: string, b: string) =>
  (link.sourceId === a && link.targetId === b) || (link.sourceId === b && link.targetId === a);

/** Un lien entre deux tickets est-il permis ? null s'il l'est. */
export function checkTicketLink(
  links: readonly OrientedTicketLink[],
  ticketId: string,
  otherTicketId: string,
): LinkRefusal | null {
  if (ticketId === otherTicketId) return 'selfLink';
  return links.some((link) => linksPair(link, ticketId, otherTicketId)) ? 'alreadyLinked' : null;
}

/** Création d'un lien entre deux tickets, depuis `ticketId` : la nature est celle que ce ticket affichera. */
export const createTicketLinkSchema = z.object({
  ticketId: z.uuid(),
  otherTicketId: z.uuid(),
  side: z.enum(LINK_SIDES),
});
export type CreateTicketLinkInput = z.infer<typeof createTicketLinkSchema>;

/** Création d'un lien, sans nature, entre un ticket de tout type et un besoin. */
export const createNeedLinkSchema = z.object({ ticketId: z.uuid(), needId: z.uuid() });
export type CreateNeedLinkInput = z.infer<typeof createNeedLinkSchema>;

/** De même avec une exigence. */
export const createRequirementLinkSchema = z.object({ ticketId: z.uuid(), requirementId: z.uuid() });
export type CreateRequirementLinkInput = z.infer<typeof createRequirementLinkSchema>;

/** Liens d'une initiative, tels que renvoyés par l'API ; les fiches les croisent avec les objets qu'elles ont chargés. */
export interface InitiativeLinksDto {
  ticketLinks: OrientedTicketLink[];
  needLinks: { ticketId: string; needId: string }[];
  requirementLinks: { ticketId: string; requirementId: string }[];
}

/** Objet qui porte des liens : un ticket, un besoin ou une exigence. */
export interface LinkEnd {
  kind: 'ticket' | 'need' | 'requirement';
  id: string;
}

interface Referenced {
  id: string;
  reference: string;
}

/** Objets de l'initiative parmi lesquels se trouvent les bouts des liens. */
export interface LinkableObjects<T extends Referenced, N extends Referenced, R extends Referenced> {
  tickets: readonly T[];
  needs: readonly N[];
  requirements: readonly R[];
}

const pick = <O extends Referenced>(objects: readonly O[], ids: readonly string[]) =>
  sortByReference(objects.filter((o) => ids.includes(o.id)));

const omit = <O extends Referenced>(objects: readonly O[], ids: readonly string[]) =>
  sortByReference(objects.filter((o) => !ids.includes(o.id)));

/** Identifiants des objets liés à `end`, par sorte d'objet. */
function linkedIds(links: InitiativeLinksDto, end: LinkEnd): { tickets: string[]; needs: string[]; requirements: string[] } {
  if (end.kind === 'need') {
    return { tickets: links.needLinks.filter((l) => l.needId === end.id).map((l) => l.ticketId), needs: [], requirements: [] };
  }
  if (end.kind === 'requirement') {
    const tickets = links.requirementLinks.filter((l) => l.requirementId === end.id).map((l) => l.ticketId);
    return { tickets, needs: [], requirements: [] };
  }
  return {
    tickets: links.ticketLinks.flatMap((l) =>
      l.sourceId === end.id ? [l.targetId] : l.targetId === end.id ? [l.sourceId] : [],
    ),
    needs: links.needLinks.filter((l) => l.ticketId === end.id).map((l) => l.needId),
    requirements: links.requirementLinks.filter((l) => l.ticketId === end.id).map((l) => l.requirementId),
  };
}

/** Fiche d'un ticket : tickets liés, chacun avec la nature vue de ce ticket, besoins et exigences, par référence. */
export function linksOfTicket<T extends Referenced, N extends Referenced, R extends Referenced>(
  links: InitiativeLinksDto,
  ticketId: string,
  objects: LinkableObjects<T, N, R>,
): { tickets: { side: LinkSide; ticket: T }[]; needs: N[]; requirements: R[] } {
  const ids = linkedIds(links, { kind: 'ticket', id: ticketId });
  return {
    tickets: pick(objects.tickets, ids.tickets).map((ticket) => ({
      side: linkSide(links.ticketLinks.find((l) => linksPair(l, ticketId, ticket.id))!, ticketId),
      ticket,
    })),
    needs: pick(objects.needs, ids.needs),
    requirements: pick(objects.requirements, ids.requirements),
  };
}

/** Fiche d'un besoin ou d'une exigence : ses tickets, de tout type, par référence. */
export function ticketsLinkedTo<T extends Referenced>(
  links: InitiativeLinksDto,
  end: LinkEnd & { kind: 'need' | 'requirement' },
  tickets: readonly T[],
): T[] {
  return pick(tickets, linkedIds(links, end).tickets);
}

/** Objets proposés à l'ajout d'un lien depuis `end` : ni lui-même ni un objet déjà lié, par référence. */
export function linkCandidates<T extends Referenced, N extends Referenced, R extends Referenced>(
  links: InitiativeLinksDto,
  end: LinkEnd,
  objects: LinkableObjects<T, N, R>,
): { tickets: T[]; needs: N[]; requirements: R[] } {
  const ids = linkedIds(links, end);
  if (end.kind !== 'ticket') return { tickets: omit(objects.tickets, ids.tickets), needs: [], requirements: [] };
  return {
    tickets: omit(objects.tickets, [...ids.tickets, end.id]),
    needs: omit(objects.needs, ids.needs),
    requirements: omit(objects.requirements, ids.requirements),
  };
}
