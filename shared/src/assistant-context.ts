// Données lues par l'assistant (AS14 à AS18, ticket 07) et message envoyé à
// Hermes (AS26 à AS29, AS36 bis). L'API lit l'initiative avec les droits de
// l'auteur (ADR-0006, ADR-0022) et remplit AssistantContext ; le texte est
// assemblé ici, une seule fois, pour l'estimation de la taille (AS21) comme pour l'envoi.
import type { AssistantMode, OfferedAssistantUsage } from './assistant-requests.js';
import { type Locale, type MessageKey, translate } from './i18n.js';
import type { NeedNature } from './needs.js';
import type { RequirementSubtype, RequirementType } from './requirements.js';
import type { InitiativeRole } from './roles.js';
import type { AnalysisApproach } from './schemas.js';
import type { StakeholderLevel, StakeholderRole } from './stakeholders.js';

/**
 * Ce que l'API a lu de l'initiative, sous la RLS de l'auteur. Les libellés des
 * catalogues paramétrables (types et statuts de ticket, statuts d'exigence,
 * BABOK) arrivent déjà dans la langue de l'auteur ; les textes saisis, tels quels.
 * Rien de ce qu'exclut AS15 n'y figure, sauf la description des tickets fermés,
 * écartée ici.
 */
export interface AssistantContext {
  /** Instant de la lecture (ISO). */
  now: string;
  /** Date du jour, AAAA-MM-JJ. */
  today: string;
  initiative: {
    code: string;
    name: string;
    archived: boolean;
    analysisApproach: AnalysisApproach | null;
    /** AAAA-MM-JJ */
    startDate: string | null;
    /** AAAA-MM-JJ */
    plannedEndDate: string | null;
    agileExtensionEnabled: boolean;
    members: { name: string; role: InitiativeRole }[];
  };
  stakeholders: {
    name: string;
    roles: StakeholderRole[];
    influence: StakeholderLevel | null;
    interest: StakeholderLevel | null;
  }[];
  needs: { reference: string; title: string; nature: NeedNature; description: string | null; sources: string[] }[];
  requirements: {
    reference: string;
    title: string;
    type: RequirementType;
    subtype: RequirementSubtype | null;
    /** Libellé du statut. */
    status: string;
    /** Dernier passage au statut actuel (ISO). */
    statusSince: string;
    statement: string;
    /** Référence de l'exigence parente. */
    parent: string | null;
    /** Références des besoins liés. */
    needs: string[];
    /** Noms des sources. */
    sources: string[];
  }[];
  tickets: {
    reference: string;
    /** Libellés du type et du statut. */
    type: string;
    title: string;
    status: string;
    /** Statut fermé : la description n'est pas transmise (AS15). */
    closed: boolean;
    /** AAAA-MM-JJ */
    dueDate: string | null;
    assignee: string | null;
    /** Référence de l'Epic. */
    epic: string | null;
    /** Tâche et technique BABOK, avec leur numéro. */
    task: string | null;
    technique: string | null;
    description: string | null;
  }[];
  /** Actions suggérées affichées aujourd'hui, sans celles qui ont été écartées. */
  suggestedActions: { title: string; justification: string }[];
  /** Liste des pages, sans leur contenu (AS14). */
  pages: { reference: string; title: string; parent: string | null }[];
  /** Référentiel BABOK, pour Prochaines étapes, Faire le point et Préparer un atelier ; null sinon. */
  babok: {
    tasks: { label: string; covered: boolean }[];
    /** Horizons de l'Extension Agile, si le module est activé ; null sinon. */
    agileHorizons: string[] | null;
  } | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const EMPTY = '—';

/** Date AAAA-MM-JJ des données : 26.11.2026 en français, 2026-11-26 en anglais. */
export function assistantDate(locale: Locale, isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return locale === 'fr' ? `${day}.${month}.${year}` : `${year}-${month}-${day}`;
}

/** Jours entre deux dates AAAA-MM-JJ. */
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);

