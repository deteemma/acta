# Cycle de vie d'une demande à l'assistant

Type: grilling
Status: resolved
Label: wayfinder:grilling

## Question

Quelles règles de gestion suit une **demande à l'assistant**, puisqu'elle est asynchrone ? Points à trancher :

- **États** de la demande : en attente, en cours, répondue, échouée, annulée… ;
- **Prévenir le BA** quand l'avis est prêt. Le terme « Alerte » est aujourd'hui réservé aux actions : faut-il l'étendre ou créer un autre signal ?
- **Nombre de demandes** en cours par personne et par initiative ;
- **Annulation** d'une demande, **délai maximal**, **échec** et nouvelle tentative ;
- **Perte de droits** entre la question et la réponse (la personne quitte l'initiative, devient lectrice, l'initiative est archivée ou supprimée) ;
- **Date de l'état lu** : l'avis porte sur l'état de l'initiative au moment où l'assistant l'a lue, et doit le dire ;
- **Effacement** : ce que l'auteur efface (la demande, l'avis, tout le fil) et ce qu'il en reste.

## Réponse

Échange avec la responsable du 25.11.2026, douze recommandations acceptées. Les termes sont consignés dans `CONTEXT.md` (Demande à l'assistant, Statut d'une demande à l'assistant, Avis de l'assistant, Avis non lu).

1. **Demande isolée** : une question donne un avis, sans tenir compte des demandes précédentes. Le bouton « Reposer en précisant » crée une nouvelle demande préremplie avec la question d'origine.
2. **Qui peut demander** : tout membre, lecteur compris, y compris sur une initiative archivée.
3. **Statuts** : En attente, En cours, Répondue, Échouée, Annulée. Les trois derniers sont définitifs.
4. **Avis non lu** : signal distinct de l'Alerte, dans l'application seulement, sans courriel. Il porte sur une demande Répondue ou Échouée que l'auteur n'a pas encore ouverte. Il se voit sur l'initiative et dans un compteur global.
5. **Une seule demande non terminée** (En attente ou En cours) par personne, toutes initiatives confondues. La limite pourra être relevée après les mesures du modèle local.
6. **Date de lecture** : l'avis indique « Établi d'après l'état de l'initiative au JJ.MM.AAAA à HH:MM » (moment du passage En cours). Il signale « L'initiative a changé depuis cet avis » si un élément lu a été modifié. Il n'est jamais recalculé.
7. **Annulation** : l'auteur peut annuler une demande En attente ou En cours. Le travail s'arrête et aucun avis partiel n'est gardé. La demande reste dans l'historique avec le statut « Annulée » jusqu'à son effacement.
8. **Délai** :
   - une demande En cours qui dépasse le délai maximal de traitement devient Échouée, avec la mention « délai dépassé » ;
   - ce délai est un paramètre de l'administration, et sa valeur initiale viendra des mesures du modèle local ;
   - l'attente En attente n'a pas de délai, et l'auteur voit sa position dans la file (« 2 demandes avant la vôtre »).
9. **Échec** :
   - pas de nouvelle tentative automatique ;
   - la raison affichée est compréhensible : « délai dépassé », « assistant indisponible » ou « l'assistant n'a pas pu répondre » ;
   - le bouton « Reposer la question » crée une nouvelle demande avec la même question, modifiable avant l'envoi.
10. **Perte de droits** :
    - une demande non terminée devient Annulée automatiquement, avec la mention « vous n'avez plus accès à cette initiative ». Les droits sont revérifiés juste avant la lecture de l'initiative ;
    - quand l'auteur quitte l'initiative ou en est retiré, ses demandes et avis sur cette initiative sont masqués (ADR 0006). Ils réapparaissent s'il redevient membre ;
    - quand l'initiative est supprimée, toutes les demandes et tous les avis la concernant sont supprimés ;
    - quand le compte est désactivé, ses demandes sont conservées et retrouvées à la réactivation.
11. **Effacement** :
    - l'auteur efface une demande (question et avis) ou toutes ses demandes d'une initiative ;
    - l'effacement est définitif, sans trace dans ACTA ;
    - effacer une demande non terminée l'annule d'abord.
12. **Conservation et confidentialité** :
    - les demandes sont conservées sans limite de durée ;
    - personne d'autre que l'auteur ne voit ni leur contenu ni leur liste, administrateur compris ;
    - l'administrateur voit seulement des chiffres globaux : nombre de demandes, durée moyenne de traitement.

**Points renvoyés à d'autres tickets** :
- ce que Hermes conserve de son côté, pour que l'effacement soit réel : ticket 05 ;
- la valeur initiale du délai maximal : ticket 06 ;
- ce qui compte comme un élément lu modifié : zone floue « Données fournies à l'assistant ».
