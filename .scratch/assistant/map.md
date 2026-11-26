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
- [Ce que vaut le modèle local sur des tâches types d'ACTA](issues/02-mesure-modele-local.md) : de 2 à 10 min par demande sans réflexion, de 20 à 25 min avec ; contexte de 4 600 tokens au plus, sans difficulté ; la qualité est la vraie limite. Faisables : faire le point, prochaines étapes, préparer un atelier, parties prenantes. Limites : Gherkin, technique BABOK, relire une page longue, cohérence sans réflexion. Infaisable sans réflexion : relire une page moyenne. La réflexion fait passer la cohérence de 3 à 5 contradictions trouvées sur 5. Les retards d'échéance sont à calculer par ACTA.
- [Choix du premier lot](issues/06-choix-premier-lot.md) : 7 usages (relire une page en « relecture de cohérence », prochaines étapes, préparer un atelier, traçabilité et cohérence, Gherkin, faire le point, question libre sans données) ; mode de réponse rapide ou approfondie au choix du BA, avec avertissement ; délais maximaux de 20 et 60 minutes ; technique BABOK et parties prenantes reportées ; renforcement du serveur non ouvert.
- [Valeur pour le BA des dix usages candidats](issues/03-valeur-des-usages.md) : usages 2 et 9 fusionnés en « faire le point », posé à la demande ; prioritaires : relire une page, prochaines étapes, préparer un atelier ; secondaires : traçabilité et cohérence, Gherkin, faire le point ; différables : technique BABOK, parties prenantes, question libre (risque fort).
- [Cycle de vie d'une demande à l'assistant](issues/04-cycle-de-vie-demande.md) : demande isolée ouverte à tout membre, lecteur compris ; cinq statuts (En attente, En cours, Répondue, Échouée, Annulée) ; signal « Avis non lu » distinct de l'Alerte ; une demande non terminée par personne ; avis daté, jamais recalculé ; délai maximal paramétrable, pas de nouvelle tentative automatique ; masquage si l'auteur perd l'accès ; effacement définitif ; invisible pour l'administrateur.
- [Comment l'assistant lit une initiative avec les droits de l'utilisateur](issues/05-lecture-avec-les-droits.md) : ADR 0022 accepté. ACTA assemble le contexte avec les droits de l'auteur, revérifiés au départ et à l'arrivée ; file et parallélisme réglable dans ACTA ; instance Hermes réservée (profil `assistant`), sans autre outil que nos skills, sans mémoire, sans Internet ni accès au réseau `socle` ; assistant facultatif.
- [Données transmises à l'assistant pour chaque usage du premier lot](issues/07-donnees-par-usage.md) : les « Données lues » comprennent une partie commune (fiche, parties prenantes, besoins, exigences, tickets, actions suggérées, liste des pages) et l'élément choisi par le BA (une ou deux pages, une action, de 1 à 3 exigences). ACTA fournit les faits calculés (retards, date du jour). Commentaires, historiques et pièces jointes ne sont jamais transmis. Le signal de changement porte sur tout élément transmis. Plafond de 16 000 tokens, sans troncature. Un encadré « Transmis / Non transmis » précède l'envoi. Trois raisons d'échec s'ajoutent.
- [Maquette du panneau de l'assistant](issues/08-maquette-du-panneau.md) : la demande se pose depuis l'élément (bouton « Demander à l'assistant », fenêtre de dialogue) et l'avis se range dans l'onglet « Assistant » de cet élément. Un fil de l'assistant par initiative, aligné à gauche, sert d'historique et accueille les usages sans élément. Le compteur global des avis non lus est distinct des alertes et ouvre un menu regroupé par initiative. L'avis a une bordure en pointillés et une phrase de nature. Tous les textes sont fixés, et le signal de changement nomme les éléments modifiés.
- [Spécification du premier lot de l'assistant](issues/09-specification-premier-lot.md) : [`spec.md`](spec.md) validée le 27.11.2026. Les instructions sont écrites dans ACTA, en français et en anglais, et Hermes n'a ni skill ni outil. Elle fixe les bornes des quatre paramètres dans un onglet « Assistant » de l'administration, une estimation à 3 caractères par token et des chiffres globaux jamais ventilés par personne ni par initiative. Cinq vérifications sur Hermes ouvrent la construction.

**Destination atteinte le 27.11.2026** : usages classés, ADR 0022 accepté, `spec.md` validée et prête à découper.

## Zones floues

- **Plus tard, hors premier lot** :
  - l'assistant qui agit de lui-même (point périodique, relecture lancée à l'enregistrement) ;
  - la version mobile, la messagerie, les questions qui portent sur plusieurs initiatives ;
  - les usages reportés (technique BABOK, parties prenantes) et les données jointes à une question libre ;
  - le renforcement du serveur, à examiner sur les retours d'usage du premier lot.

## Hors périmètre

- **Modification d'ACTA par l'assistant** (créer un ticket, une action, un commentaire) : fera l'objet d'une exploration distincte, après celle-ci (décision de la responsable du 25.11.2026).
- **Accès des BA à hermes-webui** : écarté, car il contournerait les permissions d'ACTA.
