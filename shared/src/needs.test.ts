import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNeedSchema } from './needs.js';

const valid = { title: 'Délais de traitement trop longs', nature: 'problem' };

test('un besoin porte un titre de 200 caractères au plus et une nature, problème ou opportunité', () => {
  assert.equal(createNeedSchema.safeParse(valid).success, true);
  assert.equal(createNeedSchema.safeParse({ ...valid, nature: 'opportunity' }).success, true);
  assert.equal(createNeedSchema.safeParse({ ...valid, title: '   ' }).success, false);
  assert.equal(createNeedSchema.safeParse({ ...valid, title: 'x'.repeat(201) }).success, false);
  assert.equal(createNeedSchema.safeParse({ title: valid.title }).success, false);
  assert.equal(createNeedSchema.safeParse({ ...valid, nature: 'risque' }).success, false);
});

test('la description est facultative : vide, elle est absente ; 20 000 caractères au plus', () => {
  assert.equal(createNeedSchema.parse({ ...valid, description: '  ' }).description, null);
  assert.equal(createNeedSchema.safeParse({ ...valid, description: 'x'.repeat(20001) }).success, false);
});

test('une partie prenante à l’origine n’est comptée qu’une fois', () => {
  const id = '4d3c2b1a-0000-4000-8000-000000000001';
  assert.deepEqual(createNeedSchema.parse({ ...valid, stakeholderIds: [id, id] }).stakeholderIds, [id]);
  assert.equal(createNeedSchema.safeParse({ ...valid, stakeholderIds: ['pas-un-uuid'] }).success, false);
});
