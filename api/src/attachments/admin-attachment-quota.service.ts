import { Injectable } from '@nestjs/common';
import type { AttachmentQuotaDto } from '@app/shared';
import { sql } from 'kysely';
import { DatabaseService, type Tx } from '../db/database.service.js';

/**
 * Limite de pièces jointes par initiative (ticket 31), valable pour toute
 * l'application : bornes de @app/shared (première barrière, à la validation du
 * corps), fonction admin_set_attachment_quota de la base (seconde barrière,
 * migration 0031). L'occupation des initiatives n'est jamais lue ici.
 */
@Injectable()
export class AdminAttachmentQuotaService {
  constructor(private readonly database: DatabaseService) {}

  get(adminId: string): Promise<AttachmentQuotaDto> {
    return this.database.asAdmin(adminId, (tx) => loadQuota(tx));
  }

  /** Baisser la limite ne supprime aucun fichier : seuls les ajouts sont refusés. */
  set(adminId: string, quotaMb: number): Promise<AttachmentQuotaDto> {
    return this.database.asAdmin(adminId, async (tx) => {
      await sql`SELECT admin_set_attachment_quota(${quotaMb})`.execute(tx);
      return loadQuota(tx);
    });
  }
}

async function loadQuota(tx: Tx): Promise<AttachmentQuotaDto> {
  const row = await tx.selectFrom('app_settings').select('attachment_quota_mb').executeTakeFirstOrThrow();
  return { quotaMb: row.attachment_quota_mb };
}
