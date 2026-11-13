// Types de ticket et leurs statuts (ticket 29), lus à l'affichage : les statuts
// qu'ajoute l'administration à l'Action ont leur libellé et leur famille. Règles
// dans @app/shared (ticket-type-catalog.ts). Mode connecté seulement.
import { deliveredTicketTypes, type TicketTypeDto } from '@app/shared';
import { useEffect, useState } from 'react';
import type { Api } from './api';

/** Avant la lecture, ou sans réponse : les types livrés, dont les libellés sont connus. */
const DELIVERED = deliveredTicketTypes();

export function useTicketTypes(api: Api): TicketTypeDto[] {
  const [types, setTypes] = useState<TicketTypeDto[]>(DELIVERED);
  useEffect(() => {
    api.ticketTypes().then(setTypes, () => undefined);
  }, [api]);
  return types;
}
