// Validation de syntaxe Gherkin (phase 3, ticket 04) : contrôle, demandé par
// l'utilisateur, du texte d'un scénario ou du Contexte. Rien n'est conservé et
// un texte invalide s'enregistre quand même (D11, D15). Décisions D7 et D15 de
// .scratch/phase-3/spec.md, précisées le 19.11.2026 : le texte libre est admis
// là où Gherkin l'admet ; « Quand » et « Alors » comptent leurs synonymes ; une
// erreur sans ligne propre porte la dernière ligne du texte. Règle 2 modifiée le
// même jour : les mots-clés français et anglais sont admis, même mélangés, quelle
// que soit la langue des scénarios ; celle-ci ne sert plus qu'aux messages.
//
// Pas de bibliothèque d'analyse : le texte n'est qu'un corps de scénario ou de
// Contexte, sans ligne « Fonctionnalité » ni « Scénario » (D7), et les messages
// sont dans la langue de l'utilisateur. Les états suivent la grammaire Gherkin
// officielle (cucumber/gherkin, gherkin.berp) et ses mots-clés
// (gherkin-languages.json, fr et en).
import { type Locale, LOCALES, translate } from './i18n.js';

/** Mots-clés Gherkin d'une langue, tels qu'ils s'écrivent (sans l'espace ni le deux-points qui suivent). */
export interface GherkinKeywords {
  feature: readonly string[];
  rule: readonly string[];
  background: readonly string[];
  scenario: readonly string[];
  scenarioOutline: readonly string[];
  examples: readonly string[];
  given: readonly string[];
  when: readonly string[];
  then: readonly string[];
  and: readonly string[];
  but: readonly string[];
}

/** Mots-clés officiels de Gherkin (gherkin-languages.json), en français et en anglais. */
export const GHERKIN_KEYWORDS: Record<Locale, GherkinKeywords> = {
  fr: {
    feature: ['Fonctionnalité'],
    rule: ['Règle'],
    background: ['Contexte'],
    scenario: ['Scénario', 'Exemple'],
    scenarioOutline: ['Plan du scénario', 'Plan du Scénario'],
    examples: ['Exemples'],
    given: [
      'Étant donné',
      'Étant donnée',
      'Étant donnés',
      'Étant données',
      'Étant donné que',
      "Étant donné qu'",
      'Etant donné',
      'Etant donnée',
      'Etant donnés',
      'Etant données',
      'Etant donné que',
      "Etant donné qu'",
      'Soit',
      'Sachant',
      'Sachant que',
      "Sachant qu'",
    ],
    when: ['Quand', 'Lorsque', "Lorsqu'"],
    then: ['Alors', 'Donc'],
    and: ['Et', 'Et que', "Et qu'"],
    but: ['Mais', 'Mais que', "Mais qu'"],
  },
  en: {
    feature: ['Feature', 'Business Need', 'Ability'],
    rule: ['Rule'],
    background: ['Background'],
    scenario: ['Scenario', 'Example'],
    scenarioOutline: ['Scenario Outline', 'Scenario Template'],
    examples: ['Examples', 'Scenarios'],
    given: ['Given'],
    when: ['When'],
    then: ['Then'],
    and: ['And'],
    but: ['But'],
  },
};

/** Ce que l'on valide : le texte d'un scénario, ou celui du Contexte. */
export type GherkinCheckSubject = 'scenario' | 'background';

/**
 * Erreurs de la validation :
 * - `excludedLine` : ligne « Fonctionnalité », « Règle », « Contexte » ou « Scénario » dans le texte (D7) ;
 * - `spaceBeforeColon` : « Exemples : » au lieu de « Exemples: » ;
 * - `unexpectedText` : texte libre ailleurs qu'avant la première étape ou juste après « Exemples: » ;
 * - `unexpectedTable`, `unexpectedDocString` : tableau ou bloc `"""` sans étape juste avant ;
 * - `unclosedDocString` : bloc `"""` sans ligne de fin ;
 * - `inconsistentCells` : ligne de tableau qui n'a pas le nombre de cellules de la première ;
 * - `invalidTag` : étiquette qui contient une espace ;
 * - `misplacedTag` : étiquette qui ne précède pas une ligne « Exemples: » ;
 * - `stepAfterExamples` : étape placée après les Exemples ;
 * - `tagInBackground`, `examplesInBackground` : ni étiquette ni Exemples dans le Contexte ;
 * - `missingWhen`, `missingThen` : scénario sans étape « Quand » ou « Alors » (D15, règle 3) ;
 * - `missingParameter` : `<paramètre>` d'un plan de scénario sans sa colonne dans les Exemples (D15, règle 4).
 */
