# Référentiel agile à relire (ticket 01)

Document de relecture destiné à la responsable fonctionnelle
([spécification](spec.md), décisions D1 à D5). Il prépare la migration du ticket 02 : rien n'est migré
avant sa validation, et la migration reprendra ce fichier tel que corrigé.

Règles suivies (ADR-0012, D1) : pour chaque élément, le renvoi de section, le
nom anglais, le nom français proposé et un résumé rédigé pour ACTA en français
et en anglais. Les résumés sont écrits pour ACTA, dans le ton des résumés du
BABOK déjà livrés (migration `0009`) ; ils ne reprennent aucun texte de l'IIBA.

## Avertissement : ce qui est le moins sûr

Claude n'a pas eu accès au texte de l'Extension Agile v2 pour établir ce
fichier. Sont reconstitués de mémoire, et donc à contrôler en priorité contre
l'exemplaire de la responsable fonctionnelle :

1. **La liste des techniques agiles du chapitre 7** (24 techniques proposées
   ci-dessous). Une technique peut manquer ou être en trop ; voir aussi la
   rubrique « Techniques candidates écartées ».
2. **Les numéros de section.** Ils sont proposés dans l'ordre du chapitre (4.1
   à 4.7, 5.1 à 5.3, 7.1 à 7.24). Si un chapitre commence par une section
   d'introduction, tous ses numéros sont décalés d'un cran. La revue a aussi
   soulevé un doute sur les chapitres eux-mêmes : chaque horizon pourrait
   occuper un chapitre entier, et les principes un chapitre antérieur au
   ch. 4. Si c'est le cas, la spécification (D2) est à corriger elle aussi.
3. **Les relations technique agile ↔ horizon.** Ce sont des propositions,
   toutes marquées « à confirmer » (D4). D2 n'en retient que celles que
   l'ouvrage énonce explicitement : toute relation que l'ouvrage n'énonce pas
   est à barrer.
4. **Les sources citées pour les noms français.** Les termes attribués à
   l'Agile Practice Guide du PMI sont cités de mémoire, même sans ⚠. Seuls les
   termes IIBA-FR ont été vérifiés dans la migration `0009`.

## Identifiant stable (D1)

Proposition : l'identifiant de chaque élément est « ae- » suivi de son numéro
de section (par exemple `ae-4.1`, `ae-5.2`, `ae-7.17`). Le préfixe évite toute
confusion avec les identifiants du BABOK (`7.1` y désigne déjà une tâche). Il
ne dépend pas de la langue (D5) ; il est fixé à la migration et ne change plus
ensuite, même si un numéro de section était corrigé plus tard.

## Légende

Sources des noms français (D3) :

- **IIBA-FR** : traduction française du BABOK v3 et son glossaire, telle que
  reprise dans ACTA (migration `0009`) ;
- **PMI-FR** : édition française de l'Agile Practice Guide (PMI et Agile
  Alliance) ;
- **ACTA** : traduction proposée pour ACTA, faute d'équivalent repéré dans ces
  deux sources ; le terme indiqué entre crochets est celui qui a guidé la
  traduction.

⚠ signale un choix de traduction incertain, expliqué dans la colonne
« Remarque ».

Les renvois vers des techniques BABOK, dans les remarques, ne servent qu'à la
relecture. Ils ne seront pas migrés : D2 exclut toute correspondance avec le
BABOK.

Le numéro sera affiché « EA 7.17 » en français et « AE 7.17 » en anglais
(D5) ; ce fichier donne le numéro sans préfixe.

## Principes agiles (ch. 4)

