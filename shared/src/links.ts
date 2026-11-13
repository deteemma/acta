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
 * - `unknownTicket` : ce ticket n'existe pas dans l'initiative ;
 * - `unknownLinkedPage` : cette page n'existe pas dans l'initiative (pas de lien entre initiatives).
 */
export const LINK_REFUSALS = ['selfLink', 'alreadyLinked', 'unknownTicket', 'unknownLinkedPage'] as const;
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

/** Objet auquel une page se lie (ticket 25, décision 04, point 5) : jamais une autre page. */
export const PAGE_LINK_OBJECT_KINDS = ['ticket', 'need', 'requirement'] as const;
export type PageLinkObjectKind = (typeof PAGE_LINK_OBJECT_KINDS)[number];

/** Lien, sans nature, entre une page et un ticket de tout type, un besoin ou une exigence. */
export interface PageLinkDto {
  pageId: string;
  object: { kind: PageLinkObjectKind; id: string };
}

/** Création d'un lien de page, depuis la page ou depuis l'autre objet. */
export const createPageLinkSchema = z.object({
  pageId: z.uuid(),
  object: z.object({ kind: z.enum(PAGE_LINK_OBJECT_KINDS), id: z.uuid() }),
});
export type CreatePageLinkInput = z.infer<typeof createPageLinkSchema>;

/** Liens d'une initiative, tels que renvoyés par l'API ; les fiches les croisent avec les objets qu'elles ont chargés. */
export interface InitiativeLinksDto {
  ticketLinks: OrientedTicketLink[];
  needLinks: { ticketId: string; needId: string }[];
  requirementLinks: { ticketId: string; requirementId: string }[];
  pageLinks: readonly PageLinkDto[];
}

/** Objet qui porte des liens : un ticket, un besoin, une exigence ou une page. */
export interface LinkEnd {
  kind: 'ticket' | 'need' | 'requirement' | 'page';
  id: string;
}

/** Vrai si la page porte au moins un lien : elle ne se supprime pas (décision 04, point 7). */
export const pageHasLinks = (links: Pick<InitiativeLinksDto, 'pageLinks'>, pageId: string) =>
  links.pageLinks.some((l) => l.pageId === pageId);

interface Referenced {
  id: string;
  reference: string;
}

/** Objets de l'initiative parmi lesquels se trouvent les bouts des liens. */
export interface LinkableObjects<T extends Referenced, N extends Referenced, R extends Referenced, P extends Referenced = Referenced> {
  tickets: readonly T[];
  needs: readonly N[];
  requirements: readonly R[];
  pages: readonly P[];
}

const pick = <O extends Referenced>(objects: readonly O[], ids: readonly string[]) =>
  sortByReference(objects.filter((o) => ids.includes(o.id)));

const omit = <O extends Referenced>(objects: readonly O[], ids: readonly string[]) =>
  sortByReference(objects.filter((o) => !ids.includes(o.id)));

interface LinkedIds {
  tickets: string[];
  needs: string[];
  requirements: string[];
  pages: string[];
}

/** Identifiants des objets liés à `end`, par sorte d'objet. */
function linkedIds(links: InitiativeLinksDto, end: LinkEnd): LinkedIds {
  if (end.kind === 'page') {
    const idsOfKind = (kind: PageLinkObjectKind) =>
      links.pageLinks.filter((l) => l.pageId === end.id && l.object.kind === kind).map((l) => l.object.id);
    return { tickets: idsOfKind('ticket'), needs: idsOfKind('need'), requirements: idsOfKind('requirement'), pages: [] };
  }
  const pages = links.pageLinks.filter((l) => l.object.kind === end.kind && l.object.id === end.id).map((l) => l.pageId);
  if (end.kind === 'need') {
    return { tickets: links.needLinks.filter((l) => l.needId === end.id).map((l) => l.ticketId), needs: [], requirements: [], pages };
  }
  if (end.kind === 'requirement') {
    const tickets = links.requirementLinks.filter((l) => l.requirementId === end.id).map((l) => l.ticketId);
    return { tickets, needs: [], requirements: [], pages };
  }
  return {
    tickets: links.ticketLinks.flatMap((l) =>
      l.sourceId === end.id ? [l.targetId] : l.targetId === end.id ? [l.sourceId] : [],
    ),
    needs: links.needLinks.filter((l) => l.ticketId === end.id).map((l) => l.needId),
    requirements: links.requirementLinks.filter((l) => l.ticketId === end.id).map((l) => l.requirementId),
    pages,
  };
}

/** Page : ses tickets, de tout type, besoins et exigences, par référence. */
export function linksOfPage<T extends Referenced, N extends Referenced, R extends Referenced>(
  links: InitiativeLinksDto,
  pageId: string,
  objects: Omit<LinkableObjects<T, N, R>, 'pages'>,
): { tickets: T[]; needs: N[]; requirements: R[] } {
  const ids = linkedIds(links, { kind: 'page', id: pageId });
  return {
    tickets: pick(objects.tickets, ids.tickets),
    needs: pick(objects.needs, ids.needs),
    requirements: pick(objects.requirements, ids.requirements),
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

/** Ticket, besoin ou exigence : ses pages liées, par référence. */
export function pagesLinkedTo<P extends Referenced>(
  links: InitiativeLinksDto,
  end: LinkEnd & { kind: PageLinkObjectKind },
  pages: readonly P[],
): P[] {
  return pick(pages, linkedIds(links, end).pages);
}

/**
 * Objets proposés à l'ajout d'un lien depuis `end` : ni lui-même ni un objet déjà
 * lié, par référence. Une page ne se lie jamais à une autre page.
 */
export function linkCandidates<T extends Referenced, N extends Referenced, R extends Referenced, P extends Referenced>(
  links: InitiativeLinksDto,
  end: LinkEnd,
  objects: LinkableObjects<T, N, R, P>,
): { tickets: T[]; needs: N[]; requirements: R[]; pages: P[] } {
  const ids = linkedIds(links, end);
  const tickets = omit(objects.tickets, end.kind === 'ticket' ? [...ids.tickets, end.id] : ids.tickets);
  const pages = end.kind === 'page' ? [] : omit(objects.pages, ids.pages);
  if (end.kind === 'need' || end.kind === 'requirement') return { tickets, needs: [], requirements: [], pages };
  return {
    tickets,
    needs: omit(objects.needs, ids.needs),
    requirements: omit(objects.requirements, ids.requirements),
    pages,
  };
}
