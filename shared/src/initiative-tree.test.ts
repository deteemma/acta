import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInitiativeTree, type InitiativeTreeData, type InitiativeTreeNode, pathToNode, screenNodeKey } from './initiative-tree.js';
import type { TicketRow } from './tickets.js';
import type { TicketTypeDto } from './ticket-type-catalog.js';

const status = (code: string, closed: boolean) => ({ code, closed, tone: 'neutral', labels: { fr: code, en: code } });
const TYPES = [
  { code: 'action', statuses: [status('todo', false), status('done', true)] },
  { code: 'epic', statuses: [status('open', false), status('closed', true)] },
  { code: 'risk', statuses: [status('open', false), status('closed', true)] },
] as unknown as TicketTypeDto[];

const ticket = (id: string, type: string, statusCode: string, epic: string | null = null): TicketRow => ({
  id,
  type,
  reference: `CRM-${id}`,
  title: `Ticket ${id}`,
  status: statusCode,
  assignee: null,
  dueDate: null,
  epic: epic ? { id: epic, reference: `CRM-${epic}`, title: epic } : null,
  createdAt: '2026-11-01T00:00:00Z',
});

const EMPTY: InitiativeTreeData = {
  initiative: { code: 'CRM', name: 'Refonte CRM' },
  stakeholders: [],
  needs: [],
  requirements: [],
  scenarios: [],
  tickets: [],
  ticketTypes: TYPES,
  pages: [],
  memberCount: 1,
};

/** Clés et nombres, pour comparer l'arbre à un modèle écrit à la main. */
const shape = (node: InitiativeTreeNode): unknown => ({
  key: node.key,
  ...(node.reference !== null && { reference: node.reference }),
  ...(node.title !== null && { title: node.title }),
  ...(node.count !== null && { count: node.count }),
  ...(node.children.length > 0 && { children: node.children.map(shape) }),
});

test('la racine est l’initiative ; ses branches viennent dans l’ordre N5, chacune avec son nombre', () => {
  const tree = buildInitiativeTree(EMPTY);
  assert.equal(tree.key, 'initiative');
  assert.equal(tree.reference, 'CRM');
  assert.equal(tree.title, 'Refonte CRM');
  assert.deepEqual(
    tree.children.map((c) => [c.key, c.count]),
    [
      ['dashboard', null],
      ['branch:stakeholders', 0],
      ['branch:needs', 0],
      ['branch:requirements', 0],
      ['branch:tickets', 0],
      ['branch:pages', 0],
      ['team', 1],
    ],
  );
});

test('les exigences s’imbriquent sous leur parente, leurs scénarios sous elles dans leur ordre ; la référence est courte', () => {
  const tree = buildInitiativeTree({
    ...EMPTY,
    requirements: [
      { id: 'r1', reference: 'CRM-EX-001', title: 'Parente', parent: null },
      { id: 'r2', reference: 'CRM-EX-002', title: 'Fille', parent: { id: 'r1' } },
      // Parente absente de la liste : l'exigence reste visible, à la racine.
      { id: 'r3', reference: 'CRM-EX-003', title: 'Orpheline', parent: { id: 'disparue' } },
    ],
    scenarios: [
      { id: 's2', requirementId: 'r2', reference: 'CRM-SC-002', title: 'Deuxième' },
      { id: 's1', requirementId: 'r2', reference: 'CRM-SC-001', title: 'Premier' },
    ],
  });
  assert.deepEqual(shape(tree.children[3]!), {
    key: 'branch:requirements',
    count: 3,
    children: [
      {
        key: 'requirement:r1',
        reference: 'EX-001',
        title: 'Parente',
        children: [
          {
            key: 'requirement:r2',
            reference: 'EX-002',
            title: 'Fille',
            children: [
              { key: 'scenario:s2', reference: 'SC-002', title: 'Deuxième' },
              { key: 'scenario:s1', reference: 'SC-001', title: 'Premier' },
            ],
          },
        ],
      },
      { key: 'requirement:r3', reference: 'EX-003', title: 'Orpheline' },
    ],
  });
});

test('seuls les tickets ouverts figurent, par Epic puis « Sans Epic » ; un Epic fermé range ses tickets ouverts sous « Sans Epic »', () => {
  const tree = buildInitiativeTree({
    ...EMPTY,
    tickets: [
      ticket('t1', 'action', 'todo', 'e1'),
      ticket('t2', 'action', 'done', 'e1'),
      ticket('e1', 'epic', 'open'),
      ticket('e0', 'epic', 'closed'),
      ticket('t3', 'risk', 'open', 'e0'),
      ticket('t4', 'risk', 'open'),
    ],
  });
  assert.deepEqual(shape(tree.children[4]!), {
    key: 'branch:tickets',
    count: 4,
    children: [
      { key: 'ticket:e1', reference: 'e1', title: 'Ticket e1', children: [{ key: 'ticket:t1', reference: 't1', title: 'Ticket t1' }] },
      {
        key: 'noEpic',
        count: 2,
        children: [
          { key: 'ticket:t3', reference: 't3', title: 'Ticket t3' },
          { key: 'ticket:t4', reference: 't4', title: 'Ticket t4' },
        ],
      },
    ],
  });
});

