import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BabokDto } from './babok.js';
import { type PageTemplateDto, pageTemplateGroups } from './page-templates.js';

const text = (en: string, fr: string) => ({ en, fr });
const summary = text('…', '…');

const babok: BabokDto = {
  knowledgeAreas: [
    { kind: 'knowledgeArea', id: '3', section: '3', name: text('Planning', 'Planification'), summary },
    { kind: 'knowledgeArea', id: '4', section: '4', name: text('Elicitation', 'Élicitation'), summary },
    { kind: 'knowledgeArea', id: '6', section: '6', name: text('Strategy', 'Stratégie'), summary },
  ],
  tasks: [
    { kind: 'task', id: '3.1', section: '3.1', knowledgeAreaId: '3', name: text('Plan', 'Planifier'), summary, techniqueIds: [] },
    { kind: 'task', id: '3.2', section: '3.2', knowledgeAreaId: '3', name: text('Engage', 'Engager'), summary, techniqueIds: [] },
    { kind: 'task', id: '6.1', section: '6.1', knowledgeAreaId: '6', name: text('Current', 'Actuel'), summary, techniqueIds: [] },
  ],
  techniques: [],
  agile: { principles: [], horizons: [], techniques: [] },
};

const doc = { type: 'doc' as const, content: [] };
function template(id: string, taskId: string | null, fr: string, en: string, active = true): PageTemplateDto {
  return { id, name: { fr, en }, content: { fr: doc, en: doc }, taskId, origin: 'delivered', active };
}

test('« Nouvelle page » propose les modèles actifs par domaine de connaissance, dans l’ordre du référentiel puis des tâches', () => {
  const groups = pageTemplateGroups(
    babok,
    [
      template('etat', '6.1', 'Description de l’état actuel', 'Current State Description'),
      template('engagement', '3.2', 'Approche d’engagement', 'Engagement Approach'),
      template('approche', '3.1', 'Approche de l’analyse', 'Analysis Approach'),
      template('ancien', '3.1', 'Ancien modèle', 'Old template', false),
    ],
    'fr',
  );
  assert.deepEqual(
    groups.map((g) => [g.knowledgeArea?.id ?? null, g.templates.map((t) => t.id)]),
    [
      ['3', ['approche', 'engagement']],
      ['6', ['etat']],
    ],
  );
});

test('les modèles d’une même tâche suivent l’ordre alphabétique de leur nom dans la langue de l’interface', () => {
  const templates = [template('b', '3.1', 'Zèbre', 'Apple'), template('a', '3.1', 'Abeille', 'Zebra')];
  assert.deepEqual(pageTemplateGroups(babok, templates, 'fr')[0]!.templates.map((t) => t.id), ['a', 'b']);
  assert.deepEqual(pageTemplateGroups(babok, templates, 'en')[0]!.templates.map((t) => t.id), ['b', 'a']);
});

test('un modèle sans tâche BABOK est proposé à la fin, hors des domaines de connaissance', () => {
  const groups = pageTemplateGroups(babok, [template('libre', null, 'Compte rendu', 'Minutes'), template('etat', '6.1', 'État', 'State')], 'fr');
  assert.deepEqual(
    groups.map((g) => [g.knowledgeArea?.id ?? null, g.templates.map((t) => t.id)]),
    [
      ['6', ['etat']],
      [null, ['libre']],
    ],
  );
});

test('sans modèle actif, seule la page vide est proposée : aucun groupe', () => {
  assert.deepEqual(pageTemplateGroups(babok, [template('ancien', '3.1', 'Ancien', 'Old', false)], 'fr'), []);
});


test('l’administration liste tous les modèles par domaine de connaissance, désactivés compris', () => {
  const groups = pageTemplateGroups(
    babok,
    [template('ancien', '3.1', 'Ancien', 'Old', false), template('libre', null, 'Libre', 'Free', false), template('etat', '6.1', 'État', 'State')],
    'fr',
    { withInactive: true },
  );
  assert.deepEqual(
    groups.map((g) => [g.knowledgeArea?.id ?? null, g.templates.map((t) => t.id)]),
    [
      ['3', ['ancien']],
      ['6', ['etat']],
      [null, ['libre']],
    ],
  );
});
