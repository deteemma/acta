// Types de ticket et leurs statuts (ticket 29) : liste valable pour toute
// l'application, lue une fois puis tenue à jour par l'administration. Règles
// dans @app/shared (ticket-type-catalog.ts).
import {
  deliveredTicketTypes,
  referenceCategoryLabel,
  ticketStatusLabel,
  ticketStatusTone,
  type TicketTypeDto,
  ticketTypeLabel,
} from '@app/shared';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { api } from './api';
import { useI18n } from './i18n';

/** Avant la première lecture : les types livrés, dont les libellés sont connus. */
const DELIVERED = deliveredTicketTypes();

let types: TicketTypeDto[] | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Remplace la liste, par exemple après un changement dans l'administration. */
export function setTicketTypes(next: TicketTypeDto[]) {
  types = next;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Relit la liste, sauf lecture déjà en cours ; une lecture échouée sera retentée. */
function load() {
  loading ??= api.ticketTypes().then(setTicketTypes, () => undefined).finally(() => (loading = null));
}

/**
 * Tous les types et leurs statuts, dans l'ordre où ils sont proposés. `fresh` :
 * relus à l'affichage, pour proposer la liste à jour des changements de l'administration.
 */
export function useTicketTypes({ fresh = false } = {}): TicketTypeDto[] {
  const list = useSyncExternalStore(subscribe, () => types);
  useEffect(() => {
    if (fresh || !types) load();
  }, [fresh]);
  return list ?? DELIVERED;
}

/** Libellés des types, statuts et catégories de référence, dans la langue de l'utilisateur. */
export function useTicketLabels() {
  const { locale } = useI18n();
  const list = useTicketTypes();
  const typeLabel = useCallback((type: string) => ticketTypeLabel(list, type, locale), [list, locale]);
  const statusLabel = useCallback(
    (type: string, status: string) => ticketStatusLabel(list, type, status, locale),
    [list, locale],
  );
  const categoryLabel = useCallback((category: string) => referenceCategoryLabel(list, category, locale), [list, locale]);
  return useMemo(() => ({ typeLabel, statusLabel, categoryLabel }), [typeLabel, statusLabel, categoryLabel]);
}

/** Badge d'un statut de ticket, coloré selon sa famille. */
export function TicketStatusBadge({ type, status, count }: { type: string; status: string; count?: number }) {
  const list = useTicketTypes();
  const { statusLabel } = useTicketLabels();
  const label = statusLabel(type, status);
  return (
    <span className={`badge status tone-${ticketStatusTone(list, type, status)}`}>
      {label}
      {count !== undefined && <span className="count">{count}</span>}
    </span>
  );
}
