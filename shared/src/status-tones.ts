// Familles de statut (refonte du design, ticket 02) : signification visuelle
// commune aux statuts d'action et d'exigence, règle validée par la responsable
// fonctionnelle le 01.11.2026 (glossaire : « Famille de statut »).
import type { ActionStatus } from './actions.js';
import { type BabokRequirementStatus, isBabokRequirementStatus, type RequirementStatus } from './requirement-statuses.js';
import type { TicketStatus } from './tickets.js';

/** `muted` : neutre atténué. */
export const STATUS_TONES = ['neutral', 'muted', 'progress', 'positive', 'attention', 'negative'] as const;
export type StatusTone = (typeof STATUS_TONES)[number];

/** Un même identifiant de statut a la même famille pour tous les types (décision 03, point 3). */
const TICKET_TONES: Record<TicketStatus, StatusTone> = {
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

export const ticketStatusTone = (status: TicketStatus): StatusTone => TICKET_TONES[status];

export const actionStatusTone = (status: ActionStatus): StatusTone => TICKET_TONES[status];

/** Un statut ajouté par l'administration est neutre. */
export const requirementStatusTone = (status: RequirementStatus): StatusTone =>
  isBabokRequirementStatus(status) ? BABOK_REQUIREMENT_TONES[status] : 'neutral';
