// Tokens de design d'ACTA (ADR-0017, ADR-0018) : écrits une seule fois ici,
// lus par le web (propriétés personnalisées CSS) et par le mobile. Valeurs
// indépendantes de la plateforme : couleurs hexadécimales ou rgba(), longueurs
// en pixels. Référence visuelle : le système de design « ACTA » dans Claude
// Design (piste B — Sauge).
import type { StatusTone } from './status-tones.js';

export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** Une valeur par thème. */
export type Themed = Record<Theme, string>;

export const COLORS = {
  bg: { light: '#f5f6f1', dark: '#161a17' },
  surface: { light: '#ffffff', dark: '#1e2420' },
  sidebar: { light: '#ffffff', dark: '#1a1f1c' },
  border: { light: '#dce0d5', dark: '#303832' },
  text: { light: '#1c211d', dark: '#e8ece6' },
  muted: { light: '#5c645d', dark: '#9da79f' },
  accent: { light: '#0f6e66', dark: '#5ec4b6' },
  accentStrong: { light: '#0b5650', dark: '#8adcd0' },
  accentSoft: { light: '#ddefea', dark: '#1c3532' },
  onAccent: { light: '#ffffff', dark: '#0e1a18' },
  danger: { light: '#b42318', dark: '#fda29b' },
  dangerSolid: { light: '#d92d20', dark: '#d92d20' },
  onDanger: { light: '#ffffff', dark: '#ffffff' },
  backdrop: { light: 'rgba(0, 0, 0, 0.15)', dark: 'rgba(0, 0, 0, 0.5)' },
  toneNeutralBg: { light: '#e9ece5', dark: '#2a302c' },
  toneNeutralFg: { light: '#454c46', dark: '#cdd3cd' },
  toneProgressBg: { light: '#dbeafe', dark: '#1e2b4a' },
  toneProgressFg: { light: '#1e40af', dark: '#bfdbfe' },
  tonePositiveBg: { light: '#dcf2e3', dark: '#16301f' },
  tonePositiveFg: { light: '#166534', dark: '#86efac' },
  toneAttentionBg: { light: '#fcefd6', dark: '#3a2a12' },
  toneAttentionFg: { light: '#8a3b0c', dark: '#fcd34d' },
  toneNegativeBg: { light: '#fbe2df', dark: '#3d1a1d' },
  toneNegativeFg: { light: '#9f1239', dark: '#fda4af' },
} as const satisfies Record<string, Themed>;
export type ColorToken = keyof typeof COLORS;

/** Ombres au format CSS `box-shadow`, que React Native lit aussi. */
export const SHADOWS = {
  shadowPanel: { light: '-8px 0 24px rgba(20, 30, 22, 0.06)', dark: '-8px 0 24px rgba(0, 0, 0, 0.35)' },
  shadowPopover: { light: '0 2px 8px rgba(20, 30, 22, 0.12)', dark: '0 2px 8px rgba(0, 0, 0, 0.4)' },
  shadowFab: { light: '0 6px 18px rgba(0, 0, 0, 0.18)', dark: '0 6px 18px rgba(0, 0, 0, 0.4)' },
} as const satisfies Record<string, Themed>;

/** Espacements, en pixels. */
export const SPACE = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 7: 28, 8: 32 } as const;

/** Rayons, en pixels. */
export const RADIUS = { sm: 4, md: 5, lg: 6, pill: 24 } as const;

/** Tailles de texte, en pixels. */
export const TEXT = {
  pageTitle: 24,
  panelTitle: 19,
  sectionTitle: 16,
  body: 14,
  small: 13,
  label: 11,
  code: 12,
  badge: 12,
} as const;

/** Couleurs du badge d'une famille de statut (fond, texte). */
export function toneColors(tone: StatusTone, theme: Theme): { background: string; color: string; border?: string } {
  switch (tone) {
    case 'muted':
      return { background: 'transparent', color: COLORS.muted[theme], border: COLORS.border[theme] };
    case 'neutral':
      return { background: COLORS.toneNeutralBg[theme], color: COLORS.toneNeutralFg[theme] };
    case 'progress':
      return { background: COLORS.toneProgressBg[theme], color: COLORS.toneProgressFg[theme] };
    case 'positive':
      return { background: COLORS.tonePositiveBg[theme], color: COLORS.tonePositiveFg[theme] };
    case 'attention':
      return { background: COLORS.toneAttentionBg[theme], color: COLORS.toneAttentionFg[theme] };
    case 'negative':
      return { background: COLORS.toneNegativeBg[theme], color: COLORS.toneNegativeFg[theme] };
  }
}

/** Nom de propriété CSS d'un token : `accentStrong` → `accent-strong`. */
export const cssName = (token: string) => token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
