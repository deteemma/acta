// Commun à l'Action et aux autres types de ticket : responsable et Epic visés, refus, historique.
import { BadRequestException, ConflictException } from '@nestjs/common';
import { type ActionRefusal, canBeAssignee, type TicketRefusal, type TicketVersionDto } from '@app/shared';
import type { Tx } from '../db/database.service.js';
import { isConstraintViolation } from '../db/pg-errors.js';

export function ticketRefusal(refusal: TicketRefusal) {
  return refusal === 'ticketLinked' || refusal === 'epicHasTickets'
    ? new ConflictException({ statusCode: 409, refusal })
    : new BadRequestException({ statusCode: 400, refusal });
}

export function actionRefusal(refusal: ActionRefusal) {
  return refusal === 'linked'
    ? new ConflictException({ statusCode: 409, refusal })
    : new BadRequestException({ statusCode: 400, refusal });
}

/** Première barrière : le responsable est propriétaire ou contributeur de l'initiative. */
export async function checkAssignee(tx: Tx, initiativeId: string, assigneeId: string): Promise<void> {
  const member = await tx
    .selectFrom('initiative_member')
    .select('role')
    .where('initiative_id', '=', initiativeId)
    .where('user_id', '=', assigneeId)
    .executeTakeFirst();
  if (!canBeAssignee(member?.role)) throw actionRefusal('assigneeNotEligible');
}

/** Première barrière : un ticket ne rejoint qu'un Epic de la même initiative. */
export async function checkEpic(tx: Tx, initiativeId: string, epicId: string): Promise<void> {
  const epic = await tx
    .selectFrom('ticket')
    .select('id')
    .where('id', '=', epicId)
    .where('initiative_id', '=', initiativeId)
    .where('type', '=', 'epic')
    .executeTakeFirst();
  if (!epic) throw ticketRefusal('unknownEpic');
}

/** Seconde barrière : la base refuse l'Epic visé. */
export const isEpicViolation = (error: unknown) =>
  isConstraintViolation(error, 'ticket_epic_valid') || isConstraintViolation(error, 'ticket_epic_fkey');

/** Historique d'un ticket, tous types ; l'appelant a vérifié que le ticket existe et est visible. */
export async function loadTicketVersions(tx: Tx, ticketId: string): Promise<TicketVersionDto[]> {
  const rows = await tx
    .selectFrom('ticket_version as v')
    .leftJoin('app_user as u', 'u.id', 'v.changed_by')
    .select(['v.changed_at', 'v.changed_by', 'u.email', 'u.display_name', 'v.snapshot_before', 'v.snapshot_after'])
    .where('v.ticket_id', '=', ticketId)
    .orderBy('v.id')
    .execute();
  return rows.map((r) => ({
    changedAt: r.changed_at.toISOString(),
    changedBy: { userId: r.changed_by, email: r.email, displayName: r.display_name },
    before: r.snapshot_before,
    after: r.snapshot_after,
  }));
}
