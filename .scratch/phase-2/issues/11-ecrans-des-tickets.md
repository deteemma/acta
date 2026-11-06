# Écrans des tickets

Type: prototype
Status: resolved
Blocked by: 01, 03, 04

## Question

À quoi ressemblent les écrans des tickets d'une initiative ? Liste (colonnes, filtres par type, statut, responsable, Epic), fiche d'un ticket (champs, liens, commentaires, pièces jointes), vue d'un Epic et de ses tickets, création d'un ticket. Un prototype dans le design de la refonte, à manipuler pour réagir.

## Réponse

Tranché avec la responsable fonctionnelle le 06.11.2026 : variante B du prototype, avec le regroupement par Epic de la variante C en option d'affichage. Prototype conservé sur la branche jetable `prototype/ecrans-des-tickets` (à ne jamais fusionner) : `pnpm dev:web`, puis `/prototype-tickets.html?variant=B`.

1. **Navigation** : dans la barre latérale, entrées « Tickets » et « Pages » sous l'initiative, avec un affichage en pleine page. ACTA n'avait jusqu'ici en pleine page que « Mes actions ». Cela vaut aussi pour le choix de pleine page du ticket « Éditeur de page ».
2. **Liste** : tableau en pleine page, trié par échéance par défaut et triable sur chaque colonne. Colonnes : référence, type, titre, statut, responsable, échéance, Epic. Le responsable qui n'est plus membre et l'échéance dépassée sont signalés.
3. **Filtres** : recherche sur le titre et la référence, type, état (ouverts, fermés, les deux ; « ouverts » par défaut), statut (une fois un type choisi), responsable (dont « sans responsable »), Epic (dont « sans Epic »).
4. **Regroupement par Epic** : option d'affichage de la liste. Chaque Epic devient un en-tête avec sa référence, son titre, son statut, son responsable, sa progression (tickets fermés sur le total, à titre d'information) et un bouton « + Ticket » ; un groupe « Sans Epic » ferme la liste. Repris de la variante C, cette option n'a pas été prototypée avec le tableau de B.
5. **Fiche d'un ticket** : panneau à droite, à côté du tableau, sur une colonne, dans cet ordre : titre, champs (statut, responsable, échéance, Epic, champs propres au type), description, enregistrer, auteurs et dates, tickets de l'Epic pour un Epic, liens, commentaires, pièces jointes, historique, suppression. La ligne du ticket ouvert est mise en évidence.
6. **Vue d'un Epic** : la fiche de l'Epic, avec la liste de ses tickets et le nombre de fermés ; plus le regroupement de la liste.
7. **Création** : bouton « Nouveau ticket », en panneau ; le type est le premier champ et son aide rappelle qu'il ne changera plus ; les champs suivent le type. En plus, une ligne de création rapide au-dessus du tableau (type et titre, puis Entrée, la fiche s'ouvre ensuite) pour les types sans autre champ obligatoire, donc pas pour l'Action.
8. **Lecteur, initiative archivée** : mêmes écrans, en lecture seule, sans bouton de création.

Points retenus tels que prototypés, sans demande particulière de la responsable fonctionnelle : colonnes, filtres et tri par défaut.

À traiter à la réalisation : le panneau ouvert comprime le tableau et les titres passent sur plusieurs lignes. La création rapide, l'ajout de liens et de fichiers et le mode « initiative archivée » n'ont pas été vérifiés dans le prototype.
