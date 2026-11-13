import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  checkTicketLink,
  type CreateNeedLinkInput,
  type CreatePageLinkInput,
  type CreateRequirementLinkInput,
  type CreateTicketLinkInput,
  type InitiativeLinksDto,
  type LinkRefusal,
  orientTicketLink,
  type PageLinkDto,
  type PageLinkObjectKind,
} from '@app/shared';
import { DatabaseService, type Tx } from '../db/database.service.js';
import { isConstraintViolation, isUniqueViolation } from '../db/pg-errors.js';
import { needRefusal } from '../needs/needs.service.js';
import { requirementRefusal } from '../requirements/requirements.service.js';

export function linkRefusal(refusal: LinkRefusal) {
  return refusal === 'alreadyLinked'
    ? new ConflictException({ statusCode: 409, refusal })
    : new BadRequestException({ statusCode: 400, refusal });
}

/**
 * Liens d'une initiative (ticket 19, décision 04) : entre deux tickets, avec une
 * nature, d'un ticket de tout type vers un besoin ou une exigence, et d'une page
 * vers un ticket, un besoin ou une exigence (ticket 25), sans nature. Aucun des
 * objets n'est modifié : aucun historique ni enregistrement de page ne les retient.
 */
@Injectable()
export class LinksService {
  constructor(private readonly database: DatabaseService) {}

  list(userId: string, initiativeId: string): Promise<InitiativeLinksDto> {
    return this.database.asUser(userId, (tx) => loadLinks(tx, initiativeId));
  }

  createTicketLink(userId: string, initiativeId: string, input: CreateTicketLinkInput): Promise<InitiativeLinksDto> {
    return this.database.asUser(userId, async (tx) => {
      // Première barrière : les deux tickets, distincts, de cette initiative, pas encore liés.
      const pair = await tx
        .selectFrom('ticket_link')
        .select(['source_id as sourceId', 'target_id as targetId', 'kind'])
        .where('initiative_id', '=', initiativeId)
        .where((eb) => eb.or([eb('source_id', 'in', [input.ticketId, input.otherTicketId]), eb('target_id', 'in', [input.ticketId, input.otherTicketId])]))
        .execute();
      const refusal = checkTicketLink(pair, input.ticketId, input.otherTicketId);
      if (refusal) throw linkRefusal(refusal);
      await checkTickets(tx, initiativeId, [input.ticketId, input.otherTicketId]);
      const { sourceId, targetId, kind } = orientTicketLink(input.ticketId, input.otherTicketId, input.side);
      await write(() =>
        tx
          .insertInto('ticket_link')
          .values({ initiative_id: initiativeId, source_id: sourceId, target_id: targetId, kind })
          .execute(),
      );
      return loadLinks(tx, initiativeId);
    });
  }

  /** Dans un sens ou dans l'autre ; un lien déjà retiré n'est pas une erreur. */
  removeTicketLink(userId: string, initiativeId: string, ticketId: string, otherTicketId: string): Promise<void> {
    return this.database.asUser(userId, async (tx) => {
      await tx
        .deleteFrom('ticket_link')
        .where('initiative_id', '=', initiativeId)
        .where((eb) =>
          eb.or([
            eb.and([eb('source_id', '=', ticketId), eb('target_id', '=', otherTicketId)]),
            eb.and([eb('source_id', '=', otherTicketId), eb('target_id', '=', ticketId)]),
          ]),
        )
        .execute();
    });
  }

  createNeedLink(userId: string, initiativeId: string, input: CreateNeedLinkInput): Promise<InitiativeLinksDto> {
    return this.database.asUser(userId, async (tx) => {
      await checkTickets(tx, initiativeId, [input.ticketId]);
      const need = await tx
        .selectFrom('need')
        .select('id')
        .where('id', '=', input.needId)
        .where('initiative_id', '=', initiativeId)
        .executeTakeFirst();
      if (!need) throw needRefusal('unknownNeed');
      await write(() =>
        tx
          .insertInto('ticket_need')
          .values({ initiative_id: initiativeId, ticket_id: input.ticketId, need_id: input.needId })
          .execute(),
      );
      return loadLinks(tx, initiativeId);
    });
  }

  removeNeedLink(userId: string, initiativeId: string, ticketId: string, needId: string): Promise<void> {
    return this.database.asUser(userId, async (tx) => {
      await tx
        .deleteFrom('ticket_need')
        .where('initiative_id', '=', initiativeId)
        .where('ticket_id', '=', ticketId)
        .where('need_id', '=', needId)
        .execute();
    });
  }

  createRequirementLink(userId: string, initiativeId: string, input: CreateRequirementLinkInput): Promise<InitiativeLinksDto> {
    return this.database.asUser(userId, async (tx) => {
      await checkTickets(tx, initiativeId, [input.ticketId]);
      const requirement = await tx
        .selectFrom('requirement')
        .select('id')
        .where('id', '=', input.requirementId)
        .where('initiative_id', '=', initiativeId)
        .executeTakeFirst();
      if (!requirement) throw requirementRefusal('unknownRequirement');
      await write(() =>
        tx
          .insertInto('ticket_requirement')
          .values({ initiative_id: initiativeId, ticket_id: input.ticketId, requirement_id: input.requirementId })
          .execute(),
      );
      return loadLinks(tx, initiativeId);
    });
  }

  removeRequirementLink(userId: string, initiativeId: string, ticketId: string, requirementId: string): Promise<void> {
    return this.database.asUser(userId, async (tx) => {
      await tx
        .deleteFrom('ticket_requirement')
        .where('initiative_id', '=', initiativeId)
        .where('ticket_id', '=', ticketId)
        .where('requirement_id', '=', requirementId)
        .execute();
    });
  }