export const GHERKIN_ISSUE_CODES = [
  'excludedLine',
  'spaceBeforeColon',
  'unexpectedText',
  'unexpectedTable',
  'unexpectedDocString',
  'unclosedDocString',
  'inconsistentCells',
  'invalidTag',
  'misplacedTag',
  'stepAfterExamples',
  'tagInBackground',
  'examplesInBackground',
  'missingWhen',
  'missingThen',
  'missingParameter',
] as const;
export type GherkinIssueCode = (typeof GHERKIN_ISSUE_CODES)[number];

/** Erreur, avec son numéro de ligne (à partir de 1) et les valeurs de son message. */
export interface GherkinIssue {
  line: number;
  code: GherkinIssueCode;
  values: Record<string, string>;
}

type StepType = 'given' | 'when' | 'then' | 'and' | 'but' | 'star';
const STEP_TYPES = ['given', 'when', 'then', 'and', 'but'] as const;
const HEADER_TYPES = ['feature', 'rule', 'background', 'scenario', 'scenarioOutline'] as const;

type Token =
  | { kind: 'empty' }
  | { kind: 'comment' }
  | { kind: 'tag'; text: string }
  | { kind: 'row'; cells: string[] }
  | { kind: 'docString'; delimiter: string }
  | { kind: 'step'; type: StepType; text: string }
  | { kind: 'examples' }
  | { kind: 'issue'; code: GherkinIssueCode; values: Record<string, string> }
  | { kind: 'other' };

/** Mot-clé d'étape en tête de ligne : suivi d'une espace, sauf s'il finit par une apostrophe (« Lorsqu'il »). */
function stepKeyword(trimmed: string, keywords: GherkinKeywords): { type: StepType; keyword: string; text: string } | null {
  if (trimmed.startsWith('* ')) return { type: 'star', keyword: '*', text: trimmed.slice(2) };
  let best: { type: StepType; keyword: string; prefix: string } | null = null;
  for (const type of STEP_TYPES) {
    for (const keyword of keywords[type]) {
      const prefix = keyword.endsWith("'") ? keyword : `${keyword} `;
      if (trimmed.startsWith(prefix) && (!best || prefix.length > best.prefix.length)) best = { type, keyword, prefix };
    }
  }
  return best && { type: best.type, keyword: best.keyword, text: trimmed.slice(best.prefix.length) };
}

/** Mot-clé de titre (« Exemples: », « Scénario: »…) en tête de ligne, suivi du deux-points ou, à tort, d'une espace et du deux-points. */
function headerKeyword(trimmed: string, keywords: GherkinKeywords): { type: (typeof HEADER_TYPES)[number] | 'examples'; keyword: string; spaced: boolean } | null {
  for (const type of [...HEADER_TYPES, 'examples'] as const) {
    for (const keyword of keywords[type]) {
      if (trimmed.startsWith(`${keyword}:`)) return { type, keyword, spaced: false };
      if (/^\s+:/.test(trimmed.slice(keyword.length)) && trimmed.startsWith(keyword)) return { type, keyword, spaced: true };
    }
  }
  return null;
}

/** Cellules d'une ligne de tableau, avec les échappements de Gherkin (\| \\ \n) ; ce qui suit le dernier | est ignoré. */
function tableCells(trimmed: string): string[] {
  const cells: string[] = [];
  let cell = '';
  for (let i = 1; i < trimmed.length; i++) {
    const c = trimmed[i]!;
    if (c === '|') {
      cells.push(cell.trim());
      cell = '';
    } else if (c === '\\' && i + 1 < trimmed.length) {
      const next = trimmed[++i]!;
      cell += next === 'n' ? '\n' : next === '|' || next === '\\' ? next : `\\${next}`;
    } else {
      cell += c;
    }
  }
  return cells;
}

