// Langue de l'interface (ADR-0013) : proposée d'après le navigateur, puis
// remplacée par celle enregistrée sur le compte dès la connexion.
import { LOCALES, type Locale, type MessageKey, pickLocale, translate } from '@app/shared';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';

interface I18n {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18n | null>(null);

export const browserLocale = () => pickLocale(navigator.languages);

export function I18nProvider({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(browserLocale);

  useEffect(() => {
    if (!signedIn) return;
    // Sans réponse du serveur, on garde la langue du navigateur.
    api.me().then(
      (me) => me.locale && setLocaleState(me.locale),
      () => undefined,
    );
  }, [signedIn]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      // Avant connexion, le choix ne vaut que pour la page en cours.
      if (signedIn) void api.updateMe({ locale: next }).catch(() => undefined);
    },
    [signedIn],
  );

  const value = useMemo<I18n>(
    () => ({ locale, setLocale, t: (key, params) => translate(locale, key, params) }),
    [locale, setLocale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const i18n = useContext(I18nContext);
  if (!i18n) throw new Error('useI18n() hors de I18nProvider');
  return i18n;
}

export function LanguageSelector() {
  const { locale, setLocale, t } = useI18n();
  return (
    <select aria-label={t('language.label')} value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
      {LOCALES.map((l) => (
        <option key={l} value={l}>
          {t(`language.${l}`)}
        </option>
      ))}
    </select>
  );
}
