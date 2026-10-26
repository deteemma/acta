import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchInitiatives } from './search.js';

const crm = { code: 'CRM', name: 'Refonte de la relation client' };
const pay = { code: 'PAIE', name: 'Gestion de la paie' };
const ecole = { code: 'ECO', name: 'Inscriptions à l’école' };
const all = [crm, pay, ecole];

test('une initiative est trouvée par son code ou son nom, sans tenir compte des majuscules', () => {
  assert.deepEqual(searchInitiatives(all, 'crm'), [crm]);
  assert.deepEqual(searchInitiatives(all, 'GESTION'), [pay]);
});

test('les accents sont ignorés, dans la saisie comme dans l’initiative', () => {
  assert.deepEqual(searchInitiatives(all, 'ecole'), [ecole]);
  assert.deepEqual(searchInitiatives(all, 'Écôle'), [ecole]);
});

test('chaque mot saisi doit figurer dans le code ou le nom', () => {
  assert.deepEqual(searchInitiatives(all, 'crm client'), [crm]);
  assert.deepEqual(searchInitiatives(all, 'la'), [crm, pay]);
  assert.deepEqual(searchInitiatives(all, 'crm paie'), []);
});

test('une saisie vide renvoie toutes les initiatives, dans l’ordre de la liste', () => {
  assert.deepEqual(searchInitiatives(all, ''), all);
  assert.deepEqual(searchInitiatives(all, '   '), all);
});