/** Le texte des données lues, en Markdown, faits calculés en tête (AS16). */
export function assistantContextText(locale: Locale, data: AssistantContext): string {
  const t = (key: MessageKey, params?: Record<string, string | number>) => translate(locale, key, params);
  const date = (iso: string | null) => (iso ? assistantDate(locale, iso) : EMPTY);
  const days = (n: number) => t(n === 1 ? 'assistantContext.day' : 'assistantContext.days', { n });
  const list = (items: readonly string[]) => (items.length ? items.join(', ') : EMPTY);
  const fields = (pairs: [MessageKey, string][]) => pairs.map(([key, value]) => `${t(key)}${colon(locale)}${value}`).join(' ; ');
  /** Texte saisi sur plusieurs lignes, sous l'élément de liste. */
  const block = (key: MessageKey, text: string | null) =>
    text?.trim() ? [`  ${t(key)}${colon(locale).trimEnd()}`, ...text.split(/\r?\n/).map((line) => `  ${line}`)] : [];
  const section = (title: string, lines: string[]) => [`## ${title}`, '', ...(lines.length ? lines : [`- ${EMPTY}`]), ''];

  const { initiative, today } = data;
  const lines: string[] = [];

  // Faits calculés par ACTA (AS16).
  const facts: string[] = [`- ${t('assistantContext.today', { date: date(today) })}`];
  const end = initiative.plannedEndDate;
  if (!end) facts.push(`- ${t('assistantContext.endNotSet')}`);
  else {
    const left = daysBetween(today, end);
    facts.push(
      `- ${
        left > 0 ? t('assistantContext.endIn', { date: date(end), days: days(left) })
        : left === 0 ? t('assistantContext.endToday', { date: date(end) })
        : t('assistantContext.endPassed', { date: date(end), days: days(-left) })
      }`,
    );
  }
  const overdue = data.tickets.filter((ticket) => !ticket.closed && ticket.dueDate != null && ticket.dueDate < today);
  if (overdue.length === 0) facts.push(`- ${t('assistantContext.noOverdue')}`);
  else {
    facts.push(`- ${t('assistantContext.overdue')}${colon(locale).trimEnd()}`);
    for (const ticket of overdue) {
      const late = days(daysBetween(ticket.dueDate!, today));
      facts.push(`  - ${t('assistantContext.overdueItem', { reference: ticket.reference, days: late, date: date(ticket.dueDate) })}`);
    }
  }
  if (data.requirements.length > 0) {
    facts.push(`- ${t('assistantContext.statusAge')}${colon(locale).trimEnd()}`);
    for (const r of data.requirements) {
      const age = Math.floor((Date.parse(data.now) - Date.parse(r.statusSince)) / DAY_MS);
      facts.push(`  - ${t('assistantContext.statusAgeItem', { reference: r.reference, status: r.status, days: days(age) })}`);
    }
  }
  if (data.tickets.length > 0) {
    facts.push(`- ${t('assistantContext.ticketCounts')}${colon(locale).trimEnd()}`);
    const byType = new Map<string, Map<string, number>>();
    for (const ticket of data.tickets) {
      const statuses = byType.get(ticket.type) ?? new Map<string, number>();
      byType.set(ticket.type, statuses);
      statuses.set(ticket.status, (statuses.get(ticket.status) ?? 0) + 1);
    }
    for (const [type, statuses] of byType) {
      facts.push(`  - ${type}${colon(locale)}${[...statuses].map(([status, n]) => `${status} ${n}`).join(', ')}`);
    }
  }
  if (data.babok) {
    const covered = data.babok.tasks.filter((task) => task.covered).length;
    facts.push(`- ${t('assistantContext.coveredTasks', { covered, total: data.babok.tasks.length })}`);
  }
  lines.push(...section(t('assistantContext.facts'), facts));

  // Fiche de l'initiative.
  const owners = initiative.members.filter((m) => m.role === 'owner').map((m) => m.name);
  lines.push(
    `# ${t('assistantContext.initiative', { name: initiative.name, code: initiative.code })}`,
    '',
    ...(
      [
        ['assistantContext.code', initiative.code],
        ['assistantContext.status', initiative.archived ? t('initiative.archived') : t('assistantContext.active')],
        ['initiative.analysisApproach', initiative.analysisApproach ? t(`approach.${initiative.analysisApproach}`) : EMPTY],
        ['initiative.startDate', date(initiative.startDate)],
        ['initiative.plannedEndDate', date(initiative.plannedEndDate)],
        ['assistantContext.owner', list(owners)],
        ['assistantContext.members', list(initiative.members.map((m) => `${m.name} (${t(`role.${m.role}`)})`))],
        [
          'initiative.agileExtension',
          t(initiative.agileExtensionEnabled ? 'initiative.agileExtensionEnabled' : 'initiative.agileExtensionDisabled'),
        ],
      ] as [MessageKey, string][]
    ).map(([key, value]) => `- ${t(key)}${colon(locale)}${value}`),
    '',
  );

  const level = (value: StakeholderLevel | null) => (value ? t(`stakeholderLevel.${value}`) : EMPTY);
  lines.push(
    ...section(
      t('tree.stakeholders'),
      data.stakeholders.map(
        (s) =>
          `- ${s.name} — ${fields([
            ['assistantContext.roles', list(s.roles.map((role) => t(`stakeholderRole.${role}`)))],
            ['assistantContext.influence', level(s.influence)],
            ['assistantContext.interest', level(s.interest)],
          ])}`,
      ),
    ),
  );

  lines.push(
    ...section(
      t('tree.needs'),
      data.needs.flatMap((n) => [
        `- ${n.reference} — ${n.title} — ${fields([
          ['assistantContext.nature', t(`needNature.${n.nature}`)],
          ['assistantContext.sources', list(n.sources)],
        ])}`,
        ...block('assistantContext.description', n.description),
      ]),
    ),
  );

  lines.push(
    ...section(
      t('tree.requirements'),
      data.requirements.flatMap((r) => {
        const type = t(`requirementType.${r.type}`) + (r.subtype ? ` (${t(`requirementSubtype.${r.subtype}`)})` : '');
        return [
          `- ${r.reference} — ${r.title} — ${fields([
            ['assistantContext.type', type],
            ['assistantContext.status', t('assistantContext.statusSince', { status: r.status, date: date(r.statusSince) })],
            ['assistantContext.parent', r.parent ?? EMPTY],
            ['assistantContext.needs', list(r.needs)],
            ['assistantContext.sources', list(r.sources)],
          ])}`,
          ...block('assistantContext.statement', r.statement),
        ];
      }),
    ),
  );

  lines.push(
    ...section(
      t('tree.tickets'),
      data.tickets.flatMap((ticket) => {
        const optional: [MessageKey, string | null][] = [
          ['assistantContext.epic', ticket.epic],
          ['assistantContext.task', ticket.task],
          ['assistantContext.technique', ticket.technique],
        ];
        return [
          `- ${ticket.reference} — ${ticket.type} — ${ticket.title} — ${fields([
            ['assistantContext.status', ticket.status],
            ['assistantContext.dueDate', date(ticket.dueDate)],
            ['assistantContext.assignee', ticket.assignee ?? EMPTY],
            ...optional.filter((pair): pair is [MessageKey, string] => pair[1] != null),
          ])}`,
          // Description des seuls tickets non fermés (AS15).
          ...(ticket.closed ? [] : block('assistantContext.description', ticket.description)),
        ];
      }),
    ),
  );

  lines.push(
    ...section(
      t('assistantContext.suggestedActions'),
      data.suggestedActions.map((s) => `- ${s.title} — ${s.justification}`),
    ),
  );

  lines.push(
    ...section(
      t('assistantContext.pagesList'),
      data.pages.map((p) => `- ${p.reference} — ${p.title}${p.parent ? ` (${t('assistantContext.parentPage')}${colon(locale)}${p.parent})` : ''}`),
    ),
  );

  if (data.babok) {
    lines.push(
      ...section(
        t('assistantContext.babokTasks'),
        data.babok.tasks.map(
          (task) => `- ${task.label}${colon(locale)}${t(task.covered ? 'assistantContext.covered' : 'assistantContext.notCovered')}`,
        ),
      ),
    );
    if (data.babok.agileHorizons) {
      lines.push(...section(t('assistantContext.agileHorizons'), data.babok.agileHorizons.map((h) => `- ${h}`)));
    }
  }

  return lines.join('\n');
}

