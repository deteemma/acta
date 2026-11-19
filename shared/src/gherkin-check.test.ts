import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkGherkin, GHERKIN_KEYWORDS, gherkinIssueMessage } from './gherkin-check.js';

const lines = (...l: string[]) => l.join('\n');

test('un scénario complet en français est correct', () => {
  const text = lines(
    '# Le client est connu',
    'Étant donné un client premium',
    'Et qu’il a un panier de 120 CHF',
    'Quand il valide son panier',
    'Alors il obtient 10 % de remise',
    'Mais aucun cadeau',
  );
  assert.deepEqual(checkGherkin(text, 'scenario'), []);
});

test('règle 3 : un scénario a au moins une étape Quand, signalée sur la dernière ligne', () => {
  assert.deepEqual(checkGherkin(lines('Étant donné un client', 'Alors rien', ''), 'scenario'), [
    { line: 2, code: 'missingWhen', values: {} },
  ]);
  assert.deepEqual(checkGherkin(lines('Given a customer', 'When he pays'), 'scenario'), [
    { line: 2, code: 'missingThen', values: {} },
  ]);
  // Texte vide : ligne 1.
  assert.deepEqual(
    checkGherkin('', 'scenario').map((i) => [i.line, i.code]),
    [
      [1, 'missingWhen'],
      [1, 'missingThen'],
    ],
  );
});

test('règle 3 : les synonymes Lorsque et Donc comptent, pas Et, Mais ni *', () => {
  assert.deepEqual(checkGherkin(lines("Lorsqu'il paie", 'Donc il reçoit un reçu'), 'scenario'), []);
  assert.deepEqual(checkGherkin(lines('When he pays', 'Then he gets a receipt'), 'scenario'), []);
  assert.deepEqual(
    checkGherkin(lines('* il paie', 'Et il reçoit un reçu', 'Mais rien d’autre'), 'scenario').map((i) => i.code),
    ['missingWhen', 'missingThen'],
  );
});

test('règle 3 ne vaut pas pour le Contexte', () => {
  assert.deepEqual(checkGherkin(lines('Étant donné un client', 'Et un panier'), 'background'), []);
  assert.deepEqual(checkGherkin(lines('Given a customer', 'And a cart'), 'background'), []);
});

test('les mots-clés sont publiés pour la bulle d’aide', () => {
  assert.ok(GHERKIN_KEYWORDS.fr.when.includes('Quand'));
  assert.ok(GHERKIN_KEYWORDS.en.then.includes('Then'));
});

const codes = (text: string, subject: 'scenario' | 'background') =>
  checkGherkin(text, subject).map((i) => [i.line, i.code, i.values] as const);

test('règle 2 (modifiée le 19.11.2026) : mots-clés français et anglais admis, même mélangés', () => {
  // Tout en anglais, tout en français, ou les deux dans le même texte.
  assert.deepEqual(checkGherkin(lines('Given a customer', 'When he pays', 'Then he gets a receipt'), 'scenario'), []);
  assert.deepEqual(checkGherkin(lines('Given un client', 'Quand il paie', 'Then il reçoit un reçu', 'Mais rien d’autre'), 'scenario'), []);
  assert.deepEqual(checkGherkin(lines('When il paie <m>', 'Alors rien', 'Examples:', '| m |', '| 1 |'), 'scenario'), []);
  assert.deepEqual(checkGherkin(lines('Quand he pays <m>', 'Then nothing', 'Exemples:', '| m |', '| 1 |'), 'scenario'), []);
  assert.deepEqual(checkGherkin(lines('Étant donné un client', 'And a cart'), 'background'), []);
  // Règle 3 : « When » et « Then » comptent comme « Quand » et « Alors », et inversement.
  assert.deepEqual(codes(lines('Given un client', 'When il paie'), 'scenario'), [[2, 'missingThen', {}]]);
  // D7 vaut dans les deux langues.
  assert.deepEqual(codes(lines('Feature: Paiement', 'Quand il paie', 'Alors rien'), 'scenario'), [[1, 'excludedLine', { keyword: 'Feature' }]]);
  assert.deepEqual(codes(lines('When he pays', 'Then nothing', 'Scénario: Paiement'), 'scenario'), [[3, 'excludedLine', { keyword: 'Scénario' }]]);
});

test('D7 : les lignes Fonctionnalité, Règle, Contexte et Scénario sont exclues', () => {
  const valid = ['Quand il paie', 'Alors il reçoit un reçu'];
  for (const keyword of ['Fonctionnalité', 'Règle', 'Scénario', 'Plan du scénario', 'Exemple', 'Contexte']) {
    assert.deepEqual(codes(lines(`${keyword}: Paiement`, ...valid), 'scenario'), [[1, 'excludedLine', { keyword }]]);
  }
  const validEn = ['When he pays', 'Then he gets a receipt'];
  for (const keyword of ['Feature', 'Rule', 'Scenario', 'Scenario Outline', 'Background']) {
    assert.deepEqual(codes(lines(...validEn, `${keyword}: Payment`), 'scenario'), [[3, 'excludedLine', { keyword }]]);
  }
  assert.deepEqual(codes(lines('Étant donné un client', 'Scénario: Paiement'), 'background'), [
    [2, 'excludedLine', { keyword: 'Scénario' }],
  ]);
});

