import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type AdminPageTemplateDto,
  checkPageTemplateCreation,
  checkPageTemplateDeletion,
  checkPageTemplateUpdate,
  type PageTemplateInput,
  type PageTemplateRefusal,
  type UpdatePageTemplateInput,
} from '@app/shared';
import { sql } from 'kysely';
import { DatabaseService, type Tx } from '../db/database.service.js';
import { isConstraintViolation } from '../db/pg-errors.js';

/**
 * Administration des modèles de page (ticket 30) : règles de @app/shared
 * (première barrière), fonctions admin_* de la base (seconde barrière, migration
 * 0030). Chaque écriture renvoie toute la liste, à jour.
 */
@Injectable()
export class AdminPageTemplatesService {
  constructor(private readonly database: DatabaseService) {}

  list(adminId: string): Promise<AdminPageTemplateDto[]> {
    return this.database.asAdmin(adminId, (tx) => loadAdminTemplates(tx));
  }

  /** Modèle ajouté, actif dès son ajout. */
  add(adminId: string, input: PageTemplateInput): Promise<AdminPageTemplateDto[]> {
    return this.database.asAdmin(adminId, async (tx) => {
      const refusal = checkPageTemplateCreation(await loadAdminTemplates(tx), input, await loadTaskIds(tx));
      if (refusal) throw pageTemplateRefusal(refusal);
      await write(() =>
        sql`SELECT admin_add_page_template(${randomUUID()}, ${input.name.fr}, ${input.name.en}, ${JSON.stringify(input.content.fr)}::jsonb, ${JSON.stringify(input.content.en)}::jsonb, ${input.taskId})`.execute(
          tx,
        ),
      );
      return loadAdminTemplates(tx);
    });
  }

  /** Nom, contenu et tâche d'un modèle ajouté ; état (actif ou désactivé) de tout modèle. */
  update(adminId: string, id: string, input: UpdatePageTemplateInput): Promise<AdminPageTemplateDto[]> {
    return this.database.asAdmin(adminId, async (tx) => {
      const refusal = checkPageTemplateUpdate(await loadAdminTemplates(tx), id, input, await loadTaskIds(tx));
      if (refusal) throw pageTemplateRefusal(refusal);
      if ('name' in input) {
        await write(() =>
          sql`SELECT admin_update_page_template(${id}, ${input.name.fr}, ${input.name.en}, ${JSON.stringify(input.content.fr)}::jsonb, ${JSON.stringify(input.content.en)}::jsonb, ${input.taskId})`.execute(
            tx,
          ),
        );
      }
      if (input.active !== undefined) {
        await write(() => sql`SELECT admin_set_page_template_active(${id}, ${input.active})`.execute(tx));
      }
      return loadAdminTemplates(tx);
    });
  }

  /** Seul un modèle ajouté qui n'a jamais servi se supprime. */
  remove(adminId: string, id: string): Promise<AdminPageTemplateDto[]> {
    return this.database.asAdmin(adminId, async (tx) => {
      const refusal = checkPageTemplateDeletion(await loadAdminTemplates(tx), id);
      if (refusal) throw pageTemplateRefusal(refusal);
      await write(() => sql`SELECT admin_delete_page_template(${id})`.execute(tx));
      return loadAdminTemplates(tx);
    });
  }
}

async function loadAdminTemplates(tx: Tx): Promise<AdminPageTemplateDto[]> {
  const rows = await tx
    .selectFrom('page_template')
    .select(['id', 'name_fr', 'name_en', 'content_fr', 'content_en', 'task_id', 'origin', 'active', 'used'])
    .orderBy('name_fr')
    .execute();
  return rows.map((r) => ({
    id: r.id,
    name: { fr: r.name_fr, en: r.name_en },
    content: { fr: r.content_fr, en: r.content_en },
    taskId: r.task_id,
    origin: r.origin,
    active: r.active,
    used: r.used,
  }));
}

async function loadTaskIds(tx: Tx): Promise<string[]> {
  return (await tx.selectFrom('babok_task').select('id').execute()).map((r) => r.id);
}

/** Contraintes de la base (seconde barrière) et refus correspondants. */
const DB_REFUSALS: [string, PageTemplateRefusal][] = [
  ['page_template_name_fr_key', 'nameTaken'],
  ['page_template_name_en_key', 'nameTaken'],
  ['page_template_task_id_fkey', 'unknownTask'],
  ['page_template_delivered_locked', 'deliveredTemplateLocked'],
  ['page_template_used', 'templateUsed'],
];

/** Écriture refusée par la base (seconde barrière) : motif lisible par le client. */
async function write(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    const found = DB_REFUSALS.find(([constraint]) => isConstraintViolation(error, constraint));
    if (found) throw pageTemplateRefusal(found[1]);
    throw error;
  }
}

function pageTemplateRefusal(refusal: PageTemplateRefusal) {
  return refusal === 'unknownTemplate'
    ? new NotFoundException({ statusCode: 404, refusal })
    : new ConflictException({ statusCode: 409, refusal });
}
