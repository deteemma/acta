import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type AdminTicketTypeDto,
  checkTicketStatusCreation,
  checkTicketStatusDeletion,
  checkTicketStatusUpdate,
  checkTicketTypeCreation,
  checkTicketTypeDeletion,
  checkTicketTypeUpdate,
  type CreateTicketStatusInput,
  type CreateTicketTypeInput,
  deliveredTicketTypes,
  sortTicketTypes,
  type TicketTypeDto,
  type TicketTypeRefusal,
  type UpdateTicketStatusInput,
  type UpdateTicketTypeInput,
} from '@app/shared';
import { sql } from 'kysely';
import { DatabaseService, type Tx } from '../db/database.service.js';
import { isConstraintViolation } from '../db/pg-errors.js';

/**
 * Types de ticket et statuts (ticket 29) : règles de @app/shared (première
 * barrière), fonctions admin_* de la base (seconde barrière, migration 0029).
 * Chaque écriture renvoie toute la liste, à jour.
 */
@Injectable()
export class TicketTypesService {
  constructor(private readonly database: DatabaseService) {}

  list(userId: string): Promise<TicketTypeDto[]> {
    return this.database.asUser(userId, (tx) => loadTicketTypes(tx));
  }

  adminList(adminId: string): Promise<AdminTicketTypeDto[]> {
    return this.database.asAdmin(adminId, (tx) => loadAdminTicketTypes(tx));
  }

  /** Type actif dès sa création ; son premier statut est l'initial. */
  add(adminId: string, input: CreateTicketTypeInput): Promise<AdminTicketTypeDto[]> {
    return this.database.asAdmin(adminId, async (tx) => {
      const refusal = checkTicketTypeCreation(await loadTicketTypes(tx), await loadUsedAcronyms(tx), input);
      if (refusal) throw ticketTypeRefusal(refusal);
      const statuses = input.statuses.map((s) => ({
        code: randomUUID(),
        labelFr: s.labels.fr,
        labelEn: s.labels.en,
        tone: s.tone,
        closed: s.closed,
      }));
      await write(() =>
        sql`SELECT admin_add_ticket_type(${randomUUID()}, ${input.labels.fr}, ${input.labels.en}, ${input.acronym}, ${JSON.stringify(statuses)}::jsonb)`.execute(
          tx,
        ),
      );
      return loadAdminTicketTypes(tx);
    });
  }

  /** Renommer, désactiver ou réactiver un type ajouté. */
  update(adminId: string, code: string, input: UpdateTicketTypeInput): Promise<AdminTicketTypeDto[]> {
    return this.database.asAdmin(adminId, async (tx) => {
      const refusal = checkTicketTypeUpdate(await loadTicketTypes(tx), code, input);
      if (refusal) throw ticketTypeRefusal(refusal);
      await write(() =>
        sql`SELECT admin_update_ticket_type(${code}, ${input.labels?.fr ?? null}, ${input.labels?.en ?? null}, ${input.active ?? null})`.execute(
          tx,
        ),
      );
      return loadAdminTicketTypes(tx);
    });
  }

  /** Seul un type ajouté dont aucun ticket n'a jamais été créé se supprime. */
  remove(adminId: string, code: string): Promise<AdminTicketTypeDto[]> {
    return this.database.asAdmin(adminId, async (tx) => {
      const refusal = checkTicketTypeDeletion(await loadAdminTicketTypes(tx), code);
      if (refusal) throw ticketTypeRefusal(refusal);
      await write(() => sql`SELECT admin_delete_ticket_type(${code})`.execute(tx));
      return loadAdminTicketTypes(tx);
    });
  }

  /** Statut ajouté à tout type, livré ou ajouté, après ses statuts existants. */
  addStatus(adminId: string, type: string, input: CreateTicketStatusInput): Promise<AdminTicketTypeDto[]> {
    return this.database.asAdmin(adminId, async (tx) => {
      const refusal = checkTicketStatusCreation(await loadTicketTypes(tx), type, input);
      if (refusal) throw ticketTypeRefusal(refusal);
      await write(() =>
        sql`SELECT admin_add_ticket_status(${type}, ${randomUUID()}, ${input.labels.fr}, ${input.labels.en}, ${input.tone}, ${input.closed})`.execute(
          tx,
        ),
      );
      return loadAdminTicketTypes(tx);
    });
  }

  /** Renommer, désactiver ou réactiver un statut ajouté. */
  updateStatus(adminId: string, type: string, code: string, input: UpdateTicketStatusInput): Promise<AdminTicketTypeDto[]> {
    return this.database.asAdmin(adminId, async (tx) => {
      const refusal = checkTicketStatusUpdate(await loadTicketTypes(tx), type, code, input);
      if (refusal) throw ticketTypeRefusal(refusal);
      await write(() =>
        sql`SELECT admin_update_ticket_status(${type}, ${code}, ${input.labels?.fr ?? null}, ${input.labels?.en ?? null}, ${input.active ?? null})`.execute(
          tx,
        ),
      );
      return loadAdminTicketTypes(tx);
    });
  }

