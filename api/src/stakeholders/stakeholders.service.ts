import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type CreateStakeholderInput,
  type StakeholderDto,
  type StakeholderRefusal,
  type StakeholderRole,
  sortByName,
  type UpdateStakeholderInput,
} from '@app/shared';
import { sql } from 'kysely';
import { DatabaseService, type Tx } from '../db/database.service.js';
import { isConstraintViolation, isForeignKeyViolation } from '../db/pg-errors.js';

@Injectable()
export class StakeholdersService {
  constructor(private readonly database: DatabaseService) {}

  listForInitiative(userId: string, initiativeId: string): Promise<StakeholderDto[]> {
    return this.database.asUser(userId, async (tx) => {
      const rows = await this.selectStakeholders(tx).where('s.initiative_id', '=', initiativeId).execute();
      return sortByName(rows.map(toDto));
    });
  }

  get(userId: string, initiativeId: string, stakeholderId: string): Promise<StakeholderDto> {
    return this.database.asUser(userId, (tx) => this.loadStakeholder(tx, initiativeId, stakeholderId));
  }

  create(userId: string, initiativeId: string, input: CreateStakeholderInput): Promise<StakeholderDto> {
    const id = randomUUID();
    return this.database.asUser(userId, async (tx) => {
      if (input.userId) await this.checkLinkableUser(tx, initiativeId, input.userId, null);
      await write(() =>
        tx
          .insertInto('stakeholder')
          .values({
            id,
            initiative_id: initiativeId,
            name: input.name,
            kind: input.kind,
            roles: input.roles,
            influence: input.influence ?? null,
            interest: input.interest ?? null,
            contact: input.contact ?? null,
            notes: input.notes ?? null,
            user_id: input.userId ?? null,
          })
          .execute(),
      );
      return this.loadStakeholder(tx, initiativeId, id);
    });
  }

  /** Seuls les champs fournis changent. */
  update(
    userId: string,
    initiativeId: string,
    stakeholderId: string,
    input: UpdateStakeholderInput,
  ): Promise<StakeholderDto> {
    return this.database.asUser(userId, async (tx) => {
      const current = await this.loadStakeholder(tx, initiativeId, stakeholderId);
      // Rien à changer : un UPDATE sans colonne serait refusé par PostgreSQL.
      if (Object.values(input).every((value) => value === undefined)) return current;
      // Le compte n'est vérifié qu'à sa liaison : le lien reste si la personne quitte l'initiative.
      if (input.userId && input.userId !== current.user?.userId) {
        await this.checkLinkableUser(tx, initiativeId, input.userId, stakeholderId);
      }
      await write(() =>
        tx
          .updateTable('stakeholder')
          .set({
            name: input.name,
            kind: input.kind,
            roles: input.roles,
            influence: input.influence,
            interest: input.interest,
            contact: input.contact,
            notes: input.notes,
            user_id: input.userId,
          })
          .where('id', '=', stakeholderId)
          .where('initiative_id', '=', initiativeId)
          .execute(),
      );
      return this.loadStakeholder(tx, initiativeId, stakeholderId);
    });
  }

  /** Une partie prenante liée à une action ne se supprime pas. */
  remove(userId: string, initiativeId: string, stakeholderId: string): Promise<void> {
    return this.database.asUser(userId, async (tx) => {
      await this.loadStakeholder(tx, initiativeId, stakeholderId);
      try {
        await tx
          .deleteFrom('stakeholder')
          .where('id', '=', stakeholderId)
          .where('initiative_id', '=', initiativeId)
          .execute();
      } catch (error) {
        if (isForeignKeyViolation(error)) throw stakeholderRefusal('stakeholderLinked');
        throw error;
      }
    });
  }

  /**
   * Première barrière : le compte relié est celui d'un membre, quel que soit
   * son rôle, et n'est pas déjà relié à une autre fiche de l'initiative.
   */
  private async checkLinkableUser(tx: Tx, initiativeId: string, userId: string, stakeholderId: string | null): Promise<void> {
    const member = await tx
      .selectFrom('initiative_member')
      .select('user_id')
      .where('initiative_id', '=', initiativeId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (!member) throw stakeholderRefusal('userNotMember');
    let other = tx
      .selectFrom('stakeholder')
      .select('id')
      .where('initiative_id', '=', initiativeId)
      .where('user_id', '=', userId);
    if (stakeholderId) other = other.where('id', '!=', stakeholderId);
    if (await other.executeTakeFirst()) throw stakeholderRefusal('userAlreadyLinked');
  }

  private async loadStakeholder(tx: Tx, initiativeId: string, stakeholderId: string): Promise<StakeholderDto> {
    const row = await this.selectStakeholders(tx)
      .where('s.id', '=', stakeholderId)
      .where('s.initiative_id', '=', initiativeId)
      .executeTakeFirst();
    if (!row) throw new NotFoundException();
    return toDto(row);
  }

  private selectStakeholders(tx: Tx) {
    return tx
      .selectFrom('stakeholder as s')
      .leftJoin('initiative_member as um', (join) =>
        join.onRef('um.initiative_id', '=', 's.initiative_id').onRef('um.user_id', '=', 's.user_id'),
      )
      .leftJoin('app_user as u', 'u.id', 's.user_id')
      .leftJoin('app_user as cu', 'cu.id', 's.created_by')
      .leftJoin('app_user as uu', 'uu.id', 's.updated_by')
      .select([
        's.id',
        's.initiative_id',
        's.name',
        's.kind',
        // pg ne sait pas lire un tableau de type énuméré : il le renverrait en texte « {a,b} ».
        sql<StakeholderRole[]>`s.roles::text[]`.as('roles'),
        's.influence',
        's.interest',
        's.contact',
        's.notes',
        's.user_id',
        'u.email as user_email',
        'u.display_name as user_display_name',
        'um.user_id as user_member_id',
        's.created_at',
        's.created_by',
        'cu.email as created_by_email',
        'cu.display_name as created_by_display_name',
        's.updated_at',
        's.updated_by',
        'uu.email as updated_by_email',
        'uu.display_name as updated_by_display_name',
      ]);
  }
}

type StakeholderRow = Awaited<
  ReturnType<ReturnType<StakeholdersService['selectStakeholders']>['executeTakeFirstOrThrow']>
>;

function toDto(r: StakeholderRow): StakeholderDto {
  return {
    id: r.id,
    initiativeId: r.initiative_id,
    name: r.name,
    kind: r.kind,
    roles: r.roles,
    influence: r.influence,
    interest: r.interest,
    contact: r.contact,
    notes: r.notes,
    user: r.user_id
      ? {
          userId: r.user_id,
          email: r.user_email,
          displayName: r.user_display_name,
          member: r.user_member_id != null,
        }
      : null,
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
    if (isConstraintViolation(error, 'stakeholder_user_member')) throw stakeholderRefusal('userNotMember');
    if (isConstraintViolation(error, 'stakeholder_user_unique')) throw stakeholderRefusal('userAlreadyLinked');
    throw error;
  }
}

export function stakeholderRefusal(refusal: StakeholderRefusal) {
  return refusal === 'stakeholderLinked' || refusal === 'userAlreadyLinked'
    ? new ConflictException({ statusCode: 409, refusal })
    : new BadRequestException({ statusCode: 400, refusal });
}
