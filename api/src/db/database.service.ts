import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Kysely, PostgresDialect, sql, type Transaction } from 'kysely';
import pg from 'pg';
import { AppConfig } from '../config/app-config.js';
import type { Database } from './schema.js';

export type Tx = Transaction<Database>;

/**
 * Accès à la base avec le compte applicatif, soumis à la RLS (ADR-0003).
 * Toute requête métier passe par `asUser` : l'utilisateur courant est transmis
 * à PostgreSQL pour la durée de la transaction, et les politiques RLS filtrent.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly db: Kysely<Database>;

  constructor(config: AppConfig) {
    this.db = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new pg.Pool({ connectionString: config.databaseUrl, max: 10 }),
      }),
    });
  }

  asUser<T>(userId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction().execute(async (tx) => {
      await sql`SELECT set_config('app.user_id', ${userId}, true)`.execute(tx);
      return work(tx);
    });
  }

  async ping(): Promise<void> {
    await sql`SELECT 1`.execute(this.db);
  }

  async onModuleDestroy(): Promise<void> {
    await this.db.destroy();
  }
}
