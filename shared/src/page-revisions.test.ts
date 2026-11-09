import { test } from 'node:test';
import { updatePageSchema } from './pages.js';
import assert from 'node:assert/strict';
import {
  checkPageRevisionDelete,
  checkPageRevisionRestore,
  checkPageVersionNote,
  currentPageRevision,
  checkPageVersionDeclare,
  nextPageVersionNumber,
  type PageRevisionItem,
  declarePageVersionSchema,
  diffPageTexts,
  pageComparisonText,
  pageVersionStatus,
} from './page-revisions.js';

/** Enregistrements dans l'ordre chronologique : `v` numéro de version, `x` supprimé. */
function revisions(...specs: string[]): PageRevisionItem[] {
  return specs.map((spec, i) => {
    const version = /v(\d+)/.exec(spec);
    return {
      id: `r${i + 1}`,
      sequence: i + 1,
      versionNumber: version ? Number(version[1]) : null,
      deletedAt: spec.includes('x') ? '2026-11-09T10:00:00.000Z' : null,
    };
  });
}

test('une page n’a aucune version à sa création : la première déclarée porte le numéro 1', () => {
  assert.equal(nextPageVersionNumber(revisions('')), 1);
  assert.equal(nextPageVersionNumber(revisions('', 'v1', '')), 2);
});

test('le numéro d’une version supprimée n’est jamais réattribué', () => {
  assert.equal(nextPageVersionNumber(revisions('v1', 'v2x', 'v3x', '')), 4);
});

test('seul un enregistrement postérieur à la dernière version se déclare, après coup', () => {
  const list = revisions('', 'v1', '', '');
  assert.equal(checkPageVersionDeclare(list, 'r3'), null);
  assert.equal(checkPageVersionDeclare(list, 'r4'), null);
  assert.equal(checkPageVersionDeclare(list, 'r1'), 'pageVersionNotAfterLast');
  assert.equal(checkPageVersionDeclare(revisions('', ''), 'r1'), null);
});

test('une version ne se déclare pas deux fois ; un enregistrement supprimé ne se déclare pas', () => {
  assert.equal(checkPageVersionDeclare(revisions('', 'v1'), 'r2'), 'alreadyPageVersion');
  assert.equal(checkPageVersionDeclare(revisions('x', ''), 'r1'), 'pageRevisionDeleted');
});

test('une version supprimée compte encore comme dernière version : la numérotation reste chronologique', () => {
  assert.equal(checkPageVersionDeclare(revisions('v1', '', 'v2x', ''), 'r2'), 'pageVersionNotAfterLast');
  assert.equal(checkPageVersionDeclare(revisions('v1', '', 'v2x', ''), 'r4'), null);
});

test('tout enregistrement se supprime sauf le dernier, même s’il est une version', () => {
  assert.equal(checkPageRevisionDelete(revisions('', 'v1', ''), 'r1'), null);
  assert.equal(checkPageRevisionDelete(revisions('', 'v1', ''), 'r2'), null);
  assert.equal(checkPageRevisionDelete(revisions('', 'v1', ''), 'r3'), 'lastPageRevision');
  assert.equal(checkPageRevisionDelete(revisions('', 'v1'), 'r2'), 'lastPageRevision');
  assert.equal(checkPageRevisionDelete(revisions('x', ''), 'r1'), 'pageRevisionDeleted');
});

test('la page affiche sa dernière version et signale les modifications depuis', () => {
  assert.deepEqual(pageVersionStatus(revisions('')), { lastVersion: null, modifiedSinceLastVersion: false, nextVersion: 1 });
  assert.deepEqual(pageVersionStatus(revisions('', 'v1')), { lastVersion: 1, modifiedSinceLastVersion: false, nextVersion: 2 });
  assert.deepEqual(pageVersionStatus(revisions('v1', '', 'v2', '')), { lastVersion: 2, modifiedSinceLastVersion: true, nextVersion: 3 });
  // Version 2 supprimée : la page affiche la version 1, la prochaine sera la 3.
  assert.deepEqual(pageVersionStatus(revisions('v1', 'v2x', '')), { lastVersion: 1, modifiedSinceLastVersion: true, nextVersion: 3 });
});

const text = (value: string) => ({ type: 'text' as const, text: value });
const block = (type: 'paragraph' | 'heading', ...content: object[]) => ({ type, content: content as never[] });
const node = (type: string, ...content: object[]) => ({ type, content: content as never[] }) as never;

