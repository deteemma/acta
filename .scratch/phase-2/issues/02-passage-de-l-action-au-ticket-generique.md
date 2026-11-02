# Passage de l'Action au ticket générique

Type: grilling
Status: resolved
Blocked by: 01

## Question

Comment l'Action de la phase 1 (table `action` à part, sans référence — migration `0010`) devient-elle un type de ticket, sans rien casser ? Trancher :

- le sort des actions existantes : référence attribuée rétroactivement (dans quel ordre), données conservées ;
- ce qui reste propre à l'Action (tâche BABOK obligatoire, technique, `suggestion_key`, responsable signalé s'il quitte l'initiative) ;
- les effets sur « Mes actions », le tableau de bord, les actions suggérées (R1 à R15), les alertes, l'export et le mobile (« Mes actions » doit continuer de fonctionner) ;
- « Mes actions » reste-t-il limité aux actions, ou montre-t-il les autres tickets dont je suis responsable ?
- l'historique, désormais tenu pour tous les tickets (voir « Modèle commun du ticket ») : que contient-il pour les actions existantes au moment du passage ?

Déjà tranché dans « Modèle commun du ticket » : acronyme AC par défaut, numéroté par type ; type figé à la création ; responsable obligatoire pour l'Action ; mêmes droits qu'aujourd'hui.

## Réponse

Tranché avec la responsable fonctionnelle le 02.11.2026. Rien de l'Action de la phase 1 ne se perd : elle devient le type de ticket Action, avec ses données, ses liens et ses usages actuels.

1. **Références attribuées après coup** : dans chaque initiative, les actions existantes sont numérotées dans l'ordre de leur date de création, la plus ancienne recevant `<CODE>-AC-001`. Le compteur de l'initiative reprend à la suite pour les actions créées ensuite.
2. **Parties prenantes concernées** : le lien actuel entre une action et des parties prenantes devient un **champ propre à l'Action** (facultatif, parties prenantes de la même initiative). Il est distinct des « parties prenantes interrogées » de la Question. Une partie prenante concernée par une action ne peut pas être supprimée. La règle R6 est inchangée.
3. **Liens avec les besoins et les exigences** : les liens existants sont repris intégralement et deviennent des liens ticket ↔ besoin et ticket ↔ exigence. Le ticket « Liens » décide seulement si les autres types y ont droit.
4. **Actions suggérées et couverture** : les règles R1 à R15 ne proposent et ne créent que des Actions ; la suggestion d'origine reste propre à l'Action. Une tâche ou un domaine BABOK n'est couvert (R1, R14, tableau de bord) que par des Actions.
5. **Tableau de bord et alertes** : inchangés en phase 2, limités aux Actions (leur extension reste dans les zones floues). L'export tableur des exigences n'est pas touché.
6. **« Mes actions »** : reste limité aux Actions dont je suis responsable, sur le web comme sur le téléphone. Le téléphone continue de fonctionner comme aujourd'hui.
7. **Historique** : vide pour les actions existantes au moment du passage. Il commence à la première modification qui suit ; aucune entrée n'est reconstituée. L'auteur et la date de création, ainsi que ceux de la dernière modification, restent affichés comme aujourd'hui.
8. **Affichage de la référence** : dès le passage, la référence s'affiche en lecture seule devant le titre, partout où une action apparaît : liste, fiche, tableau de bord, « Mes actions », alertes, téléphone.

Rappel (« Modèle commun du ticket ») : acronyme AC, type figé, responsable obligatoire, tâche BABOK obligatoire et technique facultative, responsable signalé s'il quitte l'initiative, mêmes droits qu'aujourd'hui.

Glossaire `CONTEXT.md` mis à jour : Action (parties prenantes concernées), « Mes actions ».
