import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type BabokDto,
  babokEnglishName,
  findBabokElement,
  searchBabok,
  tasksOfKnowledgeArea,
  tasksUsingTechnique,
  techniquesOfTask,
} from './babok.js';

const text = (en: string, fr: string) => ({ en, fr });

const babok: BabokDto = {
  knowledgeAreas: [
    { kind: 'knowledgeArea', id: '7', section: '7', name: text('Requirements Analysis and Design Definition', 'Analyse des exigences et spécification de la conception'), summary: text('…', '…') },
  ],
  tasks: [
    { kind: 'task', id: '7.2', section: '7.2', knowledgeAreaId: '7', name: text('Verify Requirements', 'Vérifier les exigences'), summary: text('…', '…'), techniqueIds: ['10.1', '10.37'] },
    { kind: 'task', id: '7.3', section: '7.3', knowledgeAreaId: '7', name: text('Validate Requirements', 'Valider les exigences'), summary: text('…', '…'), techniqueIds: ['10.1'] },
  ],
  techniques: [
    { kind: 'technique', id: '10.1', section: '10.1', name: text('Acceptance and Evaluation Criteria', 'Critères d’acceptation et d’évaluation'), summary: text('…', '…') },
    { kind: 'technique', id: '10.37', section: '10.37', name: text('Reviews', 'Revues'), summary: text('…', '…') },
    { kind: 'technique', id: '10.5', section: '10.5', name: text('Brainstorming', 'Brainstorming'), summary: text('…', '…') },
  ],
};

test('une technique liste les tâches qui l’utilisent, dans l’ordre du référentiel', () => {
  assert.deepEqual(tasksUsingTechnique(babok, '10.1').map((t) => t.id), ['7.2', '7.3']);
  assert.deepEqual(tasksUsingTechnique(babok, '10.37').map((t) => t.id), ['7.2']);
  assert.deepEqual(tasksUsingTechnique(babok, '10.5'), []);
});

test('en français, le nom anglais de l’élément est proposé en info-bulle ; rien en anglais', () => {
  const verify = babok.tasks[0]!;
  assert.equal(babokEnglishName(verify, 'fr'), 'Verify Requirements');
  assert.equal(babokEnglishName(verify, 'en'), undefined);
});

const ids = (elements: { id: string }[]) => elements.map((e) => e.id);

test('palette : un élément est trouvé par son numéro de section ou son nom, sans casse ni accents', () => {
  assert.deepEqual(ids(searchBabok(babok, '7.2')), ['7.2']);
  assert.deepEqual(ids(searchBabok(babok, 'verifier')), ['7.2']);
  assert.deepEqual(ids(searchBabok(babok, 'revues')), ['10.37']);
});

test('palette : le nom anglais est aussi cherché, quelle que soit la langue', () => {
  assert.deepEqual(ids(searchBabok(babok, 'reviews')), ['10.37']);
  assert.deepEqual(ids(searchBabok(babok, 'exigences requirements')), ['7', '7.2', '7.3']);
});

test('palette : domaines, puis tâches, puis techniques', () => {
  assert.deepEqual(ids(searchBabok(babok, 'r')), ['7', '7.2', '7.3', '10.1', '10.37', '10.5']);
});

test('palette : saisie vide = aucun élément du référentiel (seules les initiatives, ticket 02)', () => {
  assert.deepEqual(searchBabok(babok, ''), []);
  assert.deepEqual(searchBabok(babok, '  '), []);
});

test('un domaine liste ses tâches ; une tâche, ses techniques ; dans l’ordre du référentiel', () => {
  assert.deepEqual(ids(tasksOfKnowledgeArea(babok, '7')), ['7.2', '7.3']);
  assert.deepEqual(ids(techniquesOfTask(babok, babok.tasks[0]!)), ['10.1', '10.37']);
});

test('un élément se retrouve par son identifiant, quel que soit son type', () => {
  assert.equal(findBabokElement(babok, '7')?.kind, 'knowledgeArea');
  assert.equal(findBabokElement(babok, '7.3')?.kind, 'task');
  assert.equal(findBabokElement(babok, '10.37')?.kind, 'technique');
  assert.equal(findBabokElement(babok, '99'), undefined);
});
