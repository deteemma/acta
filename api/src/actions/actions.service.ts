import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type ActionDto,
  type ActionRefusal,
  canBeAssignee,
  type CreateActionInput,
  sortByName,
  type StakeholderRefDto,
  type UpdateActionInput,
} from '@app/shared';
import { sql } from 'kysely';
import { DatabaseService, type Tx } from '../db/database.service.js';
import { isConstraintViolation, isForeignKeyViolation } from '../db/pg-errors.js';
import { stakeholderRefusal } from '../stakeholders/stakeholders.service.js';

@Injectable()
export class ActionsService {
  constructor(private readonly database: DatabaseService) {}

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

  /** Sans responsable fourni (création rapide), la personne qui crée l'action. */
  create(userId: string, initiativeId: string, input: CreateActionInput): Promise<ActionDto> {
    const id = randomUUID();
    const assigneeId = input.assigneeId ?? userId;
    return this.database.asUser(userId, async (tx) => {
      await this.checkAssignee(tx, initiativeId, assigneeId);
      if (input.stakeholderIds) await this.checkStakeholders(tx, initiativeId, input.stakeholderIds);
      await write(() =>
        tx
          .insertInto('action')
          .values({
            id,
            initiative_id: initiativeId,
            title: input.title,
            description: input.description ?? null,
            task_id: input.taskId,
            technique_id: input.techniqueId ?? null,
            assignee_id: assigneeId,
            due_date: input.dueDate ?? null,
          })
          .execute(),
      );
      if (input.stakeholderIds) await this.linkStakeholders(tx, initiativeId, id, input.stakeholderIds);
      return this.loadAction(tx, userId, initiativeId, id);
    });
  }

