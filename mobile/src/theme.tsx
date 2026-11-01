// Thème du mobile (refonte du design, ticket 06) : les tokens de @app/shared
// (ADR-0018), dans le thème clair ou sombre du téléphone.
import {
  COLORS,
  type ColorToken,
  RADIUS,
  SHADOWS,
  SPACE,
  type StatusTone,
  TEXT,
  type Theme,
  toneColors,
} from '@app/shared';
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

/** Polices embarquées (App.tsx) : une famille par graisse, Android ignorant `fontWeight` sur une police chargée. */
export const FONTS = {
  regular: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semibold: 'IBMPlexSans_600SemiBold',
  bold: 'IBMPlexSans_700Bold',
  mono: 'IBMPlexMono_400Regular',
} as const;

export interface AppTheme {
  name: Theme;
  colors: Record<ColorToken, string>;
  shadows: Record<keyof typeof SHADOWS, string>;
  space: typeof SPACE;
  radius: typeof RADIUS;
  text: typeof TEXT;
  fonts: typeof FONTS;
  tone: (tone: StatusTone) => ReturnType<typeof toneColors>;
}

function pick<T extends Record<string, Record<Theme, string>>>(tokens: T, theme: Theme): Record<keyof T, string> {
  return Object.fromEntries(Object.entries(tokens).map(([name, value]) => [name, value[theme]])) as Record<keyof T, string>;
}

const THEMES: Record<Theme, AppTheme> = {
  light: makeTheme('light'),
  dark: makeTheme('dark'),
};

function makeTheme(name: Theme): AppTheme {
  return {
    name,
    colors: pick(COLORS, name),
    shadows: pick(SHADOWS, name),
    space: SPACE,
    radius: RADIUS,
    text: TEXT,
    fonts: FONTS,
    tone: (tone) => toneColors(tone, name),
  };
}

/** Thème du téléphone ; clair par défaut. */
export function useTheme(): AppTheme {
  return THEMES[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

/**
 * Feuille de styles d'un écran (`make` appelle `StyleSheet.create`), recalculée
 * au changement de thème.
 */
export function useStyles<T>(make: (theme: AppTheme) => T): T {
  const theme = useTheme();
  // `make` est une fonction de module : seul le thème la fait changer.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => make(theme), [theme]);
}