  /** Depuis la page ou depuis l'autre objet ; jamais vers une autre page (schéma). */
  createPageLink(userId: string, initiativeId: string, input: CreatePageLinkInput): Promise<InitiativeLinksDto> {
    return this.database.asUser(userId, async (tx) => {
      // Première barrière : la page et l'objet appartiennent à cette initiative.
      const page = await tx
        .selectFrom('page')
        .select('id')
        .where('id', '=', input.pageId)
        .where('initiative_id', '=', initiativeId)
        .executeTakeFirst();
      if (!page) throw linkRefusal('unknownLinkedPage');
      const { kind, id } = input.object;
      if (kind === 'ticket') {
        await checkTickets(tx, initiativeId, [id]);
      } else {
        const found = await tx.selectFrom(kind).select('id').where('id', '=', id).where('initiative_id', '=', initiativeId).executeTakeFirst();
        if (!found) throw kind === 'need' ? needRefusal('unknownNeed') : requirementRefusal('unknownRequirement');
      }
      const values = { initiative_id: initiativeId, page_id: input.pageId };
      await write(() =>
        kind === 'ticket'
          ? tx.insertInto('page_ticket').values({ ...values, ticket_id: id }).execute()
          : kind === 'need'
            ? tx.insertInto('page_need').values({ ...values, need_id: id }).execute()
            : tx.insertInto('page_requirement').values({ ...values, requirement_id: id }).execute(),
      );
      return loadLinks(tx, initiativeId);
    });
  }

  /** Depuis la page ou depuis l'autre objet ; un lien déjà retiré n'est pas une erreur. */
  removePageLink(userId: string, initiativeId: string, pageId: string, kind: PageLinkObjectKind, objectId: string): Promise<void> {
    return this.database.asUser(userId, async (tx) => {
      const remove =
        kind === 'ticket'
          ? tx.deleteFrom('page_ticket').where('ticket_id', '=', objectId)
          : kind === 'need'
            ? tx.deleteFrom('page_need').where('need_id', '=', objectId)
            : tx.deleteFrom('page_requirement').where('requirement_id', '=', objectId);
      await remove.where('initiative_id', '=', initiativeId).where('page_id', '=', pageId).execute();
    });
  }
}

async function loadLinks(tx: Tx, initiativeId: string): Promise<InitiativeLinksDto> {
  const [ticketLinks, needLinks, requirementLinks, pageLinks] = await Promise.all([
    tx
      .selectFrom('ticket_link')
      .select(['source_id as sourceId', 'target_id as targetId', 'kind'])
      .where('initiative_id', '=', initiativeId)
      .execute(),
    tx
      .selectFrom('ticket_need')
      .select(['ticket_id as ticketId', 'need_id as needId'])
      .where('initiative_id', '=', initiativeId)
      .execute(),
    tx
      .selectFrom('ticket_requirement')
      .select(['ticket_id as ticketId', 'requirement_id as requirementId'])
      .where('initiative_id', '=', initiativeId)
      .execute(),
    loadPageLinks(tx, initiativeId),
  ]);
  return { ticketLinks, needLinks, requirementLinks, pageLinks };
}

/** Liens des pages de l'initiative, vers des tickets, des besoins et des exigences. */
export async function loadPageLinks(tx: Tx, initiativeId: string): Promise<PageLinkDto[]> {
  const [tickets, needs, requirements] = await Promise.all([
    tx.selectFrom('page_ticket').select(['page_id', 'ticket_id as id']).where('initiative_id', '=', initiativeId).execute(),
    tx.selectFrom('page_need').select(['page_id', 'need_id as id']).where('initiative_id', '=', initiativeId).execute(),
    tx.selectFrom('page_requirement').select(['page_id', 'requirement_id as id']).where('initiative_id', '=', initiativeId).execute(),
  ]);
  const toPageLinks = (kind: PageLinkObjectKind, rows: { page_id: string; id: string }[]): PageLinkDto[] =>
    rows.map((r) => ({ pageId: r.page_id, object: { kind, id: r.id } }));
  return [...toPageLinks('ticket', tickets), ...toPageLinks('need', needs), ...toPageLinks('requirement', requirements)];
}

/** Première barrière : chaque ticket existe dans l'initiative (pas de lien entre initiatives). */
async function checkTickets(tx: Tx, initiativeId: string, ticketIds: string[]): Promise<void> {
  const found = await tx
    .selectFrom('ticket')
    .select('id')
    .where('initiative_id', '=', initiativeId)
    .where('id', 'in', ticketIds)
    .execute();
  if (found.length !== new Set(ticketIds).size) throw linkRefusal('unknownTicket');
}

/** Écriture refusée par la base (seconde barrière) : motif lisible par le client. */
async function write(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (isUniqueViolation(error)) throw linkRefusal('alreadyLinked');
    if (isConstraintViolation(error, 'ticket_link_not_self')) throw linkRefusal('selfLink');
    const violates = (constraints: string[]) => constraints.some((c) => isConstraintViolation(error, c));
    if (violates(['ticket_need_need_fkey', 'page_need_need_fkey'])) throw needRefusal('unknownNeed');
    if (violates(['ticket_requirement_requirement_fkey', 'page_requirement_requirement_fkey'])) {
      throw requirementRefusal('unknownRequirement');
    }
    if (violates(['page_ticket_page_fkey', 'page_need_page_fkey', 'page_requirement_page_fkey'])) {
      throw linkRefusal('unknownLinkedPage');
    }
    if (
      violates([
        'ticket_link_source_fkey',
        'ticket_link_target_fkey',
        'ticket_need_ticket_fkey',
        'ticket_requirement_ticket_fkey',
        'page_ticket_ticket_fkey',
      ])
    ) {
      throw linkRefusal('unknownTicket');
    }
    throw error;
  }
}
