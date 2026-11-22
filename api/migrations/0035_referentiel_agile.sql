-- Référentiel de l'Extension Agile au Guide BABOK v2 (Extension Agile, ticket 02 ;
-- spécification D1, D2) : 7 principes agiles (ch. 4), 3 horizons (ch. 5),
-- 24 techniques agiles (ch. 7) et les horizons où chaque technique s'applique,
-- seulement quand l'ouvrage l'énonce. Pas de correspondance avec les tâches du
-- BABOK (D2).
--
-- Mêmes règles que le référentiel BABOK (migration 0009, ADR-0012) : identique
-- pour toutes les initiatives, en lecture seule pour tous, administrateur
-- compris ; seule une migration le modifie. Chaque élément porte un identifiant
-- stable, « ae- » suivi de son numéro de section (fixé ici, il ne change plus,
-- même si un numéro de section était corrigé), son renvoi de section, son nom
-- en anglais et en français et un résumé rédigé pour ACTA dans les deux langues.
-- Aucun texte de l'IIBA n'est reproduit.
--
-- Contenu repris tel quel du fichier de relecture validé par la responsable
-- fonctionnelle le 22.11.2026 (.scratch/extension-agile/referentiel-agile.md).

CREATE TABLE agile_principle (
  id         text PRIMARY KEY,
  section    text NOT NULL,              -- renvoi de section de l'Extension Agile v2
  position   smallint NOT NULL UNIQUE,   -- ordre de l'ouvrage
  name_en    text NOT NULL,
  name_fr    text NOT NULL,
  summary_en text NOT NULL,
  summary_fr text NOT NULL
);

CREATE TABLE agile_horizon (
  id         text PRIMARY KEY,
  section    text NOT NULL,
  position   smallint NOT NULL UNIQUE,
  name_en    text NOT NULL,
  name_fr    text NOT NULL,
  summary_en text NOT NULL,
  summary_fr text NOT NULL
);

CREATE TABLE agile_technique (
  id         text PRIMARY KEY,
  section    text NOT NULL,
  position   smallint NOT NULL UNIQUE,
  name_en    text NOT NULL,
  name_fr    text NOT NULL,
  summary_en text NOT NULL,
  summary_fr text NOT NULL
);

-- Horizons où l'ouvrage dit que chaque technique agile s'applique.
CREATE TABLE agile_technique_horizon (
  technique_id text NOT NULL REFERENCES agile_technique (id),
  horizon_id   text NOT NULL REFERENCES agile_horizon (id),
  PRIMARY KEY (technique_id, horizon_id)
);
CREATE INDEX agile_technique_horizon_horizon_id_idx ON agile_technique_horizon (horizon_id);

-- Row Level Security : lecture par tout utilisateur connecté ; aucune politique
-- d'écriture, donc aucune écriture possible avec le compte applicatif.
ALTER TABLE agile_principle ENABLE ROW LEVEL SECURITY;
ALTER TABLE agile_horizon ENABLE ROW LEVEL SECURITY;
ALTER TABLE agile_technique ENABLE ROW LEVEL SECURITY;
ALTER TABLE agile_technique_horizon ENABLE ROW LEVEL SECURITY;

CREATE POLICY agile_principle_select ON agile_principle FOR SELECT
  USING (current_app_user_id() IS NOT NULL);
CREATE POLICY agile_horizon_select ON agile_horizon FOR SELECT
  USING (current_app_user_id() IS NOT NULL);
CREATE POLICY agile_technique_select ON agile_technique FOR SELECT
  USING (current_app_user_id() IS NOT NULL);
CREATE POLICY agile_technique_horizon_select ON agile_technique_horizon FOR SELECT
  USING (current_app_user_id() IS NOT NULL);

-- Données ------------------------------------------------------------------------

