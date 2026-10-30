// Langue de l'interface (ADR-0013) : proposée d'après le téléphone, puis
// remplacée par celle enregistrée sur le compte dès la connexion.
import { LOCALES, type Locale, type MessageKey, pickLocale, translate } from '@app/shared';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type Api, ApiError } from './api';

interface I18n {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  /** Applique la langue du compte ; ensuite, chaque choix y est enregistré. */
  linkAccount: (api: Api) => void;
  unlinkAccount: () => void;
}

const I18nContext = createContext<I18n | null>(null);

// Hermes expose Intl : pas besoin de module natif pour lire la langue du téléphone.
export const deviceLocale = () => pickLocale([Intl.DateTimeFormat().resolvedOptions().locale]);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(deviceLocale);
  const [account, setAccount] = useState<Api | null>(null);

  const linkAccount = useCallback((api: Api) => {
    setAccount(api);
    // Sans réponse du serveur, on garde la langue du téléphone.
    api.me().then(
      (me) => me.locale && setLocaleState(me.locale),
      () => undefined,
    );
  }, []);

  const unlinkAccount = useCallback(() => setAccount(null), []);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      if (account) void account.updateMe({ locale: next }).catch(() => undefined);
    },
    [account],
  );

  const value = useMemo<I18n>(
    () => ({ locale, setLocale, t: (key, params) => translate(locale, key, params), linkAccount, unlinkAccount }),
    [locale, setLocale, linkAccount, unlinkAccount],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const i18n = useContext(I18nContext);
  if (!i18n) throw new Error('useI18n() hors de I18nProvider');
  return i18n;
}

/** Message d'une erreur d'appel à l'API, dans la langue de l'interface. */
export function describeError(t: I18n['t'], error: unknown): string {
  if (error instanceof ApiError) {
    return error.status === 409 ? t('initiatives.codeTaken') : t('error.http', { status: error.status });
  }
  return String(error);
}

export function LanguageSelector() {
  const { locale, setLocale, t } = useI18n();
  return (
    <View style={styles.row} accessibilityLabel={t('language.label')}>
      {LOCALES.map((l) => (
        <Pressable
          key={l}
          onPress={() => setLocale(l)}
          accessibilityRole="button"
          accessibilityState={{ selected: l === locale }}
          accessibilityLabel={t(`language.${l}`)}
        >
          <Text style={l === locale ? styles.selected : styles.option}>{l.toUpperCase()}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  option: { opacity: 0.5, padding: 4 },
  selected: { fontWeight: '700', padding: 4 },
});
