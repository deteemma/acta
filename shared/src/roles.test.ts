import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can, hasAtLeast } from './roles.js';

test('le lecteur peut consulter mais pas modifier', () => {
  assert.equal(can('reader', 'view'), true);
  assert.equal(can('reader', 'edit'), false);
});

test('le contributeur peut modifier mais pas gérer les membres', () => {
  assert.equal(can('contributor', 'edit'), true);
  assert.equal(can('contributor', 'manageMembers'), false);
});

test('le propriétaire a tous les droits', () => {
  assert.equal(can('owner', 'delete'), true);
  assert.equal(can('owner', 'manageMembers'), true);
});

test('un non-membre n’a aucun droit', () => {
  assert.equal(hasAtLeast(null, 'reader'), false);
});
