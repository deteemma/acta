import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  canBeAssignee,
  checkTicketFields,
  type CreateTicketInput,
  sortByName,
  type StakeholderRefDto,
  type TicketDto,
  type TicketRow,
  type TicketType,
  type TicketVersionDto,
  type UpdateTicketInput,
} from '@app/shared';
import { sql } from 'kysely';
import { DatabaseService, type Tx } from '../db/database.service.js';
import { isConstraintViolation, isForeignKeyViolation } from '../db/pg-errors.js';
import { stakeholderRefusal } from '../stakeholders/stakeholders.service.js';
import { actionRefusal, checkAssignee, checkEpic, isEpicViolation, loadTicketVersions, ticketRefusal } from './ticket-rules.js';

/**
 * Tickets d'une initiative (ticket 18). La liste montre tous les types ; le reste
 * porte sur les types autres que l'Action, qui garde ses routes (`/actions`).
 */
@Injectable()
export class TicketsService {
  constructor(private readonly database: DatabaseService) {}

  list(userId: string, initiativeId: string): Promise<TicketRow[]> {
    return this.database.asUser(userId, async (tx) => {
      const rows = await tx
        .selectFrom('ticket as t')
        .leftJoin('initiative_member as am', (join) =>
          join.onRef('am.initiative_id', '=', 't.initiative_id').onRef('am.user_id', '=', 't.assignee_id'),
        )
        .leftJoin('app_user as au', 'au.id', 't.assignee_id')
        .leftJoin('ticket as e', 'e.id', 't.epic_id')
        .select([
          't.id',
          't.type',
          't.reference',
          't.title',
          't.status',
          't.assignee_id',
          'au.email as assignee_email',
          'au.display_name as assignee_display_name',
          'am.role as assignee_role',
          // Sans conversion, pg renverrait un Date à minuit local (décalage de fuseau).
          sql<string | null>`t.due_date::text`.as('due_date'),
          'e.id as epic_id',
          'e.reference as epic_reference',
          'e.title as epic_title',
          't.created_at',
        ])
        .where('t.initiative_id', '=', initiativeId)
        .execute();
      return rows.map((r) => ({
        id: r.id,
        type: r.type,
        reference: r.reference,
        title: r.title,
        status: r.status,
        assignee: r.assignee_id
          ? {
              userId: r.assignee_id,
              email: r.assignee_email,
              displayName: r.assignee_display_name,
              eligible: canBeAssignee(r.assignee_role),
            }
          : null,
        dueDate: r.due_date,
        epic: r.epic_id ? { id: r.epic_id, reference: r.epic_reference!, title: r.epic_title! } : null,
        createdAt: r.created_at.toISOString(),
      }));
    });
  }

  get(userId: string, initiativeId: string, ticketId: string): Promise<TicketDto> {
    return this.database.asUser(userId, (tx) => this.loadTicket(tx, userId, initiativeId, ticketId));
  }

  /** Modifications enregistrées par la base, la plus ancienne d'abord (ticketHistory les compare). */
  history(userId: string, initiativeId: string, ticketId: string): Promise<TicketVersionDto[]> {
    return this.database.asUser(userId, async (tx) => {
      await this.loadTicket(tx, userId, initiativeId, ticketId);
      return loadTicketVersions(tx, ticketId);
    });
  }

  /** Dans le statut initial du type, posé par la base. */
  create(userId: string, initiativeId: string, input: CreateTicketInput): Promise<TicketDto> {
    const id = randomUUID();
    return this.database.asUser(userId, async (tx) => {
      throwIfRefused(input.type, input);
      if (input.assigneeId) await checkAssignee(tx, initiativeId, input.assigneeId);
      if (input.epicId) await checkEpic(tx, initiativeId, input.epicId);
      if (input.questionedStakeholderIds) await this.checkStakeholders(tx, initiativeId, input.questionedStakeholderIds);
      await write(() =>
        tx
          .insertInto('ticket')
          .values({
            id,
            initiative_id: initiativeId,
            type: input.type,
            title: input.title,
            description: input.description ?? null,
            assignee_id: input.assigneeId ?? null,
            due_date: input.dueDate ?? null,
            epic_id: input.epicId ?? null,
            probability: input.probability ?? null,
            impact: input.impact ?? null,
          })
          .execute(),
      );
      if (input.questionedStakeholderIds) await this.linkStakeholders(tx, initiativeId, id, input.questionedStakeholderIds);
      return this.loadTicket(tx, userId, initiativeId, id);
    });
  }

