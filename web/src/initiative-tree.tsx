// Arborescence d'une initiative (ADR-0021, N5 à N10) : chargée ici, construite
// par @app/shared (initiative-tree.ts), affichée à gauche de l'écran de données
// et parcourue au clavier (flèches, Entrée, Début, Fin). Les pages s'y rangent
// comme avant (N9 ; décision 08, point 7) : glisser une page sur le haut d'une
// ligne la place avant, sur le reste de la ligne elle devient sa sous-page ;
// Alt + flèches la déplace au clavier.
import {
  acceptsScenarios,
  buildInitiativeTree,
  type InitiativeDto,
  type InitiativeMemberDto,
  type InitiativeTreeNode,
  type MessageKey,
  type NeedDto,
  dropPlacement,
  keyboardPlacement,
  type OwnerDesignationDto,
  type PagePlacement,
  type PageKeyboardMove,
  type PageRow,
  pathToNode,
  type RequirementDto,
  type Screen,
  type ScenarioDto,
  type StakeholderDto,
  type TicketRow,
  type TreeNodeRef,
} from '@app/shared';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { type DragEvent, type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { useTicketTypes } from './ticket-types';

/** Ce que l'écran de données et l'arborescence montrent d'une initiative. */
export interface InitiativeData {
  initiative: InitiativeDto;
  members: InitiativeMemberDto[];
  designations: OwnerDesignationDto[];
  stakeholders: StakeholderDto[];
  needs: NeedDto[];
  requirements: RequirementDto[];
  /** Tous les tickets, ouverts et fermés ; l'arborescence ne montre que les ouverts (N8). */
  tickets: TicketRow[];
  pages: PageRow[];
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
        tickets: shown.lists.tickets,
        pages: shown.lists.pages,
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

/** Où mène un nœud : l'écran à afficher à droite. */
export function nodeDestination(initiativeId: string, ref: TreeNodeRef): Screen {
  switch (ref.kind) {
    case 'initiative':
      return { kind: 'initiative', initiativeId, tab: 'overview' };
    case 'dashboard':
      return { kind: 'dashboard', initiativeId, tab: 'tasks' };
    case 'team':
      return { kind: 'team', initiativeId, tab: 'members' };
    case 'branch':
      switch (ref.branch) {
        case 'stakeholders':
          return { kind: 'stakeholders', initiativeId, tab: 'list' };
        default:
          return { kind: ref.branch, initiativeId };
      }
    case 'noEpic':
      return { kind: 'tickets', initiativeId };
    case 'stakeholder':
      return { kind: 'stakeholder', initiativeId, stakeholderId: ref.id, tab: 'sheet' };
    case 'need':
      return { kind: 'need', initiativeId, needId: ref.id, tab: 'sheet' };
    case 'requirement':
      return { kind: 'requirement', initiativeId, requirementId: ref.id, tab: 'sheet' };
    case 'scenario':
      // L'onglet Scénarios de son exigence, le scénario mis en évidence (N16).
      return { kind: 'scenario', initiativeId, requirementId: ref.requirementId, scenarioId: ref.id };
    case 'ticket':
      // De tout type, ouvert ou fermé (N8).
      return { kind: 'ticket', initiativeId, ticketId: ref.id, tab: 'sheet' };
    case 'page':
      return { kind: 'page', initiativeId, pageId: ref.id, tab: 'content' };
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

/** Rangement des pages, pour qui peut les modifier. */
export interface PageMoves {
  pages: PageRow[];
  /** Déplace la page ; résolu une fois l'arborescence relue, rejeté en cas d'échec (l'erreur est affichée ailleurs). */
  onMove: (pageId: string, placement: PagePlacement) => Promise<void>;
  /** « + » d'une page : sa sous-page, en fenêtre de dialogue. */
  onAddChild: (pageId: string) => void;
}

/** Touches qui, avec Alt, déplacent la page choisie dans l'arborescence. */
const PAGE_MOVE_KEYS: Partial<Record<string, PageKeyboardMove>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowRight: 'indent',
  ArrowLeft: 'outdent',
};

const pageIdOf = (node: InitiativeTreeNode) => (node.ref.kind === 'page' ? node.ref.id : null);

export function InitiativeTree({
  tree,
  selectedKey,
  onSelect,
  pageMoves,
}: {
  tree: InitiativeTreeNode;
  /** Nœud de l'écran affiché ; null pour « Mes actions », le référentiel… */
  selectedKey: string | null;
  onSelect: (node: InitiativeTreeNode) => void;
  /** Absent : les pages ne se déplacent pas (lecteur, initiative archivée). */
  pageMoves?: PageMoves;
}) {
  const { t } = useI18n();
  const [dragged, setDragged] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; zone: 'before' | 'inside' } | null>(null);
  // Déplacement fait : annoncé aux lecteurs d'écran ; impossible : dit à l'écran jusqu'à la touche suivante.
  const [moved, setMoved] = useState('');
  const [blocked, setBlocked] = useState('');
  // La page déplacée au clavier garde le focus à sa nouvelle place.
  const refocus = useRef<string | null>(null);
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

  useEffect(() => {
    const key = refocus.current;
    if (!key) return;
    refocus.current = null;
    if (listRef.current?.contains(document.activeElement) || document.activeElement === document.body) focusNode(key);
  }, [tree]);

  const titleOf = (pageId: string) => pageMoves?.pages.find((p) => p.id === pageId)?.title ?? '';

  async function move(pageId: string, placement: PagePlacement, keepFocus: string | null) {
    if (!pageMoves) return;
    try {
      await pageMoves.onMove(pageId, placement);
      refocus.current = keepFocus;
      setMoved(t('pages.moved', { title: titleOf(pageId) }));
    } catch {
      // L'erreur est affichée au-dessus de l'écran de données.
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const index = visible.findIndex((v) => v.node.key === current);
    const item = visible[index];
    if (!item) return;
    const { node } = item;
    setBlocked('');
    const pageId = pageIdOf(node);
    if (event.altKey && pageMoves && pageId) {
      const name = PAGE_MOVE_KEYS[event.key];
      if (!name) return;
      event.preventDefault();
      const placement = keyboardPlacement(pageMoves.pages, pageId, name);
      if (placement) void move(pageId, placement, node.key);
      else setBlocked(t(`pages.cannotMove.${name}`, { title: titleOf(pageId) }));
      return;
    }
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

  function zoneOf(event: DragEvent<HTMLElement>): 'before' | 'inside' {
    const box = event.currentTarget.getBoundingClientRect();
    // Haut de la ligne : avant elle ; le reste : sous-page.
    return event.clientY - box.top < box.height * 0.3 ? 'before' : 'inside';
  }

  /** Glisser-déposer d'une page sur une autre ; rien pour les autres nœuds. */
  function dragProps(node: InitiativeTreeNode) {
    const pageId = pageIdOf(node);
    if (!pageMoves || !pageId) return {};
    const placementAt = (event: DragEvent<HTMLElement>) =>
      dragged ? dropPlacement(pageMoves.pages, dragged, pageId, zoneOf(event)) : null;
    return {
      draggable: true,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', node.reference ?? '');
        setDragged(pageId);
      },
      onDragEnd: () => {
        setDragged(null);
        setDrop(null);
      },
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (!dragged) return;
        if (!placementAt(event)) {
          setDrop(null);
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        const zone = zoneOf(event);
        if (drop?.id !== pageId || drop.zone !== zone) setDrop({ id: pageId, zone });
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDrop(null);
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        const placement = placementAt(event);
        if (dragged && placement) void move(dragged, placement, null);
        setDragged(null);
        setDrop(null);
      },
    };
  }

  const render = (node: InitiativeTreeNode, depth: number) => {
    const hasChildren = node.children.length > 0;
    const pageId = pageIdOf(node);
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
        <div
          className={[
            'tree-node',
            selected ? 'is-selected' : '',
            pageId && pageId === dragged ? 'is-dragging' : '',
            pageId && drop?.id === pageId ? `drop-${drop.zone}` : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ paddingLeft: `calc(${depth} * var(--space-4))` }}
          {...dragProps(node)}
        >
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
          {pageMoves && pageId && (
            <button
              type="button"
              className="ghost icon-only tree-add"
              tabIndex={-1}
              aria-label={t('pages.addChild', { title: node.title ?? '' })}
              title={t('pages.addChild', { title: node.title ?? '' })}
              onClick={() => pageMoves.onAddChild(pageId)}
            >
              <Plus />
            </button>
          )}
        </div>
        {hasChildren && isOpen && <ul role="group">{node.children.map((c) => render(c, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <>
      <ul ref={listRef} className="tree" role="tree" aria-label={t('tree.label')} onKeyDown={onKeyDown}>
        {render(tree, 0)}
      </ul>
      <p className="visually-hidden" role="status">
        {moved}
      </p>
      <p className="tree-status" role="status">
        {blocked}
      </p>
    </>
  );
}
