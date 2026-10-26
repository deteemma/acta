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
  'initiatives.new': 'Nouvelle initiative',
  'initiative.code': 'Code',
  'initiative.name': 'Nom',
  'initiative.myRole': 'Mon rôle',
  'initiative.members': 'Membres',
  'initiative.description': 'Description',
  'initiative.analysisApproach': 'Approche d’analyse',
  'initiative.startDate': 'Date de début',
  'initiative.plannedEndDate': 'Date de fin prévue',
  'initiative.notSet': 'Non renseignée',
  'initiative.save': 'Enregistrer',
  'initiative.saved': 'Modifications enregistrées.',
  'initiative.invalid':
    'Vérifiez la fiche : le nom est obligatoire (120 caractères au plus), la description fait 4 000 caractères au plus et la fin prévue ne précède pas le début.',
  'initiative.archived': 'Archivée',
  'initiative.archivedOn': 'Archivée le {date} : lecture seule.',
  'initiative.archive': 'Archiver',
  'initiative.unarchive': 'Désarchiver',
  'initiative.delete': 'Supprimer l’initiative',
  'initiative.deleteConfirm': 'Supprimer définitivement {code} et tout son contenu ? Cette action est irréversible.',
  'initiative.deleteConfirmButton': 'Oui, supprimer',
  'initiatives.archivedSection': 'Archivées ({count})',
  'approach.predictive': 'Prédictive',
  'approach.adaptive': 'Adaptative',
  'member.email': 'Courriel',
  'member.role': 'Rôle',
  'member.teamBa': 'BA de l’équipe',
  'palette.open': 'Rechercher',
  'palette.label': 'Palette de commandes',
  'palette.placeholder': 'Rechercher une initiative…',
  'palette.noResults': 'Aucun résultat.',
  'panel.close': 'Fermer',
  'common.loading': 'Chargement…',
  'common.yes': 'Oui',
  'common.cancel': 'Annuler',
  'common.no': 'Non',
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
  'initiatives.new': 'New initiative',
  'initiative.code': 'Code',
  'initiative.name': 'Name',
  'initiative.myRole': 'My role',
  'initiative.members': 'Members',
  'initiative.description': 'Description',
  'initiative.analysisApproach': 'Analysis approach',
  'initiative.startDate': 'Start date',
  'initiative.plannedEndDate': 'Planned end date',
  'initiative.notSet': 'Not specified',
  'initiative.save': 'Save',
  'initiative.saved': 'Changes saved.',
  'initiative.invalid':
    'Check the record: the name is required (120 characters at most), the description has 4,000 characters at most and the planned end date is not before the start date.',
  'initiative.archived': 'Archived',
  'initiative.archivedOn': 'Archived on {date}: read-only.',
  'initiative.archive': 'Archive',
  'initiative.unarchive': 'Unarchive',
  'initiative.delete': 'Delete initiative',
  'initiative.deleteConfirm': 'Permanently delete {code} and all its content? This cannot be undone.',
  'initiative.deleteConfirmButton': 'Yes, delete',
  'initiatives.archivedSection': 'Archived ({count})',
  'approach.predictive': 'Predictive',
  'approach.adaptive': 'Adaptive',
  'member.email': 'Email',
  'member.role': 'Role',
  'member.teamBa': 'Team BA',
  'palette.open': 'Search',
  'palette.label': 'Command palette',
  'palette.placeholder': 'Search for an initiative…',
  'palette.noResults': 'No results.',
  'panel.close': 'Close',
  'common.loading': 'Loading…',
  'common.yes': 'Yes',
  'common.cancel': 'Cancel',
  'common.no': 'No',
  'sync.rejected': 'Change rejected by the server ({status}).',
  'error.http': 'Error {status}',
};

const MESSAGES: Record<Locale, Record<MessageKey, string>> = { fr, en };

/**
 * Info-bulle d'un terme du BABOK, dont l'anglais est la langue de référence
 * (ADR-0013) : le terme anglais en français, rien en anglais.
 */
export function englishTermTooltip(locale: Locale, key: MessageKey): string | undefined {
  return locale === 'en' ? undefined : MESSAGES.en[key];
}

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
