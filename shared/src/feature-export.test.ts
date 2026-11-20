import { test } from 'node:test';
import assert from 'node:assert/strict';
import { featureFile, featureFileName } from './feature-export.js';

const requirement = { reference: 'CRM-EX-012', title: 'Paiement par carte', statement: 'Le client paie par carte.' };

test('le fichier porte le nom de la référence de l’exigence', () => {
  assert.equal(featureFileName('CRM-EX-012'), 'CRM-EX-012.feature');
});

test('sans scénario ni Contexte, le fichier contient la ligne Fonctionnalité et l’énoncé', () => {
  assert.equal(
    featureFile({ requirement, language: 'fr', background: null, scenarios: [] }),
    '# language: fr\nFonctionnalité: CRM-EX-012 Paiement par carte\n  Le client paie par carte.\n',
  );
});

test('en français : Contexte, puis chaque scénario dans l’ordre avec l’étiquette de sa référence', () => {
  const file = featureFile({
    requirement,
    language: 'fr',
    background: 'Étant donné un client connecté',
    scenarios: [
      { reference: 'CRM-SC-003', title: 'Carte acceptée', text: 'Quand il paie\nAlors la commande est validée' },
      {
        reference: 'CRM-SC-001',
        title: 'Carte refusée',
        text: 'Quand il paie avec <carte>\nAlors il voit <message>\n\nExemples:\n  | carte | message |\n  | expirée | Carte expirée |',
      },
    ],
  });
  assert.equal(
    file,
    [
      '# language: fr',
      'Fonctionnalité: CRM-EX-012 Paiement par carte',
      '  Le client paie par carte.',
      '',
      '  Contexte:',
      '    Étant donné un client connecté',
      '',
      '  @CRM-SC-003',
      '  Scénario: Carte acceptée',
      '    Quand il paie',
      '    Alors la commande est validée',
      '',
      '  @CRM-SC-001',
      '  Plan du scénario: Carte refusée',
      '    Quand il paie avec <carte>',
      '    Alors il voit <message>',
      '',
      '    Exemples:',
      '      | carte | message |',
      '      | expirée | Carte expirée |',
      '',
    ].join('\n'),
  );
});

test('les textes sont repris tels quels, même invalides, sans traduire les mots-clés de l’autre langue', () => {
  const file = featureFile({
    requirement,
    language: 'fr',
    background: null,
    scenarios: [
      // Mots-clés anglais dans une Fonctionnalité française : ni traduits, et leurs Examples en font un plan.
      { reference: 'CRM-SC-001', title: 'Mélange', text: 'Given un client\nQuand il paie <x>\nExamples:\n| x |' },
      // Texte invalide, avec un bloc dont le contenu ressemble à des Exemples : scénario simple.
      { reference: 'CRM-SC-002', title: 'Brouillon', text: 'Ceci n’est pas du Gherkin <<\nAlors\n  """\nExemples:\n  """' },
    ],
  });
  assert.equal(
    file,
    [
      '# language: fr',
      'Fonctionnalité: CRM-EX-012 Paiement par carte',
      '  Le client paie par carte.',
      '',
      '  @CRM-SC-001',
      '  Plan du scénario: Mélange',
      '    Given un client',
      '    Quand il paie <x>',
      '    Examples:',
      '    | x |',
      '',
      '  @CRM-SC-002',
      '  Scénario: Brouillon',
      '    Ceci n’est pas du Gherkin <<',
      '    Alors',
      '      """',
      '    Exemples:',
      '      """',
      '',
    ].join('\n'),
  );
});

test('« Exemples : » mal écrit ne fait pas un plan du scénario (réponse du 19.11.2026)', () => {
  const file = featureFile({
    requirement,
    language: 'fr',
    background: null,
    scenarios: [{ reference: 'CRM-SC-001', title: 'Espace', text: 'Quand il paie <x>\nExemples :\n| x |' }],
  });
  assert.match(file, /\n {2}Scénario: Espace\n/);
});

test('l’énoncé en texte enrichi devient une description en texte simple', () => {
  const file = featureFile({
    requirement: { ...requirement, statement: 'Le client **paie** :\n\n- par carte\n- par virement' },
    language: 'fr',
    background: null,
    scenarios: [],
  });
  assert.equal(
    file,
    '# language: fr\nFonctionnalité: CRM-EX-012 Paiement par carte\n  Le client paie :\n\n  - par carte\n  - par virement\n',
  );
});

test('en anglais : mots-clés anglais', () => {
  const file = featureFile({
    requirement: { reference: 'CRM-EX-012', title: 'Card payment', statement: 'The customer pays by card.' },
    language: 'en',
    background: 'Given a signed-in customer',
    scenarios: [
      { reference: 'CRM-SC-001', title: 'Card accepted', text: 'When they pay\nThen the order is confirmed' },
      { reference: 'CRM-SC-002', title: 'Card declined', text: 'When they pay with <card>\nThen they see <message>\nExamples:\n| card | message |' },
    ],
  });
  assert.equal(
    file,
    [
      '# language: en',
      'Feature: CRM-EX-012 Card payment',
      '  The customer pays by card.',
      '',
      '  Background:',
      '    Given a signed-in customer',
      '',
      '  @CRM-SC-001',
      '  Scenario: Card accepted',
      '    When they pay',
      '    Then the order is confirmed',
      '',
      '  @CRM-SC-002',
      '  Scenario Outline: Card declined',
      '    When they pay with <card>',
      '    Then they see <message>',
      '    Examples:',
      '    | card | message |',
      '',
    ].join('\n'),
  );
});