test('les pages suivent leurs sous-pages, dans leur ordre de rangement', () => {
  const tree = buildInitiativeTree({
    ...EMPTY,
    pages: [
      { id: 'p2', reference: 'CRM-PA-002', title: 'Deux', parentId: null, position: 1 },
      { id: 'p1', reference: 'CRM-PA-001', title: 'Un', parentId: null, position: 0 },
      { id: 'p3', reference: 'CRM-PA-003', title: 'Sous-page', parentId: 'p1', position: 0 },
    ],
  });
  assert.deepEqual(shape(tree.children[5]!), {
    key: 'branch:pages',
    count: 3,
    children: [
      { key: 'page:p1', reference: 'PA-001', title: 'Un', children: [{ key: 'page:p3', reference: 'PA-003', title: 'Sous-page' }] },
      { key: 'page:p2', reference: 'PA-002', title: 'Deux' },
    ],
  });
});

test('parties prenantes et besoins, dans l’ordre reçu', () => {
  const tree = buildInitiativeTree({
    ...EMPTY,
    stakeholders: [{ id: 'sh1', name: 'Direction' }],
    needs: [{ id: 'n1', reference: 'CRM-BE-001', title: 'Suivre les clients' }],
  });
  assert.deepEqual(shape(tree.children[1]!), {
    key: 'branch:stakeholders',
    count: 1,
    children: [{ key: 'stakeholder:sh1', title: 'Direction' }],
  });
  assert.deepEqual(shape(tree.children[2]!), {
    key: 'branch:needs',
    count: 1,
    children: [{ key: 'need:n1', reference: 'BE-001', title: 'Suivre les clients' }],
  });
});

test('le chemin d’un nœud part de la racine : fil d’Ariane et dépliage ; vide pour un nœud absent (ticket fermé)', () => {
  const tree = buildInitiativeTree({
    ...EMPTY,
    requirements: [
      { id: 'r1', reference: 'CRM-EX-001', title: 'Parente', parent: null },
      { id: 'r2', reference: 'CRM-EX-002', title: 'Fille', parent: { id: 'r1' } },
    ],
  });
  assert.deepEqual(
    pathToNode(tree, 'requirement:r2').map((n) => n.key),
    ['initiative', 'branch:requirements', 'requirement:r1', 'requirement:r2'],
  );
  assert.deepEqual(pathToNode(tree, 'ticket:ferme'), []);
});

test('chaque écran d’une initiative désigne son nœud ; « Mes actions » n’en désigne aucun', () => {
  const initiativeId = 'i';
  assert.equal(screenNodeKey({ kind: 'myActions' }), null);
  assert.equal(screenNodeKey({ kind: 'initiative', initiativeId, tab: 'members' }), 'initiative');
  assert.equal(screenNodeKey({ kind: 'dashboard', initiativeId, tab: 'tasks' }), 'dashboard');
  assert.equal(screenNodeKey({ kind: 'team', initiativeId, tab: 'designations' }), 'team');
  assert.equal(screenNodeKey({ kind: 'stakeholders', initiativeId, tab: 'matrix' }), 'branch:stakeholders');
  assert.equal(screenNodeKey({ kind: 'tickets', initiativeId }), 'branch:tickets');
  assert.equal(screenNodeKey({ kind: 'pages', initiativeId, pageId: null }), 'branch:pages');
  assert.equal(screenNodeKey({ kind: 'pages', initiativeId, pageId: 'p1' }), 'page:p1');
  assert.equal(screenNodeKey({ kind: 'stakeholder', initiativeId, stakeholderId: 's1', tab: 'origin' }), 'stakeholder:s1');
  assert.equal(screenNodeKey({ kind: 'need', initiativeId, needId: 'n1', tab: 'links' }), 'need:n1');
  // Un scénario : son nœud, sous son exigence, est celui de l'écran (N16).
  assert.equal(screenNodeKey({ kind: 'requirement', initiativeId, requirementId: 'r1', tab: 'history' }), 'requirement:r1');
  assert.equal(screenNodeKey({ kind: 'scenario', initiativeId, requirementId: 'r1', scenarioId: 'sc1' }), 'scenario:sc1');
  // Un ticket fermé n'est pas dans l'arbre : son nœud n'y sera pas trouvé (N8).
  assert.equal(screenNodeKey({ kind: 'ticket', initiativeId, ticketId: 't1', tab: 'comments' }), 'ticket:t1');
});
