# Spécification — Phase 2 : tickets et pages

Validée décision par décision avec la responsable fonctionnelle, du 02 au 06.11.2026. Carte du cadrage : [map.md](map.md).

## Objectif

Sur le web, une équipe suit tout le travail d'une initiative dans des **tickets** de plusieurs types (l'Action de la phase 1 en devient un), regroupés par **Epics**, commentés, liés entre eux et aux besoins et exigences. Elle rédige ses livrables BABOK dans des **pages** rangées en arborescence, versionnées et créées depuis des **modèles**. Tickets et pages acceptent des pièces jointes.

## Périmètre

Compris : tout ce que décident les tickets ci-dessous, sur le web. Sur le téléphone : « Mes actions » continue de fonctionner, affiche la référence et le statut En attente, et reçoit l'alerte de modifications non enregistrées.

Non compris : voir la section « Hors périmètre » de la [carte](map.md).

## Où sont les règles

Chaque règle vit dans un seul ticket de décision. Les tickets de réalisation y renvoient sans les recopier : **les lire avant de coder**. En cas de doute ou de contradiction, s'arrêter et poser la question à la responsable fonctionnelle (`CLAUDE.md`).

| Sujet | Décision |
|---|---|
| Champs, référence, droits, suppression, historique d'un ticket | [01](issues/01-modele-commun-du-ticket.md) |
| Passage de l'Action au ticket générique | [02](issues/02-passage-de-l-action-au-ticket-generique.md) |
| Types et statuts, familles, statuts fermés | [03](issues/03-types-de-ticket-et-statuts-parametrables.md) |
| Liens | [04](issues/04-liens.md) |
| Commentaires | [05](issues/05-commentaires.md) |
| Livrables BABOK (recherche) | [06](issues/06-livrables-babok-v3-par-tache.md) |
| Modèle de la page, enregistrements, versions | [07](issues/07-modele-de-la-page.md) |
| Éditeur de page | [08](issues/08-editeur-de-page.md) |
| Modèles de page | [09](issues/09-modeles-de-page.md) |
| Pièces jointes | [10](issues/10-pieces-jointes.md) |
| Écrans des tickets | [11](issues/11-ecrans-des-tickets.md) |
| Modifications non enregistrées | [12](issues/12-modifications-non-enregistrees.md) |
| Navigation | [13](issues/13-coexistence-de-la-navigation.md) |
| Écrans d'administration | [14](issues/14-ecrans-d-administration.md) |

Vocabulaire : [`CONTEXT.md`](../../CONTEXT.md). Les prototypes de l'éditeur de page et des écrans des tickets ont été supprimés le 07.11.2026 : les décisions 08 et 11 font foi. Le menu du haut du premier n'existe pas dans ACTA.

## Contraintes techniques

- ADR `docs/adr/` : 0006 (deux barrières, guards et RLS), 0013 (deux langues), 0014 (pièces jointes en base), 0017 et 0018 (composants maison, tokens), 0019 (Tiptap, contenu en JSON).
- Nouvelle entité : suivre `docs/ajouter-entite-partagee.md`, dont les permissions de bout en bout dans `scripts/roles/`.
- Règles métier dans `shared/`, avec tests : `CODING_STANDARDS.md`.
- Le téléphone lit et crée les actions par l'API (`mobile/src/api.ts`), PowerSync n'a ni table ni écriture d'action : aucune règle de synchronisation à changer, mais les routes et réponses dont le téléphone dépend doivent rester compatibles.
- Un ADR est à écrire au ticket 21 : absence d'antivirus, risque accepté par la responsable fonctionnelle.

## Découpage

Chaque ticket livre quelque chose de visible et se valide seul.

| N° | Ticket | Dépend de |
|---|---|---|
| 15 | [Modifications non enregistrées](issues/15-modifications-non-enregistrees.md) | — |
| 16 | [Ticket générique et passage de l'Action](issues/16-ticket-generique-et-passage-de-l-action.md) | — |
| 17 | [Navigation et écran Tickets](issues/17-navigation-et-ecran-tickets.md) | 16 |
| 18 | [Types de ticket livrés et Epics](issues/18-types-de-ticket-livres-et-epics.md) | 17 |
| 19 | [Liens](issues/19-liens.md) | 18 |
| 20 | [Commentaires](issues/20-commentaires.md) | 18 |
| 21 | [Pièces jointes des tickets](issues/21-pieces-jointes-des-tickets.md) | 18 |
| 22 | [Pages : arborescence et écriture](issues/22-pages-arborescence-et-ecriture.md) | 17 |
| 23 | [Enregistrements et versions](issues/23-enregistrements-et-versions.md) | 22 |
| 24 | [Modification simultanée d'une page](issues/24-modification-simultanee-d-une-page.md) | 23 |
| 25 | [Liens et commentaires des pages](issues/25-liens-et-commentaires-des-pages.md) | 19, 20, 22 |
| 26 | [Images et pièces jointes des pages](issues/26-images-et-pieces-jointes-des-pages.md) | 21, 23 |
| 27 | [Créer une page depuis un modèle](issues/27-creer-une-page-depuis-un-modele.md) | 22 |
| 28 | [Rédaction des 22 modèles](issues/28-redaction-des-22-modeles.md) | 27 |
| 29 | [Administration : types et statuts](issues/29-administration-types-et-statuts.md) | 18 |
| 30 | [Administration : modèles de page](issues/30-administration-modeles-de-page.md) | 27 |
| 31 | [Administration : limite de pièces jointes](issues/31-administration-limite-de-pieces-jointes.md) | 21 |
