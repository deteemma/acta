import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyFormat, parseRichText, splitReferences } from './rich-text.js';

const t = (text: string) => ({ type: 'text', text });

test('texte simple : paragraphes séparés par une ligne vide, retours à la ligne gardés', () => {
  assert.deepEqual(parseRichText('Ligne 1\nLigne 2\n\nAutre paragraphe'), [
    { type: 'paragraph', lines: [[t('Ligne 1')], [t('Ligne 2')]] },
    { type: 'paragraph', lines: [[t('Autre paragraphe')]] },
  ]);
});

test('titres de trois niveaux', () => {
  assert.deepEqual(parseRichText('# Compte rendu\n## Participants\n### Détail'), [
    { type: 'heading', level: 1, content: [t('Compte rendu')] },
    { type: 'heading', level: 2, content: [t('Participants')] },
    { type: 'heading', level: 3, content: [t('Détail')] },
  ]);
});

test('listes à puces et numérotées', () => {
  assert.deepEqual(parseRichText('Points :\n- Alice\n* Bruno\n\n1. Ouvrir\n2. Fermer'), [
    { type: 'paragraph', lines: [[t('Points :')]] },
    { type: 'list', ordered: false, items: [[t('Alice')], [t('Bruno')]] },
    { type: 'list', ordered: true, items: [[t('Ouvrir')], [t('Fermer')]] },
  ]);
});

const inline = (source: string) => {
  const [block] = parseRichText(source);
  assert.equal(block?.type, 'paragraph');
  return block.type === 'paragraph' ? block.lines[0] : [];
};

test('gras et italique, imbricables', () => {
  assert.deepEqual(inline('Un **point clé** et une *nuance*'), [
    t('Un '),
    { type: 'bold', children: [t('point clé')] },
    t(' et une '),
    { type: 'italic', children: [t('nuance')] },
  ]);
  assert.deepEqual(inline('**très *important***'), [
    { type: 'bold', children: [t('très '), { type: 'italic', children: [t('important')] }] },
  ]);
});

test('marque non fermée : gardée telle quelle', () => {
  assert.deepEqual(inline('2 * 3 = 6 et **ouvert'), [t('2 * 3 = 6 et **ouvert')]);
});

test('liens http, https et mailto', () => {
  assert.deepEqual(inline('Voir [la note](https://exemple.test/note) ou [écrire](mailto:a@exemple.test)'), [
    t('Voir '),
    { type: 'link', href: 'https://exemple.test/note', text: 'la note' },
    t(' ou '),
    { type: 'link', href: 'mailto:a@exemple.test', text: 'écrire' },
  ]);
});

test('lien vers une adresse dangereuse : texte seul', () => {
  assert.deepEqual(inline('[clic](javascript:alert(1))'), [t('[clic](javascript:alert(1))')]);
});

test('une référence écrite telle quelle est reconnue, jusque dans le gras', () => {
  assert.deepEqual(inline('Répond à CRM-BE-001 et **CRM-EX-1012**.'), [
    t('Répond à '),
    { type: 'reference', reference: 'CRM-BE-001' },
    t(' et '),
    { type: 'bold', children: [{ type: 'reference', reference: 'CRM-EX-1012' }] },
    t('.'),
  ]);
});

test('pas de référence au milieu d’un mot, avec moins de 3 chiffres ou dans un lien', () => {
  assert.deepEqual(inline('voirCRM-BE-001 CRM-BE-01 CRM-BE-001A'), [t('voirCRM-BE-001 CRM-BE-01 CRM-BE-001A')]);
  assert.deepEqual(inline('[CRM-BE-001](https://exemple.test/CRM-BE-001)'), [
    { type: 'link', href: 'https://exemple.test/CRM-BE-001', text: 'CRM-BE-001' },
  ]);
});

/** Texte et sélection notés avec [ ] : « un [mot] » = « mot » sélectionné. */
function edit(marked: string, format: Parameters<typeof applyFormat>[2]): string {
  const start = marked.indexOf('[');
  const end = marked.indexOf(']') - 1;
  const r = applyFormat(marked.replace('[', '').replace(']', ''), { start, end }, format);
  return `${r.text.slice(0, r.selection.start)}[${r.text.slice(r.selection.start, r.selection.end)}]${r.text.slice(r.selection.end)}`;
}

test('gras et italique : entourent la sélection, qui reste sélectionnée', () => {
  assert.equal(edit('un [mot] clé', 'bold'), 'un **[mot]** clé');
  assert.equal(edit('un [mot] clé', 'italic'), 'un *[mot]* clé');
});

test('gras sans sélection : marques insérées, curseur entre les deux', () => {
  assert.equal(edit('un []', 'bold'), 'un **[]**');
});

test('titre et listes : appliqués à chaque ligne sélectionnée, en entier', () => {
  assert.equal(edit('Comp[]te rendu', 'heading'), '[## Compte rendu]');
  assert.equal(edit('[Alice\nBru]no', 'bulletList'), '[- Alice\n- Bruno]');
  assert.equal(edit('Intro\n[Ouvrir\nFermer]', 'numberedList'), 'Intro\n[1. Ouvrir\n2. Fermer]');
});

test('lien : le texte sélectionné devient le libellé, l’adresse est sélectionnée', () => {
  assert.equal(edit('voir [la note]', 'link'), 'voir [la note]([https://])');
});

test('texte simple : les références sont reconnues, le reste est gardé tel quel, retours à la ligne compris', () => {
  assert.deepEqual(splitReferences('Voir CRM-EX-012,\n*pas* du gras'), [
    t('Voir '),
    { type: 'reference', reference: 'CRM-EX-012' },
    t(',\n*pas* du gras'),
  ]);
});
