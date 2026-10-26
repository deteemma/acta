import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AddMemberInput,
  CreateInitiativeInput,
  InitiativeDto,
  InitiativeMemberDto,
  UpdateInitiativeInput,
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
      const row = await this.selectInitiatives(tx, userId).where('i.id', '=', initiativeId).executeTakeFirst();
      if (!row) throw new NotFoundException();
      return toDto(row);
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
      const row = await this.selectInitiatives(tx, userId).where('i.id', '=', id).executeTakeFirstOrThrow();
      return toDto(row);
    });
  }

  update(userId: string, initiativeId: string, input: UpdateInitiativeInput): Promise<InitiativeDto> {
    return this.database.asUser(userId, async (tx) => {
      await tx
        .updateTable('initiative')
        .set({ name: input.name, updated_at: sql`now()` })
        .where('id', '=', initiativeId)
        .execute();
      const row = await this.selectInitiatives(tx, userId).where('i.id', '=', initiativeId).executeTakeFirst();
      if (!row) throw new NotFoundException();
      return toDto(row);
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

  private selectInitiatives(tx: Tx, userId: string) {
    return tx
      .selectFrom('initiative as i')
      .innerJoin('initiative_member as m', (join) =>
        join.onRef('m.initiative_id', '=', 'i.id').on('m.user_id', '=', userId),
      )
      .select(['i.id', 'i.code', 'i.name', 'i.created_at', 'm.role']);
  }
}

function toDto(row: {
  id: string;
  code: string;
  name: string;
  created_at: Date;
  role: InitiativeDto['myRole'];
}): InitiativeDto {
  return { id: row.id, code: row.code, name: row.name, createdAt: row.created_at.toISOString(), myRole: row.role };
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === '23505';
}
