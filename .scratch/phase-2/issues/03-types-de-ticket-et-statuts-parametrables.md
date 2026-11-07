# Types de ticket et statuts paramétrables

Type: grilling
Status: resolved
Blocked by: 01

## Question

Comment l'administration étend-elle les types de ticket et leurs statuts ? Trancher :

- ajout d'un type : libellés en français et en anglais (ADR-0013), acronyme de référence, statuts propres ;
- statuts des types livrés (Action, Question, Décision, Risque, Demande de changement, Epic) : fixes comme les statuts BABOK d'exigence, ou modifiables ;
- famille de statut (`status_tone`) des statuts livrés et ajoutés ;
- désactivation et suppression d'un type ou d'un statut déjà porté (sur le modèle des statuts d'exigence) ;
- passage libre d'un statut à l'autre, ou enchaînement imposé ; statut initial ; statuts « fermés » (qui comptent comme terminés pour les alertes et les filtres).

## Réponse

Tranché avec la responsable fonctionnelle le 02.11.2026. Modèle des statuts d'exigence, étendu aux tickets.

1. **Types livrés** (Action, Question, Décision, Risque, Demande de changement, Epic) : ni renommés, ni désactivés, ni supprimés ; seul leur acronyme se paramètre.
2. **Statuts livrés** : fixes, ni renommés, ni désactivés, ni supprimés. L'administration peut ajouter des statuts à tout type, livré ou ajouté. Listes livrées, dans l'ordre, avec les libellés anglais (ADR-0013) :

   | Type | Statuts (FR) | Statuts (EN) |
   |---|---|---|
   | Action | À faire, En cours, En attente, Terminée, Annulée | libellés actuels + On hold |
   | Question | Ouverte, En attente, Répondue, Close, Refusée | Open, On hold, Answered, Closed, Rejected |
   | Décision | Proposée, En attente, Actée, Refusée | Proposed, On hold, Agreed, Rejected |
   | Risque | Identifié, En attente, Traité, Clos | Identified, On hold, Addressed, Closed |
   | Demande de changement | Soumise, Analysée, En attente, Acceptée, Refusée | Submitted, Analysed, On hold, Accepted, Rejected |
   | Epic | À faire, En cours, En attente, Terminé, Annulé | To do, In progress, On hold, Done, Cancelled |

   - **En attente** (ajouté sur demande, pour les six types) : il manque une information pour continuer.
   - **Question refusée** : écartée sans réponse (non pertinente, ou les parties prenantes ne répondent pas). **Décision refusée** : l'arbitrage proposé n'est pas retenu.
3. **Familles des statuts livrés** :
   - neutre : À faire, Ouverte, Proposée, Soumise ;
   - en cours : En cours, Répondue, Traité, Analysée ;
   - positif : Terminée/Terminé, Close, Clos, Actée, Acceptée ;
   - attention : En attente, Identifié ;
   - négatif : Refusée ;
   - neutre atténué : Annulée/Annulé.

   Pour un statut de ticket ajouté, l'administrateur choisit la famille parmi les cinq (neutre par défaut). Les statuts d'exigence ajoutés restent toujours neutres.
4. **Statut initial** : le premier de la liste du type. Tout ticket est créé dans ce statut, puis le change librement.
5. **Passage d'un statut à l'autre** : libre pour tous les types, sans enchaînement imposé.
6. **Statuts fermés** (le ticket est terminé : plus d'alerte, rangé parmi les « fermés » des filtres) :
   - Action : Terminée, Annulée ;
   - Question : Close, Refusée ;
   - Décision : Actée, Refusée ;
   - Risque : Clos ;
   - Demande de changement : Acceptée, Refusée ;
   - Epic : Terminé, Annulé.

   **En attente n'est jamais fermé**, si bien qu'une action en attente garde ses alertes. Pour un statut ajouté, l'administrateur indique s'il est fermé.
7. **Ajout d'un type** : l'administrateur saisit un libellé en français et en anglais (50 caractères au plus, chacun unique parmi les types), un acronyme (2 à 4 lettres, réservé à vie) et au moins deux statuts. Le premier statut est le statut initial, et au moins un statut est fermé. Le type est actif dès sa création. Il n'a que les champs communs.
8. **Statut ajouté** : son libellé se modifie. Désactivé, il n'est plus proposé, mais les tickets qui le portent le gardent. Il ne se supprime que s'il n'a jamais été porté. On ne peut désactiver ni le statut initial d'un type, ni son dernier statut fermé encore actif.
9. **Type ajouté** : son libellé se modifie. Désactivé, il n'est plus proposé à la création, mais ses tickets restent consultables et modifiables. Il ne se supprime que si aucun ticket de ce type n'a jamais été créé.
10. **Portée et ordre** : types et statuts valent pour toute l'application. Les statuts ajoutés se placent après les statuts livrés du type, dans l'ordre d'ajout, sans réordonnancement. Les types ajoutés se placent après les types livrés.

Glossaire `CONTEXT.md` mis à jour : Famille de statut, Statut de ticket, Statut fermé, En attente, Type de ticket, statuts de l'Action, de la Question, de la Décision, du Risque, de la Demande de changement et de l'Epic, Alerte.
