# Spécification du premier lot de l'assistant

Type: task
Status: resolved
Label: wayfinder:task
Blocked by: 07, 08

## Question

Rédiger `.scratch/assistant/spec.md`, la spécification du premier lot, prête à être découpée en tickets. Elle rassemble les décisions de la carte : cycle de vie, ADR 0022, choix du premier lot, données par usage et maquette du panneau. Elle doit aussi répondre aux points encore ouverts à cette étape :
- le texte des instructions données au modèle pour chaque usage ;
- les skills à écrire pour Hermes ;
- les paramètres d'administration (demandes traitées en même temps, deux délais maximaux, taille maximale des données lues) ;
- la méthode d'estimation de la taille des données lues avant l'envoi ;
- les chiffres globaux visibles par l'administrateur.

La spécification est validée par la responsable avant tout découpage.

## Réponse

Échange avec la responsable du 27.11.2026 : neuf points validés en trois séries, puis la spécification a été **validée** telle quelle. Elle se trouve dans [`spec.md`](../spec.md) (décisions AS1 à AS40).

1. **Instructions dans ACTA** : elles sont écrites dans le code et envoyées avec chaque demande. Hermes n'a aucun skill ni aucun outil au premier lot. C'est plus strict que l'ADR 0022, qui n'est pas modifié (AS26).
2. **Instructions en français et en anglais**, envoyées dans la langue d'ACTA de l'auteur (AS28). Le texte français des instructions générales et de chaque usage est fixé dans AS28 et AS29.
3. **Bornes des paramètres** (AS32) :
   - demandes traitées en même temps : de 1 à 10 ;
   - délai en réponse rapide : de 5 à 60 min (20 au départ) ;
   - délai en réponse approfondie : de 10 à 180 min (60 au départ), jamais moins que le délai rapide ;
   - taille maximale : de 2 000 à 32 000 tokens (16 000 au départ).
4. **Chiffres globaux**, sur 30 jours et depuis le début : demandes par statut, par usage et par mode ; durée moyenne de traitement par mode ; attente moyenne dans la file ; échecs par raison ; demandes en file en ce moment. Ils ne sont jamais donnés par personne ni par initiative (AS33, AS34).
5. **Onglet « Assistant »** de l'administration, après « Pièces jointes », visible seulement si l'assistant est installé (AS32).
6. **Délai modifié** : la demande garde le délai en vigueur à son passage En cours ; le nouveau délai vaut pour les demandes suivantes (AS5).
7. **Estimation de la taille** : nombre de caractères divisé par 3, arrondi au-dessus, par une fonction unique de `shared/` (AS21).
8. **Gherkin** : les exigences choisies ensemble doivent avoir une fonctionnalité de même langue ; les autres sont grisées (AS29b).
9. **Chiffres et effacement** : une demande effacée disparaît aussi des chiffres, qui peuvent donc baisser (AS34).

Cinq points restent **à vérifier au premier ticket** de construction (spec, « Points de vigilance ») : réflexion activable demande par demande à travers Hermes, taille du prompt de Hermes, version déployée, journaux, suppression de session.