  /** Seuls les champs fournis changent ; tout statut du type peut passer à tout autre. */
  update(userId: string, initiativeId: string, ticketId: string, input: UpdateTicketInput): Promise<TicketDto> {
    return this.database.asUser(userId, async (tx) => {
      const current = await this.loadTicket(tx, userId, initiativeId, ticketId);
      throwIfRefused(current.type, input);
      const { questionedStakeholderIds, status, ...others } = input;
      const fieldsChange = status !== undefined || Object.values(others).some((value) => value !== undefined);
      const stakeholdersChange =
        questionedStakeholderIds !== undefined &&
        !sameIds(questionedStakeholderIds, current.questionedStakeholders.map((s) => s.id));
      // Rien à changer : un UPDATE sans colonne serait refusé par PostgreSQL.
      if (!fieldsChange && !stakeholdersChange) return current;
      // Le responsable n'est vérifié qu'à son attribution : il le reste s'il quitte l'initiative.
      if (input.assigneeId && input.assigneeId !== current.assignee?.userId) {
        await checkAssignee(tx, initiativeId, input.assigneeId);
      }
      if (input.epicId && input.epicId !== current.epic?.id) await checkEpic(tx, initiativeId, input.epicId);
      if (stakeholdersChange) {
        await this.checkStakeholders(tx, initiativeId, questionedStakeholderIds);
        await tx.deleteFrom('question_stakeholder').where('ticket_id', '=', ticketId).execute();
        await this.linkStakeholders(tx, initiativeId, ticketId, questionedStakeholderIds);
      }
      // Sans autre colonne changée, on réécrit le statut pour que le déclencheur
      // enregistre l'auteur et la date de la modification.
      await write(() =>
        tx
          .updateTable('ticket')
          .set(
            fieldsChange
              ? {
                  title: input.title,
                  description: input.description,
                  assignee_id: input.assigneeId,
                  due_date: input.dueDate,
                  epic_id: input.epicId,
                  probability: input.probability,
                  impact: input.impact,
                  status: status as TicketDto['status'] | undefined,
                }
              : { status: current.status },
          )
          .where('id', '=', ticketId)
          .where('initiative_id', '=', initiativeId)
          .execute(),
      );
      return this.loadTicket(tx, userId, initiativeId, ticketId);
    });
  }

  /** Définitive. Refusée pour un Epic qui contient des tickets ou un ticket lié à un autre objet. */
  remove(userId: string, initiativeId: string, ticketId: string): Promise<void> {
    return this.database.asUser(userId, async (tx) => {
      await this.loadTicket(tx, userId, initiativeId, ticketId);
      try {
        await tx.deleteFrom('ticket').where('id', '=', ticketId).where('initiative_id', '=', initiativeId).execute();
      } catch (error) {
        if (isConstraintViolation(error, 'ticket_epic_fkey')) throw ticketRefusal('epicHasTickets');
        if (isForeignKeyViolation(error)) throw ticketRefusal('ticketLinked');
        throw error;
      }
    });
  }

  /** Première barrière : chaque partie prenante interrogée appartient à l'initiative. */
  private async checkStakeholders(tx: Tx, initiativeId: string, stakeholderIds: readonly string[]): Promise<void> {
    if (stakeholderIds.length === 0) return;
    const found = await tx
      .selectFrom('stakeholder')
      .select('id')
      .where('initiative_id', '=', initiativeId)
      .where('id', 'in', [...stakeholderIds])
      .execute();
    if (found.length !== stakeholderIds.length) throw stakeholderRefusal('unknownStakeholder');
  }

  private async linkStakeholders(tx: Tx, initiativeId: string, ticketId: string, stakeholderIds: readonly string[]) {
    if (stakeholderIds.length === 0) return;
    try {
      await tx
        .insertInto('question_stakeholder')
        .values(stakeholderIds.map((id) => ({ initiative_id: initiativeId, ticket_id: ticketId, stakeholder_id: id })))
        .execute();
    } catch (error) {
      // Seconde barrière : partie prenante d'une autre initiative.
      if (isConstraintViolation(error, 'question_stakeholder_stakeholder_fkey')) {
        throw stakeholderRefusal('unknownStakeholder');
      }
      throw error;
    }
  }