test('le texte comparé : un bloc par ligne, sans la mise en forme, un tableau avec ses séparateurs', () => {
  const doc = {
    type: 'doc' as const,
    content: [
      block('heading', text('Budget '), { ...text('2027'), marks: [{ type: 'bold' }] }),
      block('paragraph'),
      block('paragraph', text('a'), { type: 'hardBreak' }, text('b')),
      node('bulletList', node('listItem', block('paragraph', text('un'))), node('listItem', block('paragraph', text('deux')))),
      node(
        'table',
        node('tableRow', node('tableHeader', block('paragraph', text('Poste'))), node('tableHeader', block('paragraph', text('Montant')))),
        node('tableRow', node('tableCell', block('paragraph', text('Licences'))), node('tableCell', block('paragraph'))),
      ),
    ] as never[],
  };
  assert.equal(pageComparisonText(doc), 'Budget 2027\n\na\nb\nun\ndeux\nPoste | Montant\nLicences | ');
  assert.equal(pageComparisonText(null), '');
});

test('la comparaison ne signale aucune différence d’espaces : doubles espaces, insécables, lignes vides', () => {
  assert.deepEqual(diffPageTexts('Le  budget :\n\nvalidé ', 'Le budget :\nvalidé'), [{ kind: 'same', text: 'Le budget :\nvalidé' }]);
  assert.deepEqual(diffPageTexts('', ''), []);
});

test('la comparaison met en évidence, mot à mot, les ajouts et les suppressions dans un seul texte', () => {
  assert.deepEqual(diffPageTexts('Le budget est de 10 k', 'Le budget est de 12 k'), [
    { kind: 'same', text: 'Le budget est de ' },
    { kind: 'removed', text: '10' },
    { kind: 'same', text: ' ' },
    { kind: 'added', text: '12' },
    { kind: 'same', text: ' k' },
  ]);
  assert.deepEqual(diffPageTexts('a\nb', 'a\nnouvelle ligne\nb'), [
    { kind: 'same', text: 'a\n' },
    { kind: 'added', text: 'nouvelle ligne\n' },
    { kind: 'same', text: 'b' },
  ]);
  assert.deepEqual(diffPageTexts('', 'tout neuf'), [{ kind: 'added', text: 'tout neuf' }]);
});

test('deux textes longs entièrement différents se comparent sans attendre', () => {
  const words = (prefix: string) => Array.from({ length: 30_000 }, (_, i) => `${prefix}${i}`).join(' ');
  const started = Date.now();
  const parts = diffPageTexts(words('a'), words('b'));
  assert.ok(Date.now() - started < 3000);
  assert.deepEqual(parts.map((p) => p.kind).filter((k) => k !== 'same'), ['removed', 'added']);
});

test('note de version facultative, 500 caractères au plus ; vide, elle est retirée', () => {
  assert.deepEqual(declarePageVersionSchema.parse({}), { note: null });
  assert.deepEqual(declarePageVersionSchema.parse({ note: '  ' }), { note: null });
  assert.deepEqual(declarePageVersionSchema.parse({ note: ' Relue ' }), { note: 'Relue' });
  assert.equal(declarePageVersionSchema.safeParse({ note: 'x'.repeat(500) }).success, true);
  assert.equal(declarePageVersionSchema.safeParse({ note: 'x'.repeat(501) }).success, false);
});

test('enregistrer peut déclarer le nouvel enregistrement comme version, avec sa note', () => {
  assert.deepEqual(updatePageSchema.parse({ title: 'Budget', version: { note: 'Relue' } }), { title: 'Budget', version: { note: 'Relue' } });
  assert.equal(updatePageSchema.parse({ title: 'Budget' }).version, undefined);
});

test('seule une version porte une note ; un enregistrement supprimé ne se corrige ni ne se restaure', () => {
  assert.equal(checkPageVersionNote(revisions('v1', ''), 'r1'), null);
  assert.equal(checkPageVersionNote(revisions('v1', ''), 'r2'), 'notPageVersion');
  assert.equal(checkPageVersionNote(revisions('v1x', ''), 'r1'), 'pageRevisionDeleted');
  assert.equal(checkPageRevisionRestore(revisions('v1', ''), 'r1'), null);
  assert.equal(checkPageRevisionRestore(revisions('x', ''), 'r1'), 'pageRevisionDeleted');
});

test('l’état actuel de la page est son dernier enregistrement encore présent ; il ne se restaure pas', () => {
  assert.equal(currentPageRevision(revisions('', 'v1', ''))?.id, 'r3');
  assert.equal(currentPageRevision([...revisions('', 'v1x', '')].reverse())?.id, 'r3');
  assert.equal(checkPageRevisionRestore(revisions('', ''), 'r2'), 'currentPageRevision');
});
