import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSISTANT_SETTINGS_DEFAULTS,
  applicableTimeoutMinutes,
  estimateTokens,
  exceedsDataLimit,
  freeSlots,
  isFinalStatus,
  isTimedOut,
  queuePositionMessage,
  runOutcome,
} from './assistant-requests.js';

test('travail Hermes pas encore fini : la demande reste En cours', () => {
  for (const status of ['started', 'queued', 'running', 'stopping']) {
    assert.deepEqual(runOutcome({ status }), { kind: 'running' });
  }
});

test('travail terminé avec un texte : Répondue, avec l’avis tel quel (AS37)', () => {
  assert.deepEqual(runOutcome({ status: 'completed', output: '## Avancement\n- 3 actions terminées' }), {
    kind: 'answered',
    advice: '## Avancement\n- 3 actions terminées',
  });
});

test('réponse vide ou en erreur : Échouée, « l’assistant n’a pas pu répondre » (AS38)', () => {
  assert.deepEqual(runOutcome({ status: 'completed', output: '  \n' }), { kind: 'failed', reason: 'noAnswer' });
  assert.deepEqual(runOutcome({ status: 'completed' }), { kind: 'failed', reason: 'noAnswer' });
  assert.deepEqual(runOutcome({ status: 'failed', error: 'boom' }), { kind: 'failed', reason: 'noAnswer' });
});

test('travail perdu (interrompu, inconnu, introuvable) : Échouée, « assistant indisponible » (AS38)', () => {
  assert.deepEqual(runOutcome({ status: 'interrupted' }), { kind: 'failed', reason: 'unavailable' });
  assert.deepEqual(runOutcome({ status: 'unknown' }), { kind: 'failed', reason: 'unavailable' });
  assert.deepEqual(runOutcome({ status: 'cancelled' }), { kind: 'failed', reason: 'unavailable' });
  assert.deepEqual(runOutcome(null), { kind: 'failed', reason: 'unavailable' });
});

test('position dans la file, avec ses variantes à 0 et à 1 (AS4, ticket 08)', () => {
  assert.equal(queuePositionMessage('fr', 0), 'Votre demande est la prochaine.');
  assert.equal(queuePositionMessage('fr', 1), '1 demande avant la vôtre.');
  assert.equal(queuePositionMessage('fr', 2), '2 demandes avant la vôtre.');
  assert.equal(queuePositionMessage('en', 2), '2 requests ahead of yours.');
});

test('Répondue, Échouée et Annulée sont définitives ; En attente et En cours non (AS2)', () => {
  assert.deepEqual(
    (['pending', 'running', 'answered', 'failed', 'cancelled'] as const).filter(isFinalStatus),
    ['answered', 'failed', 'cancelled'],
  );
});

test('délai applicable selon le mode : 20 minutes en rapide, 60 en approfondi au départ (AS5, AS32)', () => {
  assert.equal(applicableTimeoutMinutes('quick', ASSISTANT_SETTINGS_DEFAULTS), 20);
  assert.equal(applicableTimeoutMinutes('thorough', ASSISTANT_SETTINGS_DEFAULTS), 60);
  const changed = { ...ASSISTANT_SETTINGS_DEFAULTS, quickTimeoutMinutes: 5, thoroughTimeoutMinutes: 90 };
  assert.equal(applicableTimeoutMinutes('quick', changed), 5);
  assert.equal(applicableTimeoutMinutes('thorough', changed), 90);
});

test('délai dépassé au-delà du délai noté au passage En cours, pas à la minute exacte (AS5)', () => {
  const readAt = '2026-11-26T14:00:00.000Z';
  assert.equal(isTimedOut(readAt, 20, new Date('2026-11-26T14:20:00.000Z')), false);
  assert.equal(isTimedOut(readAt, 20, new Date('2026-11-26T14:20:01.000Z')), true);
});

test('places libres dans la limite du parallélisme, jamais négatives (AS4, AS32)', () => {
  assert.equal(freeSlots(1, 0), 1);
  assert.equal(freeSlots(1, 1), 0);
  assert.equal(freeSlots(3, 1), 2);
  // Parallélisme baissé pendant que des demandes tournent : elles finissent, rien ne part.
  assert.equal(freeSlots(1, 3), 0);
});

test('estimation : caractères des données lues ÷ 3, arrondi au supérieur (AS21)', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('abc'), 1);
  assert.equal(estimateTokens('abcd'), 2);
  assert.equal(estimateTokens('x'.repeat(48_000)), 16_000);
  // Un caractère accentué ou hors du plan de base compte pour un caractère.
  assert.equal(estimateTokens('éèà'), 1);
  assert.equal(estimateTokens('😀😀😀😀'), 2);
});

test('plafond : refus au-delà, jamais à la valeur exacte (AS20)', () => {
  assert.equal(exceedsDataLimit('x'.repeat(48_000), 16_000), false);
  assert.equal(exceedsDataLimit('x'.repeat(48_001), 16_000), true);
});
