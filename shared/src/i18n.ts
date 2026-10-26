// Langues de l'interface (ADR-0013) : libellés écrits une seule fois ici,
// utilisés par le web et le mobile. Le contenu saisi n'est jamais traduit.

export const LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'fr';

/**
 * Langue proposée à la première connexion : la première langue préférée du
 * navigateur ou du téléphone qui est disponible, sinon le français.
 */
export function pickLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const language = tag.toLowerCase().split(/[-_]/)[0];
    const match = LOCALES.find((l) => l === language);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

const fr = {
  'app.title': 'ACTA',
  'app.startFailed': 'Impossible de démarrer : {error}',
  'app.configUnavailable': 'Configuration indisponible ({status})',
  'auth.login': 'Se connecter',
  'auth.logout': 'Se déconnecter',
  'auth.loginFailed': 'Connexion impossible : {error}',
  'language.label': 'Langue',
  'language.fr': 'Français',
  'language.en': 'English',
  'role.owner': 'Propriétaire',
  'role.contributor': 'Contributeur',
  'role.reader': 'Lecteur',
  'initiatives.title': 'Mes initiatives',
  'initiatives.empty': 'Aucune initiative pour l’instant.',
  'initiatives.codePlaceholder': 'Code (ex. CRM)',
  'initiatives.codeShortPlaceholder': 'Code',
  'initiatives.namePlaceholder': 'Nom de l’initiative',
  'initiatives.create': 'Créer',
  'initiatives.invalid':
    'Le code fait 2 à 10 lettres majuscules ou chiffres et commence par une lettre ; le nom est obligatoire (120 caractères au plus).',
  'initiatives.codeTaken': 'Ce code d’initiative est déjà utilisé.',
  'initiatives.pendingSync': 'en attente de synchronisation',
  'sync.rejected': 'Modification refusée par le serveur ({status}).',
  'error.http': 'Erreur {status}',
} as const;

export type MessageKey = keyof typeof fr;

// Le typage impose que chaque libellé existe dans les deux langues.
const en: Record<MessageKey, string> = {
  'app.title': 'ACTA',
  'app.startFailed': 'Unable to start: {error}',
  'app.configUnavailable': 'Configuration unavailable ({status})',
  'auth.login': 'Sign in',
  'auth.logout': 'Sign out',
  'auth.loginFailed': 'Sign-in failed: {error}',
  'language.label': 'Language',
  'language.fr': 'Français',
  'language.en': 'English',
  'role.owner': 'Owner',
  'role.contributor': 'Contributor',
  'role.reader': 'Reader',
  'initiatives.title': 'My initiatives',
  'initiatives.empty': 'No initiatives yet.',
  'initiatives.codePlaceholder': 'Code (e.g. CRM)',
  'initiatives.codeShortPlaceholder': 'Code',
  'initiatives.namePlaceholder': 'Initiative name',
  'initiatives.create': 'Create',
  'initiatives.invalid':
    'The code has 2 to 10 uppercase letters or digits and starts with a letter; the name is required (120 characters at most).',
  'initiatives.codeTaken': 'This initiative code is already in use.',
  'initiatives.pendingSync': 'awaiting synchronisation',
  'sync.rejected': 'Change rejected by the server ({status}).',
  'error.http': 'Error {status}',
};

const MESSAGES: Record<Locale, Record<MessageKey, string>> = { fr, en };

/** Libellé traduit ; les `{nom}` sont remplacés par les paramètres. */
export function translate(
  locale: Locale,
  key: MessageKey,
  params: Record<string, string | number> = {},
): string {
  return MESSAGES[locale][key].replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}
