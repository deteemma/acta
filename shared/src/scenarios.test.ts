import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptsScenarios,
  backgroundHistory,
  checkScenarioOrder,
  createScenarioSchema,
  moveScenario,
  newFeatureLanguage,
  saveBackgroundSchema,
  scenarioHistory,
  setFeatureLanguageSchema,
  updateScenarioSchema,
} from './scenarios.js';

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

test('le Contexte compte 10 000 caractères au plus, garde ses retraits, et n’est jamais vide', () => {
  const text = '  Étant donné un client connu\n    | nom |\n';
  assert.deepEqual(saveBackgroundSchema.parse({ baseRowVersion: null, text }), { baseRowVersion: null, text });
  assert.equal(saveBackgroundSchema.safeParse({ baseRowVersion: null, text: 'x'.repeat(10_000) }).success, true);
  assert.equal(saveBackgroundSchema.safeParse({ baseRowVersion: null, text: 'x'.repeat(10_001) }).success, false);
  assert.equal(saveBackgroundSchema.safeParse({ baseRowVersion: 2, text: ' \n ' }).success, false);
});

test('un Contexte s’enregistre en disant sur quel état il est basé : aucun (création) ou celui de son ouverture', () => {
  assert.equal(saveBackgroundSchema.safeParse({ text: 'Étant donné un client' }).success, false);
  assert.equal(saveBackgroundSchema.safeParse({ baseRowVersion: 3, text: 'Étant donné un client' }).success, true);
  // Pas de titre : un champ inconnu est ignoré.
  assert.deepEqual(saveBackgroundSchema.parse({ baseRowVersion: 0, text: 'x', title: 'T' }), { baseRowVersion: 0, text: 'x' });
});

test('la langue d’une nouvelle fonctionnalité est celle demandée, sinon celle de son auteur, sinon le français', () => {
  assert.equal(newFeatureLanguage('en', 'fr'), 'en');
  assert.equal(newFeatureLanguage(undefined, 'en'), 'en');
  assert.equal(newFeatureLanguage(undefined, null), 'fr');
});

test('la langue de la fonctionnalité est le français ou l’anglais', () => {
  assert.deepEqual(setFeatureLanguageSchema.parse({ language: 'en' }), { language: 'en' });
  assert.equal(setFeatureLanguageSchema.safeParse({ language: 'de' }).success, false);
  assert.equal(createScenarioSchema.safeParse({ title: 'T', text: '', language: 'de' }).success, false);
  assert.equal(createScenarioSchema.parse({ title: 'T', text: '', language: 'en' }).language, 'en');
});

const alice = { userId: 'alice', email: 'alice@example.org', displayName: 'Alice' };
const bruno = { userId: 'bruno', email: 'bruno@example.org', displayName: 'Bruno' };

test('historique d’un scénario : la création, puis chaque modification du titre ou du texte, la plus récente en tête', () => {
  const history = scenarioHistory({
    createdAt: '2026-11-17T09:00:00.000Z',
    createdBy: alice,
    versions: [
      {
        changedAt: '2026-11-17T10:00:00.000Z',
        changedBy: bruno,
        before: { title: 'Connexion', text: 'Quand je me connecte' },
        after: { title: 'Connexion réussie', text: 'Quand je me connecte' },
      },
      {
        changedAt: '2026-11-17T11:00:00.000Z',
        changedBy: alice,
        before: { title: 'Connexion réussie', text: 'Quand je me connecte' },
        after: { title: 'Connexion réussie', text: 'Quand je me connecte\nAlors je vois mon tableau de bord' },
      },
    ],
  });
  assert.deepEqual(history, [
    {
      changedAt: '2026-11-17T11:00:00.000Z',
      changedBy: alice,
      kind: 'updated',
      changes: [{ field: 'text', from: 'Quand je me connecte', to: 'Quand je me connecte\nAlors je vois mon tableau de bord' }],
    },
    {
      changedAt: '2026-11-17T10:00:00.000Z',
      changedBy: bruno,
      kind: 'updated',
      changes: [{ field: 'title', from: 'Connexion', to: 'Connexion réussie' }],
    },
    { changedAt: '2026-11-17T09:00:00.000Z', changedBy: alice, kind: 'created', changes: [] },
  ]);
});

test('historique du Contexte : la création, puis chaque modification du texte', () => {
  const history = backgroundHistory({
    createdAt: '2026-11-17T09:00:00.000Z',
    createdBy: alice,
    versions: [
      { changedAt: '2026-11-17T10:00:00.000Z', changedBy: bruno, before: { text: 'Étant donné un client' }, after: { text: 'Étant donné un client connecté' } },
    ],
  });
  assert.deepEqual(history, [
    {
      changedAt: '2026-11-17T10:00:00.000Z',
      changedBy: bruno,
      kind: 'updated',
      changes: [{ field: 'text', from: 'Étant donné un client', to: 'Étant donné un client connecté' }],
    },
    { changedAt: '2026-11-17T09:00:00.000Z', changedBy: alice, kind: 'created', changes: [] },
  ]);
});
