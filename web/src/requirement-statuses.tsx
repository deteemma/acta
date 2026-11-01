// Statuts d'exigence (ticket 11) : liste valable pour toute l'application, lue
// une fois puis tenue à jour par l'administration. Règles dans @app/shared
// (requirement-statuses.ts).
import {
  babokRequirementStatuses,
  englishTermTooltip,
  isBabokRequirementStatus,
  type RequirementStatus,
  type RequirementStatusDto,
  requirementStatusLabel,
  requirementStatusTone,
} from '@app/shared';
import { useEffect, useSyncExternalStore } from 'react';
import { api } from './api';
import { useI18n } from './i18n';

/** Avant la première lecture : les statuts du BABOK, dont les libellés sont connus. */
const BABOK_STATUSES = babokRequirementStatuses();

let statuses: RequirementStatusDto[] | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Remplace la liste, par exemple après un changement dans l'administration. */
export function setRequirementStatuses(next: RequirementStatusDto[]) {
  statuses = next;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Relit la liste, sauf lecture déjà en cours ; une lecture échouée sera retentée. */
function load() {
  loading ??= api.requirementStatuses().then(setRequirementStatuses, () => undefined).finally(() => (loading = null));
}

/**
 * Tous les statuts, dans l'ordre où ils sont proposés. `fresh` : relus à
 * l'affichage, pour proposer la liste à jour des changements de l'administration.
 */
export function useRequirementStatuses({ fresh = false } = {}): RequirementStatusDto[] {
  const list = useSyncExternalStore(subscribe, () => statuses);
  useEffect(() => {
    if (fresh || !statuses) load();
  }, [fresh]);
  return list ?? BABOK_STATUSES;
}

/**
 * Badge d'un statut, coloré selon sa famille ; pour un statut du BABOK, en
 * français, le terme anglais en info-bulle (ADR-0013).
 */
export function StatusLabel({ status }: { status: RequirementStatus }) {
  const { locale } = useI18n();
  const list = useRequirementStatuses();
  return (
    <span
      className={`badge status tone-${requirementStatusTone(status)}`}
      title={isBabokRequirementStatus(status) ? englishTermTooltip(locale, `requirementStatus.${status}`) : undefined}>
      {requirementStatusLabel(list, status, locale)}
    </span>
  );
}
