import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  type ActionDto,
  type ActionStatus,
  canBeAssignee,
  type CreateActionInput,
  type NeedRefDto,
  type RequirementRefDto,
  sortByName,
  sortByReference,
  type StakeholderRefDto,
  type TicketVersionDto,
  type UpdateActionInput,
} from '@app/shared';
import { sql } from 'kysely';
import { DatabaseService, type Tx } from '../db/database.service.js';
import { isConstraintViolation, isForeignKeyViolation } from '../db/pg-errors.js';
import { needRefusal } from '../needs/needs.service.js';
import { requirementRefusal } from '../requirements/requirements.service.js';
import { stakeholderRefusal } from '../stakeholders/stakeholders.service.js';
import { SuggestedActionsService } from '../suggested-actions/suggested-actions.service.js';
import { actionRefusal, checkAssignee, checkEpic, isEpicViolation, loadTicketVersions, ticketRefusal } from '../tickets/ticket-rules.js';

@Injectable()
export class ActionsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly suggestedActions: SuggestedActionsService,
  ) {}

  /** « Mes actions » : celles dont je suis responsable, dans les initiatives dont je suis membre (RLS). */
  listMine(userId: string): Promise<ActionDto[]> {
    return this.database.asUser(userId, async (tx) => {
      const rows = await this.selectActions(tx, userId).where('a.assignee_id', '=', userId).execute();
      return this.toDtos(tx, rows);
    });
  }

  listForInitiative(userId: string, initiativeId: string): Promise<ActionDto[]> {
    return this.database.asUser(userId, async (tx) => {
      const rows = await this.selectActions(tx, userId)
        .where('a.initiative_id', '=', initiativeId)
        .orderBy('a.created_at', 'desc')
        .execute();
      return this.toDtos(tx, rows);
    });
  }

  get(userId: string, initiativeId: string, actionId: string): Promise<ActionDto> {
    return this.database.asUser(userId, (tx) => this.loadAction(tx, userId, initiativeId, actionId));
  }

  /** Modifications enregistrées par la base, la plus ancienne d'abord (ticketHistory les compare). */
  history(userId: string, initiativeId: string, actionId: string): Promise<TicketVersionDto[]> {
    return this.database.asUser(userId, async (tx) => {
      await this.loadAction(tx, userId, initiativeId, actionId);
      return loadTicketVersions(tx, actionId);
    });
  }

  /** Sans responsable fourni (création rapide), la personne qui crée l'action. */
  create(userId: string, initiativeId: string, input: CreateActionInput): Promise<ActionDto> {
    const id = randomUUID();
    const assigneeId = input.assigneeId ?? userId;
    return this.database.asUser(userId, async (tx) => {
      await checkAssignee(tx, initiativeId, assigneeId);
      // Une origine inventée masquerait une suggestion sans raison (G6).
      if (input.suggestionKey && !(await this.suggestedActions.isOffered(tx, initiativeId, input.suggestionKey))) {
        throw actionRefusal('suggestionNotOffered');
      }
      if (input.epicId) await checkEpic(tx, initiativeId, input.epicId);
      if (input.stakeholderIds) await this.checkStakeholders(tx, initiativeId, input.stakeholderIds);
      if (input.needIds) await this.checkNeeds(tx, initiativeId, input.needIds);
      if (input.requirementIds) await this.checkRequirements(tx, initiativeId, input.requirementIds);
      await write(() =>
        tx
          .insertInto('ticket')
          .values({
            id,
            initiative_id: initiativeId,
            type: 'action',
            title: input.title,
            description: input.description ?? null,
            task_id: input.taskId,
            technique_id: input.techniqueId ?? null,
            assignee_id: assigneeId,
            due_date: input.dueDate ?? null,
            epic_id: input.epicId ?? null,
            suggestion_key: input.suggestionKey ?? null,
          })
          .execute(),
      );
      if (input.stakeholderIds) await this.linkStakeholders(tx, initiativeId, id, input.stakeholderIds);
      if (input.needIds) await this.linkNeeds(tx, initiativeId, id, input.needIds);
      if (input.requirementIds) await this.linkRequirements(tx, initiativeId, id, input.requirementIds);
      await this.suggestedActions.forgetVanishedDismissals(tx, initiativeId);
      return this.loadAction(tx, userId, initiativeId, id);
    });
  }

  /** Seuls les champs fournis changent ; tout statut peut passer à tout autre. */
  update(userId: string, initiativeId: string, actionId: string, input: UpdateActionInput): Promise<ActionDto> {
    return this.database.asUser(userId, async (tx) => {
      const current = await this.loadAction(tx, userId, initiativeId, actionId);
      const { stakeholderIds, needIds, requirementIds, ...fields } = input;
      const fieldsChange = Object.values(fields).some((value) => value !== undefined);
      const stakeholdersChange =
        stakeholderIds !== undefined && !sameIds(stakeholderIds, current.stakeholders.map((s) => s.id));
      const needsChange = needIds !== undefined && !sameIds(needIds, current.needs.map((n) => n.id));
      const requirementsChange =
        requirementIds !== undefined && !sameIds(requirementIds, current.requirements.map((r) => r.id));
      const linksChange = stakeholdersChange || needsChange || requirementsChange;
      // Rien à changer : un UPDATE sans colonne serait refusé par PostgreSQL.
      if (!fieldsChange && !linksChange) return current;
      // Le responsable n'est vérifié qu'à son attribution : il le reste s'il quitte l'initiative.
      if (input.assigneeId !== undefined && input.assigneeId !== current.assignee.userId) {
        await checkAssignee(tx, initiativeId, input.assigneeId);
      }
      if (input.epicId && input.epicId !== current.epic?.id) await checkEpic(tx, initiativeId, input.epicId);
      if (stakeholdersChange) {
        await this.checkStakeholders(tx, initiativeId, stakeholderIds);
        await tx.deleteFrom('action_stakeholder').where('ticket_id', '=', actionId).execute();
        await this.linkStakeholders(tx, initiativeId, actionId, stakeholderIds);
      }
      if (needsChange) {
        await this.checkNeeds(tx, initiativeId, needIds);
        await tx.deleteFrom('ticket_need').where('ticket_id', '=', actionId).execute();
        await this.linkNeeds(tx, initiativeId, actionId, needIds);
      }
      if (requirementsChange) {
        await this.checkRequirements(tx, initiativeId, requirementIds);
        await tx.deleteFrom('ticket_requirement').where('ticket_id', '=', actionId).execute();
        await this.linkRequirements(tx, initiativeId, actionId, requirementIds);
      }
      // Les liens avec les besoins et les exigences ne modifient pas l'action
      // (décision 04, point 8) : sans autre changement, la ligne n'est pas touchée.
      if (!fieldsChange && !stakeholdersChange) return this.loadAction(tx, userId, initiativeId, actionId);
      // Changer les parties prenantes modifie l'action : sans autre colonne changée,
      // on réécrit le statut pour que le déclencheur en enregistre auteur et date.
      await write(() =>
        tx
          .updateTable('ticket')
          .set(
            fieldsChange
              ? {
                  title: input.title,
                  description: input.description,
                  task_id: input.taskId,
                  technique_id: input.techniqueId,
                  assignee_id: input.assigneeId,
                  due_date: input.dueDate,
                  epic_id: input.epicId,
                  status: input.status,
                }
              : { status: current.status },
          )
          .where('id', '=', actionId)
          .where('initiative_id', '=', initiativeId)
          .where('type', '=', 'action')
          .execute(),
      );
      await this.suggestedActions.forgetVanishedDismissals(tx, initiativeId);
      return this.loadAction(tx, userId, initiativeId, actionId);
    });
  }

  /** Première barrière : chaque partie prenante liée appartient à l'initiative. */
  private async checkStakeholders(tx: Tx, initiativeId: string, stakeholderIds: string[]): Promise<void> {
    if (stakeholderIds.length === 0) return;
    const found = await tx
      .selectFrom('stakeholder')
      .select('id')
      .where('initiative_id', '=', initiativeId)
      .where('id', 'in', stakeholderIds)
      .execute();
    if (found.length !== stakeholderIds.length) throw stakeholderRefusal('unknownStakeholder');
  }

  private async linkStakeholders(tx: Tx, initiativeId: string, actionId: string, stakeholderIds: string[]) {
    if (stakeholderIds.length === 0) return;
    try {
      await tx
        .insertInto('action_stakeholder')
        .values(stakeholderIds.map((id) => ({ initiative_id: initiativeId, ticket_id: actionId, stakeholder_id: id })))
        .execute();
    } catch (error) {
      // Seconde barrière : partie prenante d'une autre initiative.
      if (isConstraintViolation(error, 'action_stakeholder_stakeholder_fkey')) {
        throw stakeholderRefusal('unknownStakeholder');
      }
      throw error;
    }
  }

  /** Première barrière : chaque besoin lié appartient à l'initiative. */
  private async checkNeeds(tx: Tx, initiativeId: string, needIds: string[]): Promise<void> {
    if (needIds.length === 0) return;
    const found = await tx
      .selectFrom('need')
      .select('id')
      .where('initiative_id', '=', initiativeId)
      .where('id', 'in', needIds)
      .execute();
    if (found.length !== needIds.length) throw needRefusal('unknownNeed');
  }

  private async linkNeeds(tx: Tx, initiativeId: string, actionId: string, needIds: string[]) {
    if (needIds.length === 0) return;
    try {
      await tx
        .insertInto('ticket_need')
        .values(needIds.map((id) => ({ initiative_id: initiativeId, ticket_id: actionId, need_id: id })))
        .execute();
    } catch (error) {
      // Seconde barrière : besoin d'une autre initiative.
      if (isConstraintViolation(error, 'ticket_need_need_fkey')) throw needRefusal('unknownNeed');
      throw error;
    }
  }

  /** Première barrière : chaque exigence liée appartient à l'initiative. */
  private async checkRequirements(tx: Tx, initiativeId: string, requirementIds: string[]): Promise<void> {
    if (requirementIds.length === 0) return;
    const found = await tx
      .selectFrom('requirement')
      .select('id')
      .where('initiative_id', '=', initiativeId)
      .where('id', 'in', requirementIds)
      .execute();
    if (found.length !== requirementIds.length) throw requirementRefusal('unknownRequirement');
  }

  private async linkRequirements(tx: Tx, initiativeId: string, actionId: string, requirementIds: string[]) {
    if (requirementIds.length === 0) return;
    try {
      await tx
        .insertInto('ticket_requirement')
        .values(requirementIds.map((id) => ({ initiative_id: initiativeId, ticket_id: actionId, requirement_id: id })))
        .execute();
    } catch (error) {
      // Seconde barrière : exigence d'une autre initiative.
      if (isConstraintViolation(error, 'ticket_requirement_requirement_fkey')) {
        throw requirementRefusal('unknownRequirement');
      }
      throw error;
    }
  }

  /**
   * Avec les parties prenantes liées à chaque action, par ordre alphabétique, et
   * ses besoins et exigences, par référence.
   */
  private async toDtos(tx: Tx, rows: ActionRow[]): Promise<ActionDto[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const requirementLinks = await tx
      .selectFrom('ticket_requirement as l')
      .innerJoin('requirement as r', 'r.id', 'l.requirement_id')
      .select(['l.ticket_id', 'r.id', 'r.reference', 'r.title'])
      .where('l.ticket_id', 'in', ids)
      .execute();
    const requirementsByAction = new Map<string, RequirementRefDto[]>();
    for (const { ticket_id, ...requirement } of requirementLinks) {
      requirementsByAction.set(ticket_id, [...(requirementsByAction.get(ticket_id) ?? []), requirement]);
    }
    const needLinks = await tx
      .selectFrom('ticket_need as l')
      .innerJoin('need as n', 'n.id', 'l.need_id')
      .select(['l.ticket_id', 'n.id', 'n.reference', 'n.title'])
      .where('l.ticket_id', 'in', ids)
      .execute();
    const needsByAction = new Map<string, NeedRefDto[]>();
    for (const { ticket_id, ...need } of needLinks) {
      needsByAction.set(ticket_id, [...(needsByAction.get(ticket_id) ?? []), need]);
    }
    const links = await tx
      .selectFrom('action_stakeholder as l')
      .innerJoin('stakeholder as s', 's.id', 'l.stakeholder_id')
      .select(['l.ticket_id', 's.id', 's.name'])
      .where('l.ticket_id', 'in', ids)
      .execute();
    const byAction = new Map<string, StakeholderRefDto[]>();
    for (const { ticket_id, id, name } of links) {
      byAction.set(ticket_id, [...(byAction.get(ticket_id) ?? []), { id, name }]);
    }
    return rows.map((r) =>
      toDto(
        r,
        sortByName(byAction.get(r.id) ?? []),
        sortByReference(needsByAction.get(r.id) ?? []),
        sortByReference(requirementsByAction.get(r.id) ?? []),
      ),
    );
  }

  /** Une action liée à un autre objet ne se supprime pas : on l'annule. */
  remove(userId: string, initiativeId: string, actionId: string): Promise<void> {
    return this.database.asUser(userId, async (tx) => {
      await this.loadAction(tx, userId, initiativeId, actionId);
      try {
        await tx
          .deleteFrom('ticket')
          .where('id', '=', actionId)
          .where('initiative_id', '=', initiativeId)
          .where('type', '=', 'action')
          .execute();
      } catch (error) {
        if (isForeignKeyViolation(error)) throw actionRefusal('linked');
        throw error;
      }
      await this.suggestedActions.forgetVanishedDismissals(tx, initiativeId);
    });
  }

  private async loadAction(tx: Tx, userId: string, initiativeId: string, actionId: string): Promise<ActionDto> {
    const row = await this.selectActions(tx, userId)
      .where('a.id', '=', actionId)
      .where('a.initiative_id', '=', initiativeId)
      .executeTakeFirst();
    if (!row) throw new NotFoundException();
    const [dto] = await this.toDtos(tx, [row]);
    return dto!;
  }

  /** Les Actions, seules concernées par « Mes actions », le tableau de bord, les alertes et les suggestions. */
  private selectActions(tx: Tx, userId: string) {
    return tx
      .selectFrom('ticket as a')
      .innerJoin('initiative as i', 'i.id', 'a.initiative_id')
      .innerJoin('initiative_member as mine', (join) =>
        join.onRef('mine.initiative_id', '=', 'a.initiative_id').on('mine.user_id', '=', userId),
      )
      .leftJoin('initiative_member as am', (join) =>
        join.onRef('am.initiative_id', '=', 'a.initiative_id').onRef('am.user_id', '=', 'a.assignee_id'),
      )
      .leftJoin('app_user as au', 'au.id', 'a.assignee_id')
      .leftJoin('app_user as bu', 'bu.id', 'a.assigned_by')
      .leftJoin('app_user as cu', 'cu.id', 'a.created_by')
      .leftJoin('app_user as uu', 'uu.id', 'a.updated_by')
      .leftJoin('ticket as e', 'e.id', 'a.epic_id')
      .select([
        'a.id',
        'a.initiative_id',
        'i.code as initiative_code',
        'i.name as initiative_name',
        'i.archived_at as initiative_archived_at',
        'mine.role as my_role',
        'a.reference',
        'a.title',
        'a.description',
        'a.task_id',
        'a.technique_id',
        'a.assignee_id',
        'au.email as assignee_email',
        'au.display_name as assignee_display_name',
        'am.role as assignee_role',
        'a.assigned_by',
        'bu.email as assigned_by_email',
        'bu.display_name as assigned_by_display_name',
        'a.assigned_at',
        // Sans conversion, pg renverrait un Date à minuit local (décalage de fuseau).
        sql<string | null>`a.due_date::text`.as('due_date'),
        'a.status',
        'e.id as epic_id',
        'e.reference as epic_reference',
        'e.title as epic_title',
        'a.created_at',
        'a.created_by',
        'cu.email as created_by_email',
        'cu.display_name as created_by_display_name',
        'a.updated_at',
        'a.updated_by',
        'uu.email as updated_by_email',
        'uu.display_name as updated_by_display_name',
      ])
      .where('a.type', '=', 'action');
  }
}