test('D7 : étiquettes, commentaires, tableaux de données et blocs de texte sont admis', () => {
  const fr = lines(
    'Étant donné les clients suivants :',
    '  | nom   | statut  |',
    '  | Alice | premium |',
    '# un commentaire',
    'Quand Alice envoie le message',
    '  """json',
    '  { "Given": "pas un mot-clé ici", "Scénario": 1 }',
    '  """',
    'Alors le message est accepté',
  );
  assert.deepEqual(checkGherkin(fr, 'scenario'), []);
  const en = lines('Given the customers:', '  | name |', '  | Bob  |', 'When Bob sends', '  ```', '  Quand ceci', '  ```', 'Then it is accepted');
  assert.deepEqual(checkGherkin(en, 'scenario'), []);
});

test('règle 4 : chaque paramètre d’un plan de scénario a sa colonne dans les Exemples', () => {
  const fr = lines(
    'Quand le client paie <montant> CHF',
    '  | moyen    |',
    '  | <moyen>  |',
    'Alors il obtient <remise>',
    '',
    '@premium',
    'Exemples:',
    '  | montant | remise |',
    '  | 120     | 10 %   |',
  );
  assert.deepEqual(codes(fr, 'scenario'), [[3, 'missingParameter', { parameter: 'moyen' }]]);
  const en = lines(
    'When the customer pays <amount>',
    'Then he gets <discount>',
    'Examples: small',
    '  | amount | discount |',
    '  | 10     | 0        |',
    'Examples: large',
    '  | amount |',
    '  | 500    |',
  );
  assert.deepEqual(codes(en, 'scenario'), [[2, 'missingParameter', { parameter: 'discount' }]]);
  // Sans Exemples, ce n'est pas un plan de scénario : <montant> est du texte.
  assert.deepEqual(checkGherkin(lines('Quand il paie <montant>', 'Alors rien'), 'scenario'), []);
});

test('grammaire : texte libre admis avant la première étape et après Exemples, pas ailleurs', () => {
  assert.deepEqual(
    checkGherkin(lines('Ce scénario couvre le client premium.', '', 'Quand il paie <m>', 'Alors rien', 'Exemples: gros montants', 'Seulement les gros.', '| m |', '| 1 |'), 'scenario'),
    [],
  );
  assert.deepEqual(codes(lines('When he pays', 'some free text', 'Then he is happy'), 'scenario'), [[2, 'unexpectedText', {}]]);
  // Un commentaire clôt le texte libre, comme dans Gherkin.
  assert.deepEqual(codes(lines('Texte libre', '# commentaire', 'Encore du texte', 'Quand il paie', 'Alors rien'), 'scenario'), [
    [3, 'unexpectedText', {}],
  ]);
  // « Lorsqu’il » avec une apostrophe typographique n'est pas un mot-clé Gherkin.
  assert.deepEqual(codes(lines('Quand il paie', 'Lorsqu’il paie', 'Alors rien'), 'scenario'), [[2, 'unexpectedText', {}]]);
});

test('grammaire : tableaux et blocs de texte suivent une étape', () => {
  assert.deepEqual(codes(lines('| a |', 'Quand il paie', 'Alors rien'), 'scenario'), [[1, 'unexpectedTable', {}]]);
  assert.deepEqual(codes(lines('When he pays', '| a | b |', '| 1 |', 'Then nothing'), 'scenario'), [
    [3, 'inconsistentCells', { expected: '2', actual: '1' }],
  ]);
  assert.deepEqual(codes(lines('When he pays', '| a |', '"""', 'x', '"""', 'Then nothing'), 'scenario'), [[3, 'unexpectedDocString', {}]]);
  assert.deepEqual(codes(lines('Quand il paie', '"""', 'Alors rien'), 'scenario'), [
    [2, 'unclosedDocString', { delimiter: '"""' }],
    // « Alors rien » est dans le bloc non fermé : ce n'est pas une étape.
    [3, 'missingThen', {}],
  ]);
  // Une barre échappée ne sépare pas les cellules.
  assert.deepEqual(checkGherkin(lines('Quand il saisit', '| a \\| b | c |', '| 1 | 2 |', 'Alors rien'), 'scenario'), []);
});

