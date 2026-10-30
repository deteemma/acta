import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  checkRequirementShape,
  type CreateRequirementInput,
  createsParentCycle,
  type NeedRefDto,
  type RequirementDto,
  type RequirementRefusal,
  type RequirementVersionDto,
  sortByName,
  sortByReference,
  type StakeholderRefDto,
  type UpdateRequirementInput,
} from '@app/shared';
import { sql } from 'kysely';
import { DatabaseService, type Tx } from '../db/database.service.js';
import { isConstraintViolation, isForeignKeyViolation } from '../db/pg-errors.js';
import { needRefusal } from '../needs/needs.service.js';
import { stakeholderRefusal } from '../stakeholders/stakeholders.service.js';

@Injectable()
export class RequirementsService {
  constructor(private readonly database: DatabaseService) {}

  listForInitiative(userId: string, initiativeId: string): Promise<RequirementDto[]> {
    return this.database.asUser(userId, async (tx) => {
      const rows = await this.selectRequirements(tx).where('r.initiative_id', '=', initiativeId).execute();
      return sortByReference(await this.toDtos(tx, rows));
    });
  }

  get(userId: string, initiativeId: string, requirementId: string): Promise<RequirementDto> {
    return this.database.asUser(userId, (tx) => this.loadRequirement(tx, initiativeId, requirementId));
  }

  /** Versions enregistrées par la base, la plus ancienne d'abord (requirementHistory les compare). */
  history(userId: string, initiativeId: string, requirementId: string): Promise<RequirementVersionDto[]> {
    return this.database.asUser(userId, async (tx) => {
      await this.loadRequirement(tx, initiativeId, requirementId);
      const rows = await tx
        .selectFrom('requirement_version as v')
        .leftJoin('app_user as u', 'u.id', 'v.changed_by')
        .select(['v.changed_at', 'v.changed_by', 'u.email', 'u.display_name', 'v.snapshot'])
        .where('v.requirement_id', '=', requirementId)
        .orderBy('v.id')
        .execute();
      return rows.map((r) => ({
        changedAt: r.changed_at.toISOString(),
        changedBy: { userId: r.changed_by, email: r.email, displayName: r.display_name },
        snapshot: r.snapshot,
      }));
    });
  }

  /** La référence est attribuée par la base, le statut est Proposée. */
  create(userId: string, initiativeId: string, input: CreateRequirementInput): Promise<RequirementDto> {
    const id = randomUUID();
    return this.database.asUser(userId, async (tx) => {
      const stakeholderIds = input.stakeholderIds ?? [];
      const needIds = input.needIds ?? [];
      const parentId = input.parentId ?? null;
      await this.checkStakeholders(tx, initiativeId, stakeholderIds);
      await this.checkNeeds(tx, initiativeId, needIds);
      if (parentId) await this.checkParent(tx, initiativeId, id, parentId);
      await write(() =>
        tx
          .insertInto('requirement')
          .values({
            id,
            initiative_id: initiativeId,
            title: input.title,
            statement: input.statement,
            type: input.type,
            subtype: input.subtype ?? null,
            parent_id: parentId,
          })
          .execute(),
      );
      await this.linkStakeholders(tx, initiativeId, id, stakeholderIds);
      await this.linkNeeds(tx, initiativeId, id, needIds);
      await finalize(tx);
      return this.loadRequirement(tx, initiativeId, id);
    });
  }