type ActionRow = Awaited<ReturnType<ReturnType<ActionsService['selectActions']>['executeTakeFirstOrThrow']>>;

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

function toDto(
  r: ActionRow,
  stakeholders: StakeholderRefDto[],
  needs: NeedRefDto[],
  requirements: RequirementRefDto[],
): ActionDto {
  return {
    id: r.id,
    initiative: {
      id: r.initiative_id,
      code: r.initiative_code,
      name: r.initiative_name,
      archived: r.initiative_archived_at != null,
      myRole: r.my_role,
    },
    reference: r.reference,
    title: r.title,
    description: r.description,
    // Une Action a toujours une tâche et un responsable (contrainte ticket_action_fields).
    taskId: r.task_id!,
    techniqueId: r.technique_id,
    assignee: {
      userId: r.assignee_id!,
      email: r.assignee_email,
      displayName: r.assignee_display_name,
      eligible: canBeAssignee(r.assignee_role),
    },
    assignedBy: { userId: r.assigned_by, email: r.assigned_by_email, displayName: r.assigned_by_display_name },
    assignedAt: r.assigned_at.toISOString(),
    dueDate: r.due_date,
    status: r.status as ActionStatus,
    epic: r.epic_id ? { id: r.epic_id, reference: r.epic_reference!, title: r.epic_title! } : null,
    stakeholders,
    needs,
    requirements,
    createdAt: r.created_at.toISOString(),
    createdBy: { userId: r.created_by, email: r.created_by_email, displayName: r.created_by_display_name },
    updatedAt: r.updated_at.toISOString(),
    updatedBy: { userId: r.updated_by, email: r.updated_by_email, displayName: r.updated_by_display_name },
  };
}

/** Écriture refusée par la base (seconde barrière) : motif lisible par le client. */
async function write(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (isConstraintViolation(error, 'ticket_assignee_eligible')) throw actionRefusal('assigneeNotEligible');
    if (isEpicViolation(error)) throw ticketRefusal('unknownEpic');
    // Tâche ou technique absente du référentiel.
    if (isConstraintViolation(error, 'ticket_task_id_fkey') || isConstraintViolation(error, 'ticket_technique_id_fkey')) {
      throw actionRefusal('unknownBabokElement');
    }
    throw error;
  }
}
