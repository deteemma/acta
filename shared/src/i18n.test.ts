import { test } from 'node:test';
import assert from 'node:assert/strict';
import { englishTermTooltip, pickLocale, translate } from './i18n.js';

test('la langue proposée est la première langue préférée disponible', () => {
  assert.equal(pickLocale(['de-CH', 'en-GB', 'fr-FR']), 'en');
  assert.equal(pickLocale(['fr-CH']), 'fr');
});

test('à défaut de français ou d’anglais, le français est proposé', () => {
  assert.equal(pickLocale(['de-DE', 'it']), 'fr');
  assert.equal(pickLocale([]), 'fr');
});

test('les paramètres sont insérés dans le libellé traduit', () => {
  assert.equal(translate('fr', 'error.http', { status: 409 }), 'Erreur 409');
  assert.equal(translate('en', 'error.http', { status: 409 }), 'Error 409');
});

test('en français, le terme anglais du BABOK est proposé en info-bulle', () => {
  assert.equal(englishTermTooltip('fr', 'approach.predictive'), 'Predictive');
  assert.equal(englishTermTooltip('fr', 'approach.adaptive'), 'Adaptive');
  assert.equal(englishTermTooltip('en', 'approach.adaptive'), undefined);
});
