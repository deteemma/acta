# Carte : l'assistant d'ACTA (aide à la décision du BA)

Label: wayfinder:map

## Destination

Un cadrage décisionnel de l'**assistant** d'ACTA, qui fonctionne avec Hermes Agent et le modèle local en coulisses. Il comprend les usages classés par priorité, un ADR proposé pour l'architecture d'intégration, et une `spec.md` du premier lot prête à découper en tickets.

## Notes

- **Domaine** : aide à la décision du BA dans ACTA, selon le cadre BABOK v3. Termes : **Assistant**, **Demande à l'assistant**, **Avis de l'assistant** (`CONTEXT.md`, section « Aide à la décision »).
- **Skills à consulter** : `grilling` et `domain-modeling` pour chaque ticket d'échange ; `research` pour les recherches ; `prototype` pour les maquettes.
- **Cadre fixé au démarrage (25.11.2026)** :
  - lecture seule : l'assistant conseille et ne modifie jamais ACTA ;
  - il répond seulement à la demande ;
  - fonctionnement **asynchrone** : la question est posée, la réponse arrive quand elle est prête ;
  - une initiative à la fois, dans le web d'ACTA ;
  - il ne voit jamais plus que ce que voit l'utilisateur (ADR 0006) ;
  - conversations privées à leur auteur, conservées pour lui, effaçables par lui ;
  - réponses dans la langue d'ACTA de l'utilisateur ;
  - il **complète** les règles fixes R1 à R15 sans les remplacer.
- **Hermes reste invisible pour le BA** : l'interface dit « Assistant » ; hermes-webui sert seulement à l'administration et aux essais.
- **Modèle local obligatoire.** Un renforcement du serveur (carte graphique, modèle plus gros) reste une décision possible si un usage le justifie.
- **Serveur constaté le 25.11.2026** :
  - conteneurs `hermes-agent` (`nousresearch/hermes-agent:latest`), `hermes-webui` et `ollama` ;
  - modèle `qwen3.5:9b`, sans carte graphique (16 cœurs, 31 Go de mémoire) ;
  - Hermes est sur le réseau `hermes-webui_hermes-net`, ACTA sur le réseau `socle` : ils ne se voient pas ;
  - API Hermes active avec `API_SERVER_KEY` vide.
- **Règles de CLAUDE.md** : ne jamais inventer de règle de gestion ; les ADR 0001 à 0011 ne se modifient pas, on propose un nouvel ADR.

## Décisions prises

<!-- une ligne par ticket résolu : [titre](lien) : résumé -->

- [Capacités d'intégration de Hermes Agent](issues/01-capacites-integration-hermes.md) : différé possible en interrogeant Hermes (pas de rappel, résultat gardé une heure), donc la file est côté ACTA ; pas de jeton par utilisateur ; aucun isolement entre utilisateurs (mémoire, historique et skills à couper) ; outils dangereux actifs par défaut ; réseau commun à créer ; contexte Ollama à porter à 64 000 tokens.
- [Valeur pour le BA des dix usages candidats](issues/03-valeur-des-usages.md) : usages 2 et 9 fusionnés en « faire le point », posé à la demande ; prioritaires : relire une page, prochaines étapes, préparer un atelier ; secondaires : traçabilité et cohérence, Gherkin, faire le point ; différables : technique BABOK, parties prenantes, question libre (risque fort).
- [Cycle de vie d'une demande à l'assistant](issues/04-cycle-de-vie-demande.md) : demande isolée ouverte à tout membre, lecteur compris ; cinq statuts (En attente, En cours, Répondue, Échouée, Annulée) ; signal « Avis non lu » distinct de l'Alerte ; une demande non terminée par personne ; avis daté, jamais recalculé ; délai maximal paramétrable, pas de nouvelle tentative automatique ; masquage si l'auteur perd l'accès ; effacement définitif ; invisible pour l'administrateur.

## Zones floues

- **Données fournies à l'assistant pour chaque usage du premier lot** : quelles pages, quels tickets, quelles exigences, quelle part du référentiel BABOK. Cela dépend de l'architecture de lecture et du premier lot. On y décidera aussi ce qui compte comme un élément lu modifié depuis l'avis.
- **Aspect du panneau dans ACTA** : où l'on pose la question, où arrive la réponse, comment distinguer un avis d'une suggestion. Une maquette viendra après le choix du premier lot.
- **Spécification du premier lot** (`spec.md`) : se rédige une fois les tickets 05 et 06 résolus (le 04 l'est).
- **Renforcement du serveur** : à examiner seulement si les mesures du modèle local le justifient.
- **Plus tard, hors premier lot** : l'assistant qui agit de lui-même (point périodique, relecture lancée à l'enregistrement), la version mobile, la messagerie, les questions qui portent sur plusieurs initiatives.

## Hors périmètre

- **Modification d'ACTA par l'assistant** (créer un ticket, une action, un commentaire) : fera l'objet d'une exploration distincte, après celle-ci (décision de la responsable du 25.11.2026).
- **Accès des BA à hermes-webui** : écarté, car il contournerait les permissions d'ACTA.
