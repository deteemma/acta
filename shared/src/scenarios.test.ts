import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptsScenarios, checkScenarioOrder, createScenarioSchema, moveScenario, updateScenarioSchema } from './scenarios.js';

test('monter ou descendre un scénario l’échange avec son voisin', () => {
  assert.deepEqual(moveScenario(['a', 'b', 'c'], 'b', -1), ['b', 'a', 'c']);
  assert.deepEqual(moveScenario(['a', 'b', 'c'], 'b', 1), ['a', 'c', 'b']);
  // Le premier ne monte pas, le dernier ne descend pas.
  assert.deepEqual(moveScenario(['a', 'b', 'c'], 'a', -1), ['a', 'b', 'c']);
  assert.deepEqual(moveScenario(['a', 'b', 'c'], 'c', 1), ['a', 'b', 'c']);
});

test('un nouvel ordre doit reprendre exactement les scénarios actuels de l’exigence', () => {
  assert.equal(checkScenarioOrder(['a', 'b', 'c'], ['c', 'a', 'b']), null);
  // Un scénario ajouté ou supprimé entre-temps : l'ordre affiché est dépassé.
  assert.equal(checkScenarioOrder(['a', 'b', 'c'], ['b', 'a']), 'scenarioOrderOutdated');
  assert.equal(checkScenarioOrder(['a', 'b'], ['b', 'a', 'c']), 'scenarioOrderOutdated');
  assert.equal(checkScenarioOrder(['a', 'b'], ['a', 'a']), 'scenarioOrderOutdated');
});

test('un scénario a un titre obligatoire', () => {
  assert.equal(createScenarioSchema.safeParse({ title: '', text: 'Quand je valide' }).success, false);
  assert.equal(createScenarioSchema.safeParse({ title: '   ', text: 'Quand je valide' }).success, false);
  assert.equal(createScenarioSchema.safeParse({ text: 'Quand je valide' }).success, false);
  assert.deepEqual(createScenarioSchema.parse({ title: '  Paiement refusé ', text: '' }), { title: 'Paiement refusé', text: '' });
});

test('le texte compte 10 000 caractères au plus, et garde ses espaces et ses retraits', () => {
  assert.equal(createScenarioSchema.safeParse({ title: 'T', text: 'x'.repeat(10_000) }).success, true);
  assert.equal(createScenarioSchema.safeParse({ title: 'T', text: 'x'.repeat(10_001) }).success, false);
  const text = '  Étant donné un client\n    | nom |\n';
  assert.equal(createScenarioSchema.parse({ title: 'T', text }).text, text);
});

test('un texte qui n’est pas du Gherkin correct s’enregistre quand même', () => {
  assert.equal(createScenarioSchema.safeParse({ title: 'T', text: 'Ceci n’est pas du Gherkin <<' }).success, true);
});

test('une modification dit sur quel état du scénario elle est basée', () => {
  assert.equal(updateScenarioSchema.safeParse({ title: 'T', text: 'x' }).success, false);
  assert.deepEqual(updateScenarioSchema.parse({ baseRowVersion: 3, title: ' T ' }), { baseRowVersion: 3, title: 'T' });
  assert.equal(updateScenarioSchema.safeParse({ baseRowVersion: 0, text: 'x'.repeat(10_001) }).success, false);
});

test('seule une exigence de solution fonctionnelle a des scénarios', () => {
  assert.equal(acceptsScenarios({ type: 'solution', subtype: 'functional' }), true);
  assert.equal(acceptsScenarios({ type: 'solution', subtype: 'non_functional' }), false);
  for (const type of ['business', 'stakeholder', 'transition'] as const) {
    assert.equal(acceptsScenarios({ type, subtype: null }), false);
  }
});
