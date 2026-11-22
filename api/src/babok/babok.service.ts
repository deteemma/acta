import { Injectable } from '@nestjs/common';
import type { BabokDto, TechniqueCounts } from '@app/shared';
import { sql } from 'kysely';
import { DatabaseService, type Tx } from '../db/database.service.js';

const ELEMENT_COLUMNS = ['id', 'section', 'name_en', 'name_fr', 'summary_en', 'summary_fr'] as const;

interface ElementRow {
  id: string;
  section: string;
  name_en: string;
  name_fr: string;
  summary_en: string;
  summary_fr: string;
}

const element = (row: ElementRow) => ({
  id: row.id,
  section: row.section,
  name: { en: row.name_en, fr: row.name_fr },
  summary: { en: row.summary_en, fr: row.summary_fr },
});

/** Référentiel BABOK (ticket 06, ADR-0012) et de l'Extension Agile, identiques pour tous : lecture seule. */
@Injectable()
export class BabokService {
  constructor(private readonly database: DatabaseService) {}

  get(userId: string): Promise<BabokDto> {
    return this.database.asUser(userId, (tx) => this.load(tx));
  }

  /** Le référentiel, lu dans la transaction en cours. */
  async load(tx: Tx): Promise<BabokDto> {
    const knowledgeAreas = await tx
      .selectFrom('babok_knowledge_area')
      .select(ELEMENT_COLUMNS)
      .orderBy('position')
      .execute();
    const tasks = await tx
      .selectFrom('babok_task')
      .select([...ELEMENT_COLUMNS, 'knowledge_area_id'])
      .orderBy('position')
      .execute();
    const techniques = await tx.selectFrom('babok_technique').select(ELEMENT_COLUMNS).orderBy('position').execute();
    const links = await tx
      .selectFrom('babok_task_technique as l')
      .innerJoin('babok_technique as t', 't.id', 'l.technique_id')
      .select(['l.task_id', 'l.technique_id'])
      .orderBy('t.position')
      .execute();
    const agilePrinciples = await tx.selectFrom('agile_principle').select(ELEMENT_COLUMNS).orderBy('position').execute();
    const horizons = await tx.selectFrom('agile_horizon').select(ELEMENT_COLUMNS).orderBy('position').execute();
    const agileTechniques = await tx.selectFrom('agile_technique').select(ELEMENT_COLUMNS).orderBy('position').execute();
    const horizonLinks = await tx
      .selectFrom('agile_technique_horizon as l')
      .innerJoin('agile_horizon as h', 'h.id', 'l.horizon_id')
      .select(['l.technique_id', 'l.horizon_id'])
      .orderBy('h.position')
      .execute();
    return {
      knowledgeAreas: knowledgeAreas.map((row) => ({ kind: 'knowledgeArea' as const, ...element(row) })),
      tasks: tasks.map((row) => ({
        kind: 'task' as const,
        ...element(row),
        knowledgeAreaId: row.knowledge_area_id,
        techniqueIds: links.filter((l) => l.task_id === row.id).map((l) => l.technique_id),
      })),
      techniques: techniques.map((row) => ({ kind: 'technique' as const, ...element(row) })),
      // Extension Agile (migration 0035) : consultable par tous, module activé ou non (D6).
      agile: {
        principles: agilePrinciples.map((row) => ({ kind: 'agilePrinciple' as const, ...element(row) })),
        horizons: horizons.map((row) => ({ kind: 'agileHorizon' as const, ...element(row) })),
        techniques: agileTechniques.map((row) => ({
          kind: 'agileTechnique' as const,
          ...element(row),
          horizonIds: horizonLinks.filter((l) => l.technique_id === row.id).map((l) => l.horizon_id),
        })),
      },
    };
  }

  /**
   * Usage des techniques dans toute l'application, initiatives dont
   * l'utilisateur n'est pas membre comprises : des nombres seuls (migration 0014).
   */
  techniqueUsage(userId: string): Promise<TechniqueCounts> {
    return this.database.asUser(userId, async (tx) => {
      const { rows } = await sql<{ technique_id: string; action_count: string }>`
        SELECT technique_id, action_count FROM technique_usage_counts()
      `.execute(tx);
      return Object.fromEntries(rows.map((row) => [row.technique_id, Number(row.action_count)]));
    });
  }
}
