// PROTOTYPE jetable (navigation par arborescence) : chargement en lecture seule
// des données d'une initiative et construction de l'arbre. À ne pas fusionner.
import {
  type FeatureDto,
  type InitiativeDto,
  type InitiativeLinksDto,
  type InitiativeMemberDto,
  type NeedDto,
  type PageRow,
  type RequirementDto,
  type RequirementStatusDto,
  type ScenarioDto,
  type StakeholderDto,
  type TicketRow,
  type TicketTypeDto,
} from '@app/shared';
import { api } from '../api';

export interface ProtoData {
  initiative: InitiativeDto;
  members: InitiativeMemberDto[];
  stakeholders: StakeholderDto[];
  needs: NeedDto[];
  requirements: RequirementDto[];
  scenarios: Map<string, ScenarioDto[]>;
  features: Map<string, FeatureDto>;
  tickets: TicketRow[];
  pages: PageRow[];
  links: InitiativeLinksDto;
  ticketTypes: TicketTypeDto[];
  requirementStatuses: RequirementStatusDto[];
}

export const isFunctional = (r: RequirementDto) => r.type === 'solution' && r.subtype === 'functional';

export async function loadInitiative(id: string): Promise<ProtoData> {
  const [initiative, members, stakeholders, needs, requirements, tickets, pages, links, ticketTypes, requirementStatuses] =
    await Promise.all([
      api.getInitiative(id),
      api.listMembers(id),
      api.listStakeholders(id),
      api.listNeeds(id),
      api.listRequirements(id),
      api.listTickets(id),
      api.listPages(id),
      api.listLinks(id),
      api.ticketTypes(),
      api.requirementStatuses(),
    ]);
  const functional = requirements.filter(isFunctional);
  const [scenarioLists, featureList] = await Promise.all([
    Promise.all(functional.map((r) => api.listScenarios(id, r.id).catch(() => [] as ScenarioDto[]))),
    Promise.all(functional.map((r) => api.getFeature(id, r.id).catch(() => ({ language: null, background: null }) as FeatureDto))),
  ]);
  return {
    initiative,
    members,
    stakeholders,
    needs,
    requirements,
    scenarios: new Map(functional.map((r, i) => [r.id, scenarioLists[i] ?? []])),
    features: new Map(functional.map((r, i) => [r.id, featureList[i]!])),
    tickets,
    pages,
    links,
    ticketTypes,
    requirementStatuses,
  };
}

// ── Libellés ────────────────────────────────────────────────────────────────

export function ticketStatus(data: ProtoData, t: Pick<TicketRow, 'type' | 'status'>) {
  const status = data.ticketTypes.find((ty) => ty.code === t.type)?.statuses.find((s) => s.code === t.status);
  return { label: status?.labels.fr ?? t.status, tone: status?.tone ?? 'neutral', closed: status?.closed ?? false };
}

export const ticketTypeLabel = (data: ProtoData, type: string) =>
  data.ticketTypes.find((ty) => ty.code === type)?.labels.fr ?? type;

export const requirementStatusLabel = (data: ProtoData, code: string) =>
  data.requirementStatuses.find((s) => s.code === code)?.labels.fr ?? code;

export const REQUIREMENT_TYPE_LABEL: Record<string, string> = {
  business: 'Exigence métier',
  stakeholder: 'Exigence de partie prenante',
  solution: 'Exigence de solution',
  transition: 'Exigence de transition',
};

export const memberName = (m: { displayName: string | null; email: string | null } | null) =>
  m ? (m.displayName ?? m.email ?? '—') : 'Sans responsable';

// ── Arbre ───────────────────────────────────────────────────────────────────

/** Clé d'un nœud, reprise dans l'adresse (`?node=`). */
export type NodeKey = string;

export interface TreeNode {
  key: NodeKey;
  label: string;
  reference?: string;
  count?: number;
  children: TreeNode[];
}

export function buildTree(data: ProtoData): TreeNode {
  const reqChildren = (parentId: string | null): TreeNode[] =>
    data.requirements
      .filter((r) => (r.parent?.id ?? null) === parentId)
      .map((r) => ({
        key: `requirement:${r.id}`,
        label: r.title,
        reference: r.reference,
        children: [
          ...reqChildren(r.id),
          ...(data.scenarios.get(r.id) ?? []).map((s) => ({
            key: `scenario:${s.id}`,
            label: s.title,
            reference: s.reference,
            children: [],
          })),
        ],
      }));

  const pageChildren = (parentId: string | null): TreeNode[] =>
    data.pages
      .filter((p) => p.parentId === parentId)
      .sort((a, b) => a.position - b.position)
      .map((p) => ({ key: `page:${p.id}`, label: p.title, reference: p.reference, children: pageChildren(p.id) }));

  // Tickets ouverts seulement, rangés par Epic puis « Sans Epic » (décision de la responsable, 20.11.2026).
  const open = data.tickets.filter((t) => !ticketStatus(data, t).closed);
  const ticketNode = (t: TicketRow): TreeNode => ({ key: `ticket:${t.id}`, label: t.title, reference: t.reference, children: [] });
  const epics = open.filter((t) => t.type === 'epic');
  const withoutEpic = open.filter((t) => t.type !== 'epic' && !t.epic);
  const ticketTree: TreeNode[] = [
    ...epics.map((e) => ({ ...ticketNode(e), children: open.filter((t) => t.epic?.id === e.id).map(ticketNode) })),
    ...(withoutEpic.length > 0
      ? [{ key: 'group:noEpic', label: 'Sans Epic', count: withoutEpic.length, children: withoutEpic.map(ticketNode) }]
      : []),
  ];

  return {
    key: 'initiative',
    label: data.initiative.name,
    reference: data.initiative.code,
    children: [
      { key: 'dashboard', label: 'Tableau de bord', children: [] },
      {
        key: 'group:stakeholders',
        label: 'Parties prenantes',
        count: data.stakeholders.length,
        children: data.stakeholders.map((s) => ({ key: `stakeholder:${s.id}`, label: s.name, children: [] })),
      },
      {
        key: 'group:needs',
        label: 'Besoins',
        count: data.needs.length,
        children: data.needs.map((n) => ({ key: `need:${n.id}`, label: n.title, reference: n.reference, children: [] })),
      },
      { key: 'group:requirements', label: 'Exigences', count: data.requirements.length, children: reqChildren(null) },
      { key: 'group:tickets', label: 'Tickets', count: open.length, children: ticketTree },
      { key: 'group:pages', label: 'Pages', count: data.pages.length, children: pageChildren(null) },
      { key: 'team', label: 'Équipe', count: data.members.length, children: [] },
    ],
  };
}

/** Chemin de la racine jusqu'au nœud (fil d'Ariane, dépliage). */
export function pathTo(root: TreeNode, key: NodeKey): TreeNode[] {
  if (root.key === key) return [root];
  for (const child of root.children) {
    const path = pathTo(child, key);
    if (path.length) return [root, ...path];
  }
  return [];
}
