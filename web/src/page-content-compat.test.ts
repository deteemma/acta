// Anciens enregistrements lisibles après une montée de version de Tiptap (ticket 23,
// ADR-0019, conséquences). page-content-tiptap-3.32.0.json est figé : c'est le
// JSON qu'écrivait Tiptap 3.32.0 pour chaque élément de mise en forme admis. Ne
// jamais le régénérer pour faire passer ce test : s'il échoue après une montée de
// version, les enregistrements conservés doivent être migrés (ADR-0019).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pageComparisonText, pageContentSchema, type PageDoc } from '@app/shared';
import { getSchema } from '@tiptap/core';
import { Node } from '@tiptap/pm/model';
import { pageExtensions } from './page-editor-extensions.ts';

const saved = JSON.parse(readFileSync(new URL('./page-content-tiptap-3.32.0.json', import.meta.url), 'utf8')) as PageDoc;

test('un enregistrement écrit par Tiptap 3.32.0 s’ouvre dans l’éditeur actuel sans rien perdre', () => {
  const node = Node.fromJSON(getSchema(pageExtensions()), saved);
  node.check();
  // Comparé une fois sérialisé : ProseMirror crée ses attributs sans prototype.
  assert.deepEqual(JSON.parse(JSON.stringify(node.toJSON())), saved);
});

test('un enregistrement écrit par Tiptap 3.32.0 reste un contenu de page valide, affiché et comparé sur son texte', () => {
  assert.equal(pageContentSchema.safeParse(saved).success, true);
  assert.equal(
    pageComparisonText(saved),
    [
      'Budget 2027',
      'Postes',
      'Détail',
      '# Budget 2027',
      '2026. Une année',
      'a < b & c',
      'Gras et italique et lien ; voir CRM-PA-001.',
      'ligne 1',
      'ligne 2',
      'un',
      'deux',
      'trois',
      'Poste | Montant',
      'Licences | 12 000',
      '',
    ].join('\n'),
  );
});
