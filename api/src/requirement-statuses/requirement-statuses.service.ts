import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type AdminRequirementStatusDto,
  babokRequirementStatuses,
  checkStatusDeletion,
  checkStatusLabels,
  checkStatusUpdate,
  type CreateRequirementStatusInput,
  type RequirementStatusDto,
  type RequirementStatusRefusal,
  sortRequirementStatuses,
  type UpdateRequirementStatusInput,
} from '@app/shared';
import { sql } from 'kysely';
import { DatabaseService, type Tx } from '../db/database.service.js';
import { isConstraintViolation } from '../db/pg-errors.js';

/**
 * Statuts d'exigence (ticket 11) : règles de @app/shared (première barrière),
 * fonctions admin_* de la base (seconde barrière, migration 0017).
 */
@Injectable()
export class RequirementStatusesService {
  constructor(private readonly database: DatabaseService) {}

  list(userId: string): Promise<RequirementStatusDto[]> {
    return this.database.asUser(userId, (tx) => loadRequirementStatuses(tx));
  }

  adminList(adminId: string): Promise<AdminRequirementStatusDto[]> {
    return this.database.asAdmin(adminId, (tx) => loadAdminStatuses(tx));
  }

  add(adminId: string, input: CreateRequirementStatusInput): Promise<AdminRequirementStatusDto[]> {
    return this.database.asAdmin(adminId, async (tx) => {
      const refusal = checkStatusLabels(await loadRequirementStatuses(tx), null, input.labels);
      if (refusal) throw requirementStatusRefusal(refusal);
      await write(() =>
        sql`SELECT admin_add_requirement_status(${randomUUID()}, ${input.labels.fr}, ${input.labels.en})`.execute(tx),
      );
      return loadAdminStatuses(tx);
    });
  }

  /** Renommer, désactiver ou réactiver un statut ajouté. */
  update(adminId: string, code: string, input: UpdateRequirementStatusInput): Promise<AdminRequirementStatusDto[]> {
    return this.database.asAdmin(adminId, async (tx) => {
      const refusal = checkStatusUpdate(await loadRequirementStatuses(tx), code, input);
      if (refusal) throw requirementStatusRefusal(refusal);
      await write(() =>
        sql`SELECT admin_update_requirement_status(${code}, ${input.labels?.fr ?? null}, ${input.labels?.en ?? null}, ${input.active ?? null})`.execute(
          tx,
        ),
      );
      return loadAdminStatuses(tx);
    });
  }

  /** Seul un statut ajouté jamais utilisé se supprime. */
  remove(adminId: string, code: string): Promise<AdminRequirementStatusDto[]> {
    return this.database.asAdmin(adminId, async (tx) => {
      const refusal = checkStatusDeletion(await loadAdminStatuses(tx), code);
      if (refusal) throw requirementStatusRefusal(refusal);
      await write(() => sql`SELECT admin_delete_requirement_status(${code})`.execute(tx));
      return loadAdminStatuses(tx);
    });
  }
}

/** Tous les statuts, dans l'ordre où ils sont proposés, lus dans la transaction en cours. */
export async function loadRequirementStatuses(tx: Tx): Promise<RequirementStatusDto[]> {
  const rows = await tx.selectFrom('requirement_status').selectAll().execute();
  const babok = babokRequirementStatuses();
  return sortRequirementStatuses(
    rows.map((r) =>
      r.babok
        ? babok.find((s) => s.code === r.code)!
        : {
            code: r.code,
            babok: false,
            labels: { fr: r.label_fr!, en: r.label_en! },
            active: r.active,
            createdAt: r.created_at!.toISOString(),
          },
    ),
  );
}

async function loadAdminStatuses(tx: Tx): Promise<AdminRequirementStatusDto[]> {
  const [statuses, used] = await Promise.all([
    loadRequirementStatuses(tx),
    sql<{ code: string }>`SELECT admin_used_requirement_statuses() AS code`.execute(tx),
  ]);
  const usedCodes = new Set(used.rows.map((r) => r.code));
  return statuses.map((s) => ({ ...s, used: usedCodes.has(s.code) }));
}

/** Écriture refusée par la base (seconde barrière) : motif lisible par le client. */
async function write(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (
      isConstraintViolation(error, 'requirement_status_label_fr_key') ||
      isConstraintViolation(error, 'requirement_status_label_en_key')
    ) {
      throw requirementStatusRefusal('labelTaken');
    }
    if (isConstraintViolation(error, 'requirement_status_babok_locked')) throw requirementStatusRefusal('babokStatusLocked');
    if (isConstraintViolation(error, 'requirement_status_used')) throw requirementStatusRefusal('statusUsed');
    throw error;
  }
}

export function requirementStatusRefusal(refusal: RequirementStatusRefusal) {
  switch (refusal) {
    case 'unknownStatus':
      return new NotFoundException({ statusCode: 404, refusal });
    case 'inactiveStatus':
      return new BadRequestException({ statusCode: 400, refusal });
    default:
      return new ConflictException({ statusCode: 409, refusal });
  }
}