INSERT INTO agile_principle (id, section, position, name_en, name_fr, summary_en, summary_fr) VALUES
  ('ae-4.1', '4.1', 1, 'See the Whole', 'Voir l''ensemble', 'Place each need in its wider context (organisation, customers, other ongoing changes) before focusing on any one part of the solution.', 'Situer chaque besoin dans son contexte (organisation, clients, autres changements en cours) avant de s''attacher à une partie de la solution.'),
  ('ae-4.2', '4.2', 2, 'Think as a Customer', 'Penser comme un client', 'Start from what customers and users experience and expect, and check with them regularly that the solution actually helps them.', 'Partir de ce que vivent et attendent les clients et les utilisateurs, et vérifier régulièrement auprès d''eux que la solution leur sert.'),
  ('ae-4.3', '4.3', 3, 'Analyze to Determine What is Valuable', 'Analyser pour déterminer ce qui a de la valeur', 'Keep assessing what brings the most value, so that those items come first and low-value ones are dropped.', 'Évaluer en continu ce qui apporte le plus de valeur, pour faire passer ces éléments en premier et renoncer à ceux qui en apportent peu.'),
  ('ae-4.4', '4.4', 4, 'Get Real Using Examples', 'Concrétiser à l''aide d''exemples', 'Pin down needs through concrete examples, which also serve to check that the solution behaves as intended.', 'Préciser les besoins par des exemples concrets, qui servent aussi à vérifier que la solution se comporte comme prévu.'),
  ('ae-4.5', '4.5', 5, 'Understand What is Doable', 'Comprendre ce qui est réalisable', 'Take technical, organisational and time constraints into account so as to propose what can really be delivered.', 'Tenir compte des contraintes techniques, organisationnelles et de délai pour proposer ce qui peut réellement être livré.'),
  ('ae-4.6', '4.6', 6, 'Stimulate Collaboration and Continuous Improvement', 'Stimuler la collaboration et l''amélioration continue', 'Get stakeholders and the team working together, and regularly adjust the way of working based on what is learned.', 'Faire travailler ensemble les parties prenantes et l''équipe, et ajuster régulièrement la manière de travailler d''après ce que l''on apprend.'),
  ('ae-4.7', '4.7', 7, 'Avoid Waste', 'Éviter le gaspillage', 'Produce only the analysis and documentation that are genuinely useful, at the time they are useful.', 'Ne produire que l''analyse et la documentation qui servent vraiment, au moment où elles servent.');

INSERT INTO agile_horizon (id, section, position, name_en, name_fr, summary_en, summary_fr) VALUES
  ('ae-5.1', '5.1', 1, 'Strategy Horizon', 'horizon Stratégie', 'Level of the organisation as a whole: direction, goals and choice of the initiatives to start or stop, over a long time frame.', 'Niveau de l''organisation dans son ensemble : orientations, objectifs et choix des initiatives à lancer ou à arrêter, sur un temps long.'),
  ('ae-5.2', '5.2', 2, 'Initiative Horizon', 'horizon Initiative', 'Level of one initiative: define what it must achieve, break down the work and follow its value from one delivery to the next.', 'Niveau d''une initiative : définir ce qu''elle doit accomplir, découper le travail et en suivre la valeur d''une livraison à l''autre.'),
  ('ae-5.3', '5.3', 3, 'Delivery Horizon', 'horizon Livraison', 'Level of the delivery team: detail the items to build in the next short cycles and check what has been delivered.', 'Niveau de l''équipe de livraison : préciser les éléments à réaliser dans les prochains cycles courts et vérifier ce qui a été livré.');

