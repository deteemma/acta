import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type ActionDto,
  type ActionRefusal,
  canBeAssignee,
  type CreateActionInput,
  type UpdateActionInput,
} from '@app/shared';
import { sql } from 'kysely';
import { DatabaseService, type Tx } from '../db/database.service.js';
import { isConstraintViolation, isForeignKeyViolation } from '../db/pg-errors.js';

@Injectable()
export class ActionsService {
  constructor(private readonly database: DatabaseService) {}

  /** « Mes actions » : celles dont je suis responsable, dans les initiatives dont je suis membre (RLS). */
  listMine(userId: string): Promise<ActionDto[]> {
    return this.database.asUser(userId, async (tx) => {
      const rows = await this.selectActions(tx, userId).where('a.assignee_id', '=', userId).execute();
      return rows.map(toDto);
    });
  }

  listForInitiative(userId: string, initiativeId: string): Promise<ActionDto[]> {
    return this.database.asUser(userId, async (tx) => {
      const rows = await this.selectActions(tx, userId)
        .where('a.initiative_id', '=', initiativeId)
        .orderBy('a.created_at', 'desc')
        .execute();
      return rows.map(toDto);
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
      return this.loadAction(tx, userId, initiativeId, id);
    });
  }

  /** Seuls les champs fournis changent ; tout statut peut passer à tout autre. */
  update(userId: string, initiativeId: string, actionId: string, input: UpdateActionInput): Promise<ActionDto> {
    return this.database.asUser(userId, async (tx) => {
      const current = await this.loadAction(tx, userId, initiativeId, actionId);
      // Rien à changer : un UPDATE sans colonne serait refusé par PostgreSQL.
      if (Object.values(input).every((value) => value === undefined)) return current;
      // Le responsable n'est vérifié qu'à son attribution : il le reste s'il quitte l'initiative.
      if (input.assigneeId !== undefined && input.assigneeId !== current.assignee.userId) {
        await this.checkAssignee(tx, initiativeId, input.assigneeId);
      }
      await write(() =>
        tx
          .updateTable('action')
          .set({
            title: input.title,
            description: input.description,
            task_id: input.taskId,
            technique_id: input.techniqueId,
            assignee_id: input.assigneeId,
            due_date: input.dueDate,
            status: input.status,
          })
          .where('id', '=', actionId)
          .where('initiative_id', '=', initiativeId)
          .execute(),
      );
      return this.loadAction(tx, userId, initiativeId, actionId);
    });
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
    return toDto(row);
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

function toDto(r: ActionRow): ActionDto {
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
