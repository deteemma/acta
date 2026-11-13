// Familles de statut (refonte du design, ticket 02) : signification visuelle
// commune aux statuts de ticket et d'exigence, règle validée par la responsable
// fonctionnelle le 01.11.2026 (glossaire : « Famille de statut »).
import { type BabokRequirementStatus, isBabokRequirementStatus, type RequirementStatus } from './requirement-statuses.js';

/** `muted` : neutre atténué. */
export const STATUS_TONES = ['neutral', 'muted', 'progress', 'positive', 'attention', 'negative'] as const;
export type StatusTone = (typeof STATUS_TONES)[number];

/**
 * Familles des statuts de ticket livrés : un même identifiant de statut a la même
 * famille pour tous les types (décision 03, point 3).
 */
export const DELIVERED_TICKET_TONES: Readonly<Record<string, StatusTone>> = {
  todo: 'neutral',
  open: 'neutral',
  proposed: 'neutral',
  submitted: 'neutral',
  in_progress: 'progress',
  answered: 'progress',
  addressed: 'progress',
  analysed: 'progress',
  done: 'positive',
  closed: 'positive',
  agreed: 'positive',
  accepted: 'positive',
  on_hold: 'attention',
  identified: 'attention',
  rejected: 'negative',
  cancelled: 'muted',
};

const BABOK_REQUIREMENT_TONES: Record<BabokRequirementStatus, StatusTone> = {
  proposed: 'neutral',
  verified: 'progress',
  validated: 'progress',
  approved: 'positive',
  deferred: 'attention',
  rejected: 'negative',
};

/** Un statut ajouté par l'administration est neutre. */
export const requirementStatusTone = (status: RequirementStatus): StatusTone =>
  isBabokRequirementStatus(status) ? BABOK_REQUIREMENT_TONES[status] : 'neutral';
