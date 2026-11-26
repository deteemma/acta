import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ASSISTANT_API_KEY_MIN_LENGTH, assistantConnection } from './assistant.js';

const key = 'k'.repeat(ASSISTANT_API_KEY_MIN_LENGTH);

test('assistant absent sans adresse ou sans clé de Hermes (AS25)', () => {
  assert.equal(assistantConnection(undefined, undefined), null);
  assert.equal(assistantConnection('', ''), null);
  assert.equal(assistantConnection('http://assistant:8642', undefined), null);
  assert.equal(assistantConnection('http://assistant:8642', '  '), null);
  assert.equal(assistantConnection(undefined, key), null);
  assert.equal(assistantConnection(' ', key), null);
});

test('assistant installé avec adresse et clé, adresse sans « / » final', () => {
  assert.deepEqual(assistantConnection('http://assistant:8642/', key), {
    url: 'http://assistant:8642',
    apiKey: key,
  });
});

test('clé de moins de 32 caractères refusée (AS35)', () => {
  assert.throws(() => assistantConnection('http://assistant:8642', key.slice(1)), /au moins 32/);
});
