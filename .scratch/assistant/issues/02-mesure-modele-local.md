# Ce que vaut le modèle local sur des tâches types d'ACTA

Type: task
Status: claimed
Label: wayfinder:task

## Question

Que valent `qwen3.5:9b` sans carte graphique (sur le serveur, ou sur une machine équivalente) en temps de réponse et en qualité, sur des tâches représentatives des dix usages candidats ? Les tâches types :

- relire une page de taille moyenne et une page longue ;
- résumer l'état d'une initiative à partir de ses actions et tickets ;
- proposer une prochaine étape en tenant compte des actions suggérées ;
- proposer une technique BABOK ;
- contrôler la cohérence entre deux pages ;
- rédiger un brouillon de scénarios Gherkin ;
- critiquer une liste de parties prenantes.

Données : une initiative de **démonstration** (base locale), jamais de données de production.

Résultat attendu, pour chaque tâche :
- le temps de réponse ;
- la taille de contexte utilisée ;
- une appréciation de la qualité (exacte, utile, ou fausse et dangereuse) ;
- un verdict faisable / limite / infaisable sur le matériel actuel.

## Avancement

- **25.11.2026, en attente** : le port SSH du serveur (51837) ne répond plus depuis le poste de la responsable, alors que https://acta.socle-eagtasq.fr répond. Le poste lui-même ne remplace pas le serveur (12 fils et 16 Go, contre 16 cœurs et 31 Go). La responsable rétablit l'accès (pare-feu ou fail2ban depuis la console OVH, ou autre réseau). Les mesures se feront ensuite sur le serveur, sans elle.
- **Avant toute commande Docker locale** (extraction de l'initiative de démonstration avec `scripts/sql.sh`), repasser sur le contexte `desktop-linux` : le contexte `vps` était encore actif le 25.11.2026.