function tokenize(line: string): Token {
  // Comme Gherkin, seules les espaces de tête sont retirées : « Quand » suivi d'une espace est une étape.
  const trimmed = line.trimStart();
  if (trimmed.trim() === '') return { kind: 'empty' };
  if (trimmed.startsWith('#')) return { kind: 'comment' };
  if (trimmed.startsWith('@')) return { kind: 'tag', text: trimmed };
  if (trimmed.startsWith('|')) return { kind: 'row', cells: tableCells(trimmed) };
  if (trimmed.startsWith('"""') || trimmed.startsWith('```')) return { kind: 'docString', delimiter: trimmed.slice(0, 3) };
  // D15, règle 2 modifiée le 19.11.2026 : mots-clés français et anglais admis, quelle que soit la langue des scénarios.
  for (const language of LOCALES) {
    const header = headerKeyword(trimmed, GHERKIN_KEYWORDS[language]);
    // Une ligne exclue (D7) l'est avec ou sans espace avant le deux-points.
    if (header && header.type !== 'examples') return { kind: 'issue', code: 'excludedLine', values: { keyword: header.keyword } };
    if (header?.spaced) return { kind: 'issue', code: 'spaceBeforeColon', values: { keyword: header.keyword } };
    if (header) return { kind: 'examples' };
  }
  for (const language of LOCALES) {
    const step = stepKeyword(trimmed, GHERKIN_KEYWORDS[language]);
    if (step) return { kind: 'step', type: step.type, text: step.text };
  }
  return { kind: 'other' };
}

/**
 * Où en est la lecture :
 * - `start` : avant toute étape, texte libre admis (la description de Gherkin) ;
 * - `description` : dans ce texte libre ; `afterComment` : un commentaire l'a clos ;
 * - `step` : juste après une étape, qui peut recevoir un tableau ou un bloc `"""` ;
 * - `stepTable` : dans le tableau d'une étape ; `stepDone` : l'argument de l'étape est complet ;
 * - `examples*` : mêmes états pour un bloc d'Exemples ; `examplesTable` : dans son tableau.
 */
type State =
  | 'start'
  | 'description'
  | 'afterComment'
  | 'step'
  | 'stepTable'
  | 'stepDone'
  | 'examplesStart'
  | 'examplesDescription'
  | 'examplesAfterComment'
  | 'examplesTable';

const DESCRIPTION_STATES: Partial<Record<State, { text: State; comment: State }>> = {
  start: { text: 'description', comment: 'afterComment' },
  description: { text: 'description', comment: 'afterComment' },
  examplesStart: { text: 'examplesDescription', comment: 'examplesAfterComment' },
  examplesDescription: { text: 'examplesDescription', comment: 'examplesAfterComment' },
};
const IN_EXAMPLES: readonly State[] = ['examplesStart', 'examplesDescription', 'examplesAfterComment', 'examplesTable'];

/**
 * `<paramètre>` cités dans un texte : sans espace juste après < ni juste avant >,
 * pour qu'une comparaison (« le total est < 10 et > 2 ») n'en soit pas un.
 */
const parametersIn = (text: string) => [...text.matchAll(/<([^\s<>](?:[^<>]*[^\s<>])?)>/g)].map((m) => m[1]!);

/**
 * Valide le texte d'un scénario ou du Contexte (D15), mots-clés français et
 * anglais admis. Renvoie les erreurs dans l'ordre des lignes ; aucune : syntaxe correcte.
 */
