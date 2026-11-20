// PROTOTYPE jetable : contenu de l'écran de données, découpé en sous-écrans.
// Chaque variante décide seulement de la façon de présenter ces sous-écrans.
import { type ReactNode, useEffect, useState } from 'react';
import { api } from '../api';
import { PageContent } from '../page-content';
import { RichText } from '../rich-text';
import {
  isFunctional,
  memberName,
  type NodeKey,
  type ProtoData,
  REQUIREMENT_TYPE_LABEL,
  requirementStatusLabel,
  ticketStatus,
  ticketTypeLabel,
} from './data';

export interface SubScreen {
  id: string;
  label: string;
  count?: number;
  render: () => ReactNode;
}

export interface Screen {
  kindLabel: string;
  reference?: string;
  title: string;
  badges: ReactNode[];
  subScreens: SubScreen[];
  /** Sous-écran à ouvrir d'office (scénario choisi dans l'arbre). */
  initialSub?: string;
  highlight?: string;
}

type Go = (key: NodeKey) => void;

function useLoad<T>(deps: string, load: () => Promise<T>): T | null | 'error' {
  const [value, setValue] = useState<T | null | 'error'>(null);
  // L'écran est remonté à chaque changement de nœud : pas de remise à zéro ici.
  useEffect(() => {
    load().then(setValue, () => setValue('error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps]);
  return value;
}

function Loading<T>({ value, children }: { value: T | null | 'error'; children: (v: T) => ReactNode }) {
  if (value === null) return <p className="muted">Chargement…</p>;
  if (value === 'error') return <p className="muted">Indisponible dans le prototype.</p>;
  return <>{children(value)}</>;
}

const Badge = ({ tone = 'neutral', status, children }: { tone?: string; status?: boolean; children: ReactNode }) => (
  <span className={`badge tone-${tone}${status ? ' status' : ''}`}>{children}</span>
);

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="proto-field">
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>
);

const date = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

function RefLink({ go, nodeKey, reference, title }: { go: Go; nodeKey: NodeKey; reference: string; title: string }) {
  return (
    <button type="button" className="proto-reflink" onClick={() => go(nodeKey)}>
      <span className="code">{reference}</span> {title}
    </button>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="muted">{children}</p>;
}

// ── Liens d'un objet (tickets, besoins, exigences, pages) ─────────────────

function LinksOf({ data, go, kind, id }: { data: ProtoData; go: Go; kind: 'ticket' | 'need' | 'requirement' | 'page'; id: string }) {
  const ticketIds = new Set<string>();
  const pageIds = new Set<string>();
  const needIds = new Set<string>();
  const reqIds = new Set<string>();
  const { links } = data;
  if (kind === 'ticket') {
    for (const l of links.ticketLinks as unknown as { ticketId: string; otherTicketId: string }[])
      if (l.ticketId === id) ticketIds.add(l.otherTicketId);
    for (const l of links.needLinks) if (l.ticketId === id) needIds.add(l.needId);
    for (const l of links.requirementLinks) if (l.ticketId === id) reqIds.add(l.requirementId);
  }
  if (kind === 'need') for (const l of links.needLinks) if (l.needId === id) ticketIds.add(l.ticketId);
  if (kind === 'requirement') for (const l of links.requirementLinks) if (l.requirementId === id) ticketIds.add(l.ticketId);
  for (const l of links.pageLinks as unknown as { pageId: string; kind: string; objectId: string }[]) {
    if (kind === 'page' && l.pageId === id) {
      if (l.kind === 'ticket') ticketIds.add(l.objectId);
      if (l.kind === 'need') needIds.add(l.objectId);
      if (l.kind === 'requirement') reqIds.add(l.objectId);
    } else if (l.objectId === id && l.kind === kind) pageIds.add(l.pageId);
  }
  const rows = [
    ...data.tickets.filter((t) => ticketIds.has(t.id)).map((t) => ({ key: `ticket:${t.id}`, ...t })),
    ...data.needs.filter((n) => needIds.has(n.id)).map((n) => ({ key: `need:${n.id}`, ...n })),
    ...data.requirements.filter((r) => reqIds.has(r.id)).map((r) => ({ key: `requirement:${r.id}`, ...r })),
    ...data.pages.filter((p) => pageIds.has(p.id)).map((p) => ({ key: `page:${p.id}`, ...p })),
  ];
  return (
    <>
      <div className="proto-toolbar">
        <button type="button">+ Lier un ticket</button>
        <button type="button">+ Lier une page</button>
      </div>
      {rows.length === 0 ? (
        <Empty>Aucun lien.</Empty>
      ) : (
        <ul className="proto-rows">
          {rows.map((r) => (
            <li key={r.key}>
              <RefLink go={go} nodeKey={r.key} reference={r.reference} title={r.title} />
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">Un lien apparaît des deux côtés et empêche la suppression des deux objets.</p>
    </>
  );
}

function Comments({ load }: { load: () => Promise<{ id: string; body: string | null; author: { displayName: string | null; email: string | null }; createdAt: string }[]> }) {
  const comments = useLoad(String(load), load);
  return (
    <Loading value={comments}>
      {(list) => (
        <>
          {list.length === 0 && <Empty>Aucun commentaire.</Empty>}
          <ul className="proto-rows">
            {list.map((c) => (
              <li key={c.id}>
                <small className="muted">
                  {memberName(c.author)} · {date(c.createdAt)}
                </small>
                {c.body ? <RichText source={c.body} /> : <em className="muted">Commentaire supprimé</em>}
              </li>
            ))}
          </ul>
          <textarea placeholder="Votre commentaire" rows={3} />
          <button type="button" className="primary">
            Commenter
          </button>
        </>
      )}
    </Loading>
  );
}

function History({ load }: { load: () => Promise<{ changedAt: string; changedBy: { displayName: string | null; email: string | null } }[]> }) {
  const entries = useLoad(String(load), load);
  return (
    <Loading value={entries}>
      {(list) =>
        list.length === 0 ? (
          <Empty>Aucune modification.</Empty>
        ) : (
          <ol className="proto-timeline">
            {list.map((e, i) => (
              <li key={i}>
                Modifiée le {date(e.changedAt)} par {memberName(e.changedBy)}
              </li>
            ))}
          </ol>
        )
      }
    </Loading>
  );
}

// ── Écrans ──────────────────────────────────────────────────────────────────

export function screenFor(data: ProtoData, key: NodeKey, go: Go): Screen {
  const [kind, id = ''] = key.split(':') as [string, string?];
  const iid = data.initiative.id;

  switch (kind) {
    case 'initiative':
      return initiativeScreen(data, go);
    case 'dashboard':
      return {
        kindLabel: 'Initiative',
        title: 'Tableau de bord',
        badges: [],
        subScreens: [
          {
            id: 'board',
            label: 'Tâches BABOK',
            render: () => <Empty>Le tableau de bord actuel (actions par domaine et par tâche) s'afficherait ici, en pleine largeur.</Empty>,
          },
          { id: 'suggest', label: 'Actions suggérées', render: () => <Empty>Les actions suggérées R1 à R15.</Empty> },
        ],
      };
    case 'team':
      return {
        kindLabel: 'Initiative',
        title: 'Équipe',
        badges: [],
        subScreens: teamSubScreens(data),
      };
    case 'group':
      return groupScreen(data, id, go);
    case 'stakeholder': {
      const s = data.stakeholders.find((x) => x.id === id);
      if (!s) break;
      const needs = data.needs.filter((n) => n.stakeholders.some((x) => x.id === id));
      const reqs = data.requirements.filter((r) => r.stakeholders.some((x) => x.id === id));
      return {
        kindLabel: 'Partie prenante',
        title: s.name,
        badges: s.roles.map((r) => <Badge key={r}>{r}</Badge>),
        subScreens: [
          {
            id: 'sheet',
            label: 'Fiche',
            render: () => (
              <dl className="proto-fields">
                <Field label="Nature">{s.kind}</Field>
                <Field label="Influence">{s.influence ?? '—'}</Field>
                <Field label="Intérêt">{s.interest ?? '—'}</Field>
                <Field label="Contact">{s.contact ?? '—'}</Field>
                <Field label="Compte relié">{s.user ? memberName(s.user) : '—'}</Field>
                <Field label="Notes">{s.notes ? <RichText source={s.notes} /> : '—'}</Field>
              </dl>
            ),
          },
          {
            id: 'origin',
            label: 'À l’origine de',
            count: needs.length + reqs.length,
            render: () => (
              <ul className="proto-rows">
                {needs.map((n) => (
                  <li key={n.id}>
                    <RefLink go={go} nodeKey={`need:${n.id}`} reference={n.reference} title={n.title} />
                  </li>
                ))}
                {reqs.map((r) => (
                  <li key={r.id}>
                    <RefLink go={go} nodeKey={`requirement:${r.id}`} reference={r.reference} title={r.title} />
                  </li>
                ))}
                {needs.length + reqs.length === 0 && <Empty>Aucun besoin ni exigence.</Empty>}
              </ul>
            ),
          },
        ],
      };
    }
    case 'need': {
      const n = data.needs.find((x) => x.id === id);
      if (!n) break;
      const reqs = data.requirements.filter((r) => r.needs.some((x) => x.id === id));
      return {
        kindLabel: 'Besoin',
        reference: n.reference,
        title: n.title,
        badges: [<Badge key="nature">{n.nature === 'problem' ? 'Problème' : 'Opportunité'}</Badge>],
        subScreens: [
          {
            id: 'sheet',
            label: 'Fiche',
            render: () => (
              <dl className="proto-fields">
                <Field label="Description">{n.description ? <RichText source={n.description} /> : '—'}</Field>
                <Field label="Parties prenantes à l'origine">{n.stakeholders.map((s) => s.name).join(', ') || '—'}</Field>
                <Field label="Modifié">
                  {date(n.updatedAt)} par {memberName(n.updatedBy)}
                </Field>
              </dl>
            ),
          },
          {
            id: 'requirements',
            label: 'Exigences',
            count: reqs.length,
            render: () => (
              <ul className="proto-rows">
                {reqs.map((r) => (
                  <li key={r.id}>
                    <RefLink go={go} nodeKey={`requirement:${r.id}`} reference={r.reference} title={r.title} />
                  </li>
                ))}
                {reqs.length === 0 && <Empty>Aucune exigence ne répond à ce besoin.</Empty>}
              </ul>
            ),
          },
          { id: 'links', label: 'Liens', render: () => <LinksOf data={data} go={go} kind="need" id={id} /> },
        ],
      };
    }
    case 'scenario': {
      const reqId = [...data.scenarios].find(([, list]) => list.some((s) => s.id === id))?.[0];
      if (!reqId) break;
      return { ...requirementScreen(data, reqId, go, id), initialSub: 'scenarios', highlight: id };
    }
    case 'requirement':
      if (!data.requirements.some((r) => r.id === id)) break;
      return requirementScreen(data, id, go);
    case 'ticket': {
      const t = data.tickets.find((x) => x.id === id);
      if (!t) break;
      const st = ticketStatus(data, t);
      const children = data.tickets.filter((x) => x.epic?.id === id);
      return {
        kindLabel: ticketTypeLabel(data, t.type),
        reference: t.reference,
        title: t.title,
        badges: [
          <Badge key="s" tone={st.tone} status>
            {st.label}
          </Badge>,
        ],
        subScreens: [
          { id: 'sheet', label: 'Fiche', render: () => <TicketSheet data={data} id={id} type={t.type} /> },
          ...(t.type === 'epic'
            ? [
                {
                  id: 'children',
                  label: 'Tickets de l’Epic',
                  count: children.length,
                  render: () => <TicketTable data={data} go={go} tickets={children} />,
                },
              ]
            : []),
          { id: 'links', label: 'Liens', render: () => <LinksOf data={data} go={go} kind="ticket" id={id} /> },
          { id: 'comments', label: 'Commentaires', render: () => <Comments load={() => api.listTicketComments(iid, id)} /> },
          {
            id: 'history',
            label: 'Historique',
            render: () => (
              <History
                load={() =>
                  (t.type === 'action' ? api.actionHistory(iid, id) : api.ticketHistory(iid, id)) as unknown as Promise<
                    { changedAt: string; changedBy: { displayName: string | null; email: string | null } }[]
                  >
                }
              />
            ),
          },
        ],
      };
    }
    case 'page': {
      const p = data.pages.find((x) => x.id === id);
      if (!p) break;
      return {
        kindLabel: 'Page',
        reference: p.reference,
        title: p.title,
        badges: [],
        subScreens: [
          { id: 'content', label: 'Contenu', render: () => <PageBody data={data} id={id} /> },
          { id: 'links', label: 'Liens', render: () => <LinksOf data={data} go={go} kind="page" id={id} /> },
          { id: 'comments', label: 'Commentaires', render: () => <Comments load={() => api.listPageComments(iid, id)} /> },
          { id: 'attachments', label: 'Pièces jointes', render: () => <Empty>Les pièces jointes de la page.</Empty> },
          { id: 'history', label: 'Historique', render: () => <Empty>Enregistrements et versions de la page.</Empty> },
        ],
      };
    }
  }
  return { kindLabel: '', title: 'Élément introuvable', badges: [], subScreens: [] };
}

function initiativeScreen(data: ProtoData, go: Go): Screen {
  const i = data.initiative;
  const openTickets = data.tickets.filter((t) => !ticketStatus(data, t).closed);
  const counts: [string, NodeKey, number][] = [
    ['Parties prenantes', 'group:stakeholders', data.stakeholders.length],
    ['Besoins', 'group:needs', data.needs.length],
    ['Exigences', 'group:requirements', data.requirements.length],
    ['Tickets ouverts', 'group:tickets', openTickets.length],
    ['Pages', 'group:pages', data.pages.length],
  ];
  return {
    kindLabel: 'Initiative',
    reference: i.code,
    title: i.name,
    badges: [<Badge key="role">Mon rôle : {i.myRole}</Badge>, ...(i.archivedAt ? [<Badge key="a">Archivée</Badge>] : [])],
    subScreens: [
      {
        id: 'overview',
        label: 'Aperçu',
        render: () => (
          <>
            <div className="proto-cards">
              {counts.map(([label, key, n]) => (
                <button key={key} type="button" className="proto-card" onClick={() => go(key)}>
                  <strong>{n}</strong>
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <dl className="proto-fields">
              <Field label="Description">{i.description ?? '—'}</Field>
              <Field label="Approche d'analyse">{i.analysisApproach ?? 'Non renseignée'}</Field>
              <Field label="Début">{date(i.startDate)}</Field>
              <Field label="Fin prévue">{date(i.plannedEndDate)}</Field>
            </dl>
          </>
        ),
      },
      ...teamSubScreens(data),
      {
        id: 'settings',
        label: 'Paramètres',
        render: () => (
          <>
            <dl className="proto-fields">
              <Field label="Code">
                <span className="code">{i.code}</span> {i.codeFrozen && <small className="muted">(figé)</small>}
              </Field>
            </dl>
            <div className="proto-toolbar">
              <button type="button">Archiver</button>
              <button type="button" className="danger">
                Supprimer l'initiative
              </button>
            </div>
          </>
        ),
      },
    ],
  };
}

function teamSubScreens(data: ProtoData): SubScreen[] {
  return [
    {
      id: 'members',
      label: 'Membres',
      count: data.members.length,
      render: () => (
        <>
          <table className="proto-table">
            <thead>
              <tr>
                <th>Membre</th>
                <th>Rôle</th>
                <th>BA de l'équipe</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.userId}>
                  <td>
                    {memberName(m)} {m.isMe && <small className="muted">(vous)</small>}
                  </td>
                  <td>{m.role}</td>
                  <td>{m.isTeamBa ? 'Oui' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="proto-toolbar">
            <button type="button" className="primary">
              Inviter un membre
            </button>
          </div>
        </>
      ),
    },
    { id: 'designations', label: 'Désignations', render: () => <Empty>Désignations de propriétaire.</Empty> },
  ];
}

function requirementScreen(data: ProtoData, id: string, go: Go, highlight?: string): Screen {
  const r = data.requirements.find((x) => x.id === id)!;
  const iid = data.initiative.id;
  const scenarios = data.scenarios.get(id) ?? [];
  const background = data.features.get(id)?.background;
  const children = data.requirements.filter((x) => x.parent?.id === id);
  return {
    kindLabel: 'Exigence',
    reference: r.reference,
    title: r.title,
    badges: [
      <Badge key="s" status>
        {requirementStatusLabel(data, r.status)}
      </Badge>,
      <Badge key="t">
        {REQUIREMENT_TYPE_LABEL[r.type]}
        {r.subtype ? ` (${r.subtype === 'functional' ? 'Fonctionnelle' : 'Non fonctionnelle'})` : ''}
      </Badge>,
    ],
    subScreens: [
      {
        id: 'sheet',
        label: 'Fiche',
        render: () => (
          <dl className="proto-fields">
            <Field label="Énoncé">
              <RichText source={r.statement} />
            </Field>
            <Field label="Sources">{r.stakeholders.map((s) => s.name).join(', ') || '—'}</Field>
            <Field label="Modifiée">
              {date(r.updatedAt)} par {memberName(r.updatedBy)}
            </Field>
          </dl>
        ),
      },
      ...(isFunctional(r)
        ? [
            {
              id: 'scenarios',
              label: 'Scénarios',
              count: scenarios.length,
              render: () => <Scenarios scenarios={scenarios} background={background?.text ?? null} highlight={highlight} />,
            },
          ]
        : []),
      {
        id: 'trace',
        label: 'Traçabilité',
        render: () => (
          <dl className="proto-fields">
            <Field label="Besoins">
              {r.needs.map((n) => (
                <div key={n.id}>
                  <RefLink go={go} nodeKey={`need:${n.id}`} reference={n.reference} title={n.title} />
                </div>
              ))}
              {r.needs.length === 0 && '—'}
            </Field>
            <Field label="Exigence parente">
              {r.parent ? <RefLink go={go} nodeKey={`requirement:${r.parent.id}`} reference={r.parent.reference} title={r.parent.title} /> : 'Aucune'}
            </Field>
            <Field label="Exigences dérivées">
              {children.map((c) => (
                <div key={c.id}>
                  <RefLink go={go} nodeKey={`requirement:${c.id}`} reference={c.reference} title={c.title} />
                </div>
              ))}
              {children.length === 0 && '—'}
            </Field>
          </dl>
        ),
      },
      { id: 'links', label: 'Liens', render: () => <LinksOf data={data} go={go} kind="requirement" id={id} /> },
      {
        id: 'history',
        label: 'Historique',
        render: () => <History load={() => api.requirementHistory(iid, id)} />,
      },
    ],
  };
}

export function Scenarios({ scenarios, background, highlight }: { scenarios: { id: string; reference: string; title: string; text: string }[]; background: string | null; highlight?: string }) {
  return (
    <>
      <div className="proto-toolbar">
        <button type="button">Exporter (.feature)</button>
        <button type="button">+ Ajouter un scénario</button>
      </div>
      <section className="proto-gherkin">
        <h4>Contexte</h4>
        {background ? <pre>{background}</pre> : <Empty>Aucun contexte.</Empty>}
      </section>
      {scenarios.map((s) => (
        <section key={s.id} className={`proto-gherkin${s.id === highlight ? ' is-highlighted' : ''}`} id={`scenario-${s.id}`}>
          <h4>
            <span className="code">{s.reference}</span> {s.title}
            <span className="proto-actions">
              <button type="button">Modifier</button>
              <button type="button">Historique</button>
            </span>
          </h4>
          {s.text ? <pre>{s.text}</pre> : <Empty>Texte vide.</Empty>}
        </section>
      ))}
    </>
  );
}

function TicketSheet({ data, id, type }: { data: ProtoData; id: string; type: string }) {
  const iid = data.initiative.id;
  const ticket = useLoad<{
    assignee: Parameters<typeof memberName>[0];
    dueDate: string | null;
    epic: { reference: string; title: string } | null;
    description: string | null;
    taskId?: string;
  }>(id, () => (type === 'action' ? api.getAction(iid, id) : api.getTicket(iid, id)));
  return (
    <Loading value={ticket}>
      {(t) => (
        <>
          <div className="proto-toolbar">
            <button type="button" className="primary">
              Modifier
            </button>
          </div>
          <dl className="proto-fields">
            <Field label="Responsable">{memberName(t.assignee)}</Field>
            <Field label="Échéance">{t.dueDate ? date(t.dueDate) : 'Sans échéance'}</Field>
            <Field label="Epic">{t.epic ? `${t.epic.reference} ${t.epic.title}` : 'Sans Epic'}</Field>
            {t.taskId && <Field label="Tâche BABOK">{t.taskId}</Field>}
            <Field label="Description">{t.description ? <RichText source={t.description} /> : '—'}</Field>
          </dl>
        </>
      )}
    </Loading>
  );
}

function PageBody({ data, id }: { data: ProtoData; id: string }) {
  const page = useLoad(id, () => api.getPage(data.initiative.id, id));
  return (
    <Loading value={page}>
      {(p) => (
        <>
          <div className="proto-toolbar">
            <button type="button" className="primary">
              Modifier
            </button>
            <button type="button">+ Sous-page</button>
          </div>
          {p.content ? <PageContent doc={p.content} /> : <Empty>Page vide.</Empty>}
        </>
      )}
    </Loading>
  );
}

export function TicketTable({ data, go, tickets }: { data: ProtoData; go: Go; tickets: ProtoData['tickets'] }) {
  return (
    <table className="proto-table">
      <thead>
        <tr>
          <th>Référence</th>
          <th>Type</th>
          <th>Titre</th>
          <th>Statut</th>
          <th>Responsable</th>
          <th>Échéance</th>
        </tr>
      </thead>
      <tbody>
        {tickets.map((t) => {
          const st = ticketStatus(data, t);
          return (
            <tr key={t.id} onClick={() => go(`ticket:${t.id}`)}>
              <td className="code">{t.reference}</td>
              <td>{ticketTypeLabel(data, t.type)}</td>
              <td>{t.title}</td>
              <td>
                <Badge tone={st.tone} status>
                  {st.label}
                </Badge>
              </td>
              <td>{memberName(t.assignee)}</td>
              <td>{t.dueDate ? date(t.dueDate) : 'Sans échéance'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TicketsList({ data, go }: { data: ProtoData; go: Go }) {
  const [state, setState] = useState<'open' | 'closed' | 'all'>('open');
  const [query, setQuery] = useState('');
  const shown = data.tickets.filter((t) => {
    const closed = ticketStatus(data, t).closed;
    const okState = state === 'all' || (state === 'closed') === closed;
    const q = query.trim().toLowerCase();
    return okState && (!q || t.title.toLowerCase().includes(q) || t.reference.toLowerCase().includes(q));
  });
  return (
    <>
      <div className="proto-toolbar">
        <input placeholder="Chercher un titre ou une référence" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={state} onChange={(e) => setState(e.target.value as typeof state)} aria-label="État">
          <option value="open">Ouverts</option>
          <option value="closed">Fermés</option>
          <option value="all">Ouverts et fermés</option>
        </select>
        <button type="button" className="primary">
          + Nouveau ticket
        </button>
      </div>
      <p className="muted small">Tickets affichés : {shown.length}. Les tickets fermés ne figurent pas dans l'arborescence : ils se retrouvent ici.</p>
      <TicketTable data={data} go={go} tickets={shown} />
    </>
  );
}

function groupScreen(data: ProtoData, group: string, go: Go): Screen {
  const simple = (title: string, rows: { key: NodeKey; reference?: string; title: string; extra?: ReactNode }[], create: string): Screen => ({
    kindLabel: data.initiative.name,
    title,
    badges: [],
    subScreens: [
      {
        id: 'list',
        label: 'Liste',
        count: rows.length,
        render: () => (
          <>
            <div className="proto-toolbar">
              <button type="button" className="primary">
                {create}
              </button>
            </div>
            <ul className="proto-rows">
              {rows.map((r) => (
                <li key={r.key}>
                  <RefLink go={go} nodeKey={r.key} reference={r.reference ?? ''} title={r.title} /> {r.extra}
                </li>
              ))}
              {rows.length === 0 && <Empty>Aucun élément.</Empty>}
            </ul>
          </>
        ),
      },
    ],
  });
  switch (group) {
    case 'stakeholders':
      return {
        ...simple('Parties prenantes', data.stakeholders.map((s) => ({ key: `stakeholder:${s.id}`, title: s.name })), '+ Nouvelle partie prenante'),
        subScreens: [
          ...simple('', data.stakeholders.map((s) => ({ key: `stakeholder:${s.id}`, title: s.name })), '+ Nouvelle partie prenante').subScreens,
          { id: 'matrix', label: 'Matrice influence × intérêt', render: () => <Empty>La matrice actuelle, en pleine largeur.</Empty> },
        ],
      };
    case 'needs':
      return simple('Besoins', data.needs.map((n) => ({ key: `need:${n.id}`, reference: n.reference, title: n.title })), '+ Nouveau besoin');
    case 'requirements':
      return simple(
        'Exigences',
        data.requirements.map((r) => ({ key: `requirement:${r.id}`, reference: r.reference, title: r.title })),
        '+ Nouvelle exigence',
      );
    case 'pages':
      return simple('Pages', data.pages.map((p) => ({ key: `page:${p.id}`, reference: p.reference, title: p.title })), '+ Nouvelle page');
    case 'noEpic': {
      const rows = data.tickets.filter((t) => t.type !== 'epic' && !t.epic && !ticketStatus(data, t).closed);
      return {
        kindLabel: 'Tickets',
        title: 'Sans Epic',
        badges: [],
        subScreens: [{ id: 'list', label: 'Liste', count: rows.length, render: () => <TicketTable data={data} go={go} tickets={rows} /> }],
      };
    }
    case 'tickets':
    default:
      return {
        kindLabel: data.initiative.name,
        title: 'Tickets',
        badges: [],
        subScreens: [{ id: 'list', label: 'Liste', count: data.tickets.length, render: () => <TicketsList data={data} go={go} /> }],
      };
  }
}
