import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  checkTicketLink,
  type CreateNeedLinkInput,
  type CreateRequirementLinkInput,
  type CreateTicketLinkInput,
  type InitiativeLinksDto,
  type LinkRefusal,
  orientTicketLink,
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
 * nature, et d'un ticket de tout type vers un besoin ou une exigence. Ni le ticket,
 * ni le besoin, ni l'exigence ne sont modifiés : aucun historique ne les retient.
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
}

async function loadLinks(tx: Tx, initiativeId: string): Promise<InitiativeLinksDto> {
  const [ticketLinks, needLinks, requirementLinks] = await Promise.all([
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
  ]);
  return { ticketLinks, needLinks, requirementLinks };
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
    if (isConstraintViolation(error, 'ticket_need_need_fkey')) throw needRefusal('unknownNeed');
    if (isConstraintViolation(error, 'ticket_requirement_requirement_fkey')) throw requirementRefusal('unknownRequirement');
    if (
      ['ticket_link_source_fkey', 'ticket_link_target_fkey', 'ticket_need_ticket_fkey', 'ticket_requirement_ticket_fkey'].some(
        (constraint) => isConstraintViolation(error, constraint),
      )
    ) {
      throw linkRefusal('unknownTicket');
    }
    throw error;
  }
}
