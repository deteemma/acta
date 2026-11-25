# Capacités d'intégration de Hermes Agent

Type: research
Status: resolved
Label: wayfinder:research

## Question

Avec la version installée sur le serveur (`nousresearch/hermes-agent:latest`), comment ACTA peut-elle faire travailler Hermes Agent ? Établir les faits suivants, à partir de la documentation officielle et du dépôt de Nous Research :

1. **API serveur** : quels points d'entrée (compatibilité OpenAI, sessions, tâches) ? Une demande peut-elle se traiter en **différé** (soumettre, puis récupérer ou être rappelé quand la réponse est prête) ? Sinon, que faut-il ajouter côté ACTA (file d'attente) ?
2. **Accès aux données** : comment fournir à Hermes des données d'ACTA ? Client MCP, outils personnalisés, skills, ou contexte passé dans la demande. Un jeton propre à l'utilisateur peut-il être transmis à chaque demande, pour que les appels vers ACTA respectent ses droits ?
3. **Isolement entre utilisateurs** : mémoire persistante, sessions, skills auto-générés. Une information lue pour un utilisateur peut-elle ressortir chez un autre ? Peut-on désactiver la mémoire ou la cloisonner ?
4. **Sécurité** : authentification de l'API (`API_SERVER_KEY`), outils dangereux activés par défaut (terminal, navigateur, écriture de fichiers) et moyen de les couper.
5. **Réseau** : ce qu'il faut pour que l'API d'ACTA (réseau `socle`) et Hermes (réseau `hermes-webui_hermes-net`) communiquent.
6. **Modèle** : configuration d'Ollama comme fournisseur, et limites connues avec un petit modèle (appels d'outils, longueur de contexte).

## Réponse

Recherche du 25.11.2026 sur Hermes Agent v0.23.4 (commit `8fc0374`). La note complète se trouve sur la branche jetable `research/capacites-hermes`, fichier `.scratch/assistant/research/01-capacites-integration-hermes.md`. La version qui tourne sur le serveur reste à vérifier.

1. **Différé : possible, mais ACTA doit interroger Hermes.** On soumet la demande (`POST /v1/runs`), puis on récupère le résultat (`GET /v1/runs/{id}`). Hermes ne rappelle pas ACTA, ne garde le résultat qu'une heure et accepte au plus 10 travaux en même temps. ACTA doit donc tenir sa propre file des demandes.
2. **Jeton par utilisateur : impossible tel quel.** Les en-têtes MCP sont fixés à la connexion. Il reste deux pistes : ACTA assemble le contexte déjà filtré, ou un plugin Hermes associe chaque session à un utilisateur.
3. **Aucun isolement entre utilisateurs.** Hermes est conçu pour un seul utilisateur : mémoire, recherche dans l'historique et skills générés sont communs à toutes les demandes. On peut les désactiver dans `config.yaml`. Seul un conteneur séparé isole vraiment.
4. **Outils dangereux actifs par défaut sur l'API** : terminal, fichiers, exécution de code, navigateur, délégation, cron… On les coupe par `agent.disabled_toolsets` ou en listant les outils autorisés dans `platform_toolsets.api_server`.
5. **Clé d'API** : il en faut une d'au moins 16 caractères, sinon l'API ne démarre pas. La variable est vide dans l'environnement du conteneur : il faut vérifier si elle est ailleurs ou si l'API est arrêtée.
6. **Réseau** : ACTA et Hermes doivent partager un réseau Docker. Mettre Hermes sur `socle` lui ouvrirait aussi l'accès à la base et à Keycloak (ADR 0007).
7. **Modèle** : Hermes exige 64 000 tokens de contexte, alors qu'Ollama en donne 4 096 par défaut. Il faut régler `OLLAMA_CONTEXT_LENGTH`. Sans carte graphique, une réponse peut prendre plusieurs minutes.
