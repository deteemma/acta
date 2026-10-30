import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ActionDto } from './actions.js';
import type { BabokDto, TechniqueDto } from './babok.js';
import { analysisObjectLinks, rankTechniques, suggestTasks, type TaskSuggestion } from './suggestions.js';

const taskIds = (suggestions: TaskSuggestion[]) => suggestions.map((s) => s.taskId);

test('tâche proposée : initiative sans aucune action → 3.1', () => {
  assert.deepEqual(suggestTasks({ kind: 'initiative', hasActions: false }), [
    { taskId: '3.1', reason: 'noAction' },
  ]);
});

test('tâche proposée : initiative qui a déjà des actions → aucune', () => {
  assert.deepEqual(suggestTasks({ kind: 'initiative', hasActions: true }), []);
});

test('tâche proposée : depuis une partie prenante → 3.2, puis 4.5', () => {
  assert.deepEqual(taskIds(suggestTasks({ kind: 'stakeholder' })), ['3.2', '4.5']);
});

test('tâche proposée : depuis un besoin → 6.1, puis 6.2', () => {
  assert.deepEqual(taskIds(suggestTasks({ kind: 'need' })), ['6.1', '6.2']);
});

test('tâche proposée : depuis une exigence, selon son statut, 5.1 en second choix', () => {
  assert.deepEqual(taskIds(suggestTasks({ kind: 'requirement', status: 'proposed' })), ['7.2', '5.1']);
  assert.deepEqual(taskIds(suggestTasks({ kind: 'requirement', status: 'verified' })), ['7.3', '5.1']);
  assert.deepEqual(taskIds(suggestTasks({ kind: 'requirement', status: 'validated' })), ['5.5', '5.1']);
});

test('tâche proposée : depuis une exigence d’un autre statut → 5.1 seule', () => {
  for (const status of ['approved', 'deferred', 'rejected'] as const) {
    assert.deepEqual(taskIds(suggestTasks({ kind: 'requirement', status })), ['5.1'], status);
  }
});

test('chaque tâche proposée porte sa justification', () => {
  assert.deepEqual(suggestTasks({ kind: 'requirement', status: 'proposed' }), [
    { taskId: '7.2', reason: 'requirementProposed' },
    { taskId: '5.1', reason: 'requirementTrace' },
  ]);
});

test('action créée depuis un objet d’analyse : liée à cet objet', () => {
  assert.deepEqual(analysisObjectLinks({ kind: 'stakeholder', id: 's1' }), { stakeholderIds: ['s1'] });
  assert.deepEqual(analysisObjectLinks({ kind: 'need', id: 'n1' }), { needIds: ['n1'] });
  assert.deepEqual(analysisObjectLinks({ kind: 'requirement', id: 'r1' }), { requirementIds: ['r1'] });
});

const text = (name: string) => ({ en: name, fr: name });
const technique = (id: string): TechniqueDto => ({ kind: 'technique', id, section: id, name: text(id), summary: text('…') });

/** Tâche 4.1 associée à 10.5, 10.25 et 10.43 ; 10.1 n'y est pas associée. */
const babok: BabokDto = {
  knowledgeAreas: [],
  tasks: [
    { kind: 'task', id: '4.1', section: '4.1', knowledgeAreaId: '4', name: text('4.1'), summary: text('…'), techniqueIds: ['10.5', '10.25', '10.43'] },
  ],
  techniques: ['10.1', '10.5', '10.25', '10.43'].map(technique),
};

/** Action d'une initiative, réduite à ce qui compte pour l'usage : sa technique. */
const using = (techniqueId: string | null): Pick<ActionDto, 'techniqueId'> => ({ techniqueId });

test('techniques proposées : celles de la tâche, les plus utilisées dans l’initiative d’abord', () => {
  const ranked = rankTechniques(babok, '4.1', [using('10.43'), using('10.25'), using('10.43'), using(null)], {});
  assert.deepEqual(
    ranked.suggested.map((s) => [s.technique.id, s.usage.initiative]),
    [['10.43', 2], ['10.25', 1], ['10.5', 0]],
  );
  assert.deepEqual(ranked.others.map((t) => t.id), ['10.1']);
});

test('techniques proposées : à égalité dans l’initiative, les plus utilisées dans toute l’application', () => {
  const ranked = rankTechniques(babok, '4.1', [using('10.5'), using('10.25')], { '10.5': 3, '10.25': 7, '10.1': 40 });
  assert.deepEqual(
    ranked.suggested.map((s) => [s.technique.id, s.usage.initiative, s.usage.application]),
    [['10.25', 1, 7], ['10.5', 1, 3], ['10.43', 0, 0]],
  );
});

test('techniques proposées : sans aucun usage, l’ordre du référentiel', () => {
  assert.deepEqual(rankTechniques(babok, '4.1', [], {}).suggested.map((s) => s.technique.id), ['10.5', '10.25', '10.43']);
});

test('techniques proposées : tâche inconnue ou pas encore choisie, aucune proposée', () => {
  const ranked = rankTechniques(babok, '', [using('10.1')], {});
  assert.deepEqual(ranked.suggested, []);
  assert.equal(ranked.others.length, 4);
});
