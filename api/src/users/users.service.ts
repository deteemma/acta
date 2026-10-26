import { Injectable, NotFoundException } from '@nestjs/common';
import type { MeDto, UpdateMeInput } from '@app/shared';
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

  me(userId: string): Promise<MeDto> {
    return this.database.asUser(userId, (tx) => this.selectMe(tx, userId));
  }

  updateMe(userId: string, input: UpdateMeInput): Promise<MeDto> {
    return this.database.asUser(userId, async (tx) => {
      await tx
        .updateTable('app_user')
        .set({ locale: input.locale, updated_at: sql`now()` })
        .where('id', '=', userId)
        .execute();
      return this.selectMe(tx, userId);
    });
  }

  private async selectMe(tx: Tx, userId: string): Promise<MeDto> {
    const row = await tx
      .selectFrom('app_user')
      .select(['id', 'email', 'display_name', 'locale'])
      .where('id', '=', userId)
      .executeTakeFirst();
    if (!row) throw new NotFoundException();
    return { id: row.id, email: row.email, displayName: row.display_name, locale: row.locale };
  }
}
