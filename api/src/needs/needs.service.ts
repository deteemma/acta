import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type CreateNeedInput,
  type NeedDto,
  type NeedRefusal,
  type ReferenceDto,
  sortByName,
  sortByReference,
  type StakeholderRefDto,
  type UpdateNeedInput,
} from '@app/shared';
import { DatabaseService, type Tx } from '../db/database.service.js';
import { isConstraintViolation, isForeignKeyViolation } from '../db/pg-errors.js';
import { stakeholderRefusal } from '../stakeholders/stakeholders.service.js';

@Injectable()
export class NeedsService {
  constructor(private readonly database: DatabaseService) {}

  listForInitiative(userId: string, initiativeId: string): Promise<NeedDto[]> {
    return this.database.asUser(userId, async (tx) => {
      const rows = await this.selectNeeds(tx).where('n.initiative_id', '=', initiativeId).execute();
      return sortByReference(await this.toDtos(tx, rows));
    });
  }

  /**
   * Palette et aperçu des références citées dans un texte : besoins et exigences
   * de toutes les initiatives dont je suis membre (RLS).
   */
  listReferences(userId: string): Promise<ReferenceDto[]> {
    return this.database.asUser(userId, async (tx) => {
      const needs = await tx
        .selectFrom('need as n')
        .innerJoin('initiative as i', 'i.id', 'n.initiative_id')
        .select(['n.id', 'n.initiative_id', 'i.archived_at', 'n.reference', 'n.title'])
        .execute();
      const requirements = await tx
        .selectFrom('requirement as r')
        .innerJoin('initiative as i', 'i.id', 'r.initiative_id')
        .select(['r.id', 'r.initiative_id', 'i.archived_at', 'r.reference', 'r.title', 'r.type', 'r.subtype', 'r.status'])
        .execute();
      return sortByReference([
        ...needs.map((r) => ({
          category: 'need' as const,
          id: r.id,
          initiativeId: r.initiative_id,
          initiativeArchived: r.archived_at != null,
          reference: r.reference,
          title: r.title,
          requirement: null,
        })),
        ...requirements.map((r) => ({
          category: 'requirement' as const,
          id: r.id,
          initiativeId: r.initiative_id,
          initiativeArchived: r.archived_at != null,
          reference: r.reference,
          title: r.title,
          requirement: { type: r.type, subtype: r.subtype, status: r.status },
        })),
      ]);
    });
  }

  get(userId: string, initiativeId: string, needId: string): Promise<NeedDto> {
    return this.database.asUser(userId, (tx) => this.loadNeed(tx, initiativeId, needId));
  }

  /** La référence est attribuée par la base. */
  create(userId: string, initiativeId: string, input: CreateNeedInput): Promise<NeedDto> {
    const id = randomUUID();
    return this.database.asUser(userId, async (tx) => {
      if (input.stakeholderIds) await this.checkStakeholders(tx, initiativeId, input.stakeholderIds);
      await tx
        .insertInto('need')
        .values({
          id,
          initiative_id: initiativeId,
          title: input.title,
          nature: input.nature,
          description: input.description ?? null,
        })
        .execute();
      if (input.stakeholderIds) await this.linkStakeholders(tx, initiativeId, id, input.stakeholderIds);
      return this.loadNeed(tx, initiativeId, id);
    });
  }

  /** Seuls les champs fournis changent ; changer les parties prenantes à l'origine modifie le besoin. */
  update(userId: string, initiativeId: string, needId: string, input: UpdateNeedInput): Promise<NeedDto> {
    return this.database.asUser(userId, async (tx) => {
      const current = await this.loadNeed(tx, initiativeId, needId);
      const { stakeholderIds, ...fields } = input;
      const fieldsChange = Object.values(fields).some((value) => value !== undefined);
      const linksChange =
        stakeholderIds !== undefined && !sameIds(stakeholderIds, current.stakeholders.map((s) => s.id));
      // Rien à changer : un UPDATE sans colonne serait refusé par PostgreSQL.
      if (!fieldsChange && !linksChange) return current;
      if (linksChange) {
        await this.checkStakeholders(tx, initiativeId, stakeholderIds);
        await tx.deleteFrom('need_stakeholder').where('need_id', '=', needId).execute();
        await this.linkStakeholders(tx, initiativeId, needId, stakeholderIds);
      }
      // Sans autre colonne changée, on réécrit la nature pour que le déclencheur
      // enregistre auteur et date de la modification.
      await tx
        .updateTable('need')
        .set(
          fieldsChange
            ? { title: input.title, nature: input.nature, description: input.description }
            : { nature: current.nature },
        )
        .where('id', '=', needId)
        .where('initiative_id', '=', initiativeId)
        .execute();
      return this.loadNeed(tx, initiativeId, needId);
    });
  }

