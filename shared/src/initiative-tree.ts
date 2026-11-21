// Arborescence d'une initiative (ADR-0021, N5 à N10) : construite une seule fois
// ici à partir des listes de l'initiative, affichée par le web à gauche de
// l'écran de données.
import type { PageRow } from './pages.js';
import type { Screen } from './screens.js';
import { sortByReference } from './references.js';
import { isOpenTicket, type TicketRow } from './tickets.js';
import type { TicketTypeDto } from './ticket-type-catalog.js';

/** Branches de l'arborescence qui portent une liste d'éléments. */
export const TREE_BRANCHES = ['stakeholders', 'needs', 'requirements', 'tickets', 'pages'] as const;
export type TreeBranch = (typeof TREE_BRANCHES)[number];

/** Ce que désigne un nœud ; sa clé, unique dans l'arbre, en découle. */
export type TreeNodeRef =
  | { kind: 'initiative' }
  | { kind: 'dashboard' }
  | { kind: 'team' }
  | { kind: 'branch'; branch: TreeBranch }
  /** Tickets ouverts sans Epic ouvert. */
  | { kind: 'noEpic' }
  | { kind: 'stakeholder' | 'need' | 'requirement' | 'page'; id: string }
  | { kind: 'scenario'; id: string; requirementId: string }
  | { kind: 'ticket'; id: string; type: string };

export interface InitiativeTreeNode {
  key: string;
  ref: TreeNodeRef;
  /** Référence courte (ex. EX-001, N10), sans le code de l'initiative ; null si l'élément n'en a pas. */
  reference: string | null;
  /** Titre saisi ; null pour un nœud fixe, dont le libellé vient de l'interface. */
  title: string | null;
  /** Nombre d'éléments d'une branche ; null pour les autres nœuds. */
  count: number | null;
  children: InitiativeTreeNode[];
}

export interface InitiativeTreeData {
  initiative: { code: string; name: string };
  stakeholders: readonly { id: string; name: string }[];
  needs: readonly { id: string; reference: string; title: string }[];
  requirements: readonly { id: string; reference: string; title: string; parent: { id: string } | null }[];
  /** Scénarios des exigences, chacun dans l'ordre de son exigence. */
  scenarios: readonly { id: string; requirementId: string; reference: string; title: string }[];
  tickets: readonly TicketRow[];
  ticketTypes: readonly TicketTypeDto[];
  pages: readonly PageRow[];
  memberCount: number;
}

export function treeNodeKey(ref: TreeNodeRef): string {
  switch (ref.kind) {
    case 'initiative':
    case 'dashboard':
    case 'team':
    case 'noEpic':
      return ref.kind;
    case 'branch':
      return `branch:${ref.branch}`;
    default:
      return `${ref.kind}:${ref.id}`;
  }
}

/** Référence sans le code de l'initiative : CRM-EX-001 → EX-001. */
export function shortReference(reference: string, code: string): string {
  return reference.startsWith(`${code}-`) ? reference.slice(code.length + 1) : reference;
}

function node(
  ref: TreeNodeRef,
  fields: { reference?: string | null; title?: string | null; count?: number | null; children?: InitiativeTreeNode[] } = {},
): InitiativeTreeNode {
  return {
    key: treeNodeKey(ref),
    ref,
    reference: fields.reference ?? null,
    title: fields.title ?? null,
    count: fields.count ?? null,
    children: fields.children ?? [],
  };
}