  /** Seuls les champs fournis changent ; tout statut peut passer à tout autre. */
  update(userId: string, initiativeId: string, actionId: string, input: UpdateActionInput): Promise<ActionDto> {
    return this.database.asUser(userId, async (tx) => {
      const current = await this.loadAction(tx, userId, initiativeId, actionId);
      const { stakeholderIds, ...fields } = input;
      const fieldsChange = Object.values(fields).some((value) => value !== undefined);
      const linksChange =
        stakeholderIds !== undefined && !sameIds(stakeholderIds, current.stakeholders.map((s) => s.id));
      // Rien à changer : un UPDATE sans colonne serait refusé par PostgreSQL.
      if (!fieldsChange && !linksChange) return current;
      // Le responsable n'est vérifié qu'à son attribution : il le reste s'il quitte l'initiative.
      if (input.assigneeId !== undefined && input.assigneeId !== current.assignee.userId) {
        await this.checkAssignee(tx, initiativeId, input.assigneeId);
      }
      if (linksChange) {
        await this.checkStakeholders(tx, initiativeId, stakeholderIds);
        await tx.deleteFrom('action_stakeholder').where('action_id', '=', actionId).execute();
        await this.linkStakeholders(tx, initiativeId, actionId, stakeholderIds);
      }
      // Changer les liens modifie l'action : sans autre colonne changée, on
      // réécrit le statut pour que le déclencheur en enregistre auteur et date.
      await write(() =>
        tx
          .updateTable('action')
          .set(
            fieldsChange
              ? {
                  title: input.title,
                  description: input.description,
                  task_id: input.taskId,
                  technique_id: input.techniqueId,
                  assignee_id: input.assigneeId,
                  due_date: input.dueDate,
                  status: input.status,
                }
              : { status: current.status },
          )
          .where('id', '=', actionId)
          .where('initiative_id', '=', initiativeId)
          .execute(),
      );
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
        .values(stakeholderIds.map((id) => ({ initiative_id: initiativeId, action_id: actionId, stakeholder_id: id })))
        .execute();
    } catch (error) {
      // Seconde barrière : partie prenante d'une autre initiative.
      if (isConstraintViolation(error, 'action_stakeholder_stakeholder_fkey')) {
        throw stakeholderRefusal('unknownStakeholder');
      }
      throw error;
    }
  }

  /** Avec les parties prenantes liées à chaque action, par ordre alphabétique. */
  private async toDtos(tx: Tx, rows: ActionRow[]): Promise<ActionDto[]> {
    if (rows.length === 0) return [];
    const links = await tx
      .selectFrom('action_stakeholder as l')
      .innerJoin('stakeholder as s', 's.id', 'l.stakeholder_id')
      .select(['l.action_id', 's.id', 's.name'])
      .where(
        'l.action_id',
        'in',
        rows.map((r) => r.id),
      )
      .execute();
    const byAction = new Map<string, StakeholderRefDto[]>();
    for (const { action_id, id, name } of links) {
      byAction.set(action_id, [...(byAction.get(action_id) ?? []), { id, name }]);
    }
    return rows.map((r) => toDto(r, sortByName(byAction.get(r.id) ?? [])));
  }

  /** Une action liée à un autre objet ne se supprime pas : on l'annule. */
  remove(userId: string, initiativeId: string, actionId: string): Promise<void> {
    return this.database.asUser(userId, async (tx) => {
      await this.loadAction(tx, userId, initiativeId, actionId);
      try {
        await tx.deleteFrom('action').where('id', '=', actionId).where('initiative_id', '=', initiativeId).execute();
      } catch (error) {
        if (isForeignKeyViolation(error)) throw actionRefusal('linked');
        throw error;
      }
    });
  }

  /** Première barrière : le responsable est propriétaire ou contributeur de l'initiative. */
  private async checkAssignee(tx: Tx, initiativeId: string, assigneeId: string): Promise<void> {
    const member = await tx
      .selectFrom('initiative_member')
      .select('role')
      .where('initiative_id', '=', initiativeId)
      .where('user_id', '=', assigneeId)
      .executeTakeFirst();
    if (!canBeAssignee(member?.role)) throw actionRefusal('assigneeNotEligible');
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

  private selectActions(tx: Tx, userId: string) {
    return tx
      .selectFrom('action as a')
      .innerJoin('initiative as i', 'i.id', 'a.initiative_id')
      .innerJoin('initiative_member as mine', (join) =>
        join.onRef('mine.initiative_id', '=', 'a.initiative_id').on('mine.user_id', '=', userId),
      )
      .leftJoin('initiative_member as am', (join) =>
        join.onRef('am.initiative_id', '=', 'a.initiative_id').onRef('am.user_id', '=', 'a.assignee_id'),
      )
      .leftJoin('app_user as au', 'au.id', 'a.assignee_id')
      .leftJoin('app_user as cu', 'cu.id', 'a.created_by')
      .leftJoin('app_user as uu', 'uu.id', 'a.updated_by')
      .select([
        'a.id',
        'a.initiative_id',
        'i.code as initiative_code',
        'i.name as initiative_name',
        'i.archived_at as initiative_archived_at',
        'mine.role as my_role',
        'a.title',
        'a.description',
        'a.task_id',
        'a.technique_id',
        'a.assignee_id',
        'au.email as assignee_email',
        'au.display_name as assignee_display_name',
        'am.role as assignee_role',
        // Sans conversion, pg renverrait un Date à minuit local (décalage de fuseau).
        sql<string | null>`a.due_date::text`.as('due_date'),
        'a.status',
        'a.created_at',
        'a.created_by',
        'cu.email as created_by_email',
        'cu.display_name as created_by_display_name',
        'a.updated_at',
        'a.updated_by',
        'uu.email as updated_by_email',
        'uu.display_name as updated_by_display_name',
      ]);
  }
}

type ActionRow = Awaited<ReturnType<ReturnType<ActionsService['selectActions']>['executeTakeFirstOrThrow']>>;

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

function toDto(r: ActionRow, stakeholders: StakeholderRefDto[]): ActionDto {
  return {
    id: r.id,
    initiative: {
      id: r.initiative_id,
      code: r.initiative_code,
      name: r.initiative_name,
      archived: r.initiative_archived_at != null,
      myRole: r.my_role,
    },
    title: r.title,
    description: r.description,
    taskId: r.task_id,
    techniqueId: r.technique_id,
    assignee: {
      userId: r.assignee_id,
      email: r.assignee_email,
      displayName: r.assignee_display_name,
      eligible: canBeAssignee(r.assignee_role),
    },
    dueDate: r.due_date,
    status: r.status,
    stakeholders,
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
    if (isConstraintViolation(error, 'action_assignee_eligible')) throw actionRefusal('assigneeNotEligible');
    // Tâche ou technique absente du référentiel.
    if (isConstraintViolation(error, 'action_task_id_fkey') || isConstraintViolation(error, 'action_technique_id_fkey')) {
      throw actionRefusal('unknownBabokElement');
    }
    throw error;
  }
}

function actionRefusal(refusal: ActionRefusal) {
  return refusal === 'linked'
    ? new ConflictException({ statusCode: 409, refusal })
    : new BadRequestException({ statusCode: 400, refusal });
}
