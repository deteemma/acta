import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type BabokDto,
  babokEnglishName,
  agileTechniqueChoices,
  agileTechniquesOfHorizon,
  babokSectionLabel,
  horizonsOfAgileTechnique,
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
  agile: {
    principles: [
      { kind: 'agilePrinciple', id: 'ae-4.1', section: '4.1', name: text('See the Whole', 'Voir l’ensemble'), summary: text('…', '…') },
    ],
    horizons: [
      { kind: 'agileHorizon', id: 'ae-5.1', section: '5.1', name: text('Strategy Horizon', 'horizon Stratégie'), summary: text('…', '…') },
      { kind: 'agileHorizon', id: 'ae-5.3', section: '5.3', name: text('Delivery Horizon', 'horizon Livraison'), summary: text('…', '…') },
    ],
    techniques: [
      { kind: 'agileTechnique', id: 'ae-7.10', section: '7.10', name: text('Portfolio Kanban', 'Kanban de portefeuille'), summary: text('…', '…'), horizonIds: ['ae-5.1'] },
      { kind: 'agileTechnique', id: 'ae-7.16', section: '7.16', name: text('Reviews', 'Revues'), summary: text('…', '…'), horizonIds: ['ae-5.3'] },
      { kind: 'agileTechnique', id: 'ae-7.15', section: '7.15', name: text('Retrospectives', 'Rétrospectives'), summary: text('…', '…'), horizonIds: ['ae-5.1', 'ae-5.3'] },
    ],
  },
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
  assert.deepEqual(ids(searchBabok(babok, 'revues')), ['10.37', 'ae-7.16']);
});

test('palette : le nom anglais est aussi cherché, quelle que soit la langue', () => {
  assert.deepEqual(ids(searchBabok(babok, 'reviews')), ['10.37', 'ae-7.16']);
  assert.deepEqual(ids(searchBabok(babok, 'exigences requirements')), ['7', '7.2', '7.3']);
});

test('palette : domaines, tâches, techniques, puis principes agiles, horizons et techniques agiles', () => {
  assert.deepEqual(ids(searchBabok(babok, 'r')), ['7', '7.2', '7.3', '10.1', '10.37', '10.5', 'ae-4.1', 'ae-5.1', 'ae-5.3', 'ae-7.10', 'ae-7.16', 'ae-7.15']);
});

test('palette : un élément agile est trouvé par son numéro préfixé, en français comme en anglais', () => {
  assert.deepEqual(ids(searchBabok(babok, 'EA 7.16')), ['ae-7.16']);
  assert.deepEqual(ids(searchBabok(babok, 'ae 7.16')), ['ae-7.16']);
  assert.deepEqual(ids(searchBabok(babok, '5.3')), ['ae-5.3']);
  assert.deepEqual(ids(searchBabok(babok, 'horizon livraison')), ['ae-5.3']);
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

test('numéro affiché : « EA » devant la section d’un élément agile en français, « AE » en anglais ; rien pour le BABOK', () => {
  const kanban = babok.agile.techniques[0]!;
  assert.equal(babokSectionLabel(kanban, 'fr'), 'EA 7.10');
  assert.equal(babokSectionLabel(kanban, 'en'), 'AE 7.10');
  assert.equal(babokSectionLabel(babok.agile.horizons[0]!, 'fr'), 'EA 5.1');
  assert.equal(babokSectionLabel(babok.agile.principles[0]!, 'en'), 'AE 4.1');
  assert.equal(babokSectionLabel(babok.tasks[0]!, 'fr'), '7.2');
  assert.equal(babokSectionLabel(babok.tasks[0]!, 'en'), '7.2');
});

test('en français, le nom anglais d’un élément agile est proposé en info-bulle', () => {
  assert.equal(babokEnglishName(babok.agile.horizons[0]!, 'fr'), 'Strategy Horizon');
  assert.equal(babokEnglishName(babok.agile.horizons[0]!, 'en'), undefined);
});

test('une technique agile liste ses horizons ; un horizon, les techniques agiles qui s’y appliquent ; dans l’ordre du référentiel', () => {
  const retrospectives = babok.agile.techniques[2]!;
  assert.deepEqual(ids(horizonsOfAgileTechnique(babok, retrospectives)), ['ae-5.1', 'ae-5.3']);
  assert.deepEqual(ids(agileTechniquesOfHorizon(babok, 'ae-5.1')), ['ae-7.10', 'ae-7.15']);
  assert.deepEqual(ids(agileTechniquesOfHorizon(babok, 'ae-5.3')), ['ae-7.16', 'ae-7.15']);
  assert.deepEqual(agileTechniquesOfHorizon(babok, 'ae-5.2'), []);
});

test('un élément agile se retrouve par son identifiant stable ; la section seule désigne le BABOK', () => {
  assert.equal(findBabokElement(babok, 'ae-4.1')?.kind, 'agilePrinciple');
  assert.equal(findBabokElement(babok, 'ae-5.3')?.kind, 'agileHorizon');
  assert.equal(findBabokElement(babok, 'ae-7.16')?.kind, 'agileTechnique');
  assert.equal(findBabokElement(babok, '7.16'), undefined);
});

test('techniques agiles proposées pour une action : triées par numéro de section (D15)', () => {
  const choices = agileTechniqueChoices({
    ...babok,
    agile: {
      ...babok.agile,
      techniques: [
        ...babok.agile.techniques,
        { kind: 'agileTechnique', id: 'ae-7.2', section: '7.2', name: text('Business Model Canvas', 'Business Model Canvas'), summary: text('…', '…'), horizonIds: [] },
      ],
    },
  });
  assert.deepEqual(ids(choices), ['ae-7.2', 'ae-7.10', 'ae-7.15', 'ae-7.16']);
});
