import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actionStatusTone, requirementStatusTone } from './status-tones.js';

test("famille de statut d'une action", () => {
  assert.equal(actionStatusTone('todo'), 'neutral');
  assert.equal(actionStatusTone('in_progress'), 'progress');
  assert.equal(actionStatusTone('done'), 'positive');
  assert.equal(actionStatusTone('cancelled'), 'muted');
});

test("famille de statut d'une exigence : statuts du BABOK", () => {
  assert.equal(requirementStatusTone('proposed'), 'neutral');
  assert.equal(requirementStatusTone('verified'), 'progress');
  assert.equal(requirementStatusTone('validated'), 'progress');
  assert.equal(requirementStatusTone('approved'), 'positive');
  assert.equal(requirementStatusTone('deferred'), 'attention');
  assert.equal(requirementStatusTone('rejected'), 'negative');
});

test("un statut d'exigence ajouté par l'administration est neutre", () => {
  assert.equal(requirementStatusTone('s4444'), 'neutral');
});
