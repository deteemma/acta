import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  can,
  type AddMemberInput,
  type CreateInitiativeInput,
  type InitiativeDto,
  type InitiativeMemberDto,
  type InitiativeRole,
  type UpdateInitiativeInput,
} from '@app/shared';
import { sql } from 'kysely';
import { DatabaseService, type Tx } from '../db/database.service.js';

@Injectable()
export class InitiativesService {
  constructor(private readonly database: DatabaseService) {}

  /** Initiatives visibles par l'utilisateur : la RLS filtre, la jointure donne son rôle. */
  list(userId: string): Promise<InitiativeDto[]> {
    return this.database.asUser(userId, async (tx) => {
      const rows = await this.selectInitiatives(tx, userId).orderBy('i.created_at', 'desc').execute();
      return rows.map(toDto);
    });
  }

  get(userId: string, initiativeId: string): Promise<InitiativeDto> {
    return this.database.asUser(userId, async (tx) => {
      return toDto(await this.loadInitiative(tx, userId, initiativeId));
    });
  }

  create(userId: string, input: CreateInitiativeInput): Promise<InitiativeDto> {
    // L'identifiant est généré ici : le créateur ne devient membre (déclencheur)
    // qu'à la fin de l'INSERT, la relecture se fait donc dans une 2ᵉ requête.
    const id = input.id ?? randomUUID();
    return this.database.asUser(userId, async (tx) => {
      try {
        await tx.insertInto('initiative').values({ id, code: input.code, name: input.name }).execute();
      } catch (error) {
        // Le code est unique dans toute l'application, y compris parmi les
        // initiatives que l'utilisateur ne voit pas.
        if (isUniqueViolation(error)) throw new ConflictException('Ce code d’initiative est déjà utilisé');
        throw error;
      }
      return toDto(await this.loadInitiative(tx, userId, id));
    });
  }

  /** Seuls les champs fournis changent. */
  update(
    userId: string,
    role: InitiativeRole,
    initiativeId: string,
    input: UpdateInitiativeInput,
  ): Promise<InitiativeDto> {
    return this.database.asUser(userId, async (tx) => {
      const current = await this.loadInitiative(tx, userId, initiativeId);
      if (input.code !== undefined && input.code !== current.code && !can(role, 'editCode')) {
        throw new ForbiddenException();
      }
      // Ticket 09 : refuser aussi le changement de code dès qu'une référence existe.
      try {
        await tx
          .updateTable('initiative')
          .set({
            code: input.code,
            name: input.name,
            description: input.description,
            analysis_approach: input.analysisApproach,
            start_date: input.startDate,
            planned_end_date: input.plannedEndDate,
            updated_at: sql`now()`,
          })
          .where('id', '=', initiativeId)
          .execute();
      } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictException('Ce code d’initiative est déjà utilisé');
        // Fin prévue avant le début, une fois combinée avec la date déjà enregistrée.
        if (isConstraintViolation(error, 'initiative_dates_order')) {
          throw new BadRequestException('La fin prévue précède le début');
        }
        throw error;
      }
      return toDto(await this.loadInitiative(tx, userId, initiativeId));
    });
  }

  /** Archiver (lecture seule pour tous) ou désarchiver ; sans effet si c'est déjà le cas. */
  setArchived(userId: string, initiativeId: string, archived: boolean): Promise<InitiativeDto> {
    return this.database.asUser(userId, async (tx) => {
      await tx
        .updateTable('initiative')
        .set(
          archived
            ? { archived_at: sql`now()`, archived_by: userId, updated_at: sql`now()` }
            : { archived_at: null, archived_by: null, updated_at: sql`now()` },
        )
        .where('id', '=', initiativeId)
        .where('archived_at', archived ? 'is' : 'is not', null)
        .execute();
      return toDto(await this.loadInitiative(tx, userId, initiativeId));
    });
  }

  async remove(userId: string, initiativeId: string): Promise<void> {
    await this.database.asUser(userId, (tx) =>
      tx.deleteFrom('initiative').where('id', '=', initiativeId).execute(),
    );
  }

  listMembers(userId: string, initiativeId: string): Promise<InitiativeMemberDto[]> {
    return this.database.asUser(userId, async (tx) => {
      const rows = await tx
        .selectFrom('initiative_member as m')
        .leftJoin('app_user as u', 'u.id', 'm.user_id')
        .select(['m.user_id', 'm.role', 'm.is_team_ba', 'u.email', 'u.display_name'])
        .where('m.initiative_id', '=', initiativeId)
        .orderBy('m.created_at')
        .execute();
      return rows.map((r) => ({
        userId: r.user_id,
        email: r.email,
        displayName: r.display_name,
        role: r.role,
        isTeamBa: r.is_team_ba,
      }));
    });
  }

  addMember(userId: string, initiativeId: string, input: AddMemberInput): Promise<void> {
    return this.database.asUser(userId, async (tx) => {
      const { rows } = await sql<{ id: string | null }>`
        SELECT find_user_id_by_email(${input.email}) AS id`.execute(tx);
      const memberId = rows[0]?.id;
      // L'invité doit s'être connecté au moins une fois à l'application.
      if (!memberId) throw new NotFoundException('Aucun utilisateur avec cet e-mail');
      const inserted = await tx
        .insertInto('initiative_member')
        .values({ initiative_id: initiativeId, user_id: memberId, role: input.role })
        .onConflict((oc) => oc.columns(['initiative_id', 'user_id']).doNothing())
        .executeTakeFirst();
      if (inserted.numInsertedOrUpdatedRows === 0n) {
        throw new ConflictException('Cet utilisateur est déjà membre de l’initiative');
      }
    });
  }

  /** Initiative visible par l'utilisateur, avec son rôle ; 404 sinon. */
  private async loadInitiative(tx: Tx, userId: string, initiativeId: string) {
    const row = await this.selectInitiatives(tx, userId).where('i.id', '=', initiativeId).executeTakeFirst();
    if (!row) throw new NotFoundException();
    return row;
  }

  private selectInitiatives(tx: Tx, userId: string) {
    return tx
      .selectFrom('initiative as i')
      .innerJoin('initiative_member as m', (join) =>
        join.onRef('m.initiative_id', '=', 'i.id').on('m.user_id', '=', userId),
      )
      .select([
        'i.id',
        'i.code',
        'i.name',
        'i.description',
        'i.analysis_approach',
        // Sans conversion, pg renverrait un Date à minuit local (décalage de fuseau).
        sql<string | null>`i.start_date::text`.as('start_date'),
        sql<string | null>`i.planned_end_date::text`.as('planned_end_date'),
        'i.archived_at',
        'i.created_at',
        'm.role',
      ]);
  }
}

function toDto(row: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  analysis_approach: InitiativeDto['analysisApproach'];
  start_date: string | null;
  planned_end_date: string | null;
  archived_at: Date | null;
  created_at: Date;
  role: InitiativeDto['myRole'];
}): InitiativeDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    analysisApproach: row.analysis_approach,
    startDate: row.start_date,
    plannedEndDate: row.planned_end_date,
    archivedAt: row.archived_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    myRole: row.role,
  };
}

const pgErrorCode = (error: unknown) => (error as { code?: unknown } | null)?.code;
const isUniqueViolation = (error: unknown) => pgErrorCode(error) === '23505';
const isConstraintViolation = (error: unknown, constraint: string) =>
  (error as { constraint?: unknown } | null)?.constraint === constraint;
