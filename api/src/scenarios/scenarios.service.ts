import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  acceptsScenarios,
  type BackgroundChangedSinceBody,
  type BackgroundDto,
  checkScenarioOrder,
  type CreateScenarioInput,
  type FeatureContent,
  type FeatureDto,
  type Locale,
  newFeatureLanguage,
  type ReorderScenariosInput,
  type ScenarioChangedSinceBody,
  type ScenarioDto,
  type SaveBackgroundInput,
  type ScenarioRefusal,
  type SetFeatureLanguageInput,
  type UpdateScenarioInput,
} from '@app/shared';
import { sql } from 'kysely';
import { DatabaseService, type Tx } from '../db/database.service.js';
import { isConstraintViolation } from '../db/pg-errors.js';

/**
 * Scénarios Gherkin d'une exigence, Contexte et langue de sa Fonctionnalité
 * (phase 3, tickets 01 et 02) : tout membre consulte ; propriétaires et
 * contributeurs créent, modifient, ordonnent et suppriment, et changent la langue (D17).
 */
@Injectable()
export class ScenariosService {
  constructor(private readonly database: DatabaseService) {}

  /** Dans l'ordre de l'exigence (D9). */
  list(userId: string, initiativeId: string, requirementId: string): Promise<ScenarioDto[]> {
    return this.database.asUser(userId, async (tx) => {
      await loadRequirement(tx, initiativeId, requirementId);
      return selectScenarios(tx, requirementId);
    });
  }

  /** La référence et la place, en dernier (D9), sont attribuées par la base. */
  create(userId: string, initiativeId: string, requirementId: string, input: CreateScenarioInput): Promise<ScenarioDto> {
    const id = randomUUID();
    return this.database.asUser(userId, async (tx) => {
      const requirement = await loadRequirement(tx, initiativeId, requirementId);
      if (!acceptsScenarios(requirement)) throw scenarioRefusal('notFunctionalRequirement');
      await ensureFeature(tx, initiativeId, requirementId, userId, input.language);
      await tx
        .insertInto('gherkin_scenario')
        .values({ id, initiative_id: initiativeId, requirement_id: requirementId, title: input.title, text: input.text })
        .execute()
        .catch(translate);
      return loadScenario(tx, requirementId, id);
    });
  }

  /**
   * Modification simultanée (D14) : pas de verrou ; l'écriture ne passe que si le
   * scénario est encore dans l'état sur lequel la saisie est basée. Deux écritures
   * simultanées passent l'une après l'autre : la seconde ne trouve plus cet état.
   */
  update(
    userId: string,
    initiativeId: string,
    requirementId: string,
    scenarioId: string,
    input: UpdateScenarioInput,
  ): Promise<ScenarioDto> {
    return this.database.asUser(userId, async (tx) => {
      await loadRequirement(tx, initiativeId, requirementId);
      const { baseRowVersion, title, text } = input;
      const updated =
        title === undefined && text === undefined
          ? await tx
              .selectFrom('gherkin_scenario')
              .select('id')
              .where('id', '=', scenarioId)
              .where('requirement_id', '=', requirementId)
              .where('row_version', '=', baseRowVersion)
              .executeTakeFirst()
          : await tx
              .updateTable('gherkin_scenario')
              .set({ title, text })
              .where('id', '=', scenarioId)
              .where('requirement_id', '=', requirementId)
              .where('row_version', '=', baseRowVersion)
              .returning('id')
              .executeTakeFirst()
              .catch(translate);
      const current = await loadScenario(tx, requirementId, scenarioId);
      if (!updated) throw changedSince(current);
      return current;
    });
  }

