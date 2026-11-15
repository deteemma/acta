import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  acceptsScenarios,
  checkScenarioOrder,
  type CreateScenarioInput,
  type ReorderScenariosInput,
  type ScenarioChangedSinceBody,
  type ScenarioDto,
  type ScenarioRefusal,
  type UpdateScenarioInput,
} from '@app/shared';
import { sql } from 'kysely';
import { DatabaseService, type Tx } from '../db/database.service.js';
import { isConstraintViolation } from '../db/pg-errors.js';

/**
 * Scénarios Gherkin d'une exigence (phase 3, ticket 01) : tout membre consulte ;
 * propriétaires et contributeurs créent, modifient, ordonnent et suppriment (D17).
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
}

/** Nombre de scénarios d'une exigence : son type est figé s'il y en a (D2). */
export async function countScenarios(tx: Tx, requirementId: string): Promise<number> {
  const row = await tx
    .selectFrom('gherkin_scenario')
    .select((eb) => eb.fn.countAll<string>().as('count'))
    .where('requirement_id', '=', requirementId)
    .executeTakeFirstOrThrow();
  return Number(row.count);
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

const changedSince = (scenario: ScenarioDto) =>
  new ConflictException({ statusCode: 409, refusal: 'scenarioChangedSince', scenario } satisfies ScenarioChangedSinceBody);

export function scenarioRefusal(refusal: ScenarioRefusal) {
  return refusal === 'notFunctionalRequirement'
    ? new BadRequestException({ statusCode: 400, refusal })
    : new ConflictException({ statusCode: 409, refusal });
}