  /**
   * Seuls les champs fournis changent ; tout statut peut passer à tout autre.
   * Changer les sources, les besoins ou la parente modifie l'exigence.
   */
  update(
    userId: string,
    initiativeId: string,
    requirementId: string,
    input: UpdateRequirementInput,
  ): Promise<RequirementDto> {
    return this.database.asUser(userId, async (tx) => {
      const current = await this.loadRequirement(tx, initiativeId, requirementId);
      const { stakeholderIds, needIds, ...fields } = input;
      const fieldsChange = Object.values(fields).some((value) => value !== undefined);
      const stakeholdersChange =
        stakeholderIds !== undefined && !sameIds(stakeholderIds, current.stakeholders.map((s) => s.id));
      const needsChange = needIds !== undefined && !sameIds(needIds, current.needs.map((n) => n.id));
      // Rien à changer : un UPDATE sans colonne serait refusé par PostgreSQL.
      if (!fieldsChange && !stakeholdersChange && !needsChange) return current;
      // L'exigence telle qu'elle sera enregistrée.
      const refusal = checkRequirementShape({
        type: input.type ?? current.type,
        subtype: input.subtype !== undefined ? input.subtype : current.subtype,
        needIds: needIds ?? current.needs.map((n) => n.id),
        parentId: input.parentId !== undefined ? input.parentId : (current.parent?.id ?? null),
      });
      if (refusal) throw requirementRefusal(refusal);
      if (input.parentId && input.parentId !== current.parent?.id) {
        await this.checkParent(tx, initiativeId, requirementId, input.parentId);
      }
      if (stakeholdersChange) {
        await this.checkStakeholders(tx, initiativeId, stakeholderIds);
        await tx.deleteFrom('requirement_stakeholder').where('requirement_id', '=', requirementId).execute();
        await this.linkStakeholders(tx, initiativeId, requirementId, stakeholderIds);
      }
      if (needsChange) {
        await this.checkNeeds(tx, initiativeId, needIds);
        await tx.deleteFrom('requirement_need').where('requirement_id', '=', requirementId).execute();
        await this.linkNeeds(tx, initiativeId, requirementId, needIds);
      }
      // Sans autre colonne changée, on réécrit le statut pour que le déclencheur
      // enregistre auteur et date de la modification.
      await write(() =>
        tx
          .updateTable('requirement')
          .set(
            fieldsChange
              ? {
                  title: input.title,
                  statement: input.statement,
                  type: input.type,
                  subtype: input.subtype,
                  status: input.status,
                  parent_id: input.parentId,
                }
              : { status: current.status },
          )
          .where('id', '=', requirementId)
          .where('initiative_id', '=', initiativeId)
          .execute(),
      );
      await finalize(tx);
      return this.loadRequirement(tx, initiativeId, requirementId);
    });
  }

  /**
   * Une exigence liée à une action ou qui a des enfants ne se supprime pas ; ses
   * sources, ses liens vers ses besoins et son historique partent avec elle.
   */
  remove(userId: string, initiativeId: string, requirementId: string): Promise<void> {
    return this.database.asUser(userId, async (tx) => {
      await this.loadRequirement(tx, initiativeId, requirementId);
      try {
        await tx
          .deleteFrom('requirement')
          .where('id', '=', requirementId)
          .where('initiative_id', '=', initiativeId)
          .execute();
      } catch (error) {
        if (isForeignKeyViolation(error)) throw requirementRefusal('requirementLinked');
        throw error;
      }
    });
  }

  /** Première barrière : chaque source appartient à l'initiative. */
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

  /** Première barrière : la parente appartient à l'initiative et ne descend pas de l'exigence. */
  private async checkParent(tx: Tx, initiativeId: string, requirementId: string, parentId: string): Promise<void> {
    const tree = await tx
      .selectFrom('requirement')
      .select(['id', 'parent_id as parentId'])
      .where('initiative_id', '=', initiativeId)
      .execute();
    if (!tree.some((r) => r.id === parentId)) throw requirementRefusal('unknownRequirement');
    if (createsParentCycle(tree, requirementId, parentId)) throw requirementRefusal('parentCycle');
  }

  private async linkStakeholders(tx: Tx, initiativeId: string, requirementId: string, stakeholderIds: string[]) {
    if (stakeholderIds.length === 0) return;
    await write(() =>
      tx
        .insertInto('requirement_stakeholder')
        .values(
          stakeholderIds.map((id) => ({ initiative_id: initiativeId, requirement_id: requirementId, stakeholder_id: id })),
        )
        .execute(),
    );
  }

  private async linkNeeds(tx: Tx, initiativeId: string, requirementId: string, needIds: string[]) {
    if (needIds.length === 0) return;
    await write(() =>
      tx
        .insertInto('requirement_need')
        .values(needIds.map((id) => ({ initiative_id: initiativeId, requirement_id: requirementId, need_id: id })))
        .execute(),
    );
  }

  private async loadRequirement(tx: Tx, initiativeId: string, requirementId: string): Promise<RequirementDto> {
    const row = await this.selectRequirements(tx)
      .where('r.id', '=', requirementId)
      .where('r.initiative_id', '=', initiativeId)
      .executeTakeFirst();
    if (!row) throw new NotFoundException();
    const [dto] = await this.toDtos(tx, [row]);
    return dto!;
  }