export function checkGherkin(text: string, subject: GherkinCheckSubject): GherkinIssue[] {
  const lines = text.split(/\r?\n/);
  const issues: GherkinIssue[] = [];
  const report = (line: number, code: GherkinIssueCode, values: Record<string, string> = {}) => issues.push({ line, code, values });

  let state: State = 'start';
  let tableWidth = 0;
  // Bloc `"""` ouvert : sa ligne et son délimiteur.
  let docString: { line: number; delimiter: string } | null = null;
  // Étiquettes en attente d'une ligne « Exemples: » : la ligne de la première.
  let pendingTag: number | null = null;
  const stepTypes = new Set<StepType>();
  // Plan de scénario (règle 4) : paramètres cités par les étapes et colonnes de chaque bloc d'Exemples.
  const parameters: { line: number; name: string }[] = [];
  const examplesColumns: string[][] = [];

  for (const [index, line] of lines.entries()) {
    const n = index + 1;
    if (docString) {
      if (line.trim().startsWith(docString.delimiter)) docString = null;
      continue;
    }
    const token = tokenize(line);
    if (token.kind === 'empty') continue;
    if (token.kind === 'issue') {
      report(n, token.code, token.values);
      continue;
    }
    if (token.kind === 'comment') {
      state = DESCRIPTION_STATES[state]?.comment ?? state;
      continue;
    }

    if (pendingTag !== null && token.kind !== 'tag' && token.kind !== 'examples') {
      report(pendingTag, 'misplacedTag');
      pendingTag = null;
    }

    switch (token.kind) {
      case 'tag': {
        if (subject === 'background') {
          report(n, 'tagInBackground');
          continue;
        }
        for (const tag of token.text.split(/\s#/)[0]!.split('@').slice(1)) {
          if (/\s/.test(tag.trim())) report(n, 'invalidTag', { tag: `@${tag.trim()}` });
        }
        pendingTag ??= n;
        continue;
      }
      case 'examples': {
        pendingTag = null;
        if (subject === 'background') {
          report(n, 'examplesInBackground');
          continue;
        }
        examplesColumns.push([]);
        state = 'examplesStart';
        continue;
      }
      case 'step': {
        if (IN_EXAMPLES.includes(state)) {
          report(n, 'stepAfterExamples');
          continue;
        }
        stepTypes.add(token.type);
        for (const name of parametersIn(token.text)) parameters.push({ line: n, name });
        state = 'step';
        continue;
      }
      case 'row': {
        if (state === 'step' || state === 'examplesStart' || state === 'examplesDescription' || state === 'examplesAfterComment') {
          tableWidth = token.cells.length;
          if (state === 'step') {
            state = 'stepTable';
          } else {
            examplesColumns[examplesColumns.length - 1] = token.cells;
            state = 'examplesTable';
          }
        } else if (state === 'stepTable' || state === 'examplesTable') {
          if (token.cells.length !== tableWidth) {
            report(n, 'inconsistentCells', { expected: String(tableWidth), actual: String(token.cells.length) });
          }
        } else {
          report(n, 'unexpectedTable');
          continue;
        }
        if (state === 'stepTable') for (const cell of token.cells) for (const name of parametersIn(cell)) parameters.push({ line: n, name });
        continue;
      }
      case 'docString': {
        if (state === 'step') state = 'stepDone';
        else report(n, 'unexpectedDocString');
        // Même mal placé, le bloc est lu jusqu'à sa fin : son contenu n'est pas du Gherkin.
        docString = { line: n, delimiter: token.delimiter };
        continue;
      }
      case 'other': {
        const description = DESCRIPTION_STATES[state];
        if (description) state = description.text;
        else report(n, 'unexpectedText');
        continue;
      }
    }
  }

  if (docString) report(docString.line, 'unclosedDocString', { delimiter: docString.delimiter });
  if (pendingTag !== null) report(pendingTag, 'misplacedTag');

  if (subject === 'scenario') {
    // Erreur sans ligne propre : la dernière ligne écrite, là où compléter le texte (1 si vide).
    const lastLine = lines.reduce((last, line, index) => (line.trim() ? index + 1 : last), 1);
    if (!stepTypes.has('when')) report(lastLine, 'missingWhen');
    if (!stepTypes.has('then')) report(lastLine, 'missingThen');
    if (examplesColumns.length > 0) {
      const reported = new Set<string>();
      for (const { line, name } of parameters) {
        const key = `${line}<${name}>`;
        if (!reported.has(key) && examplesColumns.some((columns) => !columns.includes(name))) {
          reported.add(key);
          report(line, 'missingParameter', { parameter: name });
        }
      }
    }
  }
  return issues.sort((a, b) => a.line - b.line);
}

/**
 * Le texte contient-il des Exemples, qui en font un plan de scénario ? Une ligne
 * « Exemples: » ou « Examples: » (les deux langues, D15), hors bloc `"""`.
 */
export function containsExamples(text: string): boolean {
  let docString: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (docString) {
      if (line.trim().startsWith(docString)) docString = null;
      continue;
    }
    const token = tokenize(line);
    if (token.kind === 'examples') return true;
    if (token.kind === 'docString') docString = token.delimiter;
  }
  return false;
}

/**
 * Message d'une erreur dans la langue de l'utilisateur (`locale`), avec les
 * mots-clés dans la langue de la Fonctionnalité (`language`).
 */
export function gherkinIssueMessage(locale: Locale, language: Locale, issue: GherkinIssue): string {
  return translate(locale, `gherkinCheck.${issue.code}`, { ...gherkinMessageValues(language), ...issue.values });
}

/** Valeurs communes aux messages et à la bulle d'aide : mots-clés cités, dans la langue de la Fonctionnalité. */
export function gherkinMessageValues(language: Locale): Record<string, string> {
  const keywords = GHERKIN_KEYWORDS[language];
  return {
    when: keywords.when[0]!,
    then: keywords.then[0]!,
    examples: keywords.examples[0]!,
  };
}