  /** Un besoin lié à une action ou à une exigence ne se supprime pas ; ses parties prenantes à l'origine partent avec lui. */
  remove(userId: string, initiativeId: string, needId: string): Promise<void> {
    return this.database.asUser(userId, async (tx) => {
      await this.loadNeed(tx, initiativeId, needId);
      try {
        await tx.deleteFrom('need').where('id', '=', needId).where('initiative_id', '=', initiativeId).execute();
      } catch (error) {
        if (isForeignKeyViolation(error)) throw needRefusal('needLinked');
        throw error;
      }
    });
  }

  /** Première barrière : chaque partie prenante à l'origine appartient à l'initiative. */
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

  private async linkStakeholders(tx: Tx, initiativeId: string, needId: string, stakeholderIds: string[]) {
    if (stakeholderIds.length === 0) return;
    try {
      await tx
        .insertInto('need_stakeholder')
        .values(stakeholderIds.map((id) => ({ initiative_id: initiativeId, need_id: needId, stakeholder_id: id })))
        .execute();
    } catch (error) {
      // Seconde barrière : partie prenante d'une autre initiative.
      if (isConstraintViolation(error, 'need_stakeholder_stakeholder_fkey')) {
        throw stakeholderRefusal('unknownStakeholder');
      }
      throw error;
    }
  }

  private async loadNeed(tx: Tx, initiativeId: string, needId: string): Promise<NeedDto> {
    const row = await this.selectNeeds(tx)
      .where('n.id', '=', needId)
      .where('n.initiative_id', '=', initiativeId)
      .executeTakeFirst();
    if (!row) throw new NotFoundException();
    const [dto] = await this.toDtos(tx, [row]);
    return dto!;
  }

  /** Avec les parties prenantes à l'origine de chaque besoin, par ordre alphabétique. */
  private async toDtos(tx: Tx, rows: NeedRow[]): Promise<NeedDto[]> {
    if (rows.length === 0) return [];
    const links = await tx
      .selectFrom('need_stakeholder as l')
      .innerJoin('stakeholder as s', 's.id', 'l.stakeholder_id')
      .select(['l.need_id', 's.id', 's.name'])
      .where(
        'l.need_id',
        'in',
        rows.map((r) => r.id),
      )
      .execute();
    const byNeed = new Map<string, StakeholderRefDto[]>();
    for (const { need_id, id, name } of links) {
      byNeed.set(need_id, [...(byNeed.get(need_id) ?? []), { id, name }]);
    }
    return rows.map((r) => toDto(r, sortByName(byNeed.get(r.id) ?? [])));
  }

  private selectNeeds(tx: Tx) {
    return tx
      .selectFrom('need as n')
      .leftJoin('app_user as cu', 'cu.id', 'n.created_by')
      .leftJoin('app_user as uu', 'uu.id', 'n.updated_by')
      .select([
        'n.id',
        'n.initiative_id',
        'n.reference',
        'n.title',
        'n.nature',
        'n.description',
        'n.created_at',
        'n.created_by',
        'cu.email as created_by_email',
        'cu.display_name as created_by_display_name',
        'n.updated_at',
        'n.updated_by',
        'uu.email as updated_by_email',
        'uu.display_name as updated_by_display_name',
      ]);
  }
}

type NeedRow = Awaited<ReturnType<ReturnType<NeedsService['selectNeeds']>['executeTakeFirstOrThrow']>>;

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

function toDto(r: NeedRow, stakeholders: StakeholderRefDto[]): NeedDto {
  return {
    id: r.id,
    initiativeId: r.initiative_id,
    reference: r.reference,
    title: r.title,
    nature: r.nature,
    description: r.description,
    stakeholders,
    createdAt: r.created_at.toISOString(),
    createdBy: { userId: r.created_by, email: r.created_by_email, displayName: r.created_by_display_name },
    updatedAt: r.updated_at.toISOString(),
    updatedBy: { userId: r.updated_by, email: r.updated_by_email, displayName: r.updated_by_display_name },
  };
}

export function needRefusal(refusal: NeedRefusal) {
  return refusal === 'needLinked'
    ? new ConflictException({ statusCode: 409, refusal })
    : new BadRequestException({ statusCode: 400, refusal });
}
