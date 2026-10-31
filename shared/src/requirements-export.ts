// Export tableur des exigences (ticket 16) : le tableau que le web écrit en
// fichier Excel (xlsx.ts). En-têtes et listes de valeurs dans la langue de
// l'utilisateur ; le contenu saisi n'est pas traduit (ADR-0013).
import { type Locale, type MessageKey, translate } from './i18n.js';
import type { NeedRefDto } from './needs.js';
import { type RequirementStatusDto, requirementStatusLabel } from './requirement-statuses.js';
import type { RequirementDto, RequirementRefDto } from './requirements.js';
import { richTextToPlainText } from './rich-text.js';
import { xlsxWorkbook } from './xlsx.js';

/** Objet lié : sa référence et son titre. */
const refLabel = (ref: NeedRefDto | RequirementRefDto) => `${ref.reference} ${ref.title}`;

/** Colonnes, dans l'ordre du fichier : en-tête, largeur en caractères, valeur. */
const COLUMNS: readonly {
  header: MessageKey;
  width: number;
  value: (r: RequirementDto, statuses: readonly RequirementStatusDto[], locale: Locale) => string;
}[] = [
  { header: 'requirement.reference', width: 14, value: (r) => r.reference },
  { header: 'requirement.title', width: 40, value: (r) => r.title },
  { header: 'requirement.statement', width: 80, value: (r) => richTextToPlainText(r.statement) },
  { header: 'requirement.type', width: 28, value: (r, _, locale) => translate(locale, `requirementType.${r.type}`) },
  {
    header: 'requirement.subtype',
    width: 18,
    value: (r, _, locale) => (r.subtype ? translate(locale, `requirementSubtype.${r.subtype}`) : ''),
  },
  {
    header: 'requirement.status',
    width: 14,
    value: (r, statuses, locale) => requirementStatusLabel(statuses, r.status, locale),
  },
  // Plusieurs valeurs : une par ligne dans la cellule.
  { header: 'requirement.stakeholders', width: 28, value: (r) => r.stakeholders.map((s) => s.name).join('\n') },
  { header: 'requirement.needs', width: 45, value: (r) => r.needs.map(refLabel).join('\n') },
  { header: 'requirement.parent', width: 45, value: (r) => (r.parent ? refLabel(r.parent) : '') },
];

/** En-têtes, puis une ligne par exigence, dans l'ordre reçu (par référence). */
export function requirementsSheet(
  requirements: readonly RequirementDto[],
  statuses: readonly RequirementStatusDto[],
  locale: Locale,
): string[][] {
  return [
    COLUMNS.map((c) => translate(locale, c.header)),
    ...requirements.map((r) => COLUMNS.map((c) => c.value(r, statuses, locale))),
  ];
}

/** Fichier Excel des exigences : le tableau de requirementsSheet, dans une feuille nommée « Exigences ». */
export function requirementsWorkbook(
  requirements: readonly RequirementDto[],
  statuses: readonly RequirementStatusDto[],
  locale: Locale,
): Uint8Array<ArrayBuffer> {
  return xlsxWorkbook(translate(locale, 'requirements.section'), requirementsSheet(requirements, statuses, locale), {
    columnWidths: COLUMNS.map((c) => c.width),
  });
}

/** Ex. CRM-exigences-2026-10-31.xlsx ; `date` au format AAAA-MM-JJ. */
export const requirementsFileName = (initiativeCode: string, locale: Locale, date: string) =>
  `${initiativeCode}-${translate(locale, 'requirements.exportFileName')}-${date}.xlsx`;
