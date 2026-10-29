import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  can,
  checkTeamChange,
  type AddMemberInput,
  type CreateInitiativeInput,
  type InitiativeDto,
  type InitiativeMemberDto,
  type InitiativeRole,
  type OwnerDesignationDto,
  type TeamChange,
  type TeamRefusal,
  type UpdateInitiativeInput,
  type UpdateMemberInput,
} from '@app/shared';
import { sql } from 'kysely';
import { DatabaseService, type Tx } from '../db/database.service.js';
import { isConstraintViolation, isUniqueViolation } from '../db/pg-errors.js';

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
        isMe: r.user_id === userId,
      }));
    });
  }

  addMember(userId: string, initiativeId: string, input: AddMemberInput): Promise<void> {
    return this.database.asUser(userId, async (tx) => {
      const { rows } = await sql<{ id: string | null }>`
        SELECT find_user_id_by_email(${input.email}) AS id`.execute(tx);
      const memberId = rows[0]?.id;
      // L'invité doit s'être connecté au moins une fois à l'application.
      if (!memberId) throw teamRefusal('userNotFound');
      const invite = { kind: 'invite', userId: memberId, role: input.role, isTeamBa: input.isTeamBa } as const;
      await this.changeTeam(tx, userId, initiativeId, invite, () =>
        tx
          .insertInto('initiative_member')
          .values({ initiative_id: initiativeId, user_id: memberId, role: input.role, is_team_ba: input.isTeamBa })
          .execute(),
      );
    });
  }

  /** Change le rôle ou l'indication « BA de l'équipe » d'un membre (règles : team.ts). */
  updateMember(userId: string, initiativeId: string, memberId: string, input: UpdateMemberInput): Promise<void> {
    return this.database.asUser(userId, async (tx) => {
      await this.changeTeam(
        tx,
        userId,
        initiativeId,
        'role' in input
          ? { kind: 'setRole', userId: memberId, role: input.role }
          : { kind: 'setTeamBa', userId: memberId, isTeamBa: input.isTeamBa },
        () =>
          tx
            .updateTable('initiative_member')
            .set('role' in input ? { role: input.role } : { is_team_ba: input.isTeamBa })
            .where('initiative_id', '=', initiativeId)
            .where('user_id', '=', memberId)
            .execute(),
      );
    });
  }

  /** Retire un membre, ou l'utilisateur quitte l'initiative (`memberId` = lui-même). */
  removeMember(userId: string, initiativeId: string, memberId: string): Promise<void> {
    return this.database.asUser(userId, async (tx) => {
      await this.changeTeam(tx, userId, initiativeId, { kind: 'remove', userId: memberId }, () =>
        tx
          .deleteFrom('initiative_member')
          .where('initiative_id', '=', initiativeId)
          .where('user_id', '=', memberId)
          .execute(),
      );
    });
  }

  /** Désignations de propriétaire, de la plus récente à la plus ancienne. */
  listOwnerDesignations(userId: string, initiativeId: string): Promise<OwnerDesignationDto[]> {
    return this.database.asUser(userId, async (tx) => {
      const rows = await tx
        .selectFrom('owner_designation as d')
        .leftJoin('app_user as u', 'u.id', 'd.user_id')
        .leftJoin('app_user as b', 'b.id', 'd.designated_by')
        .select([
          'd.user_id',
          'u.email',
          'u.display_name',
          'd.designated_by',
          'b.email as by_email',
          'b.display_name as by_display_name',
          'd.designated_at',
        ])
        .where('d.initiative_id', '=', initiativeId)
        .orderBy('d.designated_at', 'desc')
        .orderBy('d.id', 'desc')
        .execute();
      return rows.map((r) => ({
        user: { userId: r.user_id, email: r.email, displayName: r.display_name },
        designatedBy: r.designated_by
          ? { userId: r.designated_by, email: r.by_email, displayName: r.by_display_name }
          : null,
        designatedAt: r.designated_at.toISOString(),
      }));
    });
  }

  /**
   * Applique les règles d'équipe de @app/shared (première barrière) ; la base les
   * vérifie de nouveau (seconde barrière), puis `write` enregistre le changement.
   * Refus : 403, 404 ou 409 avec `refusal`.
   */
  private async changeTeam(
    tx: Tx,
    userId: string,
    initiativeId: string,
    change: TeamChange,
    write: () => Promise<unknown>,
  ): Promise<void> {
    const team = await tx
      .selectFrom('initiative_member')
      .select(['user_id as userId', 'role', 'is_team_ba as isTeamBa'])
      .where('initiative_id', '=', initiativeId)
      .execute();
    const { rows } = await sql<{ archived: boolean }>`
      SELECT initiative_is_archived(${initiativeId}::uuid) AS archived`.execute(tx);
    const refusal = checkTeamChange(team, userId, change, { archived: rows[0]?.archived ?? false });
    if (refusal) throw teamRefusal(refusal);
    try {
      await write();
    } catch (error) {
      // Changement concurrent de l'équipe, refusé par la base.
      if (isConstraintViolation(error, 'initiative_keeps_owner')) throw teamRefusal('lastOwner');
      if (isConstraintViolation(error, 'initiative_keeps_team_ba')) throw teamRefusal('lastTeamBa');
      if (isUniqueViolation(error)) throw teamRefusal('alreadyMember');
      throw error;
    }
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

function teamRefusal(refusal: TeamRefusal) {
  switch (refusal) {
    case 'forbidden':
    case 'archived':
      return new ForbiddenException({ statusCode: 403, refusal });
    case 'notMember':
    case 'userNotFound':
      return new NotFoundException({ statusCode: 404, refusal });
    default:
      return new ConflictException({ statusCode: 409, refusal });
  }
}