export function buildInitiativeTree(data: InitiativeTreeData): InitiativeTreeNode {
  const short = (reference: string) => shortReference(reference, data.initiative.code);

  // Une exigence dont la parente manque reste visible, à la racine.
  const requirementIds = new Set(data.requirements.map((r) => r.id));
  const parentOf = (r: InitiativeTreeData['requirements'][number]) =>
    r.parent && requirementIds.has(r.parent.id) ? r.parent.id : null;
  const requirementNodes = (parentId: string | null): InitiativeTreeNode[] =>
    data.requirements
      .filter((r) => parentOf(r) === parentId)
      .map((r) =>
        node(
          { kind: 'requirement', id: r.id },
          {
            reference: short(r.reference),
            title: r.title,
            children: [
              ...requirementNodes(r.id),
              ...data.scenarios
                .filter((s) => s.requirementId === r.id)
                .map((s) =>
                  node({ kind: 'scenario', id: s.id, requirementId: r.id }, { reference: short(s.reference), title: s.title }),
                ),
            ],
          },
        ),
      );

  const pageIds = new Set(data.pages.map((p) => p.id));
  const pageNodes = (parentId: string | null): InitiativeTreeNode[] =>
    data.pages
      .filter((p) => (p.parentId && pageIds.has(p.parentId) ? p.parentId : null) === parentId)
      .sort((a, b) => a.position - b.position)
      .map((p) => node({ kind: 'page', id: p.id }, { reference: short(p.reference), title: p.title, children: pageNodes(p.id) }));

  // Tickets ouverts seulement, par Epic puis « Sans Epic » (N8) ; le ticket d'un
  // Epic fermé va sous « Sans Epic » (décision du 21.11.2026).
  const open = sortByReference(data.tickets.filter((t) => isOpenTicket(data.ticketTypes, t)));
  const ticketNode = (t: TicketRow, children: InitiativeTreeNode[] = []) =>
    node({ kind: 'ticket', id: t.id, type: t.type }, { reference: short(t.reference), title: t.title, children });
  const epics = open.filter((t) => t.type === 'epic');
  const openEpicIds = new Set(epics.map((e) => e.id));
  const members = open.filter((t) => t.type !== 'epic');
  const withoutEpic = members.filter((t) => !t.epic || !openEpicIds.has(t.epic.id));
  const ticketNodes = [
    ...epics.map((epic) => ticketNode(epic, members.filter((t) => t.epic?.id === epic.id).map((t) => ticketNode(t)))),
    ...(withoutEpic.length > 0
      ? [node({ kind: 'noEpic' }, { count: withoutEpic.length, children: withoutEpic.map((t) => ticketNode(t)) })]
      : []),
  ];

  return node(
    { kind: 'initiative' },
    {
      reference: data.initiative.code,
      title: data.initiative.name,
      children: [
        node({ kind: 'dashboard' }),
        node(
          { kind: 'branch', branch: 'stakeholders' },
          {
            count: data.stakeholders.length,
            children: data.stakeholders.map((s) => node({ kind: 'stakeholder', id: s.id }, { title: s.name })),
          },
        ),
        node(
          { kind: 'branch', branch: 'needs' },
          {
            count: data.needs.length,
            children: data.needs.map((n) => node({ kind: 'need', id: n.id }, { reference: short(n.reference), title: n.title })),
          },
        ),
        node({ kind: 'branch', branch: 'requirements' }, { count: data.requirements.length, children: requirementNodes(null) }),
        node({ kind: 'branch', branch: 'tickets' }, { count: open.length, children: ticketNodes }),
        node({ kind: 'branch', branch: 'pages' }, { count: data.pages.length, children: pageNodes(null) }),
        node({ kind: 'team' }, { count: data.memberCount }),
      ],
    },
  );
}

/** Chemin de la racine jusqu'au nœud (fil d'Ariane, dépliage) ; vide si le nœud n'est pas dans l'arbre. */
export function pathToNode(root: InitiativeTreeNode, key: string): InitiativeTreeNode[] {
  if (root.key === key) return [root];
  for (const child of root.children) {
    const path = pathToNode(child, key);
    if (path.length > 0) return [root, ...path];
  }
  return [];
}

/** Nœud que montre l'écran ; null pour « Mes actions », qui n'en sélectionne aucun (N3). */
export function screenNodeKey(screen: Screen): string | null {
  switch (screen.kind) {
    case 'myActions':
      return null;
    case 'initiative':
    case 'dashboard':
    case 'team':
      return treeNodeKey({ kind: screen.kind });
    case 'stakeholders':
    case 'needs':
    case 'requirements':
    case 'tickets':
      return treeNodeKey({ kind: 'branch', branch: screen.kind });
    case 'stakeholder':
      return treeNodeKey({ kind: 'stakeholder', id: screen.stakeholderId });
    case 'need':
      return treeNodeKey({ kind: 'need', id: screen.needId });
    case 'requirement':
      return treeNodeKey({ kind: 'requirement', id: screen.requirementId });
    case 'scenario':
      return treeNodeKey({ kind: 'scenario', id: screen.scenarioId, requirementId: screen.requirementId });
    case 'pages':
      return screen.pageId ? treeNodeKey({ kind: 'page', id: screen.pageId }) : treeNodeKey({ kind: 'branch', branch: 'pages' });
  }
}
