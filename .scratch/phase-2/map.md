# Carte — Phase 2 : tickets et pages

Type: map (wayfinder)

## Destination

Une spécification `.scratch/phase-2/spec.md` et ses tickets de réalisation numérotés, prêts pour l'agent (comme pour la phase 1) : tickets génériques (Action comprise), Epics, commentaires, liens, pages versionnées avec modèles, pièces jointes — sur le web.

## Notes

- Domaine : ACTA, cadre BABOK v3. Glossaire `CONTEXT.md`, ADR `docs/adr/` (0001 à 0011 non négociables ; 0014 fixe les pièces jointes en base, 10 Mo par fichier ; 0019 fixe l'éditeur de page).
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
- [Modifications non enregistrées](issues/12-modifications-non-enregistrees.md) : alerte « Enregistrer / Abandonner / Continuer la saisie » sur tout panneau de saisie (phase 1 comprise) et les formulaires du téléphone, dès qu'une valeur diffère de l'enregistrée ; toutes les sorties gardées, l'onglet par le message du navigateur ; une alerte par panneau, en partant du dessus ; échec = panneau resté ouvert.
- [Modèle de la page](issues/07-modele-de-la-page.md) : référence `PA`, titre, contenu de 200 000 caractères ; arborescence libre, ordre manuel, déplacement avec les sous-pages ; chaque enregistrement conservé, versions déclarées à la demande (même après coup), suppression d'un enregistrement sauf le dernier avec trace ; refus d'enregistrer si la page a changé entre-temps ; suppression refusée si liée ou avec sous-pages.
- [Commentaires](issues/05-commentaires.md) : sur les tickets et les pages entières, fil simple, écrits par propriétaires et contributeurs ; modifiés par leur auteur, supprimés par leur auteur ou un propriétaire avec une ligne de trace ; ni mention ni pièce jointe ; 5 000 caractères ; web seulement.
- [Éditeur de page](issues/08-editeur-de-page.md) : Tiptap, contenu enregistré en JSON (ADR-0019), écriture directe dans le rendu ; pleine page, arborescence à gauche, historique en volet ; comparaison dans un seul texte ; après un refus : comparer, enregistrer à la suite ou prendre la version de l'autre.
- [Modèles de page](issues/09-modeles-de-page.md) : 22 modèles livrés, plan et texte d'aide en deux langues, globaux ; copiés à la création, sans effet sur la couverture ; conception portée par une page, objectifs métier en section, confirmation par une version ; page créée au premier enregistrement.
- [Pièces jointes](issues/10-pieces-jointes.md) : sur les tickets et les pages ; liste fixe de formats, sans antivirus (risque accepté) ; 500 Mo par initiative, réglables ; un fichier appartient à la page, reste visible dans les anciens enregistrements, et ne se supprime pas s'il figure dans le dernier ; suppression tracée ; web seulement.
- [Écrans des tickets](issues/11-ecrans-des-tickets.md) : entrées « Tickets » et « Pages » sous l'initiative, en pleine page ; tableau filtrable et triable, regroupement par Epic en option ; fiche en panneau ; création en panneau ou rapide, sauf l'Action en rapide.
- [Coexistence de la navigation](issues/13-coexistence-de-la-navigation.md) : le clic sur une initiative ouvre sa fiche et déplie ses entrées ; changer d'écran ferme les panneaux ; « + Action » reste ; la palette trouve tickets et pages ; l'adresse suit Tickets, Pages et la page ouverte.
- [Écrans d'administration](issues/14-ecrans-d-administration.md) : trois onglets de plus (types de ticket, modèles de page, pièces jointes) ; 10 Mo par fichier, fixe ; 500 Mo par initiative, réglables entre 10 Mo et 1 Go.

## Zones floues

Aucune : la [spécification](spec.md) et les tickets de réalisation 15 à 31 sont écrits. Le volume synchronisé vers le téléphone est sans objet : le téléphone passe par l'API pour les actions, PowerSync n'en a aucune.

## Hors périmètre

- Scénarios Gherkin : phase 3, chantier suivant.
- Extension Agile : après la phase 3 (module activable, ADR-0012).
- Connexion à Jira ou Confluence : envisagée plus tard.
- Hors-ligne mobile, et sur mobile tout écran autre que « Mes actions » : chantier hors-ligne.
- Commentaires et pièces jointes sur les besoins et les exigences : écartés de la phase 2, à rouvrir plus tard.
- Priorité des exigences (tâche BABOK 5.3) : ni champ ni modèle en phase 2, à rouvrir plus tard ([Modèles de page](issues/09-modeles-de-page.md)).
- Reportés à plus tard par la responsable fonctionnelle (06.11.2026) : alertes sur les autres types de ticket et mention d'un membre dans un commentaire ; nouvelles actions suggérées liées aux nouveaux types ; recherche transverse dans l'initiative ; export tableur des tickets ; tableau de bord pour les autres types ; vue « mes tickets » toutes initiatives confondues.
