// Arborescence d'une initiative (ADR-0021, N5 à N10) : chargée ici, construite
// par @app/shared (initiative-tree.ts), affichée à gauche de l'écran de données
// et parcourue au clavier (flèches, Entrée, Début, Fin).
import {
  acceptsScenarios,
  buildInitiativeTree,
  type InitiativeDto,
  type InitiativeMemberDto,
  type InitiativeTreeNode,
  type MessageKey,
  type NeedDto,
  type OwnerDesignationDto,
  pathToNode,
  type RequirementDto,
  type Screen,
  type ScenarioDto,
  type StakeholderDto,
  type TreeNodeRef,
} from '@app/shared';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import type { PanelContent } from './panels';
import { ticketTarget } from './ticket-parts';
import { useTicketTypes } from './ticket-types';

/** Ce que l'écran de données et l'arborescence montrent d'une initiative. */
export interface InitiativeData {
  initiative: InitiativeDto;
  members: InitiativeMemberDto[];
  designations: OwnerDesignationDto[];
  stakeholders: StakeholderDto[];
  needs: NeedDto[];
  requirements: RequirementDto[];
  tree: InitiativeTreeNode;
}

/**
 * Charge l'initiative et tout ce que montre son arborescence ; rechargé à chaque
 * `version` (écriture sur l'initiative ou l'un de ses éléments). Pendant le
 * rechargement, les données précédentes restent affichées.
 */
export function useInitiativeData(initiativeId: string | null, version: string) {
  const ticketTypes = useTicketTypes();
  const [loaded, setLoaded] = useState<{ version: string; data: Awaited<ReturnType<typeof loadInitiative>> } | null>(null);
  const [failure, setFailure] = useState<{ initiativeId: string; error: UiError } | null>(null);

  useEffect(() => {
    if (!initiativeId) return;
    let current = true;
    loadInitiative(initiativeId).then(
      (data) => {
        if (!current) return;
        setLoaded({ version, data });
        setFailure(null);
      },
      (e: unknown) => current && setFailure({ initiativeId, error: toUiError(e) }),
    );
    return () => {
      current = false;
    };
  }, [initiativeId, version]);

  const shown = loaded?.data.initiative.id === initiativeId ? loaded.data : null;
  const data = useMemo<InitiativeData | null>(
    () =>
      shown && {
        initiative: shown.initiative,
        members: shown.members,
        designations: shown.designations,
        stakeholders: shown.lists.stakeholders,
        needs: shown.lists.needs,
        requirements: shown.lists.requirements,
        tree: buildInitiativeTree({ ...shown.lists, initiative: shown.initiative, ticketTypes, memberCount: shown.members.length }),
      },
    [shown, ticketTypes],
  );
  const error = failure?.initiativeId === initiativeId ? failure.error : null;
  // Rechargement en cours : un élément tout juste créé n'y est pas encore.
  const pending = !error && loaded?.version !== version;
  return { data, pending, error };
}

async function loadInitiative(id: string) {
  const [initiative, members, designations, stakeholders, needs, requirements, tickets, pages] = await Promise.all([
    api.getInitiative(id),
    api.listMembers(id),
    api.listOwnerDesignations(id),
    api.listStakeholders(id),
    api.listNeeds(id),
    api.listRequirements(id),
    api.listTickets(id),
    api.listPages(id),
  ]);
  // Une lecture par exigence qui porte des scénarios, pour leur ordre (N6).
  const scenarioLists = await Promise.all(
    requirements.filter(acceptsScenarios).map((r) => api.listScenarios(id, r.id).catch(() => [] as ScenarioDto[])),
  );
  return {
    initiative,
    members,
    designations,
    lists: { stakeholders, needs, requirements, scenarios: scenarioLists.flat(), tickets, pages },
  };
}

/** Libellé d'un nœud fixe (branche, tableau de bord, équipe). */
const FIXED_LABELS: Record<string, MessageKey> = {
  dashboard: 'tree.dashboard',
  team: 'tree.team',
  noEpic: 'tree.noEpic',
  'branch:stakeholders': 'tree.stakeholders',
  'branch:needs': 'tree.needs',
  'branch:requirements': 'tree.requirements',
  'branch:tickets': 'tree.tickets',
  'branch:pages': 'tree.pages',
};

/** Libellé affiché d'un nœud : son titre saisi, ou celui de l'interface. */
export function useNodeLabel() {
  const { t } = useI18n();
  return useCallback(
    (node: InitiativeTreeNode) => node.title ?? (FIXED_LABELS[node.key] ? t(FIXED_LABELS[node.key]!) : node.key),
    [t],
  );
}

/**
 * Où mène un nœud : l'écran à afficher à droite et, pour un élément pas encore
 * repris dans l'écran de données, son panneau actuel (ouvert par-dessus sa branche).
 */
export function nodeDestination(initiativeId: string, ref: TreeNodeRef): { screen: Screen; panel?: PanelContent } {
  switch (ref.kind) {
    case 'initiative':
      return { screen: { kind: 'initiative', initiativeId, tab: 'overview' } };
    case 'dashboard':
      return { screen: { kind: 'dashboard', initiativeId, tab: 'tasks' } };
    case 'team':
      return { screen: { kind: 'team', initiativeId, tab: 'members' } };
    case 'branch':
      switch (ref.branch) {
        case 'stakeholders':
          return { screen: { kind: 'stakeholders', initiativeId, tab: 'list' } };
        case 'pages':
          return { screen: { kind: 'pages', initiativeId, pageId: null } };
        default:
          return { screen: { kind: ref.branch, initiativeId } };
      }
    case 'noEpic':
      return { screen: { kind: 'tickets', initiativeId } };
    case 'stakeholder':
      return { screen: { kind: 'stakeholder', initiativeId, stakeholderId: ref.id, tab: 'sheet' } };
    case 'need':
      return { screen: { kind: 'need', initiativeId, needId: ref.id, tab: 'sheet' } };
    case 'requirement':
      return { screen: { kind: 'requirement', initiativeId, requirementId: ref.id, tab: 'sheet' } };
    case 'scenario':
      // L'onglet Scénarios de son exigence, le scénario mis en évidence (N16).
      return { screen: { kind: 'scenario', initiativeId, requirementId: ref.requirementId, scenarioId: ref.id } };
    case 'ticket':
      return { screen: { kind: 'tickets', initiativeId }, panel: ticketTarget(initiativeId, ref) };
    case 'page':
      return { screen: { kind: 'pages', initiativeId, pageId: ref.id } };
  }
}

