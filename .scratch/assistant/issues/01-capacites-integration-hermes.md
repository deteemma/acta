# Capacités d'intégration de Hermes Agent

Type: research
Status: claimed
Label: wayfinder:research

## Question

Avec la version installée sur le serveur (`nousresearch/hermes-agent:latest`), comment ACTA peut-elle faire travailler Hermes Agent ? Établir les faits suivants, à partir de la documentation officielle et du dépôt de Nous Research :

1. **API serveur** : quels points d'entrée (compatibilité OpenAI, sessions, tâches) ? Une demande peut-elle se traiter en **différé** (soumettre, puis récupérer ou être rappelé quand la réponse est prête) ? Sinon, que faut-il ajouter côté ACTA (file d'attente) ?
2. **Accès aux données** : comment fournir à Hermes des données d'ACTA ? Client MCP, outils personnalisés, skills, ou contexte passé dans la demande. Un jeton propre à l'utilisateur peut-il être transmis à chaque demande, pour que les appels vers ACTA respectent ses droits ?
3. **Isolement entre utilisateurs** : mémoire persistante, sessions, skills auto-générés. Une information lue pour un utilisateur peut-elle ressortir chez un autre ? Peut-on désactiver la mémoire ou la cloisonner ?
4. **Sécurité** : authentification de l'API (`API_SERVER_KEY`), outils dangereux activés par défaut (terminal, navigateur, écriture de fichiers) et moyen de les couper.
5. **Réseau** : ce qu'il faut pour que l'API d'ACTA (réseau `socle`) et Hermes (réseau `hermes-webui_hermes-net`) communiquent.
6. **Modèle** : configuration d'Ollama comme fournisseur, et limites connues avec un petit modèle (appels d'outils, longueur de contexte).