  /** Seul un statut ajouté jamais porté se supprime. */
  removeStatus(adminId: string, type: string, code: string): Promise<AdminTicketTypeDto[]> {
    return this.database.asAdmin(adminId, async (tx) => {
      const refusal = checkTicketStatusDeletion(await loadAdminTicketTypes(tx), type, code);
      if (refusal) throw ticketTypeRefusal(refusal);
      await write(() => sql`SELECT admin_delete_ticket_status(${type}, ${code})`.execute(tx));
      return loadAdminTicketTypes(tx);
    });
  }
}

/** Types dans l'ordre où ils sont proposés (sortTicketTypes), statuts dans l'ordre de leur type. */
async function loadRows(tx: Tx) {
  const [types, statuses] = await Promise.all([
    tx.selectFrom('ticket_type').selectAll().execute(),
    tx.selectFrom('ticket_status').selectAll().orderBy('position').execute(),
  ]);
  return { types: sortTicketTypes(types.map((t) => ({ ...t, createdAt: t.created_at }))), statuses };
}

/**
 * Tous les types et leurs statuts, dans l'ordre où ils sont proposés, lus dans
 * la transaction en cours. Libellés des types et statuts livrés : ceux de
 * l'interface (@app/shared).
 */
export async function loadTicketTypes(tx: Tx): Promise<TicketTypeDto[]> {
  return (await loadAdminTicketTypes(tx)).map(({ acronym: _a, used: _u, statuses, ...type }) => ({
    ...type,
    statuses: statuses.map(({ used: _used, ...status }) => status),
  }));
}

async function loadAdminTicketTypes(tx: Tx): Promise<AdminTicketTypeDto[]> {
  const [{ types, statuses }, categories] = await Promise.all([
    loadRows(tx),
    tx.selectFrom('reference_category').select(['category', 'acronym']).execute(),
  ]);
  const delivered = deliveredTicketTypes();
  return types.map((t) => {
    const known = delivered.find((d) => d.code === t.code);
    return {
      code: t.code,
      delivered: t.delivered,
      labels: known?.labels ?? { fr: t.label_fr!, en: t.label_en! },
      active: t.active,
      acronym: categories.find((c) => c.category === t.code)?.acronym ?? '',
      used: t.used,
      statuses: statuses
        .filter((s) => s.type === t.code)
        .map((s) => ({
          code: s.code,
          delivered: s.delivered,
          labels: known?.statuses.find((d) => d.code === s.code)?.labels ?? { fr: s.label_fr!, en: s.label_en! },
          tone: s.tone,
          closed: s.closed,
          active: s.active,
          used: s.used,
        })),
    };
  });
}

/** Acronymes portés par chaque catégorie de référence, réservés à elle seule. */
async function loadUsedAcronyms(tx: Tx): Promise<{ usedAcronyms: string[] }[]> {
  const rows = await tx.selectFrom('reference_acronym').select(['category', 'acronym']).execute();
  const byCategory = new Map<string, string[]>();
  for (const { category, acronym } of rows) byCategory.set(category, [...(byCategory.get(category) ?? []), acronym]);
  return [...byCategory.values()].map((usedAcronyms) => ({ usedAcronyms }));
}

/** Contraintes de la base (seconde barrière) et refus correspondants. */
const DB_REFUSALS: [string, TicketTypeRefusal][] = [
  ['ticket_type_label_fr_key', 'labelTaken'],
  ['ticket_type_label_en_key', 'labelTaken'],
  ['ticket_status_label_fr_key', 'statusLabelTaken'],
  ['ticket_status_label_en_key', 'statusLabelTaken'],
  ['reference_acronym_taken', 'acronymTaken'],
  ['reference_acronym_pkey', 'acronymTaken'],
  ['ticket_type_delivered_locked', 'deliveredTypeLocked'],
  ['ticket_status_delivered_locked', 'deliveredStatusLocked'],
  ['ticket_type_used', 'typeUsed'],
  ['ticket_status_used', 'statusUsed'],
  ['ticket_status_initial', 'initialStatus'],
  ['ticket_status_last_closed', 'noClosedStatus'],
];

/** Écriture refusée par la base (seconde barrière) : motif lisible par le client. */
async function write(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    const found = DB_REFUSALS.find(([constraint]) => isConstraintViolation(error, constraint));
    if (found) throw ticketTypeRefusal(found[1]);
    throw error;
  }
}

export function ticketTypeRefusal(refusal: TicketTypeRefusal) {
  return refusal === 'unknownType' || refusal === 'unknownStatus'
    ? new NotFoundException({ statusCode: 404, refusal })
    : new ConflictException({ statusCode: 409, refusal });
}
