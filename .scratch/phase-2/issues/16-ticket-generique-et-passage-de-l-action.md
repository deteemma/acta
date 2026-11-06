# 16: Ticket générique et passage de l'Action

**What to build:** L'Action devient un type de ticket sans que rien ne se perde. Elle reçoit une référence affichée partout, le statut En attente et un historique. Pour l'utilisateur, le reste de la phase 1 fonctionne comme avant.

**Blocked by:** —

**Status:** ready-for-human (réalisé, à valider par la responsable fonctionnelle)

Règles : décisions [01](01-modele-commun-du-ticket.md), [02](02-passage-de-l-action-au-ticket-generique.md) et [03](03-types-de-ticket-et-statuts-parametrables.md) (points 2 à 6, pour l'Action).

- [x] Migration : les actions, leurs liens (besoins, exigences, parties prenantes concernées) et leur suggestion d'origine sont repris intégralement, avec RLS. Vérifier sur une copie de données réelle que les comptes correspondent avant et après.
- [x] Références `<CODE>-AC-NNN` attribuées par date de création, compteur repris à la suite ; catégorie AC visible dans l'onglet des références de l'administration.
- [x] Référence en lecture seule devant le titre : liste, fiche, tableau de bord, « Mes actions », alertes, téléphone.
- [x] Statut En attente sur l'Action : proposé, famille « attention », non fermé ; il garde ses alertes et apparaît dans les comptes du tableau de bord et les filtres de « Mes actions ».
- [x] Historique par champ modifié, vide au passage, consultable par tout membre sur la fiche.
- [x] Suggestions R1 à R15, couverture, tableau de bord, alertes, « Mes actions » et export des exigences : résultats inchangés, limités aux Actions ; tests existants toujours verts.
- [ ] Téléphone : « Mes actions », la fiche et la création rapide fonctionnent, sans changement de PowerSync ; il affiche la référence et En attente. *Reste à essayer sur un téléphone : contrôlé seulement par les types et par les routes de l'API.*
- [x] `scripts/roles/` à jour : deux barrières pour tous les rôles et l'initiative archivée.
- [x] Le choix technique (table renommée ou nouvelle table) est expliqué dans le ticket une fois réalisé.

## Réalisation

**Choix technique : table renommée.** La table `action` devient `ticket`, avec une colonne `type` (seule valeur pour l'instant : `action`) et une colonne `reference` (migration `0018`). Une nouvelle table aurait imposé de recopier les lignes et de recréer clés, liens et politiques, avec un risque de perte ; le renommage laisse tout en place. `action_need` et `action_requirement` deviennent `ticket_need` et `ticket_requirement`. `action_stakeholder` garde son nom, car les parties prenantes concernées sont un champ propre à l'Action. Les adresses de l'API (`/actions`) ne changent pas : le téléphone continue de fonctionner sans mise à jour de ses appels. Les colonnes rendues facultatives pour les autres types (tâche, responsable) sont laissées au ticket 18.

**Historique.** `ticket_version` garde qui, quand, et l'état des champs avant et après. Il est écrit par la base en fin de transaction, donc aussi pour une écriture hors de l'API. `ticket_snapshot` garde le dernier état connu : c'est lui qui permet de connaître l'« avant » de la première modification, alors que l'historique reste vide au passage.

**Vérification du passage** (`scripts/verifier-passage-action.sh`, 06.11.2026) : sur une copie de la base de développement locale, seule base disponible. 9 actions, 2 liens avec des besoins, 3 suggestions d'origine : comptes et contenu des lignes identiques avant et après, références et compteurs corrects, historique vide. Cette copie n'a aucun lien avec une exigence ni aucune partie prenante concernée : ces deux tables sont renommées sans recopie, et leur usage est couvert par `scripts/roles/`. À relancer sur une copie de la production avant le déploiement, s'il en existe une.

**Décisions de la responsable fonctionnelle pendant la réalisation (06.11.2026)** : En attente est coché par défaut dans « Mes actions » ; une suggestion reste masquée tant que l'Action issue d'elle est En attente.
