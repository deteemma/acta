import { Injectable, NotFoundException } from '@nestjs/common';
import { APP_ADMIN_ROLE, type MarkAlertsSeenInput, type MeDto, type UpdateMeInput } from '@app/shared';
import { sql } from 'kysely';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { DatabaseService, type Tx } from '../db/database.service.js';

const REFRESH_MS = 5 * 60 * 1000;

/** Recopie dans app_user les utilisateurs qui se connectent (nom, e-mail). */
@Injectable()
export class UsersService {
  private readonly lastSeen = new Map<string, number>();

  constructor(private readonly database: DatabaseService) {}

  async remember(user: AuthenticatedUser): Promise<void> {
    const seen = this.lastSeen.get(user.id);
    if (seen && Date.now() - seen < REFRESH_MS) return;

    await this.database.asUser(user.id, (tx) =>
      tx
        .insertInto('app_user')
        .values({ id: user.id, email: user.email, display_name: user.displayName })
        .onConflict((oc) =>
          oc.column('id').doUpdateSet({
            email: user.email,
            display_name: user.displayName,
            updated_at: sql`now()`,
          }),
        )
        .execute(),
    );
    this.lastSeen.set(user.id, Date.now());
  }

  me(user: AuthenticatedUser): Promise<MeDto> {
    return this.database.asUser(user.id, (tx) => this.selectMe(tx, user));
  }

  updateMe(user: AuthenticatedUser, input: UpdateMeInput): Promise<MeDto> {
    return this.database.asUser(user.id, async (tx) => {
      await tx
        .updateTable('app_user')
        .set({ locale: input.locale, updated_at: sql`now()` })
        .where('id', '=', user.id)
        .execute();
      return this.selectMe(tx, user);
    });
  }

  /** Ouverture du panneau des alertes : elles ne sont plus nouvelles (ticket 15). */
  markAlertsSeen(user: AuthenticatedUser, input: MarkAlertsSeenInput): Promise<MeDto> {
    return this.database.asUser(user.id, async (tx) => {
      await tx
        .updateTable('app_user')
        .set({ alerts_seen_at: sql`now()`, alerts_seen_keys: input.alertKeys })
        .where('id', '=', user.id)
        .execute();
      return this.selectMe(tx, user);
    });
  }

  private async selectMe(tx: Tx, user: AuthenticatedUser): Promise<MeDto> {
    const row = await tx
      .selectFrom('app_user')
      .select(['id', 'email', 'display_name', 'locale', 'alerts_seen_at', 'alerts_seen_keys'])
      .where('id', '=', user.id)
      .executeTakeFirst();
    if (!row) throw new NotFoundException();
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      locale: row.locale,
      isAdmin: user.appRoles.includes(APP_ADMIN_ROLE),
      alertsSeenAt: row.alerts_seen_at.toISOString(),
      alertsSeenKeys: row.alerts_seen_keys,
    };
  }
}
