# 18: Types de ticket livrés et Epics

**What to build:** On crée et suit des Questions, Décisions, Risques, Demandes de changement et Epics, chacun avec ses champs et ses statuts. Un ticket appartient à un Epic ; la liste peut se regrouper par Epic.

**Blocked by:** 17 — Navigation et écran Tickets

**Status:** ready-for-agent

Règles : décisions [01](01-modele-commun-du-ticket.md), [03](03-types-de-ticket-et-statuts-parametrables.md) et [11](11-ecrans-des-tickets.md) (points 4 à 7).

- [ ] Types, statuts, familles, statuts fermés et acronymes livrés ; catégories visibles dans l'onglet des références. Le type ne change plus après la création.
- [ ] Champs propres : parties prenantes interrogées (Question), probabilité et impact (Risque). Une partie prenante interrogée ne se supprime plus.
- [ ] « Nouveau ticket » en panneau, type en premier champ, champs selon le type. Création rapide type et titre, pas pour l'Action.
- [ ] Fiche en panneau, sur une colonne, dans l'ordre du point 5 ; historique pour tous les types.
- [ ] Epic : un ticket y entre, en change ou en sort ; pas d'Epic dans un Epic ; fiche avec ses tickets et le nombre de fermés ; suppression refusée s'il contient des tickets.
- [ ] Option d'affichage « regrouper par Epic » : en-têtes avec progression et « + Ticket », groupe « Sans Epic ». Jamais montrée avec le tableau dans le prototype : à faire vérifier en priorité.
- [ ] Suppression définitive d'un ticket sans lien, référence jamais réutilisée. Les suggestions, la couverture, le tableau de bord, les alertes et « Mes actions » ne voient toujours que les Actions.
- [ ] Règles dans `shared/`, avec tests ; `scripts/roles/` à jour ; libellés dans les deux langues.
