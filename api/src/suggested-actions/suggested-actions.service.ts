import { Injectable } from '@nestjs/common';
import {
  type BabokDto,
  currentSituations,
  requirementStatusSince,
  type RequirementStatus,
  type StakeholderRole,
  type SuggestedAction,
  suggestActions,
  type SuggestionContext,
} from '@app/shared';
import { sql } from 'kysely';
import { BabokService } from '../babok/babok.service.js';
import { DatabaseService, type Tx } from '../db/database.service.js';

/** Encart « Actions suggérées » (ticket 14) : règles dans @app/shared (suggested-actions.ts). */
@Injectable()
export class SuggestedActionsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly babok: BabokService,
  ) {}

  list(userId: string, initiativeId: string): Promise<SuggestedAction[]> {
    return this.database.asUser(userId, async (tx) => {
      const babok = await this.babok.load(tx);
      return suggestActions(babok, await loadContext(tx, initiativeId));
    });
  }

  /** Vrai si l'encart propose cette suggestion : une Action ne se crée que depuis une suggestion affichée (G6). */
  async isOffered(tx: Tx, initiativeId: string, suggestionKey: string): Promise<boolean> {
    const babok = await this.babok.load(tx);
    return suggestActions(babok, await loadContext(tx, initiativeId)).some((s) => s.key === suggestionKey);
  }

  /** Écarte la suggestion pour toute l'équipe (G7) ; l'écart est oublié si la situation n'existe pas. */
  dismiss(userId: string, initiativeId: string, suggestionKey: string): Promise<void> {
    return this.database.asUser(userId, async (tx) => {
      await tx
        .insertInto('suggestion_dismissal')
        .values({ initiative_id: initiativeId, suggestion_key: suggestionKey })
        .onConflict((oc) => oc.doNothing())
        .execute();
      await this.forgetVanishedDismissals(tx, initiativeId);
    });
  }

  /**
   * Oublie les écarts dont la situation n'existe plus : la suggestion reviendra
   * si la situation réapparaît (G7). Appelée après chaque écriture qui peut
   * changer une situation, dans la même transaction. Le temps qui passe ne fait
   * qu'en créer (R11 à R13, R15) : seule une écriture peut en faire disparaître.
   */
  async forgetVanishedDismissals(tx: Tx, initiativeId: string): Promise<void> {
    const dismissed = await tx
      .selectFrom('suggestion_dismissal')
      .select('suggestion_key')
      .where('initiative_id', '=', initiativeId)
      .execute();
    if (dismissed.length === 0) return;
    const babok: BabokDto = await this.babok.load(tx);
    const present = new Set(currentSituations(babok, await loadContext(tx, initiativeId)).map((s) => s.key));
    const vanished = dismissed.map((d) => d.suggestion_key).filter((key) => !present.has(key));
    if (vanished.length === 0) return;
    await tx
      .deleteFrom('suggestion_dismissal')
      .where('initiative_id', '=', initiativeId)
      .where('suggestion_key', 'in', vanished)
      .execute();
  }
}

/** Ce que les règles lisent de l'initiative, sous la RLS de l'utilisateur courant. */
async function loadContext(tx: Tx, initiativeId: string): Promise<SuggestionContext> {
  const now = new Date();
  const initiative = await tx
    .selectFrom('initiative')
    .select(['archived_at', 'analysis_approach', sql<string | null>`planned_end_date::text`.as('planned_end_date')])
    .where('id', '=', initiativeId)
    .executeTakeFirstOrThrow();
  const actions = await tx
    .selectFrom('action')
    .select(['id', 'task_id', 'status', 'suggestion_key'])
    .where('initiative_id', '=', initiativeId)
    .execute();
  const actionStakeholders = await tx
    .selectFrom('action_stakeholder')
    .select(['action_id', 'stakeholder_id'])
    .where('initiative_id', '=', initiativeId)
    .execute();
  const stakeholders = await tx
    .selectFrom('stakeholder as s')
    .select(['s.id', sql<StakeholderRole[]>`s.roles::text[]`.as('roles'), 's.influence', 's.interest'])
    .where('s.initiative_id', '=', initiativeId)
    .execute();
  const needs = await tx.selectFrom('need').select('id').where('initiative_id', '=', initiativeId).execute();
  const needStakeholders = await tx
    .selectFrom('need_stakeholder')
    .select(['need_id', 'stakeholder_id'])
    .where('initiative_id', '=', initiativeId)
    .execute();
  const requirements = await tx
    .selectFrom('requirement')
    .select(['id', 'status'])
    .where('initiative_id', '=', initiativeId)
    .execute();
  const requirementStakeholders = await tx
    .selectFrom('requirement_stakeholder')
    .select(['requirement_id', 'stakeholder_id'])
    .where('initiative_id', '=', initiativeId)
    .execute();
  const requirementNeeds = await tx
    .selectFrom('requirement_need')
    .select(['requirement_id', 'need_id'])
    .where('initiative_id', '=', initiativeId)
    .execute();
  const versions = await tx
    .selectFrom('requirement_version')
    .select(['requirement_id', 'changed_at', sql<RequirementStatus>`snapshot ->> 'status'`.as('status')])
    .where('initiative_id', '=', initiativeId)
    .orderBy('id')
    .execute();
  const dismissals = await tx
    .selectFrom('suggestion_dismissal')
    .select('suggestion_key')
    .where('initiative_id', '=', initiativeId)
    .execute();
  return {
    now: now.toISOString(),
    // Date du jour dans le fuseau du serveur.
    today: now.toLocaleDateString('sv-SE'),
    initiative: {
      archived: initiative.archived_at != null,
      analysisApproach: initiative.analysis_approach,
      plannedEndDate: initiative.planned_end_date,
    },
    actions: actions.map((a) => ({
      taskId: a.task_id,
      status: a.status,
      suggestionKey: a.suggestion_key,
      stakeholderIds: actionStakeholders.filter((l) => l.action_id === a.id).map((l) => l.stakeholder_id),
    })),
    stakeholders,
    needs: needs.map((n) => ({
      id: n.id,
      stakeholderIds: needStakeholders.filter((l) => l.need_id === n.id).map((l) => l.stakeholder_id),
    })),
    requirements: requirements.map((r) => ({
      id: r.id,
      status: r.status as RequirementStatus,
      // L'historique d'une modification en cours n'est écrit qu'à la fin de la
      // transaction (migration 0013) : l'état actuel la complète.
      statusSince: requirementStatusSince([
        ...versions
          .filter((v) => v.requirement_id === r.id)
          .map((v) => ({ changedAt: v.changed_at.toISOString(), status: v.status })),
        { changedAt: now.toISOString(), status: r.status as RequirementStatus },
      ]),
      stakeholderIds: requirementStakeholders.filter((l) => l.requirement_id === r.id).map((l) => l.stakeholder_id),
      needIds: requirementNeeds.filter((l) => l.requirement_id === r.id).map((l) => l.need_id),
    })),
    dismissedKeys: dismissals.map((d) => d.suggestion_key),
  };
}
