import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { DatabaseService } from '../db/database.service.js';

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
}
