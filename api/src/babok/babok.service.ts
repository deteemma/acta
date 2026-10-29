import { Injectable } from '@nestjs/common';
import type { BabokDto } from '@app/shared';
import { DatabaseService } from '../db/database.service.js';

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

/** Référentiel BABOK (ticket 06, ADR-0012), identique pour tous : lecture seule. */
@Injectable()
export class BabokService {
  constructor(private readonly database: DatabaseService) {}

  get(userId: string): Promise<BabokDto> {
    return this.database.asUser(userId, async (tx) => {
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
      return {
        knowledgeAreas: knowledgeAreas.map((row) => ({ kind: 'knowledgeArea' as const, ...element(row) })),
        tasks: tasks.map((row) => ({
          kind: 'task' as const,
          ...element(row),
          knowledgeAreaId: row.knowledge_area_id,
          techniqueIds: links.filter((l) => l.task_id === row.id).map((l) => l.technique_id),
        })),
        techniques: techniques.map((row) => ({ kind: 'technique' as const, ...element(row) })),
      };
    });
  }
}