| Section | Nom EN | Nom FR proposé | Source | Résumé FR | Résumé EN | Remarque |
|---|---|---|---|---|---|---|
| 4.1 | See the Whole | Voir l'ensemble ⚠ | ACTA | Situer chaque besoin dans son contexte (organisation, clients, autres changements en cours) avant de s'attacher à une partie de la solution. | Place each need in its wider context (organisation, customers, other ongoing changes) before focusing on any one part of the solution. | Autre choix possible : « Avoir une vision d'ensemble ». |
| 4.2 | Think as a Customer | Penser comme un client | ACTA | Partir de ce que vivent et attendent les clients et les utilisateurs, et vérifier régulièrement auprès d'eux que la solution leur sert. | Start from what customers and users experience and expect, and check with them regularly that the solution actually helps them. | |
| 4.3 | Analyze to Determine What is Valuable | Analyser pour déterminer ce qui a de la valeur | ACTA [« valeur », IIBA-FR] | Évaluer en continu ce qui apporte le plus de valeur, pour faire passer ces éléments en premier et renoncer à ceux qui en apportent peu. | Keep assessing what brings the most value, so that those items come first and low-value ones are dropped. | |
| 4.4 | Get Real Using Examples | Concrétiser à l'aide d'exemples ⚠ | ACTA | Préciser les besoins par des exemples concrets, qui servent aussi à vérifier que la solution se comporte comme prévu. | Pin down needs through concrete examples, which also serve to check that the solution behaves as intended. | Traduction libre : l'anglais joue sur « get real ». |
| 4.5 | Understand What is Doable | Comprendre ce qui est réalisable | ACTA | Tenir compte des contraintes techniques, organisationnelles et de délai pour proposer ce qui peut réellement être livré. | Take technical, organisational and time constraints into account so as to propose what can really be delivered. | |
| 4.6 | Stimulate Collaboration and Continuous Improvement | Stimuler la collaboration et l'amélioration continue | ACTA [« amélioration continue », PMI-FR] | Faire travailler ensemble les parties prenantes et l'équipe, et ajuster régulièrement la manière de travailler d'après ce que l'on apprend. | Get stakeholders and the team working together, and regularly adjust the way of working based on what is learned. | |
| 4.7 | Avoid Waste | Éviter le gaspillage | PMI-FR | Ne produire que l'analyse et la documentation qui servent vraiment, au moment où elles servent. | Produce only the analysis and documentation that are genuinely useful, at the time they are useful. | « Gaspillage » : terme lean repris par le PMI. |

## Horizons (ch. 5)

Noms imposés par D3 : le mot « horizon » figure toujours, pour ne pas
confondre l'horizon Initiative avec l'Initiative d'ACTA.

| Section | Nom EN | Nom FR proposé | Source | Résumé FR | Résumé EN | Remarque |
|---|---|---|---|---|---|---|
| 5.1 | Strategy Horizon | horizon Stratégie | ACTA (D3) | Niveau de l'organisation dans son ensemble : orientations, objectifs et choix des initiatives à lancer ou à arrêter, sur un temps long. | Level of the organisation as a whole: direction, goals and choice of the initiatives to start or stop, over a long time frame. | Minuscule à « horizon » en début de nom : à confirmer pour l'affichage (en début de phrase et en titre, « Horizon Stratégie »). |
| 5.2 | Initiative Horizon | horizon Initiative | ACTA (D3) | Niveau d'une initiative : définir ce qu'elle doit accomplir, découper le travail et en suivre la valeur d'une livraison à l'autre. | Level of one initiative: define what it must achieve, break down the work and follow its value from one delivery to the next. | |
| 5.3 | Delivery Horizon | horizon Livraison | ACTA (D3) | Niveau de l'équipe de livraison : préciser les éléments à réaliser dans les prochains cycles courts et vérifier ce qui a été livré. | Level of the delivery team: detail the items to build in the next short cycles and check what has been delivered. | |

## Techniques agiles (ch. 7)

