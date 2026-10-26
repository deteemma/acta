// Mode hors ligne (ADR-0004) : réplique partielle locale via PowerSync. Les
// lectures se font dans SQLite ; les écritures sont mises en file et remontent
// par l'API NestJS, qui valide les règles métier.
import {
  type AbstractPowerSyncDatabase,
  column,
  PowerSyncDatabase,
  type PowerSyncBackendConnector,
  Schema,
  Table,
  UpdateType,
} from '@powersync/react-native';
import { type Api, ApiError } from './api';

export const AppSchema = new Schema({
  initiative: new Table({ code: column.text, name: column.text, created_by: column.text, created_at: column.text }),
  initiative_member: new Table({
    initiative_id: column.text,
    user_id: column.text,
    role: column.text,
    is_team_ba: column.integer,
  }),
});

export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'application.sqlite' },
});

/** Écritures refusées par le serveur, à signaler à l'utilisateur. */
export type RejectionListener = (message: string) => void;

export class Connector implements PowerSyncBackendConnector {
  constructor(
    private readonly endpoint: string,
    private readonly getToken: () => string,
    private readonly api: Api,
    private readonly onRejected: RejectionListener,
  ) {}

  async fetchCredentials() {
    return { endpoint: this.endpoint, token: this.getToken() };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;
    for (const op of transaction.crud) {
      try {
        await this.apply(op.table, op.op, op.id, op.opData ?? {});
      } catch (error) {
        // Refus métier (4xx) : l'écriture est abandonnée et signalée ; la
        // synchronisation rétablit ensuite la version du serveur.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          this.onRejected(`Modification refusée par le serveur (${error.status}).`);
          continue;
        }
        throw error; // Erreur réseau : nouvelle tentative plus tard.
      }
    }
    await transaction.complete();
  }

  private async apply(table: string, op: UpdateType, id: string, data: Record<string, unknown>) {
    if (table !== 'initiative') {
      throw new ApiError(400, `Écriture non prise en charge sur ${table}`);
    }
    if (op === UpdateType.PUT) await this.api.createInitiative({ id, code: String(data.code), name: String(data.name) });
    if (op === UpdateType.PATCH) await this.api.updateInitiative(id, { name: String(data.name) });
    if (op === UpdateType.DELETE) await this.api.deleteInitiative(id);
  }
}
