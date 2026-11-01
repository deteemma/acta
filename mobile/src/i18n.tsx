// Langue de l'interface (ADR-0013) : proposée d'après le téléphone, puis
// remplacée par celle enregistrée sur le compte dès la connexion.
import { isActionRefusal, LOCALES, type Locale, type MessageKey, pickLocale, translate } from '@app/shared';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { Globe } from 'lucide-react-native';
import { Pressable, StyleSheet, Text } from 'react-native';
import { type Api, ApiError } from './api';
import { type AppTheme, useStyles, useTheme } from './theme';

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
    if (isActionRefusal(error.refusal)) return t(`action.refusal.${error.refusal}`);
    return error.status === 409 ? t('initiatives.codeTaken') : t('error.http', { status: error.status });
  }
  return String(error);
}

/**
 * Globe et langue en cours ; chaque appui passe à la langue suivante (en-tête
 * validé le 01.11.2026, refonte du design, ticket 06).
 */
export function LanguageSelector() {
  const { locale, setLocale, t } = useI18n();
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const next = LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length];
  return (
    <Pressable
      onPress={() => setLocale(next)}
      accessibilityRole="button"
      accessibilityLabel={`${t('language.label')} : ${t(`language.${locale}`)}`}
      accessibilityHint={t(`language.${next}`)}
      style={styles.button}
    >
      <Globe color={theme.colors.text} size={20} strokeWidth={1.75} />
      <Text style={styles.code}>{locale.toUpperCase()}</Text>
    </Pressable>
  );
}

const makeStyles = ({ colors, space, radius, text, fonts }: AppTheme) =>
  StyleSheet.create({
    button: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[1],
      paddingHorizontal: space[2],
      borderRadius: radius.md,
    },
    code: { color: colors.text, fontFamily: fonts.semibold, fontSize: text.small },
  });