| Section | Nom EN | Nom FR proposé | Source | Résumé FR | Résumé EN | Remarque |
|---|---|---|---|---|---|---|
| 7.1 | Backlog Refinement | Affinage du backlog ⚠ | PMI-FR | Revoir régulièrement le backlog avec l'équipe : préciser, découper, estimer et réordonner les éléments des prochains cycles. | Regularly go over the backlog with the team: clarify, split, estimate and reorder the items for the next cycles. | Le PMI dit peut-être « affinement ». ACTA écrit « Backlog » avec une majuscule dans « Gestion du Backlog » (BABOK 10.2) : harmoniser ? |
| 7.2 | Behaviour Driven Development | Développement piloté par le comportement (BDD) ⚠ | PMI-FR | Décrire le comportement attendu par des exemples structurés (contexte, événement, résultat), qui deviennent des tests d'acceptation. | Describe expected behaviour through structured examples (context, event, outcome) that become acceptance tests. | Le sigle anglais BDD est courant en français. |
| 7.3 | Blitz Planning | Planification éclair ⚠ | ACTA [« blitz »] | Établir rapidement en groupe un premier plan de livraison, en disposant sur une ligne de temps les éléments à réaliser et leurs dépendances. | Quickly build a first delivery plan as a group by laying out the items to build and their dependencies on a timeline. | Pas d'équivalent repéré ; garder « Blitz Planning » ? |
| 7.4 | Impact Mapping | Cartographie des impacts ⚠ | ACTA [« cartographie », PMI-FR] | Relier un objectif aux acteurs qui peuvent l'influencer, aux changements de comportement attendus d'eux et aux livrables qui les favorisent. | Link a goal to the actors who can influence it, the behaviour changes expected from them, and the deliverables that encourage those changes. | |
| 7.5 | Job Stories | Récits de situation ⚠ | ACTA [« Récits utilisateurs », IIBA-FR] | Exprimer un besoin à partir d'une situation et de la motivation de la personne, plutôt qu'à partir de son rôle. | Express a need from a situation and the person's motivation, rather than from their role. | Calqué sur « Récits utilisateurs » (BABOK 10.48). Traduction littérale possible : « Récits de tâche ». |
| 7.6 | Kano Analysis | Analyse de Kano | ACTA | Classer les caractéristiques d'un produit selon l'effet de leur présence ou de leur absence sur la satisfaction des clients. | Classify product features by how their presence or absence affects customer satisfaction. | |
| 7.7 | Minimum Viable Product | Produit minimum viable (MVP) | PMI-FR | Livrer la plus petite version d'un produit qui permet de vérifier une hypothèse auprès de vrais utilisateurs. | Deliver the smallest version of a product that allows a hypothesis to be tested with real users. | |
| 7.8 | Personas | Personas | ACTA [« personas », IIBA-FR] | Décrire des utilisateurs types, avec leurs objectifs et leurs habitudes, pour garder les vrais utilisateurs à l'esprit pendant l'analyse. | Portray typical users, with their goals and habits, to keep real users in mind during analysis. | Le mot figure dans le nom du BABOK 10.43 « Liste des parties prenantes, carte ou personas ». |
| 7.9 | Planning Workshop | Atelier de planification | ACTA [« Ateliers », IIBA-FR] | Réunir l'équipe et les parties prenantes pour convenir ensemble des objectifs et du contenu du prochain cycle ou de la prochaine livraison. | Bring the team and stakeholders together to agree on the goals and content of the next cycle or release. | |
| 7.10 | Portfolio Kanban | Kanban de portefeuille | ACTA [« Kanban », PMI-FR] | Visualiser sur un tableau le flux des initiatives de l'organisation, de l'idée à la réalisation, en limitant le nombre d'initiatives menées en même temps. | Show on a board the flow of the organisation's initiatives, from idea to completion, while limiting how many run at the same time. | |
| 7.11 | Product Roadmap | Feuille de route produit | PMI-FR | Présenter les grandes étapes prévues d'un produit dans le temps, reliées aux objectifs qu'elles servent, et la tenir à jour. | Present the planned major steps of a product over time, linked to the goals they serve, and keep it up to date. | |
| 7.12 | Purpose Alignment Model | Modèle d'alignement sur la finalité ⚠ | ACTA | Classer les activités selon qu'elles distinguent l'organisation sur son marché et qu'elles sont indispensables à son fonctionnement, pour décider où investir. | Sort activities by whether they set the organisation apart in its market and whether they are critical to its operation, to decide where to invest. | Pas d'équivalent repéré. |
| 7.13 | Real Options | Options réelles | ACTA [terme de finance] | Retarder une décision jusqu'au dernier moment raisonnable, en gardant ouvertes les options et en connaissant leur date d'échéance. | Delay a decision until the last responsible moment, keeping options open and knowing when each one expires. | |
| 7.14 | Relative Estimation | Estimation relative | PMI-FR | Estimer la taille des éléments en les comparant entre eux plutôt qu'en durée absolue, par exemple en points. | Estimate the size of items by comparing them with one another rather than in absolute time, for example in points. | |
| 7.15 | Retrospectives | Rétrospectives | PMI-FR | À la fin d'un cycle, examiner en équipe la façon de travailler et choisir quelques améliorations à essayer au cycle suivant. | At the end of a cycle, look at the team's way of working and choose a few improvements to try in the next one. | Proche de « Retours d'expérience » (BABOK 10.27). |
| 7.16 | Reviews | Revues ⚠ | IIBA-FR | Montrer ce qui a été réalisé aux parties prenantes à la fin d'un cycle, recueillir leurs réactions et en tenir compte pour la suite. | Show what has been built to stakeholders at the end of a cycle, gather their reactions and take them into account for what follows. | Même nom français que la technique BABOK 10.37 : seul le préfixe EA les distingue. Préciser, par exemple « Revues de fin de cycle » ? |
| 7.17 | Spikes | Spikes ⚠ | PMI-FR | Consacrer un court travail limité dans le temps à lever une incertitude technique ou fonctionnelle avant d'estimer ou de réaliser. | Spend a short, time-boxed piece of work on removing a technical or functional uncertainty before estimating or building. | Le PMI garde, sauf erreur, le terme anglais. |
| 7.18 | Story Decomposition | Décomposition des récits | ACTA [« Récits utilisateurs », IIBA-FR] | Découper un besoin large en récits plus petits, chacun apportant de la valeur et pouvant être livré au cours d'un cycle. | Split a large need into smaller stories, each bringing value and deliverable within one cycle. | |
| 7.19 | Story Elaboration | Élaboration des récits | ACTA [« Récits utilisateurs », IIBA-FR] | Compléter un récit juste avant sa réalisation : détails, exemples et critères d'acceptation convenus avec l'équipe. | Complete a story just before it is built: details, examples and acceptance criteria agreed with the team. | |
| 7.20 | Story Mapping | Cartographie des récits ⚠ | ACTA [« cartographie », PMI-FR] | Disposer les récits selon le parcours de l'utilisateur et par ordre de priorité, pour voir l'ensemble du produit et choisir le contenu des livraisons. | Lay out stories along the user's journey and by priority, to see the whole product and choose what goes into each release. | Le terme anglais « story map » est souvent gardé. |
| 7.21 | Storyboarding | Scénarimage ⚠ | ACTA [terme courant en français] | Représenter en une suite d'images ce que vit l'utilisateur pas à pas, pour discuter d'une solution avant de la réaliser. | Show in a series of pictures what the user goes through step by step, to discuss a solution before building it. | |
| 7.22 | Value Modelling | Modélisation de la valeur | ACTA [« valeur », IIBA-FR] | Représenter comment la valeur est créée et pour qui, afin d'orienter les choix vers ce qui y contribue le plus. | Represent how value is created and for whom, so as to steer choices towards what contributes most. | |
| 7.23 | Value Stream Mapping | Cartographie de la chaîne de valeur ⚠ | PMI-FR | Représenter toutes les étapes qui mènent d'une demande à sa livraison, avec les temps d'attente, pour repérer et réduire les gaspillages. | Map every step from a request to its delivery, including waiting times, to find and reduce waste. | Autre traduction courante : « Cartographie des flux de valeur ». |
| 7.24 | Visioning | Élaboration de la vision ⚠ | ACTA | Construire avec les parties prenantes une vision commune et partagée du but visé, qui sert ensuite de repère aux décisions. | Build with stakeholders a common vision of the intended goal, which then guides decisions. | |

