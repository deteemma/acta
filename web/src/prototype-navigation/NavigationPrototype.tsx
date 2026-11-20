// PROTOTYPE jetable — question : « Comment présenter les sous-écrans d'un objet
// dans la nouvelle navigation (arborescence à gauche, écran de données à droite) ? »
// Trois variantes sur la route /prototype/navigation, choisies par `?variant=` :
//   A — onglets en tête de l'écran de données ;
//   B — une page continue, avec un sommaire fixe à droite ;
//   C — les sous-écrans comme dernier niveau de l'arborescence.
// Lecture seule : les boutons d'écriture ne font rien. À ne pas fusionner dans main.
import type { InitiativeDto } from '@app/shared';
import { BookOpen, ChevronDown, ChevronRight, ListChecks, Search, Settings2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { Logotype } from '../logotype';
import { ReferencesProvider } from '../references';
import { buildTree, loadInitiative, type NodeKey, pathTo, type ProtoData, type TreeNode } from './data';
import { type Screen, screenFor, type SubScreen } from './screens';
import { PrototypeSwitcher } from './switcher';
import './prototype.css';

const VARIANTS = [
  { key: 'A', name: 'Onglets' },
  { key: 'B', name: 'Page continue et sommaire' },
  { key: 'C', name: 'Sous-écrans dans l’arbre' },
] as const;

interface UrlState {
  variant: string;
  initiative: string | null;
  node: NodeKey;
  sub: string | null;
}

const readUrl = (): UrlState => {
  const p = new URLSearchParams(window.location.search);
  return { variant: p.get('variant') ?? 'A', initiative: p.get('initiative'), node: p.get('node') ?? 'initiative', sub: p.get('sub') };
};

function writeUrl(s: UrlState, push: boolean) {
  const p = new URLSearchParams();
  p.set('variant', s.variant);
  if (s.initiative) p.set('initiative', s.initiative);
  p.set('node', s.node);
  if (s.sub) p.set('sub', s.sub);
  const url = `${window.location.pathname}?${p}`;
  if (push) window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
}

export function NavigationPrototype() {
  return (
    <ReferencesProvider version={0}>
      <Prototype />
    </ReferencesProvider>
  );
}

function Prototype() {
  const [url, setUrl] = useState(readUrl);
  const [initiatives, setInitiatives] = useState<InitiativeDto[]>([]);
  const [loaded, setLoaded] = useState<ProtoData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback((patch: Partial<UrlState>, push = true) => {
    setUrl((current) => {
      const next = { ...current, ...patch };
      writeUrl(next, push);
      return next;
    });
  }, []);

  useEffect(() => {
    const onPop = () => setUrl(readUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    api.listInitiatives().then((list) => {
      setInitiatives(list);
      if (!readUrl().initiative && list[0]) update({ initiative: list[0].id }, false);
    }, (e: unknown) => setError(String(e)));
  }, [update]);

  useEffect(() => {
    if (!url.initiative) return;
    loadInitiative(url.initiative).then(setLoaded, (e: unknown) => setError(String(e)));
  }, [url.initiative]);
  const data = loaded?.initiative.id === url.initiative ? loaded : null;

  const go = useCallback((node: NodeKey, sub: string | null = null) => update({ node, sub }), [update]);

  return (
    <div className="proto-shell">
      <aside className="proto-side" aria-label="Navigation">
        <Logotype />
        <label className="proto-picker">
          <span className="visually-hidden">Initiative</span>
          <select
            value={url.initiative ?? ''}
            onChange={(e) => update({ initiative: e.target.value, node: 'initiative', sub: null })}
          >
            {initiatives.map((i) => (
              <option key={i.id} value={i.id}>
                {i.code} — {i.name}
                {i.archivedAt ? ' (archivée)' : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="proto-tree-scroll">
          {data && <SideTree data={data} url={url} go={go} />}
          {!data && !error && <p className="muted">Chargement…</p>}
        </div>
        <nav className="proto-side-end">
          <button type="button" className="nav-item">
            <ListChecks /> Mes actions
          </button>
          <button type="button" className="nav-item">
            <BookOpen /> Référentiel BABOK
          </button>
          <button type="button" className="nav-item">
            <Settings2 /> Administration
          </button>
        </nav>
      </aside>
      <div className="proto-main">
        <header className="proto-topbar">
          <button type="button" className="search">
            <span>
              <Search /> Rechercher
            </span>
            <kbd>Ctrl+K</kbd>
          </button>
          <button type="button" className="primary">
            + Action
          </button>
        </header>
        {error && <p className="error">{error}</p>}
        {data && <DataScreen key={`${url.initiative}-${url.node}`} data={data} url={url} go={go} />}
      </div>
      <PrototypeSwitcher variants={VARIANTS} current={url.variant} onChange={(variant) => update({ variant }, false)} />
    </div>
  );
}

// ── Arborescence ────────────────────────────────────────────────────────────

function SideTree({ data, url, go }: { data: ProtoData; url: UrlState; go: (node: NodeKey, sub?: string | null) => void }) {
  const root = useMemo(() => buildTree(data), [data]);
  const [userExpanded, setExpanded] = useState<Set<NodeKey>>(() => new Set(['initiative']));
  // Le chemin du nœud choisi est toujours déplié.
  const expanded = new Set([...userExpanded, ...pathTo(root, url.node).slice(0, -1).map((n) => n.key)]);

  const toggle = (key: NodeKey) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const subs = url.variant === 'C' ? screenFor(data, url.node, go).subScreens : [];
  const currentSub = url.sub ?? (url.variant === 'C' ? (screenFor(data, url.node, go).initialSub ?? subs[0]?.id) : null);

  const render = (node: TreeNode, depth: number) => {
    const open = expanded.has(node.key);
    const selected = node.key === url.node;
    const showSubs = selected && url.variant === 'C' && subs.length > 1;
    return (
      <li key={node.key} role="treeitem" aria-expanded={node.children.length ? open : undefined} aria-selected={selected}>
        <div className={`proto-node${selected ? ' is-selected' : ''}`} style={{ paddingLeft: `calc(${depth} * var(--space-4))` }}>
          {node.children.length > 0 ? (
            <button type="button" className="proto-twisty" aria-label={open ? 'Replier' : 'Déplier'} onClick={() => toggle(node.key)}>
              {open ? <ChevronDown /> : <ChevronRight />}
            </button>
          ) : (
            <span className="proto-twisty" />
          )}
          <button type="button" className="proto-node-label" onClick={() => go(node.key)}>
            {node.reference && depth > 0 && <span className="code">{node.reference.replace(`${data.initiative.code}-`, '')}</span>}
            <span className="proto-node-title">{node.label}</span>
            {node.count !== undefined && <span className="proto-count">{node.count}</span>}
          </button>
        </div>
        {showSubs && (
          <ul className="proto-subs" role="group">
            {subs.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={s.id === currentSub ? 'is-selected' : undefined}
                  style={{ paddingLeft: `calc(${depth + 2} * var(--space-4))` }}
                  onClick={() => go(node.key, s.id)}
                >
                  {s.label}
                  {s.count !== undefined && <span className="proto-count">{s.count}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {open && node.children.length > 0 && <ul role="group">{node.children.map((c) => render(c, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <ul className="proto-tree" role="tree" aria-label="Arborescence de l'initiative">
      {render(root, 0)}
    </ul>
  );
}

// ── Écran de données ────────────────────────────────────────────────────────

function DataScreen({ data, url, go }: { data: ProtoData; url: UrlState; go: (node: NodeKey, sub?: string | null) => void }) {
  const screen = screenFor(data, url.node, go);
  const root = buildTree(data);
  let crumbs = pathTo(root, url.node).slice(0, -1);
  // Ticket fermé, absent de l'arbre : il se rattache au nœud Tickets.
  if (crumbs.length === 0 && url.node !== 'initiative') {
    crumbs = [root, ...(url.node.startsWith('ticket:') ? [root.children.find((c) => c.key === 'group:tickets')!] : [])];
  }
  const sub = url.sub ?? screen.initialSub ?? screen.subScreens[0]?.id ?? null;

  return (
    <main className={`proto-screen variant-${url.variant}`}>
      <nav className="proto-crumbs" aria-label="Fil d'Ariane">
        {crumbs.map((c) => (
          <span key={c.key}>
            <button type="button" onClick={() => go(c.key)}>
              {c.key === 'initiative' ? `${c.reference} · ${c.label}` : c.label}
            </button>
            <span aria-hidden="true"> › </span>
          </span>
        ))}
      </nav>
      <ScreenHeader screen={screen} />
      {url.variant === 'A' && <TabsBody screen={screen} sub={sub} onSub={(s) => go(url.node, s)} />}
      {url.variant === 'B' && <ContinuousBody screen={screen} sub={url.sub ?? screen.initialSub ?? null} />}
      {url.variant === 'C' && <SingleBody sub={screen.subScreens.find((s) => s.id === sub) ?? screen.subScreens[0]} />}
    </main>
  );
}

function ScreenHeader({ screen }: { screen: Screen }) {
  return (
    <header className="proto-head">
      <small className="muted">
        {screen.kindLabel} {screen.reference && <span className="code">{screen.reference}</span>}
      </small>
      <h1>{screen.title}</h1>
      {screen.badges.length > 0 && <div className="proto-badges">{screen.badges}</div>}
    </header>
  );
}

/** Variante A : onglets. */
function TabsBody({ screen, sub, onSub }: { screen: Screen; sub: string | null; onSub: (s: string) => void }) {
  const current = screen.subScreens.find((s) => s.id === sub) ?? screen.subScreens[0];
  return (
    <>
      {screen.subScreens.length > 1 && (
        <div className="tabs" role="tablist">
          {screen.subScreens.map((s) => (
            <button key={s.id} type="button" role="tab" aria-selected={s.id === current?.id} onClick={() => onSub(s.id)}>
              {s.label}
              {s.count !== undefined && <span className="proto-count">{s.count}</span>}
            </button>
          ))}
        </div>
      )}
      <section role="tabpanel" className="proto-body">
        {current?.render()}
      </section>
    </>
  );
}

/** Variante B : tout l'objet sur une page, sommaire fixe à droite. */
function ContinuousBody({ screen, sub }: { screen: Screen; sub: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(screen.subScreens[0]?.id);
  useEffect(() => {
    if (sub) document.getElementById(`sub-${sub}`)?.scrollIntoView({ block: 'start' });
  }, [sub]);
  useEffect(() => {
    const sections = ref.current?.querySelectorAll('section[data-sub]') ?? [];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive((visible.target as HTMLElement).dataset.sub);
      },
      { rootMargin: '0px 0px -70% 0px' },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [screen]);
  return (
    <div className="proto-continuous">
      <div ref={ref} className="proto-body">
        {screen.subScreens.map((s) => (
          <section key={s.id} id={`sub-${s.id}`} data-sub={s.id} className="proto-section">
            {screen.subScreens.length > 1 && (
              <h2>
                {s.label}
                {s.count !== undefined && <span className="proto-count">{s.count}</span>}
              </h2>
            )}
            {s.render()}
          </section>
        ))}
      </div>
      {screen.subScreens.length > 1 && (
        <nav className="proto-toc" aria-label="Sur cette fiche">
          <small className="muted">Sur cette fiche</small>
          {screen.subScreens.map((s) => (
            <a
              key={s.id}
              href={`#sub-${s.id}`}
              className={s.id === active ? 'is-active' : undefined}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(`sub-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              {s.label}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}

/** Variante C : un seul sous-écran, choisi dans l'arbre. */
function SingleBody({ sub }: { sub: SubScreen | undefined }) {
  return (
    <section className="proto-body">
      {sub && <h2 className="proto-subtitle">{sub.label}</h2>}
      {sub?.render()}
    </section>
  );
}