  /** Nouvel ordre complet ; renvoie les scénarios dans cet ordre. Rien ne change dans leur état. */
  reorder(userId: string, initiativeId: string, requirementId: string, input: ReorderScenariosInput): Promise<ScenarioDto[]> {
    return this.database.asUser(userId, async (tx) => {
      await loadRequirement(tx, initiativeId, requirementId);
      // Même verrou que la création (migration 0032) : un ajout simultané attend.
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`gherkin_scenarios:${requirementId}`}, 0))`.execute(tx);
      const current = await selectScenarios(tx, requirementId);
      const refusal = checkScenarioOrder(
        current.map((s) => s.id),
        input.scenarioIds,
      );
      if (refusal) throw scenarioRefusal(refusal);
      for (const [position, id] of input.scenarioIds.entries()) {
        await tx.updateTable('gherkin_scenario').set({ position }).where('id', '=', id).execute();
      }
      return selectScenarios(tx, requirementId);
    });
  }

  /** Suppression définitive, sans condition (D10) ; la référence n'est pas réattribuée. */
  remove(userId: string, initiativeId: string, requirementId: string, scenarioId: string): Promise<void> {
    return this.database.asUser(userId, async (tx) => {
      await loadRequirement(tx, initiativeId, requirementId);
      const deleted = await tx
        .deleteFrom('gherkin_scenario')
        .where('id', '=', scenarioId)
        .where('requirement_id', '=', requirementId)
        .executeTakeFirst();
      if (deleted.numDeletedRows === 0n) throw new NotFoundException();
    });
  }

  /** Langue et Contexte ; langue nulle et pas de Contexte tant qu'aucun n'a été créé (D5). */
  feature(userId: string, initiativeId: string, requirementId: string): Promise<FeatureDto> {
    return this.database.asUser(userId, async (tx) => {
      await loadRequirement(tx, initiativeId, requirementId);
      return loadFeature(tx, requirementId);
    });
  }

  /** D5 : change la langue sans traduire aucun texte ; seulement une fois fixée. */
  setLanguage(userId: string, initiativeId: string, requirementId: string, input: SetFeatureLanguageInput): Promise<FeatureDto> {
    return this.database.asUser(userId, async (tx) => {
      const requirement = await loadRequirement(tx, initiativeId, requirementId);
      if (!acceptsScenarios(requirement)) throw scenarioRefusal('notFunctionalRequirement');
      const updated = await tx
        .updateTable('gherkin_feature')
        .set({ language: input.language })
        .where('requirement_id', '=', requirementId)
        .executeTakeFirst();
      if (updated.numUpdatedRows === 0n) throw scenarioRefusal('featureLanguageNotSet');
      return loadFeature(tx, requirementId);
    });
  }

  /**
   * Crée (`baseRowVersion` nul) ou modifie le Contexte (D12). Modification
   * simultanée (D14) : l'écriture ne passe que si le Contexte est encore dans
   * l'état sur lequel la saisie est basée, absence comprise.
   */
  saveBackground(userId: string, initiativeId: string, requirementId: string, input: SaveBackgroundInput): Promise<FeatureDto> {
    return this.database.asUser(userId, async (tx) => {
      const requirement = await loadRequirement(tx, initiativeId, requirementId);
      if (!acceptsScenarios(requirement)) throw scenarioRefusal('notFunctionalRequirement');
      const { baseRowVersion, text } = input;
      let saved: { requirement_id: string } | undefined;
      if (baseRowVersion === null) {
        await ensureFeature(tx, initiativeId, requirementId, userId, input.language);
        saved = await tx
          .insertInto('gherkin_background')
          .values({ requirement_id: requirementId, initiative_id: initiativeId, text })
          .onConflict((oc) => oc.column('requirement_id').doNothing())
          .returning('requirement_id')
          .executeTakeFirst()
          .catch(translate);
      } else {
        saved = await tx
          .updateTable('gherkin_background')
          .set({ text })
          .where('requirement_id', '=', requirementId)
          .where('row_version', '=', baseRowVersion)
          .returning('requirement_id')
          .executeTakeFirst()
          .catch(translate);
      }
      const feature = await loadFeature(tx, requirementId);
      if (!saved) throw backgroundChangedSince(feature.background);
      return feature;
    });
  }

  /** Suppression définitive du Contexte ; la langue reste fixée. */
  removeBackground(userId: string, initiativeId: string, requirementId: string): Promise<void> {
    return this.database.asUser(userId, async (tx) => {
      await loadRequirement(tx, initiativeId, requirementId);
      const deleted = await tx.deleteFrom('gherkin_background').where('requirement_id', '=', requirementId).executeTakeFirst();
      if (deleted.numDeletedRows === 0n) throw new NotFoundException();
    });
  }
}

/** Ce que porte la Fonctionnalité d'une exigence : son type est figé s'il y a un scénario ou un Contexte (D2). */
export async function loadFeatureContent(tx: Tx, requirementId: string): Promise<FeatureContent> {
  const row = await tx
    .selectFrom('gherkin_scenario')
    .select((eb) => eb.fn.countAll<string>().as('count'))
    .where('requirement_id', '=', requirementId)
    .executeTakeFirstOrThrow();
  const background = await tx
    .selectFrom('gherkin_background')
    .select('requirement_id')
    .where('requirement_id', '=', requirementId)
    .executeTakeFirst();
  return { scenarioCount: Number(row.count), hasBackground: background !== undefined };
}

/**
 * Fixe la langue de la Fonctionnalité à la création de son premier scénario ou de
 * son Contexte (D5) ; sans effet si elle l'est déjà.
 */
async function ensureFeature(tx: Tx, initiativeId: string, requirementId: string, userId: string, requested?: Locale) {
  const existing = await tx.selectFrom('gherkin_feature').select('language').where('requirement_id', '=', requirementId).executeTakeFirst();
  if (existing) return;
  const author = await tx.selectFrom('app_user').select('locale').where('id', '=', userId).executeTakeFirst();
  await tx
    .insertInto('gherkin_feature')
    .values({ requirement_id: requirementId, initiative_id: initiativeId, language: newFeatureLanguage(requested, author?.locale ?? null) })
    .onConflict((oc) => oc.column('requirement_id').doNothing())
    .execute()
    .catch(translate);
}

async function loadFeature(tx: Tx, requirementId: string): Promise<FeatureDto> {
  const feature = await tx.selectFrom('gherkin_feature').select('language').where('requirement_id', '=', requirementId).executeTakeFirst();
  const background = await tx
    .selectFrom('gherkin_background')
    .select(['text', 'row_version', 'created_at', 'updated_at'])
    .where('requirement_id', '=', requirementId)
    .executeTakeFirst();
  return {
    language: feature?.language ?? null,
    background: background
      ? {
          text: background.text,
          rowVersion: background.row_version,
          createdAt: background.created_at.toISOString(),
          updatedAt: background.updated_at.toISOString(),
        }
      : null,
  };
}

async function loadRequirement(tx: Tx, initiativeId: string, requirementId: string) {
  const requirement = await tx
    .selectFrom('requirement')
    .select(['type', 'subtype'])
    .where('id', '=', requirementId)
    .where('initiative_id', '=', initiativeId)
    .executeTakeFirst();
  if (!requirement) throw new NotFoundException();
  return requirement;
}

const scenarioColumns = [
  'id',
  'initiative_id',
  'requirement_id',
  'reference',
  'title',
  'text',
  'row_version',
  'created_at',
  'updated_at',
] as const;

async function selectScenarios(tx: Tx, requirementId: string): Promise<ScenarioDto[]> {
  const rows = await tx
    .selectFrom('gherkin_scenario')
    .select(scenarioColumns)
    .where('requirement_id', '=', requirementId)
    .orderBy('position')
    .orderBy('created_at')
    .execute();
  return rows.map(toDto);
}

async function loadScenario(tx: Tx, requirementId: string, scenarioId: string): Promise<ScenarioDto> {
  const row = await tx
    .selectFrom('gherkin_scenario')
    .select(scenarioColumns)
    .where('id', '=', scenarioId)
    .where('requirement_id', '=', requirementId)
    .executeTakeFirst();
  if (!row) throw new NotFoundException();
  return toDto(row);
}

interface ScenarioRow {
  id: string;
  initiative_id: string;
  requirement_id: string;
  reference: string;
  title: string;
  text: string;
  row_version: number;
  created_at: Date;
  updated_at: Date;
}

function toDto(r: ScenarioRow): ScenarioDto {
  return {
    id: r.id,
    initiativeId: r.initiative_id,
    requirementId: r.requirement_id,
    reference: r.reference,
    title: r.title,
    text: r.text,
    rowVersion: r.row_version,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

/** Écriture refusée par la base (seconde barrière) : motif lisible par le client. */
function translate(error: unknown): never {
  if (isConstraintViolation(error, 'gherkin_scenario_functional_requirement')) throw scenarioRefusal('notFunctionalRequirement');
  throw error;
}

const backgroundChangedSince = (background: BackgroundDto | null) =>
  new ConflictException({ statusCode: 409, refusal: 'backgroundChangedSince', background } satisfies BackgroundChangedSinceBody);

const changedSince = (scenario: ScenarioDto) =>
  new ConflictException({ statusCode: 409, refusal: 'scenarioChangedSince', scenario } satisfies ScenarioChangedSinceBody);

export function scenarioRefusal(refusal: ScenarioRefusal) {
  return refusal === 'notFunctionalRequirement'
    ? new BadRequestException({ statusCode: 400, refusal })
    : new ConflictException({ statusCode: 409, refusal });
}
