import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLORS, cssName, SHADOWS, STATUS_TONES, THEMES, toneColors } from './index.js';

const COLOR = /^(#[0-9a-f]{6}|rgba\(\d+, \d+, \d+, (0|1|0\.\d+)\))$/;

test('chaque couleur a une valeur valide dans chaque thème', () => {
  for (const [name, value] of Object.entries(COLORS)) {
    for (const theme of THEMES) assert.match(value[theme], COLOR, `${name} (${theme})`);
  }
});

test('chaque ombre a une valeur dans chaque thème', () => {
  for (const [name, value] of Object.entries(SHADOWS)) {
    for (const theme of THEMES) assert.ok(value[theme].length > 0, `${name} (${theme})`);
  }
});

test('chaque famille de statut a ses couleurs dans chaque thème', () => {
  for (const tone of STATUS_TONES) {
    for (const theme of THEMES) assert.ok(toneColors(tone, theme).color, `${tone} (${theme})`);
  }
});

test('nom de propriété CSS d’un token', () => {
  assert.equal(cssName('accentStrong'), 'accent-strong');
  assert.equal(cssName('toneNeutralBg'), 'tone-neutral-bg');
  assert.equal(cssName('bg'), 'bg');
});
