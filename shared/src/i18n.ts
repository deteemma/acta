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
  'member.you': 'vous',
  'team.invite': 'Inviter un membre',
  'team.inviteEmail': 'Courriel',
  'team.inviteHint': 'La personne doit s’être connectée au moins une fois à ACTA.',
  'team.inviteButton': 'Inviter',
  'team.inviteInvalid': 'Saisissez un courriel valide.',
  'team.role': 'Rôle de {name}',
  'team.teamBa': '{name} est BA de l’équipe',
  'team.designateOwner': 'Désigner propriétaire',
  'team.designateMeOwner': 'Me désigner propriétaire',
  'team.remove': 'Retirer',
  'team.leave': 'Quitter l’initiative',
  'team.removeConfirm': 'Retirer {name} de l’initiative ?',
  'team.leaveConfirm': 'Quitter l’initiative {code} ? Vous n’y aurez plus accès.',
  'team.confirm': 'Confirmer',
  'team.ownerHistory': 'Désignations de propriétaire',
  'team.ownerHistoryEmpty': 'Aucune désignation enregistrée.',
  'team.ownerDesignation': '{date} : {user}, désigné par {by}',
  'team.ownerDesignationUnknown': '{date} : {user}',
  'team.refusal.forbidden': 'Vous n’avez pas le droit de faire ce changement.',
  'team.refusal.archived': 'Initiative archivée : lecture seule. Vous pouvez seulement la quitter.',
  'team.refusal.userNotFound': 'Aucun utilisateur avec ce courriel : la personne doit s’être connectée au moins une fois à ACTA.',
  'team.refusal.alreadyMember': 'Cette personne est déjà membre de l’initiative.',
  'team.refusal.notMember': 'Cette personne n’est plus membre de l’initiative.',
  'team.refusal.lastOwner': 'L’initiative doit garder au moins un propriétaire : désignez-en d’abord un autre.',
  'team.refusal.lastTeamBa': 'L’initiative doit garder au moins un BA de l’équipe : attribuez d’abord l’indication à un autre membre.',
  'team.refusal.readerCannotBeTeamBa': 'Un lecteur ne peut pas être BA de l’équipe.',
  'team.refusal.removeTeamBaFirst': 'Retirez d’abord l’indication « BA de l’équipe » avant de passer ce membre en lecteur.',
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
  'member.you': 'you',
  'team.invite': 'Invite a member',
  'team.inviteEmail': 'Email',
  'team.inviteHint': 'The person must have signed in to ACTA at least once.',
  'team.inviteButton': 'Invite',
  'team.inviteInvalid': 'Enter a valid email address.',
  'team.role': 'Role of {name}',
  'team.teamBa': '{name} is a team BA',
  'team.designateOwner': 'Designate as owner',
  'team.designateMeOwner': 'Designate myself as owner',
  'team.remove': 'Remove',
  'team.leave': 'Leave initiative',
  'team.removeConfirm': 'Remove {name} from the initiative?',
  'team.leaveConfirm': 'Leave initiative {code}? You will no longer have access to it.',
  'team.confirm': 'Confirm',
  'team.ownerHistory': 'Owner designations',
  'team.ownerHistoryEmpty': 'No designation recorded.',
  'team.ownerDesignation': '{date}: {user}, designated by {by}',
  'team.ownerDesignationUnknown': '{date}: {user}',
  'team.refusal.forbidden': 'You are not allowed to make this change.',
  'team.refusal.archived': 'Archived initiative: read-only. You can only leave it.',
  'team.refusal.userNotFound': 'No user with this email: the person must have signed in to ACTA at least once.',
  'team.refusal.alreadyMember': 'This person is already a member of the initiative.',
  'team.refusal.notMember': 'This person is no longer a member of the initiative.',
  'team.refusal.lastOwner': 'The initiative must keep at least one owner: designate another one first.',
  'team.refusal.lastTeamBa': 'The initiative must keep at least one team BA: give the indication to another member first.',
  'team.refusal.readerCannotBeTeamBa': 'A reader cannot be a team BA.',
  'team.refusal.removeTeamBaFirst': 'Remove the “team BA” indication before making this member a reader.',
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