/** Deux-points selon la typographie de la langue : « : » en français, « : » collé en anglais. */
const colon = (locale: Locale) => (locale === 'fr' ? ' : ' : ': ');

/** Corps de `POST /v1/runs` (AS27, AS36 bis), dans la langue d'ACTA de l'auteur (AS28). */
export interface HermesRunRequest {
  /** Instructions générales, ajoutées au prompt système de Hermes. */
  instructions: string;
  /** Données lues entre balises, instruction de l'usage, consigne de mise en forme. */
  input: string;
  /** Session propre à la demande, supprimée ensuite (AS37). */
  session_id: string;
  /** Réglage de réflexion toujours explicite : sans lui, Hermes réfléchit (ticket 10). */
  model_options: { reasoning: { enabled: boolean } };
}

/** Session Hermes d'une demande. */
export const hermesSessionId = (requestId: string) => `acta-${requestId}`;

export function hermesRunRequest({
  requestId,
  locale,
  usage,
  mode,
  data,
}: {
  requestId: string;
  locale: Locale;
  usage: OfferedAssistantUsage;
  mode: AssistantMode;
  /** Texte des données lues (assistantContextText). */
  data: string;
}): HermesRunRequest {
  const tag = translate(locale, 'assistantInstructions.dataTag');
  return {
    instructions: translate(locale, 'assistantInstructions.general'),
    input: [
      `<${tag}>\n${data}\n</${tag}>`,
      translate(locale, `assistantInstructions.${usage}`),
      // Placée en fin de message, elle l'emporte sur la consigne de texte brut de Hermes (AS27).
      translate(locale, 'assistantInstructions.format'),
    ].join('\n\n'),
    session_id: hermesSessionId(requestId),
    // Réponse rapide sans réflexion, approfondie avec réflexion (AS13).
    model_options: { reasoning: { enabled: mode === 'thorough' } },
  };
}
