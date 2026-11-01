// Propriétés personnalisées CSS tirées des tokens de `shared` (ADR-0018) :
// installées au démarrage, avant le premier affichage. Les noms ne changent pas
// (`accentStrong` → `--accent-strong`) ; les longueurs passent en rem.
import { COLORS, cssName, RADIUS, SHADOWS, SPACE, TEXT, type Theme } from '@app/shared';

const rem = (px: number) => `${px / 16}rem`;

function themedProperties(theme: Theme): string {
  return [...Object.entries(COLORS), ...Object.entries(SHADOWS)]
    .map(([name, value]) => `--${cssName(name)}: ${value[theme]};`)
    .join('\n');
}

const fixedProperties = [
  ...Object.entries(SPACE).map(([step, px]) => `--space-${step}: ${rem(px)};`),
  ...Object.entries(RADIUS).map(([name, px]) => `--radius-${name}: ${px}px;`),
  ...Object.entries(TEXT).map(([name, px]) => `--text-${cssName(name)}: ${rem(px)};`),
].join('\n');

export const DESIGN_TOKENS_CSS = `:root {
${fixedProperties}
${themedProperties('light')}
}
@media (prefers-color-scheme: dark) {
:root {
${themedProperties('dark')}
}
}`;

export function installDesignTokens() {
  const style = document.createElement('style');
  style.dataset.designTokens = '';
  style.textContent = DESIGN_TOKENS_CSS;
  document.head.prepend(style);
}
