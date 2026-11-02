# Modèle commun du ticket

Type: grilling
Status: resolved
Blocked by: —

## Question

Qu'est-ce qu'un ticket a en commun quel que soit son type ? Trancher :

- les champs communs (titre, description, responsable, échéance, autres ?) et ceux propres à un type (ex. tâche BABOK de l'Action) ;
- la référence : un acronyme par type (ex. `CRM-AC-001`, `CRM-RI-004`) ou un seul pour tous les tickets ; numérotation par type ou commune ;
- l'appartenance à un Epic (au plus un, pas d'Epic dans un Epic — déjà au glossaire) : changement d'Epic, suppression d'un Epic qui contient des tickets ;
- les droits par rôle (propriétaire, contributeur, lecteur) : créer, modifier, changer le statut, supprimer ;
- la suppression d'un ticket (définitive ? ce que deviennent ses liens, commentaires, pièces jointes) ;
- le comportement dans une initiative archivée ;
- l'historique des modifications (comme l'exigence, ou non).

## Réponse

Tranché avec la responsable fonctionnelle le 02.11.2026.

1. **Champs communs** à tous les types : référence, type, titre (obligatoire, 200 caractères au plus), description (texte mis en forme, facultative, 20 000 caractères au plus), statut, responsable, échéance (facultative), Epic (facultatif), auteur et date de création, auteur et date de dernière modification.
   - Le **responsable** est facultatif, sauf pour l'Action où il est obligatoire. C'est un propriétaire ou un contributeur au moment de l'attribution ; il le reste s'il quitte ensuite l'initiative ou devient lecteur, et il est alors signalé jusqu'à réattribution (règle actuelle de l'action, étendue à tous les types).
2. **Champs propres à un type** :
   - Action : tâche BABOK (obligatoire) et technique (facultative).
   - Question : parties prenantes interrogées, facultatives, de la même initiative. Une partie prenante interrogée par une question ne peut pas être supprimée.
   - Risque : probabilité et impact, chacun faible, moyen ou fort, facultatifs ; aucune criticité calculée.
   - Décision, Demande de changement, Epic : aucun champ propre (l'exigence visée par une demande de changement est un lien, voir le ticket « Liens »).
   - Un type ajouté par l'administration n'a que les champs communs ; l'administration ne définit pas de champs.
3. **Référence** : un acronyme par type, numéroté par type dans l'initiative, selon la règle déjà en vigueur (acronyme paramétré par l'administration, réservé à vie). Acronymes par défaut : AC (Action), QU (Question), DE (Décision), RI (Risque), DC (Demande de changement), EP (Epic). Le type est choisi à la création et **ne change plus** : pour changer de type, créer un nouveau ticket et supprimer l'ancien.
4. **Epic** : un ticket ne rejoint qu'un Epic de la même initiative. Un contributeur peut le changer d'Epic ou l'en retirer à tout moment. Le statut d'un Epic se change à la main et ne se calcule pas à partir de ses tickets. Un Epic qui contient des tickets ne peut pas être supprimé (refus « lié »).
5. **Droits** : les mêmes que pour l'action, pour tous les types. Un lecteur consulte seulement ; un propriétaire ou un contributeur crée, modifie, change le statut et supprime tout ticket de l'initiative ; l'administrateur n'a pas accès au contenu.
6. **Suppression** : définitive, sans corbeille. Elle est refusée tant que le ticket est lié à un autre ticket, un besoin, une exigence ou une page, ou qu'il s'agit d'un Epic qui contient des tickets. Les commentaires, pièces jointes et historique du ticket disparaissent avec lui ; sa référence n'est jamais réutilisée.
7. **Initiative archivée** : tous les tickets sont en lecture seule pour tous les membres. On ne peut plus créer, modifier, changer de statut, supprimer, commenter ni joindre.
8. **Historique** : pour tous les types, Action comprise. À chaque modification, il enregistre qui, quand, et l'ancienne et la nouvelle valeur de chaque champ modifié : champs communs (dont statut, responsable, Epic) et champs propres au type. Les liens, commentaires et pièces jointes n'y figurent pas ; leurs tickets décident de leur propre trace. Tout membre peut le consulter.

Glossaire `CONTEXT.md` mis à jour : Ticket, Responsable d'un ticket, Question, Risque, Epic, Référence, Historique d'un ticket.
