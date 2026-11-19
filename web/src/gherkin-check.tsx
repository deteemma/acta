// Validation de syntaxe Gherkin (phase 3, ticket 04) : à la demande de tout
// membre, lecteur compris et sur une initiative archivée (D17), sur le texte
// affiché, même non enregistré. N'empêche jamais d'enregistrer (D11) et rien
// n'est conservé (D15). Règles dans @app/shared (gherkin-check.ts).
import {
  checkGherkin,
  GHERKIN_KEYWORDS,
  type GherkinCheckSubject,
  type GherkinIssue,
  gherkinIssueMessage,
  gherkinMessageValues,
  type Locale,
} from '@app/shared';
import { useState } from 'react';
import { useI18n } from './i18n';

/**
 * Bouton « Valider la syntaxe », son résultat et la bulle d'aide des règles.
 * `language` : langue de la Fonctionnalité, ou celle qui lui sera donnée (D5).
 * Le résultat ne vaut que pour le texte vérifié : il disparaît dès que le texte change.
 */
export function GherkinCheck({
  text,
  subject,
  language,
  label,
}: {
  text: string;
  subject: GherkinCheckSubject;
  language: Locale;
  /** Nom accessible du bouton (« Valider la syntaxe du scénario CRM-SC-001 »). */
  label: string;
}) {
  const { t, locale } = useI18n();
  const [result, setResult] = useState<{ text: string; language: Locale; issues: GherkinIssue[] } | null>(null);
  const current = result && result.text === text && result.language === language ? result : null;

  return (
    <div className="gherkin-check">
      <div className="gherkin-check-actions">
        <button type="button" className="ghost" aria-label={label} onClick={() => setResult({ text, language, issues: checkGherkin(text, subject, language) })}>
          {t('gherkinCheck.run')}
        </button>
        <GherkinHelp language={language} />
      </div>
      <div role="status">
        {current &&
          (current.issues.length === 0 ? (
            <p className="gherkin-check-result tone-positive">{t('gherkinCheck.ok')}</p>
          ) : (
            <div className="gherkin-check-result error">
              <p>{t('gherkinCheck.errors', { count: current.issues.length })}</p>
              <ul>
                {current.issues.map((issue, index) => (
                  <li key={index}>
                    <strong>{t('gherkinCheck.line', { line: issue.line })}</strong> {gherkinIssueMessage(locale, language, issue)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </div>
  );
}

/** Bulle d'aide : les règles contrôlées (D15) et les mots-clés de la langue de la Fonctionnalité. */
function GherkinHelp({ language }: { language: Locale }) {
  const { t, locale } = useI18n();
  const values = gherkinMessageValues(locale, language);
  const keywords = GHERKIN_KEYWORDS[language];
  const groups = [keywords.given, keywords.when, keywords.then, keywords.and, keywords.but, keywords.examples];

  return (
    <details className="gherkin-help">
      <summary aria-label={t('gherkinCheck.helpTitle')} title={t('gherkinCheck.helpTitle')}>
        ?
      </summary>
      <div className="gherkin-help-card">
        <strong>{t('gherkinCheck.helpTitle')}</strong>
        <p>{t('gherkinCheck.helpIntro')}</p>
        <ol>
          <li>{t('gherkinCheck.helpGrammar', values)}</li>
          <li>
            {t('gherkinCheck.helpLanguage', values)}
            <ul className="gherkin-keywords" lang={language}>
              {groups.map((group) => (
                <li key={group[0]}>{group.join(' · ')}</li>
              ))}
            </ul>
          </li>
          <li>{t('gherkinCheck.helpWhenThen', values)}</li>
          <li>{t('gherkinCheck.helpParameters', values)}</li>
        </ol>
      </div>
    </details>
  );
}
