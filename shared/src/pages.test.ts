import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkPageDelete,
  checkPageMove,
  createPageSchema,
  dropPlacement,
  flattenPageTree,
  keyboardPlacement,
  movePage,
  nextPagePosition,
  pageTextLength,
  updatePageSchema,
} from './pages.js';

const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const doc = (...content: object[]) => ({ type: 'doc', content: content as never[] });

test('une page porte un titre obligatoire de 200 caractères au plus ; deux pages peuvent avoir le même', () => {
  assert.equal(createPageSchema.safeParse({ title: 'Budget' }).success, true);
  assert.equal(createPageSchema.safeParse({ title: '  ' }).success, false);
  assert.equal(createPageSchema.safeParse({ title: 'x'.repeat(200) }).success, true);
  assert.equal(createPageSchema.safeParse({ title: 'x'.repeat(201) }).success, false);
  assert.equal(updatePageSchema.safeParse({ title: '' }).success, false);
});

test('le contenu est facultatif ; la page se crée au premier niveau ou sous une page parente', () => {
  const parentId = '7a6b5c4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d';
  assert.deepEqual(createPageSchema.parse({ title: 'Budget' }), { title: 'Budget', content: null, parentId: null });
  assert.equal(createPageSchema.parse({ title: 'Budget', parentId }).parentId, parentId);
  assert.equal(createPageSchema.safeParse({ title: 'Budget', parentId: 'pas-un-id' }).success, false);
});

test('la longueur se compte sur le texte, pas sur le JSON ni la mise en forme', () => {
  const content = doc(
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Titre', marks: [{ type: 'bold' }] }] },
    paragraph('été'),
    { type: 'paragraph' },
  );
  assert.equal(pageTextLength(content), 8);
  // Un caractère hors du plan de base compte pour un.
  assert.equal(pageTextLength(doc(paragraph('😀'))), 1);
});

test('200 000 caractères de texte au plus', () => {
  const half = 'x'.repeat(100_000);
  assert.equal(createPageSchema.safeParse({ title: 'T', content: doc(paragraph(half), paragraph(half)) }).success, true);
  assert.equal(createPageSchema.safeParse({ title: 'T', content: doc(paragraph(half), paragraph(`${half}x`)) }).success, false);
});

test('le contenu n’admet que la mise en forme prévue : titres de trois niveaux, gras, italique, lien, listes, tableau', () => {
  const ok = doc(
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'T' }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph('a')] }] },
    { type: 'orderedList', attrs: { start: 1 }, content: [{ type: 'listItem', content: [paragraph('b')] }] },
    {
      type: 'table',
      content: [
        { type: 'tableRow', content: [{ type: 'tableHeader', content: [paragraph('h')] }] },
        { type: 'tableRow', content: [{ type: 'tableCell', content: [paragraph('c')] }] },
      ],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'lien', marks: [{ type: 'link', attrs: { href: 'https://exemple.test' } }, { type: 'italic' }] },
        { type: 'hardBreak' },
      ],
    },
  );
  assert.equal(createPageSchema.safeParse({ title: 'T', content: ok }).success, true);
  const refused = [
    doc({ type: 'heading', attrs: { level: 4 }, content: [{ type: 'text', text: 'T' }] }),
    doc({ type: 'codeBlock', content: [{ type: 'text', text: 'x' }] }),
    doc({ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'strike' }] }] }),
    doc({ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }),
    doc({ type: 'paragraph', content: [{ type: 'text', text: '' }] }),
    { type: 'paragraph', content: [] },
  ];
  for (const content of refused) {
    assert.equal(createPageSchema.safeParse({ title: 'T', content }).success, false, JSON.stringify(content));
  }
});

test('le texte saisi est gardé tel quel : ni titre, ni liste, ni entité HTML (essais de fidélité, ADR-0019)', () => {
  const content = doc(paragraph('# Budget 2027'), paragraph('2026. Une année'), paragraph('a < b & c'));
  assert.deepEqual(createPageSchema.parse({ title: 'T', content }).content, content);
});

// Arborescence d'exemple :
// A
//   A1
//     A1a
//   A2
// B
const row = (id: string, parentId: string | null, position: number) => ({ id, reference: `X-PA-${id}`, title: id, parentId, position });
const tree = [row('B', null, 1), row('A2', 'A', 1), row('A', null, 0), row('A1a', 'A1', 0), row('A1', 'A', 0)];
const order = (rows: readonly { id: string; parentId: string | null; position: number }[]) =>
  flattenPageTree(rows).map((n) => `${'  '.repeat(n.depth)}${n.page.id}`);

