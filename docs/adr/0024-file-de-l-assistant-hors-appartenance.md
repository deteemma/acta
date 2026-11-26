# ADR-0024 — File de l'assistant : position et demande non terminée, hors appartenance

- **Statut** : proposé (ticket 12 de la carte « assistant », en attente de la validation de la responsable fonctionnelle)
- **Date** : 2026-11-26

## Contexte

La file des demandes à l'assistant est commune à toute l'application
(spécification `.scratch/assistant/spec.md`, AS3 et AS4) :

- l'auteur voit sa position dans la file : « 2 demandes avant la vôtre. » ;
- une personne n'a qu'une demande non terminée, toutes initiatives
  confondues. Le refus nomme cette demande : « Vous avez déjà une demande non
  terminée (« Faire le point », en attente). ».

Ces deux informations portent sur des demandes que la RLS ne montre pas à
l'auteur :

- la position compte les demandes des autres personnes, sur des initiatives
  dont l'auteur n'est peut-être pas membre ;
- la demande non terminée peut se trouver sur une initiative que l'auteur a
  quittée, dont les demandes lui sont alors masquées (AS9).

L'ADR 0016 n'admet un comptage hors appartenance que s'il renvoie des nombres
par élément du référentiel BABOK. « Au-delà, il faut un nouvel ADR. »

Options envisagées :

- **(a)** ne pas afficher la position ; écart à AS4, validée par la responsable ;
- **(b)** ne compter que les demandes visibles par l'auteur ; la position serait
  fausse ;
- **(c)** deux fonctions PostgreSQL dédiées, aux sorties limitées. Retenue.

## Décision

1. `assistant_queue_ahead(id)`, `SECURITY DEFINER` (migration 0038), renvoie
   **un seul nombre** : les demandes En attente arrivées avant la demande
   donnée. Elle renvoie null si l'appelant n'en est pas l'auteur, si la
   demande n'attend plus, ou si l'appelant n'est plus membre de son initiative.
   Elle ne renvoie ni ligne, ni identifiant, ni initiative, ni auteur.
2. `my_unfinished_assistant_request()`, `SECURITY DEFINER` (migration 0038),
   renvoie l'**usage et le statut** de la demande non terminée de l'appelant,
   et rien d'autre : ni initiative, ni contenu, ni avis. Elle porte sur ses
   propres demandes seulement.
3. Aucune des deux ne renvoie quoi que ce soit sans utilisateur courant, ni
   pour l'administrateur au titre de son rôle.
4. `scripts/roles/34-demandes-a-l-assistant.mjs` vérifie qu'un autre membre et
   l'administrateur n'obtiennent rien sur la demande d'autrui.

## Conséquences

- L'auteur déduit le nombre de demandes en attente dans toute l'application.
  Avec peu d'utilisateurs, ce nombre peut laisser deviner l'activité d'une
  autre équipe, sans rien en révéler d'autre.
- Après avoir quitté une initiative, l'auteur apprend encore qu'il y garde une
  demande non terminée, et de quel usage. Ce masquage partiel est assumé, pour
  qu'il comprenne le refus.
- Tout autre comptage ou détail hors appartenance sur les demandes, en
  particulier les chiffres de l'administration (AS33, ticket 21), demande son
  propre examen.

> Rappel : un ADR accepté n'est jamais modifié de sa propre initiative. Pour le
> faire évoluer, on propose un nouvel ADR et on attend une validation explicite.
