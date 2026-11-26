import { Injectable } from '@nestjs/common';
import {
  type AssistantContext,
  assistantContextText,
  babokSectionLabel,
  type BabokDto,
  type BabokElementDto,
  can,
  type InitiativeRole,
  isClosedTicketStatus,
  type Locale,
  memberName,
  type RequirementStatus,
  requirementStatusLabel,
  requirementStatusSince,
  type StakeholderRole,
  suggestedActionText,
  ticketStatusLabel,
  ticketTypeLabel,
} from '@app/shared';
import { sql } from 'kysely';
import { BabokService } from '../babok/babok.service.js';
import { DatabaseService, type Tx } from '../db/database.service.js';
import { loadRequirementStatuses } from '../requirement-statuses/requirement-statuses.service.js';
import { SuggestedActionsService } from '../suggested-actions/suggested-actions.service.js';
import { loadTicketTypes } from '../ticket-types/ticket-types.service.js';

/** Droits de l'auteur au moment de la lecture (AS8, AS17). */
export type AuthorAccess = 'ok' | 'accessLost' | 'accountDeactivated';

export type ReadResult = { access: 'ok'; text: string } | { access: Exclude<AuthorAccess, 'ok'> };

const name = (row: { user_id: string; email: string | null; display_name: string | null }) =>
  memberName({ userId: row.user_id, email: row.email, displayName: row.display_name });

/**
 * Données lues par l'assistant (AS14 à AS18, ADR-0022 point 1), avec l'identité
 * de l'auteur et par les deux barrières de l'ADR-0006 : la règle de roles.ts
 * (askAssistant), puis la RLS de chaque requête, dans une seule transaction.
 * Le texte est assemblé par @app/shared (assistantContextText).
 */
@Injectable()
export class AssistantContextService {
  constructor(
    private readonly database: DatabaseService,
    private readonly babok: BabokService,
    private readonly suggestedActions: SuggestedActionsService,
  ) {}

  /** Données de « Faire le point » : la partie commune et le référentiel BABOK (AS14). */
  readStatusReview(authorId: string, initiativeId: string, locale: Locale): Promise<ReadResult> {
    return this.database.asUser(authorId, async (tx) => {
      const access = await authorAccess(tx, initiativeId);
      if (access !== 'ok') return { access };
      const data = await this.read(tx, initiativeId, locale);
      return { access, text: assistantContextText(locale, data) };
    });
  }

