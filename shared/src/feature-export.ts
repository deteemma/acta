// Export .feature (phase 3, ticket 05) : la Fonctionnalité d'une exigence en un
// fichier Gherkin standard, pour les équipes de développement ou de test.
// Décision D16 de .scratch/phase-3/spec.md : les textes sont repris tels qu'ils
// ont été saisis, même invalides, sans traduire les mots-clés de l'autre langue
// (décidé le 19.11.2026) ; l'export est proposé même sans scénario ni Contexte.
import { containsExamples, GHERKIN_KEYWORDS } from './gherkin-check.js';
import type { Locale } from './i18n.js';
import { richTextToPlainText } from './rich-text.js';

/** Ce que contient le fichier : l'exigence, la langue de sa Fonctionnalité, son Contexte et ses scénarios dans l'ordre. */
export interface FeatureFileContent {
  requirement: { reference: string; title: string; statement: string };
  language: Locale;
  background: string | null;
  scenarios: readonly { reference: string; title: string; text: string }[];
}

/** D16 : nommé d'après la référence de l'exigence. */
export const featureFileName = (requirementReference: string) => `${requirementReference}.feature`;

/** Chaque ligne d'un texte, en retrait ; les lignes vides restent vides. */
const indented = (text: string, depth: number) =>
  text.split(/\r?\n/).map((line) => (line.trim() === '' ? '' : `${' '.repeat(depth)}${line}`));

/**
 * Fichier .feature (D16), dans l'ordre : ligne `# language:` qui permet aux outils
 * de lire les mots-clés de la langue ; ligne « Fonctionnalité » avec la référence
 * et le titre de l'exigence ; énoncé en description ; Contexte ; scénarios.
 */
export function featureFile({ requirement, language, background, scenarios }: FeatureFileContent): string {
  const keywords = GHERKIN_KEYWORDS[language];
  const statement = richTextToPlainText(requirement.statement);
  const lines = [
    `# language: ${language}`,
    `${keywords.feature[0]!}: ${requirement.reference} ${requirement.title}`,
    ...(statement.trim() ? indented(statement, 2) : []),
  ];
  if (background != null) lines.push('', `  ${keywords.background[0]!}:`, ...indented(background, 4));
  for (const scenario of scenarios) {
    // « Plan du scénario » si le texte contient des Exemples, quelle que soit leur langue.
    const keyword = containsExamples(scenario.text) ? keywords.scenarioOutline[0]! : keywords.scenario[0]!;
    lines.push('', `  @${scenario.reference}`, `  ${keyword}: ${scenario.title}`, ...indented(scenario.text, 4));
  }
  return `${lines.join('\n')}\n`;
}