  /** Avec les sources de chaque exigence, par ordre alphabétique, et ses besoins, par référence. */
  private async toDtos(tx: Tx, rows: RequirementRow[]): Promise<RequirementDto[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const needLinks = await tx
      .selectFrom('requirement_need as l')
      .innerJoin('need as n', 'n.id', 'l.need_id')
      .select(['l.requirement_id', 'n.id', 'n.reference', 'n.title'])
      .where('l.requirement_id', 'in', ids)
      .execute();
    const needsByRequirement = new Map<string, NeedRefDto[]>();
    for (const { requirement_id, ...need } of needLinks) {
      needsByRequirement.set(requirement_id, [...(needsByRequirement.get(requirement_id) ?? []), need]);
    }
    const sourceLinks = await tx
      .selectFrom('requirement_stakeholder as l')
      .innerJoin('stakeholder as s', 's.id', 'l.stakeholder_id')
      .select(['l.requirement_id', 's.id', 's.name'])
      .where('l.requirement_id', 'in', ids)
      .execute();
    const sourcesByRequirement = new Map<string, StakeholderRefDto[]>();
    for (const { requirement_id, id, name } of sourceLinks) {
      sourcesByRequirement.set(requirement_id, [...(sourcesByRequirement.get(requirement_id) ?? []), { id, name }]);
    }
    return rows.map((r) =>
      toDto(r, sortByName(sourcesByRequirement.get(r.id) ?? []), sortByReference(needsByRequirement.get(r.id) ?? [])),
    );
  }

  private selectRequirements(tx: Tx) {
    return tx
      .selectFrom('requirement as r')
      .leftJoin('requirement as p', 'p.id', 'r.parent_id')
      .leftJoin('app_user as cu', 'cu.id', 'r.created_by')
      .leftJoin('app_user as uu', 'uu.id', 'r.updated_by')
      .select([
        'r.id',
        'r.initiative_id',
        'r.reference',
        'r.title',
        'r.statement',
        'r.type',
        'r.subtype',
        'r.status',
        'r.parent_id',
        'p.reference as parent_reference',
        'p.title as parent_title',
        'r.created_at',
        'r.created_by',
        'cu.email as created_by_email',
        'cu.display_name as created_by_display_name',
        'r.updated_at',
        'r.updated_by',
        'uu.email as updated_by_email',
        'uu.display_name as updated_by_display_name',
      ]);
  }
}

type RequirementRow = Awaited<
  ReturnType<ReturnType<RequirementsService['selectRequirements']>['executeTakeFirstOrThrow']>
>;

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

function toDto(r: RequirementRow, stakeholders: StakeholderRefDto[], needs: NeedRefDto[]): RequirementDto {
  return {
    id: r.id,
    initiativeId: r.initiative_id,
    reference: r.reference,
    title: r.title,
    statement: r.statement,
    type: r.type,
    subtype: r.subtype,
    status: r.status,
    stakeholders,
    needs,
    parent:
      r.parent_id && r.parent_reference && r.parent_title
        ? { id: r.parent_id, reference: r.parent_reference, title: r.parent_title }
        : null,
    createdAt: r.created_at.toISOString(),
    createdBy: { userId: r.created_by, email: r.created_by_email, displayName: r.created_by_display_name },
    updatedAt: r.updated_at.toISOString(),
    updatedBy: { userId: r.updated_by, email: r.updated_by_email, displayName: r.updated_by_display_name },
  };
}

/**
 * Vérifications de fin de transaction (migration 0013), avancées ici pour que
 * le refus soit lisible et que l'historique soit à jour dans la réponse.
 */
async function finalize(tx: Tx): Promise<void> {
  await write(() =>
    sql`SET CONSTRAINTS requirement_finalize, requirement_need_finalize, requirement_stakeholder_finalize IMMEDIATE`.execute(
      tx,
    ),
  );
}

/** Écriture refusée par la base (seconde barrière) : motif lisible par le client. */
async function write(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (isConstraintViolation(error, 'requirement_subtype_matches_type')) throw requirementRefusal('subtypeMismatch');
    if (isConstraintViolation(error, 'requirement_origin_required')) throw requirementRefusal('originRequired');
    if (isConstraintViolation(error, 'requirement_parent_cycle')) throw requirementRefusal('parentCycle');
    if (isConstraintViolation(error, 'requirement_parent_fkey')) throw requirementRefusal('unknownRequirement');
    if (isConstraintViolation(error, 'requirement_need_need_fkey')) throw needRefusal('unknownNeed');
    if (isConstraintViolation(error, 'requirement_stakeholder_stakeholder_fkey')) {
      throw stakeholderRefusal('unknownStakeholder');
    }
    throw error;
  }
}

export function requirementRefusal(refusal: RequirementRefusal) {
  return refusal === 'requirementLinked'
    ? new ConflictException({ statusCode: 409, refusal })
    : new BadRequestException({ statusCode: 400, refusal });
}