  private async read(tx: Tx, initiativeId: string, locale: Locale): Promise<AssistantContext> {
    const now = new Date();
    const babok: BabokDto = await this.babok.load(tx);
    const ticketTypes = await loadTicketTypes(tx);
    const requirementStatuses = await loadRequirementStatuses(tx);

    const initiative = await tx
      .selectFrom('initiative')
      .select([
        'code',
        'name',
        'archived_at',
        'analysis_approach',
        'agile_extension_enabled',
        sql<string | null>`start_date::text`.as('start_date'),
        sql<string | null>`planned_end_date::text`.as('planned_end_date'),
      ])
      .where('id', '=', initiativeId)
      .executeTakeFirstOrThrow();
    const members = await tx
      .selectFrom('initiative_member as m')
      .innerJoin('app_user as u', 'u.id', 'm.user_id')
      .select(['m.user_id', 'm.role', 'u.email', 'u.display_name'])
      .where('m.initiative_id', '=', initiativeId)
      .orderBy('m.created_at')
      .execute();

    const stakeholders = await tx
      .selectFrom('stakeholder')
      .select(['id', 'name', sql<StakeholderRole[]>`roles::text[]`.as('roles'), 'influence', 'interest'])
      .where('initiative_id', '=', initiativeId)
      .orderBy('name')
      .execute();
    const stakeholderName = new Map(stakeholders.map((s) => [s.id, s.name]));
    const names = (ids: string[]) => ids.map((id) => stakeholderName.get(id) ?? '').filter(Boolean).sort((a, b) => a.localeCompare(b));

    const needs = await tx
      .selectFrom('need')
      .select(['id', 'reference', 'title', 'nature', 'description'])
      .where('initiative_id', '=', initiativeId)
      .orderBy('reference')
      .execute();
    const needReference = new Map(needs.map((n) => [n.id, n.reference]));
    const needSources = await tx
      .selectFrom('need_stakeholder')
      .select(['need_id', 'stakeholder_id'])
      .where('initiative_id', '=', initiativeId)
      .execute();

    const requirements = await tx
      .selectFrom('requirement')
      .select(['id', 'reference', 'title', 'statement', 'type', 'subtype', 'status', 'parent_id'])
      .where('initiative_id', '=', initiativeId)
      .orderBy('reference')
      .execute();
    const requirementReference = new Map(requirements.map((r) => [r.id, r.reference]));
    const requirementNeeds = await tx
      .selectFrom('requirement_need')
      .select(['requirement_id', 'need_id'])
      .where('initiative_id', '=', initiativeId)
      .execute();
    const requirementSources = await tx
      .selectFrom('requirement_stakeholder')
      .select(['requirement_id', 'stakeholder_id'])
      .where('initiative_id', '=', initiativeId)
      .execute();
    // Seul l'historique des statuts sert : la date du dernier changement (AS16), jamais les versions (AS15).
    const versions = await tx
      .selectFrom('requirement_version')
      .select(['requirement_id', 'changed_at', sql<RequirementStatus>`snapshot ->> 'status'`.as('status')])
      .where('initiative_id', '=', initiativeId)
      .orderBy('id')
      .execute();

    const tickets = await tx
      .selectFrom('ticket as t')
      .leftJoin('app_user as u', 'u.id', 't.assignee_id')
      .leftJoin('ticket as e', 'e.id', 't.epic_id')
      .select([
        't.id',
        't.type',
        't.reference',
        't.title',
        't.status',
        't.description',
        't.task_id',
        't.technique_id',
        't.agile_technique_id',
        't.assignee_id',
        'u.email',
        'u.display_name',
        'e.reference as epic_reference',
        sql<string | null>`t.due_date::text`.as('due_date'),
      ])
      .where('t.initiative_id', '=', initiativeId)
      .orderBy('t.reference')
      .execute();

    const pages = await tx
      .selectFrom('page')
      .select(['id', 'reference', 'title', 'parent_id'])
      .where('initiative_id', '=', initiativeId)
      .orderBy('reference')
      .execute();
    const pageReference = new Map(pages.map((p) => [p.id, p.reference]));

    const suggested = initiative.archived_at ? [] : await this.suggestedActions.listIn(tx, initiativeId);

    /** Élément du référentiel, avec son numéro (« 3.1 Planifier… », « EA 5.1 … »). */
    const element = (list: readonly BabokElementDto[], id: string | null) => {
      const found = id ? list.find((e) => e.id === id) : undefined;
      return found ? `${babokSectionLabel(found, locale)} ${found.name[locale]}` : null;
    };
    const coveredTasks = new Set(tickets.filter((t) => t.type === 'action' && t.task_id).map((t) => t.task_id));

    return {
      now: now.toISOString(),
      // Date du jour dans le fuseau du serveur, comme les actions suggérées.
      today: now.toLocaleDateString('sv-SE'),
      initiative: {
        code: initiative.code,
        name: initiative.name,
        archived: initiative.archived_at != null,
        analysisApproach: initiative.analysis_approach,
        startDate: initiative.start_date,
        plannedEndDate: initiative.planned_end_date,
        agileExtensionEnabled: initiative.agile_extension_enabled,
        members: members.map((m) => ({ name: name(m), role: m.role as InitiativeRole })),
      },
      stakeholders: stakeholders.map((s) => ({ name: s.name, roles: s.roles, influence: s.influence, interest: s.interest })),
      needs: needs.map((n) => ({
        reference: n.reference,
        title: n.title,
        nature: n.nature,
        description: n.description,
        sources: names(needSources.filter((l) => l.need_id === n.id).map((l) => l.stakeholder_id)),
      })),
      requirements: requirements.map((r) => ({
        reference: r.reference,
        title: r.title,
        type: r.type,
        subtype: r.subtype,
        status: requirementStatusLabel(requirementStatuses, r.status, locale),
        // L'état actuel complète l'historique, comme pour les actions suggérées.
        statusSince: requirementStatusSince([
          ...versions
            .filter((v) => v.requirement_id === r.id)
            .map((v) => ({ changedAt: v.changed_at.toISOString(), status: v.status })),
          { changedAt: now.toISOString(), status: r.status },
        ]),
        statement: r.statement,
        parent: r.parent_id ? (requirementReference.get(r.parent_id) ?? null) : null,
        needs: requirementNeeds
          .filter((l) => l.requirement_id === r.id)
          .map((l) => needReference.get(l.need_id) ?? '')
          .filter(Boolean)
          .sort(),
        sources: names(requirementSources.filter((l) => l.requirement_id === r.id).map((l) => l.stakeholder_id)),
      })),
      tickets: tickets.map((t) => {
        const closed = isClosedTicketStatus(ticketTypes, t.type, t.status);
        return {
          reference: t.reference,
          type: ticketTypeLabel(ticketTypes, t.type, locale),
          title: t.title,
          status: ticketStatusLabel(ticketTypes, t.type, t.status, locale),
          closed,
          dueDate: t.due_date,
          assignee: t.assignee_id ? name({ user_id: t.assignee_id, email: t.email, display_name: t.display_name }) : null,
          epic: t.epic_reference,
          task: element(babok.tasks, t.task_id),
          technique: element(babok.techniques, t.technique_id) ?? element(babok.agile.techniques, t.agile_technique_id),
          // Jamais la description d'un ticket fermé (AS15).
          description: closed ? null : t.description,
        };
      }),
      suggestedActions: suggested.map((s) => suggestedActionText(babok, locale, s)),
      pages: pages.map((p) => ({
        reference: p.reference,
        title: p.title,
        parent: p.parent_id ? (pageReference.get(p.parent_id) ?? null) : null,
      })),
      // Référentiel BABOK, que reçoit « Faire le point » (AS14).
      babok: {
        tasks: babok.tasks.map((task) => ({ label: element(babok.tasks, task.id)!, covered: coveredTasks.has(task.id) })),
        agileHorizons: initiative.agile_extension_enabled
          ? babok.agile.horizons.map((h) => element(babok.agile.horizons, h.id)!)
          : null,
      },
    };
  }
}

/**
 * Droits de l'auteur, lus sous sa propre identité : membre de l'initiative avec
 * la permission askAssistant (archivée comprise), compte actif (AS8, AS40).
 */
export async function authorAccess(tx: Tx, initiativeId: string): Promise<AuthorAccess> {
  const { rows } = await sql<{ role: InitiativeRole | null; archived: boolean; active: boolean }>`
    SELECT current_initiative_role(${initiativeId}::uuid) AS role,
           initiative_is_archived(${initiativeId}::uuid) AS archived,
           current_user_is_active() AS active`.execute(tx);
  const row = rows[0];
  if (!row?.active) return 'accountDeactivated';
  return can(row.role, 'askAssistant', { archived: row.archived }) ? 'ok' : 'accessLost';
}