### Techniques candidates écartées

Techniques qui figuraient, sauf erreur, dans la première édition de
l'Extension Agile, et que Claude pense absentes du chapitre 7 de la v2 : Backlog
Management, Burndown Charts, Business Capability Analysis, Collaborative Games,
Lightweight Documentation, MoSCoW Prioritization, User Story. Plusieurs sont
traitées dans le BABOK v3 lui-même (10.2, 10.6, 10.10, 10.33, 10.48). Si l'une
d'elles figure bien dans la v2, l'ajouter au tableau. La revue a émis un doute
sur **Lightweight Documentation**, peut-être présente dans la v2 : la liste
compterait alors 25 techniques et la numérotation serait décalée à partir de sa
place dans l'ordre alphabétique.

## Relations technique agile ↔ horizons (D2, D4)

Les « ? » sont des propositions de Claude, faites de mémoire, et non des
relations lues dans l'ouvrage. D2 ne retient que les relations que l'ouvrage
énonce explicitement : ne remplacer un « ? » par « X » que si le texte l'énonce,
effacer les autres, ajouter les relations manquantes, puis remplacer « à
confirmer » par « confirmé ». Les noms ne sont donnés que comme repère :
seuls comptent la section et le nom du tableau du chapitre 7.

| Section | Technique agile | horizon Stratégie | horizon Initiative | horizon Livraison | État |
|---|---|:-:|:-:|:-:|---|
| 7.1 | Affinage du backlog | | ? | ? | à confirmer |
| 7.2 | Développement piloté par le comportement (BDD) | | | ? | à confirmer |
| 7.3 | Planification éclair | | ? | ? | à confirmer |
| 7.4 | Cartographie des impacts | ? | ? | | à confirmer |
| 7.5 | Récits de situation | | ? | ? | à confirmer |
| 7.6 | Analyse de Kano | | ? | ? | à confirmer |
| 7.7 | Produit minimum viable (MVP) | ? | ? | | à confirmer |
| 7.8 | Personas | ? | ? | ? | à confirmer |
| 7.9 | Atelier de planification | | ? | ? | à confirmer |
| 7.10 | Kanban de portefeuille | ? | | | à confirmer |
| 7.11 | Feuille de route produit | ? | ? | | à confirmer |
| 7.12 | Modèle d'alignement sur la finalité | ? | ? | | à confirmer |
| 7.13 | Options réelles | ? | ? | ? | à confirmer |
| 7.14 | Estimation relative | | ? | ? | à confirmer |
| 7.15 | Rétrospectives | ? | ? | ? | à confirmer |
| 7.16 | Revues | | ? | ? | à confirmer |
| 7.17 | Spikes | | ? | ? | à confirmer |
| 7.18 | Décomposition des récits | | ? | ? | à confirmer |
| 7.19 | Élaboration des récits | | | ? | à confirmer |
| 7.20 | Cartographie des récits | | ? | ? | à confirmer |
| 7.21 | Scénarimage | | ? | ? | à confirmer |
| 7.22 | Modélisation de la valeur | ? | ? | | à confirmer |
| 7.23 | Cartographie de la chaîne de valeur | ? | ? | | à confirmer |
| 7.24 | Élaboration de la vision | ? | ? | | à confirmer |

## Questions pour la relecture

1. Les chapitres sont-ils bien le ch. 4 pour les principes, le ch. 5 pour les
   horizons et le ch. 7 pour les techniques ? La liste des 24 techniques
   (Lightweight Documentation comprise ou non) et leur numérotation
   correspondent-elles à votre exemplaire ? Les noms anglais sont-ils
   orthographiés comme dans l'ouvrage (« Behaviour », « Modelling ») ?
2. D3 met le terme anglais en info-bulle. Le BABOK livré a toutefois un
   précédent, « Récits utilisateurs (User Stories) ». Garde-t-on de même un
   sigle anglais dans le nom français (BDD, MVP) ?
3. « Revues » (7.16) porte le même nom que la technique BABOK 10.37 : le
   préfixe EA suffit-il, ou faut-il un nom plus précis ?
4. « Backlog » : avec ou sans majuscule, par cohérence avec « Gestion du
   Backlog » (BABOK 10.2) ?
5. Les noms d'horizon commencent-ils par une minuscule dans les listes et les
   pastilles (« horizon Stratégie ») ?
6. L'identifiant stable proposé (`ae-` suivi du numéro de section) vous
   convient-il ?
