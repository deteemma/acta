// Familles de statut (refonte du design, ticket 02) : signification visuelle
// commune aux statuts d'action et d'exigence, règle validée par la responsable
// fonctionnelle le 01.11.2026 (glossaire : « Famille de statut »).
import type { ActionStatus } from './actions.js';
import { type BabokRequirementStatus, isBabokRequirementStatus, type RequirementStatus } from './requirement-statuses.js';

/** `muted` : neutre atténué. */
export const STATUS_TONES = ['neutral', 'muted', 'progress', 'positive', 'attention', 'negative'] as const;
export type StatusTone = (typeof STATUS_TONES)[number];

const ACTION_TONES: Record<ActionStatus, StatusTone> = {
  todo: 'neutral',
  in_progress: 'progress',
  done: 'positive',
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

export const actionStatusTone = (status: ActionStatus): StatusTone => ACTION_TONES[status];

/** Un statut ajouté par l'administration est neutre. */
export const requirementStatusTone = (status: RequirementStatus): StatusTone =>
  isBabokRequirementStatus(status) ? BABOK_REQUIREMENT_TONES[status] : 'neutral';