  private async loadTicket(tx: Tx, userId: string, initiativeId: string, ticketId: string): Promise<TicketDto> {
    const r = await tx
      .selectFrom('ticket as t')
      .innerJoin('initiative as i', 'i.id', 't.initiative_id')
      .innerJoin('initiative_member as mine', (join) =>
        join.onRef('mine.initiative_id', '=', 't.initiative_id').on('mine.user_id', '=', userId),
      )
      .leftJoin('initiative_member as am', (join) =>
        join.onRef('am.initiative_id', '=', 't.initiative_id').onRef('am.user_id', '=', 't.assignee_id'),
      )
      .leftJoin('app_user as au', 'au.id', 't.assignee_id')
      .leftJoin('app_user as cu', 'cu.id', 't.created_by')
      .leftJoin('app_user as uu', 'uu.id', 't.updated_by')
      .leftJoin('ticket as e', 'e.id', 't.epic_id')
      .select([
        't.id',
        't.initiative_id',
        'i.code as initiative_code',
        'i.name as initiative_name',
        'i.archived_at as initiative_archived_at',
        'mine.role as my_role',
        't.type',
        't.reference',
        't.title',
        't.description',
        't.status',
        't.assignee_id',
        'au.email as assignee_email',
        'au.display_name as assignee_display_name',
        'am.role as assignee_role',
        sql<string | null>`t.due_date::text`.as('due_date'),
        'e.id as epic_id',
        'e.reference as epic_reference',
        'e.title as epic_title',
        't.probability',
        't.impact',
        't.created_at',
        't.created_by',
        'cu.email as created_by_email',
        'cu.display_name as created_by_display_name',
        't.updated_at',
        't.updated_by',
        'uu.email as updated_by_email',
        'uu.display_name as updated_by_display_name',
      ])
      .where('t.id', '=', ticketId)
      .where('t.initiative_id', '=', initiativeId)
      .where('t.type', '!=', 'action')
      .executeTakeFirst();
    if (!r) throw new NotFoundException();
    const stakeholders: StakeholderRefDto[] = await tx
      .selectFrom('question_stakeholder as l')
      .innerJoin('stakeholder as s', 's.id', 'l.stakeholder_id')
      .select(['s.id', 's.name'])
      .where('l.ticket_id', '=', ticketId)
      .execute();
    return {
      id: r.id,
      initiative: {
        id: r.initiative_id,
        code: r.initiative_code,
        name: r.initiative_name,
        archived: r.initiative_archived_at != null,
        myRole: r.my_role,
      },
      type: r.type,
      reference: r.reference,
      title: r.title,
      description: r.description,
      status: r.status,
      assignee: r.assignee_id
        ? {
            userId: r.assignee_id,
            email: r.assignee_email,
            displayName: r.assignee_display_name,
            eligible: canBeAssignee(r.assignee_role),
          }
        : null,
      dueDate: r.due_date,
      epic: r.epic_id ? { id: r.epic_id, reference: r.epic_reference!, title: r.epic_title! } : null,
      questionedStakeholders: sortByName(stakeholders),
      probability: r.probability,
      impact: r.impact,
      createdAt: r.created_at.toISOString(),
      createdBy: { userId: r.created_by, email: r.created_by_email, displayName: r.created_by_display_name },
      updatedAt: r.updated_at.toISOString(),
      updatedBy: { userId: r.updated_by, email: r.updated_by_email, displayName: r.updated_by_display_name },
    };
  }
}

function throwIfRefused(type: TicketType, input: Parameters<typeof checkTicketFields>[1]): void {
  const refusal = checkTicketFields(type, input);
  if (refusal) throw ticketRefusal(refusal);
}

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

/** Écriture refusée par la base (seconde barrière) : motif lisible par le client. */
async function write(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (isConstraintViolation(error, 'ticket_assignee_eligible')) throw actionRefusal('assigneeNotEligible');
    if (isEpicViolation(error)) throw ticketRefusal('unknownEpic');
    if (isConstraintViolation(error, 'ticket_no_epic_in_epic')) throw ticketRefusal('epicInEpic');
    if (isConstraintViolation(error, 'ticket_status_check')) throw ticketRefusal('statusNotOfType');
    throw error;
  }
}
