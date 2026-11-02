# Carte — Phase 2 : tickets et pages

Type: map (wayfinder)

## Destination

Une spécification `.scratch/phase-2/spec.md` et ses tickets de réalisation numérotés, prêts pour l'agent (comme pour la phase 1) : tickets génériques (Action comprise), Epics, commentaires, liens, pages versionnées avec modèles, pièces jointes — sur le web.

## Notes

- Domaine : ACTA, cadre BABOK v3. Glossaire `CONTEXT.md`, ADR `docs/adr/` (0001 à 0011 non négociables ; 0014 fixe les pièces jointes en base, 10 Mo par fichier).
- Chaque ticket de discussion : skills `grilling` et `domain-modeling` ; mettre à jour `CONTEXT.md` dès qu'un terme est tranché.
- Ne jamais inventer de règle de gestion : la responsable fonctionnelle tranche.
- Décisions de cadrage (02.11.2026) :
  - l'Action devient un type de ticket générique dans cette phase (aujourd'hui table `action` à part, sans référence — migration `0010`) ;
  - le mobile reste limité à « Mes actions », qui doit continuer de fonctionner ;
  - besoins et exigences reçoivent seulement des liens vers tickets et pages (ni commentaires ni pièces jointes).
- Un ticket résolu par session (sauf recherche).

## Décisions prises

<!-- une ligne par ticket résolu : [titre](issues/NN-slug.md) : résumé -->

- [Livrables BABOK v3 par tâche](issues/06-livrables-babok-v3-par-tache.md) : 39 livrables relevés (EN/FR) ; environ la moitié se prêtent à une page, une dizaine sont déjà des objets d'ACTA, sept restent à décider.
- [Modèle commun du ticket](issues/01-modele-commun-du-ticket.md) : champs communs (responsable facultatif sauf Action), champs propres à l'Action, la Question et le Risque ; un acronyme par type, type figé ; droits de l'action ; suppression refusée si lié ; historique pour tous les types.
- [Passage de l'Action au ticket générique](issues/02-passage-de-l-action-au-ticket-generique.md) : rien ne se perd ; références attribuées par date de création ; parties prenantes concernées propres à l'Action ; suggestions, couverture, tableau de bord, alertes et « Mes actions » restent limités aux Actions ; historique vide au passage.
- [Types de ticket et statuts paramétrables](issues/03-types-de-ticket-et-statuts-parametrables.md) : types et statuts livrés figés, l'administration en ajoute ; « En attente » sur les six types, « Refusée » sur Question et Décision ; statut initial, passage libre, statuts fermés ; familles choisies pour les statuts ajoutés.
- [Liens](issues/04-liens.md) : trois natures fixes entre tickets (bloque, duplique, est lié à), un seul lien par paire ; tout ticket et toute page se lient aux besoins et exigences, sans nature ; pas de lien entre pages ni entre initiatives ; suppression refusée si lié ; liens hors historique.

## Zones floues

- Alertes sur les autres types de ticket que l'Action (aujourd'hui limitées aux actions).
- Nouvelles actions suggérées liées aux nouveaux types (ex. risque non traité).
- Recherche transverse dans l'initiative (tickets et pages).
- Export tableur des tickets, sur le modèle de celui des exigences.
- Évolution du tableau de bord pour montrer les autres types de ticket.
- Écran d'administration des types de ticket et de leurs statuts (sur le modèle de celui des statuts d'exigence).
- Une vue « mes tickets » (tous types dont je suis responsable), « Mes actions » restant limité aux Actions.
- Volume synchronisé vers le téléphone (PowerSync) après le passage au ticket générique.
- Rédaction de la spécification et découpage en tickets de réalisation (dernière étape).

## Hors périmètre

- Scénarios Gherkin : phase 3.
- Extension Agile : chantier suivant (module activable, ADR-0012).
- Connexion à Jira ou Confluence : envisagée plus tard.
- Hors-ligne mobile, et sur mobile tout écran autre que « Mes actions » : chantier hors-ligne.
- Commentaires et pièces jointes sur les besoins et les exigences : écartés de la phase 2, à rouvrir plus tard.
