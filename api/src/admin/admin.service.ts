import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  checkAccountChange,
  checkAdminOwnerDesignation,
  type AccountDto,
  type AdminRefusal,
  type CreateAccountInput,
  type InitiativeRole,
  type OrphanInitiativeDto,
  type UpdateAccountInput,
} from '@app/shared';
import { sql } from 'kysely';
import { DatabaseService, type Tx } from '../db/database.service.js';
import { isConstraintViolation } from '../db/pg-errors.js';
import { KeycloakAdmin } from './keycloak-admin.service.js';

interface OrphanMemberRow {
  initiative_id: string;
  code: string;
  name: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: InitiativeRole;
  active: boolean;
}

/**
 * Administration des comptes (ticket 05) : règles de @app/shared (première
 * barrière), fonctions admin_* de la base (seconde barrière, migration 0007).
 */
@Injectable()
export class AdminService {
  private accountChanges: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly database: DatabaseService,
    private readonly keycloak: KeycloakAdmin,
  ) {}

  listAccounts(): Promise<AccountDto[]> {
    return this.keycloak.listAccounts();
  }

  async createAccount(input: CreateAccountInput): Promise<AccountDto> {
    return this.keycloak.getAccount(await this.keycloak.createAccount(input));
  }

  /**
   * Les changements de compte passent l'un après l'autre (une seule instance de
   * l'API) : deux administrateurs ne peuvent pas se retirer le rôle en même temps.
   */
  updateAccount(adminId: string, accountId: string, input: UpdateAccountInput): Promise<AccountDto> {
    const next = this.accountChanges.then(() => this.applyAccountChange(adminId, accountId, input));
    this.accountChanges = next.catch(() => undefined);
    return next;
  }

  private async applyAccountChange(adminId: string, accountId: string, input: UpdateAccountInput): Promise<AccountDto> {
    // État actuel dans Keycloak : le jeton de l'auteur peut dater d'avant le retrait de son rôle.
    const refusal = checkAccountChange(await this.keycloak.listAccounts(), adminId, accountId, input);
    if (refusal) throw adminRefusal(refusal);
    if ('enabled' in input) {
      // Miroir en base d'abord : si Keycloak échoue, la transaction est annulée.
      await this.database.asAdmin(adminId, async (tx) => {
        await sql`SELECT admin_set_user_deactivated(${accountId}, ${!input.enabled})`.execute(tx);
        await this.keycloak.setEnabled(accountId, input.enabled);
      });
      // Après validation : un échec ici ne doit pas défaire la désactivation.
      if (!input.enabled) await this.keycloak.logout(accountId);
    } else {
      await this.keycloak.setAdmin(accountId, input.isAdmin);
    }
    return this.keycloak.getAccount(accountId);
  }

  listOrphanInitiatives(adminId: string): Promise<OrphanInitiativeDto[]> {
    return this.database.asAdmin(adminId, async (tx) => {
      const byId = new Map<string, OrphanInitiativeDto>();
      for (const row of await orphanMembers(tx)) {
        const initiative = byId.get(row.initiative_id) ?? { id: row.initiative_id, code: row.code, name: row.name, members: [] };
        initiative.members.push({
          userId: row.user_id,
          email: row.email,
          displayName: row.display_name,
          role: row.role,
          active: row.active,
        });
        byId.set(row.initiative_id, initiative);
      }
      return [...byId.values()];
    });
  }

  /** Désigne un propriétaire sur une initiative sans propriétaire actif ; tracé comme au ticket 04. */
  designateOwner(adminId: string, initiativeId: string, userId: string): Promise<void> {
    return this.database.asAdmin(adminId, async (tx) => {
      const members = (await orphanMembers(tx))
        .filter((r) => r.initiative_id === initiativeId)
        .map((r) => ({ userId: r.user_id, role: r.role, active: r.active }));
      // Initiative inconnue, ou qui a un propriétaire actif : l'administrateur n'en sait rien.
      if (members.length === 0) throw new NotFoundException();
      const refusal = checkAdminOwnerDesignation(members, userId);
      if (refusal) throw adminRefusal(refusal);
      try {
        await sql`SELECT admin_designate_owner(${initiativeId}::uuid, ${userId})`.execute(tx);
      } catch (error) {
        // Changement concurrent, refusé par la base.
        if (isConstraintViolation(error, 'admin_designation_has_active_owner')) throw adminRefusal('hasActiveOwner');
        if (isConstraintViolation(error, 'admin_designation_active_member')) throw adminRefusal('inactiveAccount');
        throw error;
      }
    });
  }
}

async function orphanMembers(tx: Tx): Promise<OrphanMemberRow[]> {
  const { rows } = await sql<OrphanMemberRow>`SELECT * FROM admin_orphan_initiative_members()`.execute(tx);
  return rows;
}

function adminRefusal(refusal: AdminRefusal) {
  switch (refusal) {
    case 'forbidden':
    case 'self':
      return new ForbiddenException({ statusCode: 403, refusal });
    case 'notMember':
      return new NotFoundException({ statusCode: 404, refusal });
    default:
      return new ConflictException({ statusCode: 409, refusal });
  }
}