INSERT INTO agile_technique (id, section, position, name_en, name_fr, summary_en, summary_fr) VALUES
  ('ae-7.1', '7.1', 1, 'Backlog Refinement', 'Affinage du backlog', 'Regularly go over the backlog with the team: clarify, split, estimate and reorder the items for the next cycles.', 'Revoir régulièrement le backlog avec l''équipe : préciser, découper, estimer et réordonner les éléments des prochains cycles.'),
  ('ae-7.2', '7.2', 2, 'Behaviour Driven Development', 'Développement piloté par le comportement (BDD)', 'Describe expected behaviour through structured examples (context, event, outcome) that become acceptance tests.', 'Décrire le comportement attendu par des exemples structurés (contexte, événement, résultat), qui deviennent des tests d''acceptation.'),
  ('ae-7.3', '7.3', 3, 'Blitz Planning', 'Planification éclair', 'Quickly build a first delivery plan as a group by laying out the items to build and their dependencies on a timeline.', 'Établir rapidement en groupe un premier plan de livraison, en disposant sur une ligne de temps les éléments à réaliser et leurs dépendances.'),
  ('ae-7.4', '7.4', 4, 'Impact Mapping', 'Cartographie des impacts', 'Link a goal to the actors who can influence it, the behaviour changes expected from them, and the deliverables that encourage those changes.', 'Relier un objectif aux acteurs qui peuvent l''influencer, aux changements de comportement attendus d''eux et aux livrables qui les favorisent.'),
  ('ae-7.5', '7.5', 5, 'Job Stories', 'Récits de situation', 'Express a need from a situation and the person''s motivation, rather than from their role.', 'Exprimer un besoin à partir d''une situation et de la motivation de la personne, plutôt qu''à partir de son rôle.'),
  ('ae-7.6', '7.6', 6, 'Kano Analysis', 'Analyse de Kano', 'Classify product features by how their presence or absence affects customer satisfaction.', 'Classer les caractéristiques d''un produit selon l''effet de leur présence ou de leur absence sur la satisfaction des clients.'),
  ('ae-7.7', '7.7', 7, 'Minimum Viable Product', 'Produit minimum viable (MVP)', 'Deliver the smallest version of a product that allows a hypothesis to be tested with real users.', 'Livrer la plus petite version d''un produit qui permet de vérifier une hypothèse auprès de vrais utilisateurs.'),
  ('ae-7.8', '7.8', 8, 'Personas', 'Personas', 'Portray typical users, with their goals and habits, to keep real users in mind during analysis.', 'Décrire des utilisateurs types, avec leurs objectifs et leurs habitudes, pour garder les vrais utilisateurs à l''esprit pendant l''analyse.'),
  ('ae-7.9', '7.9', 9, 'Planning Workshop', 'Atelier de planification', 'Bring the team and stakeholders together to agree on the goals and content of the next cycle or release.', 'Réunir l''équipe et les parties prenantes pour convenir ensemble des objectifs et du contenu du prochain cycle ou de la prochaine livraison.'),
  ('ae-7.10', '7.10', 10, 'Portfolio Kanban', 'Kanban de portefeuille', 'Show on a board the flow of the organisation''s initiatives, from idea to completion, while limiting how many run at the same time.', 'Visualiser sur un tableau le flux des initiatives de l''organisation, de l''idée à la réalisation, en limitant le nombre d''initiatives menées en même temps.'),
  ('ae-7.11', '7.11', 11, 'Product Roadmap', 'Feuille de route produit', 'Present the planned major steps of a product over time, linked to the goals they serve, and keep it up to date.', 'Présenter les grandes étapes prévues d''un produit dans le temps, reliées aux objectifs qu''elles servent, et la tenir à jour.'),
  ('ae-7.12', '7.12', 12, 'Purpose Alignment Model', 'Modèle d''alignement sur la finalité', 'Sort activities by whether they set the organisation apart in its market and whether they are critical to its operation, to decide where to invest.', 'Classer les activités selon qu''elles distinguent l''organisation sur son marché et qu''elles sont indispensables à son fonctionnement, pour décider où investir.'),
  ('ae-7.13', '7.13', 13, 'Real Options', 'Options réelles', 'Delay a decision until the last responsible moment, keeping options open and knowing when each one expires.', 'Retarder une décision jusqu''au dernier moment raisonnable, en gardant ouvertes les options et en connaissant leur date d''échéance.'),
  ('ae-7.14', '7.14', 14, 'Relative Estimation', 'Estimation relative', 'Estimate the size of items by comparing them with one another rather than in absolute time, for example in points.', 'Estimer la taille des éléments en les comparant entre eux plutôt qu''en durée absolue, par exemple en points.'),
  ('ae-7.15', '7.15', 15, 'Retrospectives', 'Rétrospectives', 'At the end of a cycle, look at the team''s way of working and choose a few improvements to try in the next one.', 'À la fin d''un cycle, examiner en équipe la façon de travailler et choisir quelques améliorations à essayer au cycle suivant.'),
  ('ae-7.16', '7.16', 16, 'Reviews', 'Revues', 'Show what has been built to stakeholders at the end of a cycle, gather their reactions and take them into account for what follows.', 'Montrer ce qui a été réalisé aux parties prenantes à la fin d''un cycle, recueillir leurs réactions et en tenir compte pour la suite.'),
  ('ae-7.17', '7.17', 17, 'Spikes', 'Spikes', 'Spend a short, time-boxed piece of work on removing a technical or functional uncertainty before estimating or building.', 'Consacrer un court travail limité dans le temps à lever une incertitude technique ou fonctionnelle avant d''estimer ou de réaliser.'),
  ('ae-7.18', '7.18', 18, 'Story Decomposition', 'Décomposition des récits', 'Split a large need into smaller stories, each bringing value and deliverable within one cycle.', 'Découper un besoin large en récits plus petits, chacun apportant de la valeur et pouvant être livré au cours d''un cycle.'),
  ('ae-7.19', '7.19', 19, 'Story Elaboration', 'Élaboration des récits', 'Complete a story just before it is built: details, examples and acceptance criteria agreed with the team.', 'Compléter un récit juste avant sa réalisation : détails, exemples et critères d''acceptation convenus avec l''équipe.'),
  ('ae-7.20', '7.20', 20, 'Story Mapping', 'Cartographie des récits', 'Lay out stories along the user''s journey and by priority, to see the whole product and choose what goes into each release.', 'Disposer les récits selon le parcours de l''utilisateur et par ordre de priorité, pour voir l''ensemble du produit et choisir le contenu des livraisons.'),
  ('ae-7.21', '7.21', 21, 'Storyboarding', 'Scénarimage', 'Show in a series of pictures what the user goes through step by step, to discuss a solution before building it.', 'Représenter en une suite d''images ce que vit l''utilisateur pas à pas, pour discuter d''une solution avant de la réaliser.'),
  ('ae-7.22', '7.22', 22, 'Value Modelling', 'Modélisation de la valeur', 'Represent how value is created and for whom, so as to steer choices towards what contributes most.', 'Représenter comment la valeur est créée et pour qui, afin d''orienter les choix vers ce qui y contribue le plus.'),
  ('ae-7.23', '7.23', 23, 'Value Stream Mapping', 'Cartographie de la chaîne de valeur', 'Map every step from a request to its delivery, including waiting times, to find and reduce waste.', 'Représenter toutes les étapes qui mènent d''une demande à sa livraison, avec les temps d''attente, pour repérer et réduire les gaspillages.'),
  ('ae-7.24', '7.24', 24, 'Visioning', 'Élaboration de la vision', 'Build with stakeholders a common vision of the intended goal, which then guides decisions.', 'Construire avec les parties prenantes une vision commune et partagée du but visé, qui sert ensuite de repère aux décisions.');