/** Nœuds visibles, dans l'ordre d'affichage, avec leur parent : le parcours au clavier. */
function visibleNodes(root: InitiativeTreeNode, expanded: ReadonlySet<string>) {
  const list: { node: InitiativeTreeNode; parent: string | null }[] = [];
  const walk = (node: InitiativeTreeNode, parent: string | null) => {
    list.push({ node, parent });
    if (expanded.has(node.key)) for (const child of node.children) walk(child, node.key);
  };
  walk(root, null);
  return list;
}

export function InitiativeTree({
  tree,
  selectedKey,
  onSelect,
}: {
  tree: InitiativeTreeNode;
  /** Nœud de l'écran affiché ; null pour « Mes actions », le référentiel… */
  selectedKey: string | null;
  onSelect: (node: InitiativeTreeNode) => void;
}) {
  const { t } = useI18n();
  const label = useNodeLabel();
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set([tree.key]));
  // Le chemin vers le nœud choisi est toujours déplié (N10).
  const path = useMemo(() => (selectedKey ? pathToNode(tree, selectedKey) : []), [tree, selectedKey]);
  const expanded = useMemo(() => new Set([...opened, ...path.slice(0, -1).map((n) => n.key)]), [opened, path]);
  const visible = useMemo(() => visibleNodes(tree, expanded), [tree, expanded]);
  // Nœud qui reçoit le focus par Tab (tabindex itinérant).
  const [focusKey, setFocusKey] = useState<string>(tree.key);
  const current = visible.some((v) => v.node.key === focusKey)
    ? focusKey
    : (path.at(-1)?.key ?? tree.key);
  const listRef = useRef<HTMLUListElement>(null);

  const toggle = (key: string, open: boolean) =>
    setOpened((s) => {
      const next = new Set(s);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });

  const focusNode = (key: string) => {
    setFocusKey(key);
    listRef.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)?.focus();
  };

  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const index = visible.findIndex((v) => v.node.key === current);
    const item = visible[index];
    if (!item) return;
    const { node } = item;
    const isOpen = expanded.has(node.key);
    let handled = true;
    switch (event.key) {
      case 'ArrowDown':
        if (visible[index + 1]) focusNode(visible[index + 1]!.node.key);
        break;
      case 'ArrowUp':
        if (index > 0) focusNode(visible[index - 1]!.node.key);
        break;
      case 'ArrowRight':
        if (node.children.length === 0) break;
        if (!isOpen) toggle(node.key, true);
        else focusNode(node.children[0]!.key);
        break;
      case 'ArrowLeft':
        if (isOpen && node.children.length > 0 && !path.slice(0, -1).some((n) => n.key === node.key)) toggle(node.key, false);
        else if (item.parent) focusNode(item.parent);
        break;
      case 'Home':
        focusNode(visible[0]!.node.key);
        break;
      case 'End':
        focusNode(visible.at(-1)!.node.key);
        break;
      case 'Enter':
      case ' ':
        onSelect(node);
        break;
      default:
        handled = false;
    }
    if (handled) event.preventDefault();
  }

  const render = (node: InitiativeTreeNode, depth: number) => {
    const hasChildren = node.children.length > 0;
    const isOpen = expanded.has(node.key);
    const selected = node.key === selectedKey;
    // Repli impossible tant que le nœud choisi est dessous (N10).
    const locked = path.slice(0, -1).some((n) => n.key === node.key);
    return (
      <li
        key={node.key}
        role="treeitem"
        aria-expanded={hasChildren ? isOpen : undefined}
        aria-selected={selected}
        aria-level={depth + 1}
        data-key={node.key}
        tabIndex={node.key === current ? 0 : -1}
        onFocus={(e) => {
          if (e.target === e.currentTarget) setFocusKey(node.key);
        }}
      >
        <div className={`tree-node${selected ? ' is-selected' : ''}`} style={{ paddingLeft: `calc(${depth} * var(--space-4))` }}>
          {hasChildren ? (
            <button
              type="button"
              className="tree-twisty"
              tabIndex={-1}
              aria-hidden="true"
              title={t(isOpen ? 'tree.collapse' : 'tree.expand')}
              disabled={locked}
              onClick={() => toggle(node.key, !isOpen)}
            >
              {isOpen ? <ChevronDown /> : <ChevronRight />}
            </button>
          ) : (
            <span className="tree-twisty" />
          )}
          <span
            className="tree-label"
            onClick={() => {
              setFocusKey(node.key);
              onSelect(node);
            }}
          >
            {node.reference && depth > 0 && <span className="code">{node.reference}</span>}
            <span className="tree-title">{label(node)}</span>
            {node.count !== null && <span className="tree-count">{node.count}</span>}
          </span>
        </div>
        {hasChildren && isOpen && <ul role="group">{node.children.map((c) => render(c, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <ul ref={listRef} className="tree" role="tree" aria-label={t('tree.label')} onKeyDown={onKeyDown}>
      {render(tree, 0)}
    </ul>
  );
}
