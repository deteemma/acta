# 16: Ticket générique et passage de l'Action

**What to build:** L'Action devient un type de ticket sans que rien ne se perde. Elle reçoit une référence affichée partout, le statut En attente et un historique. Pour l'utilisateur, le reste de la phase 1 fonctionne comme avant.

**Blocked by:** —

**Status:** ready-for-agent

Règles : décisions [01](01-modele-commun-du-ticket.md), [02](02-passage-de-l-action-au-ticket-generique.md) et [03](03-types-de-ticket-et-statuts-parametrables.md) (points 2 à 6, pour l'Action).

- [ ] Migration : les actions, leurs liens (besoins, exigences, parties prenantes concernées) et leur suggestion d'origine sont repris intégralement, avec RLS. Vérifier sur une copie de données réelle que les comptes correspondent avant et après.
- [ ] Références `<CODE>-AC-NNN` attribuées par date de création, compteur repris à la suite ; catégorie AC visible dans l'onglet des références de l'administration.
- [ ] Référence en lecture seule devant le titre : liste, fiche, tableau de bord, « Mes actions », alertes, téléphone.
- [ ] Statut En attente sur l'Action : proposé, famille « attention », non fermé ; il garde ses alertes et apparaît dans les comptes du tableau de bord et les filtres de « Mes actions ».
- [ ] Historique par champ modifié, vide au passage, consultable par tout membre sur la fiche.
- [ ] Suggestions R1 à R15, couverture, tableau de bord, alertes, « Mes actions » et export des exigences : résultats inchangés, limités aux Actions ; tests existants toujours verts.
- [ ] Téléphone : « Mes actions », la fiche et la création rapide fonctionnent, sans changement de PowerSync ; il affiche la référence et En attente.
- [ ] `scripts/roles/` à jour : deux barrières pour tous les rôles et l'initiative archivée.
- [ ] Le choix technique (table renommée ou nouvelle table) est expliqué dans le ticket une fois réalisé.