INSERT INTO agile_technique_horizon (technique_id, horizon_id) VALUES
  ('ae-7.1', 'ae-5.2'),
  ('ae-7.1', 'ae-5.3'),
  ('ae-7.2', 'ae-5.3'),
  ('ae-7.3', 'ae-5.2'),
  ('ae-7.3', 'ae-5.3'),
  ('ae-7.4', 'ae-5.1'),
  ('ae-7.4', 'ae-5.2'),
  ('ae-7.5', 'ae-5.2'),
  ('ae-7.5', 'ae-5.3'),
  ('ae-7.6', 'ae-5.2'),
  ('ae-7.6', 'ae-5.3'),
  ('ae-7.7', 'ae-5.1'),
  ('ae-7.7', 'ae-5.2'),
  ('ae-7.8', 'ae-5.1'),
  ('ae-7.8', 'ae-5.2'),
  ('ae-7.8', 'ae-5.3'),
  ('ae-7.9', 'ae-5.2'),
  ('ae-7.9', 'ae-5.3'),
  ('ae-7.10', 'ae-5.1'),
  ('ae-7.11', 'ae-5.1'),
  ('ae-7.11', 'ae-5.2'),
  ('ae-7.12', 'ae-5.1'),
  ('ae-7.12', 'ae-5.2'),
  ('ae-7.13', 'ae-5.1'),
  ('ae-7.13', 'ae-5.2'),
  ('ae-7.13', 'ae-5.3'),
  ('ae-7.14', 'ae-5.2'),
  ('ae-7.14', 'ae-5.3'),
  ('ae-7.15', 'ae-5.1'),
  ('ae-7.15', 'ae-5.2'),
  ('ae-7.15', 'ae-5.3'),
  ('ae-7.16', 'ae-5.2'),
  ('ae-7.16', 'ae-5.3'),
  ('ae-7.17', 'ae-5.2'),
  ('ae-7.17', 'ae-5.3'),
  ('ae-7.18', 'ae-5.2'),
  ('ae-7.18', 'ae-5.3'),
  ('ae-7.19', 'ae-5.3'),
  ('ae-7.20', 'ae-5.2'),
  ('ae-7.20', 'ae-5.3'),
  ('ae-7.21', 'ae-5.2'),
  ('ae-7.21', 'ae-5.3'),
  ('ae-7.22', 'ae-5.1'),
  ('ae-7.22', 'ae-5.2'),
  ('ae-7.23', 'ae-5.1'),
  ('ae-7.23', 'ae-5.2'),
  ('ae-7.24', 'ae-5.1'),
  ('ae-7.24', 'ae-5.2');
