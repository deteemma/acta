// Alertes dans l'application (ticket 15), sans courriel : déduites de mes
// actions, elles disparaissent dès que leur situation cesse. Règles précisées
// par la responsable fonctionnelle le 31.10.2026.
import { type ActionDto, isOpenAction } from './actions.js';
import type { MeDto } from './schemas.js';

export type AlertKind = 'assigned' | 'overdue';

export interface Alert {
  kind: AlertKind;
  action: ActionDto;
  /** Absente de la liste à la dernière ouverture du panneau des alertes : comptée par le badge. */
  isNew: boolean;
}

/** Identifie une alerte, d'une ouverture du panneau à l'autre. */
export const alertKey = (alert: Pick<Alert, 'kind' | 'action'>) => `${alert.kind}:${alert.action.id}`;

/** Date AAAA-MM-JJ, dans le fuseau de l’appareil, d’un horodatage (aujourd’hui : `localDate(new Date().toISOString())`). */
export function localDate(timestamp: string): string {
  const d = new Date(timestamp);
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n) => String(n).padStart(2, '0')).join('-');
}

/**
 * Avant la première ouverture du panneau, aucune liste n'a été vue : une
 * alerte est nouvelle si elle est apparue depuis la date de référence
 * (déploiement des alertes ou création du compte). Une échéance est dépassée
 * à partir du lendemain ; une action peut aussi m'être attribuée déjà en retard.
 */
function appearedSince(kind: AlertKind, action: ActionDto, since: string): boolean {
  if (action.assignedAt > since) return true;
  return kind === 'overdue' && localDate(since) <= action.dueDate!;
}

/**
 * Mes alertes, parmi mes actions ni Terminées ni Annulées, hors initiative
 * archivée ; échéances dépassées d'abord (la plus ancienne en tête), puis
 * attributions (la plus récente en tête) :
 * - `overdue` : échéance antérieure à aujourd'hui (AAAA-MM-JJ) ;
 * - `assigned` : l'action m'a été attribuée par un autre membre.
 * Nouvelle : absente de la liste à la dernière ouverture du panneau.
 */
export function myAlerts(
  actions: readonly ActionDto[],
  me: Pick<MeDto, 'id' | 'alertsSeenAt' | 'alertsSeenKeys'>,
  today: string,
): Alert[] {
  const mine = actions.filter((a) => a.assignee.userId === me.id && isOpenAction(a) && !a.initiative.archived);
  const overdue = mine
    .filter((a) => a.dueDate != null && a.dueDate < today)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
    .map((action) => ({ kind: 'overdue' as const, action }));
  const assigned = mine
    .filter((a) => a.assignedBy.userId !== me.id)
    .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))
    .map((action) => ({ kind: 'assigned' as const, action }));
  return [...overdue, ...assigned].map((alert) => ({
    ...alert,
    isNew: me.alertsSeenKeys
      ? !me.alertsSeenKeys.includes(alertKey(alert))
      : appearedSince(alert.kind, alert.action, me.alertsSeenAt),
  }));
}