test('l’arborescence suit l’ordre libre des pages sœurs, sur une profondeur illimitée', () => {
  assert.deepEqual(order(tree), ['A', '  A1', '    A1a', '  A2', 'B']);
  const node = flattenPageTree(tree).find((n) => n.page.id === 'A1')!;
  assert.deepEqual([node.hasChildren, node.depth], [true, 1]);
});

test('une page se déplace avec ses sous-pages, n’importe où sauf sous elle-même ou l’une de ses sous-pages', () => {
  assert.equal(checkPageMove(tree, 'A', 'A'), 'pageUnderItself');
  assert.equal(checkPageMove(tree, 'A', 'A1a'), 'pageUnderItself');
  assert.equal(checkPageMove(tree, 'A', 'inconnue'), 'unknownPage');
  assert.equal(checkPageMove(tree, 'A1', 'B'), null);
  assert.equal(checkPageMove(tree, 'A1', null), null);
  assert.deepEqual(order(movePage(tree, 'A1', { parentId: 'B', index: 0 })), ['A', '  A2', 'B', '  A1', '    A1a']);
});

test('déplacer place la page au rang demandé parmi ses nouvelles sœurs', () => {
  assert.deepEqual(order(movePage(tree, 'B', { parentId: null, index: 0 })), ['B', 'A', '  A1', '    A1a', '  A2']);
  assert.deepEqual(order(movePage(tree, 'A1', { parentId: 'A', index: 1 })), ['A', '  A2', '  A1', '    A1a', 'B']);
  // Rang au-delà de la fin : en dernier.
  assert.deepEqual(order(movePage(tree, 'A2', { parentId: null, index: 9 })), ['A', '  A1', '    A1a', 'B', 'A2']);
});

test('glisser sur le haut d’une ligne place avant elle ; sur le reste, en dernière sous-page', () => {
  assert.deepEqual(dropPlacement(tree, 'B', 'A2', 'before'), { parentId: 'A', index: 1 });
  assert.deepEqual(dropPlacement(tree, 'A2', 'B', 'before'), { parentId: null, index: 1 });
  assert.deepEqual(dropPlacement(tree, 'B', 'A', 'inside'), { parentId: 'A', index: 2 });
  assert.equal(dropPlacement(tree, 'A', 'A1a', 'inside'), null);
  assert.equal(dropPlacement(tree, 'A', 'A', 'before'), null);
  // Sans effet : déjà à cette place.
  assert.equal(dropPlacement(tree, 'A', 'B', 'before'), null);
});

test('au clavier : monter, descendre, passer sous la page sœur précédente, remonter d’un niveau', () => {
  assert.deepEqual(keyboardPlacement(tree, 'A2', 'up'), { parentId: 'A', index: 0 });
  assert.deepEqual(keyboardPlacement(tree, 'A', 'down'), { parentId: null, index: 1 });
  assert.deepEqual(keyboardPlacement(tree, 'A2', 'indent'), { parentId: 'A1', index: 1 });
  assert.deepEqual(keyboardPlacement(tree, 'A1', 'outdent'), { parentId: null, index: 1 });
  // Rien à faire : première, dernière, sans sœur précédente, déjà au premier niveau.
  assert.equal(keyboardPlacement(tree, 'A', 'up'), null);
  assert.equal(keyboardPlacement(tree, 'B', 'down'), null);
  assert.equal(keyboardPlacement(tree, 'A1', 'indent'), null);
  assert.equal(keyboardPlacement(tree, 'B', 'outdent'), null);
});

test('une nouvelle page se place en dernier parmi ses sœurs', () => {
  assert.equal(nextPagePosition(tree, 'A'), 2);
  assert.equal(nextPagePosition(tree, null), 2);
  assert.equal(nextPagePosition(tree, 'A1a'), 0);
});

test('un document vide, tel que l’éditeur l’écrit, est enregistré sans contenu', () => {
  for (const content of [doc({ type: 'paragraph' }), doc(), { type: 'doc' }]) {
    assert.equal(createPageSchema.parse({ title: 'T', content }).content, null, JSON.stringify(content));
    assert.equal(updatePageSchema.parse({ content }).content, null);
  }
  assert.notEqual(createPageSchema.parse({ title: 'T', content: doc(paragraph('x')) }).content, null);
  // Un tableau vide reste du contenu.
  const table = doc({ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph' }] }] }] });
  assert.notEqual(createPageSchema.parse({ title: 'T', content: table }).content, null);
});

test('une page qui a des sous-pages ne se supprime pas', () => {
  assert.equal(checkPageDelete(tree, 'A1'), 'pageHasSubpages');
  assert.equal(checkPageDelete(tree, 'A1a'), null);
});