test('grammaire : les étiquettes précèdent les Exemples, sans espace ; les étapes viennent avant', () => {
  assert.deepEqual(codes(lines('@lent', 'Quand il paie', 'Alors rien'), 'scenario'), [[1, 'misplacedTag', {}]]);
  assert.deepEqual(codes(lines('When he pays', 'Then nothing', '@slow tag', 'Examples:', '| a |'), 'scenario'), [
    [3, 'invalidTag', { tag: '@slow tag' }],
  ]);
  assert.deepEqual(codes(lines('Quand il paie', 'Alors rien', 'Exemples:', '| a |', 'Et encore'), 'scenario'), [[5, 'stepAfterExamples', {}]]);
  assert.deepEqual(codes(lines('Quand il paie', 'Alors rien', 'Exemples :', '| a |'), 'scenario'), [
    [3, 'spaceBeforeColon', { keyword: 'Exemples' }],
  ]);
  assert.deepEqual(codes(lines('When he pays', 'Then nothing', 'Examples :', '| a |'), 'scenario'), [
    [3, 'spaceBeforeColon', { keyword: 'Examples' }],
  ]);
});

test('le Contexte n’a ni étiquette ni Exemples', () => {
  assert.deepEqual(codes(lines('Given a customer', '@tag', 'Examples:'), 'background'), [
    [2, 'tagInBackground', {}],
    [3, 'examplesInBackground', {}],
  ]);
  assert.deepEqual(codes(lines('Étant donné un client', '@lent', 'Exemples:'), 'background'), [
    [2, 'tagInBackground', {}],
    [3, 'examplesInBackground', {}],
  ]);
});

test('chaque règle de grammaire vaut aussi dans l’autre langue', () => {
  assert.deepEqual(codes(lines('Given a customer', 'Then nothing'), 'scenario'), [[2, 'missingWhen', {}]]);
  assert.deepEqual(codes(lines('Étant donné un client', 'Quand il paie'), 'scenario'), [[2, 'missingThen', {}]]);
  assert.deepEqual(codes(lines('| a |', 'When he pays', 'Then nothing'), 'scenario'), [[1, 'unexpectedTable', {}]]);
  assert.deepEqual(codes(lines('Quand il paie', '| a | b |', '| 1 |', 'Alors rien'), 'scenario'), [
    [3, 'inconsistentCells', { expected: '2', actual: '1' }],
  ]);
  assert.deepEqual(codes(lines('Quand il paie', '| a |', '"""', 'x', '"""', 'Alors rien'), 'scenario'), [[3, 'unexpectedDocString', {}]]);
  assert.deepEqual(codes(lines('When he pays', 'Then nothing', '```'), 'scenario'), [[3, 'unclosedDocString', { delimiter: '```' }]]);
  assert.deepEqual(codes(lines('@slow', 'When he pays', 'Then nothing'), 'scenario'), [[1, 'misplacedTag', {}]]);
  assert.deepEqual(codes(lines('Quand il paie', 'Alors rien', '@lent client', 'Exemples:', '| a |'), 'scenario'), [
    [3, 'invalidTag', { tag: '@lent client' }],
  ]);
  assert.deepEqual(codes(lines('When he pays', 'Then nothing', 'Examples:', '| a |', 'And again'), 'scenario'), [[5, 'stepAfterExamples', {}]]);
});

test('une ligne exclue l’est aussi avec une espace avant le deux-points', () => {
  assert.deepEqual(codes(lines('Scénario : Connexion', 'Quand x', 'Alors y'), 'scenario'), [[1, 'excludedLine', { keyword: 'Scénario' }]]);
  assert.deepEqual(codes(lines('Feature : Login', 'When x', 'Then y'), 'scenario'), [[1, 'excludedLine', { keyword: 'Feature' }]]);
});

test('une comparaison n’est pas un paramètre ; une étape sans texte reste une étape', () => {
  assert.deepEqual(checkGherkin(lines('Quand il paie <m>', 'Alors le total est < 10 et > 2', 'Exemples:', '| m |', '| 1 |'), 'scenario'), []);
  assert.deepEqual(checkGherkin(lines('When he pays <m>', 'Then the total is < 10 and > 2', 'Examples:', '| m |', '| 1 |'), 'scenario'), []);
  // Gherkin ne retire que les espaces de tête : « Quand » suivi d'une espace est une étape.
  assert.deepEqual(checkGherkin(lines('Quand ', 'Alors rien'), 'scenario'), []);
  assert.deepEqual(checkGherkin(lines('When ', 'Then nothing'), 'scenario'), []);
});

test('les messages sont dans la langue de l’utilisateur, les mots-clés dans celle des scénarios', () => {
  const [missing] = checkGherkin('Given a customer', 'scenario');
  assert.equal(gherkinIssueMessage('fr', 'en', missing!), 'Le scénario n’a aucune étape « When ».');
  assert.equal(gherkinIssueMessage('en', 'fr', missing!), 'The scenario has no “Quand” step.');
});
