# Ce que vaut le modèle local sur des tâches types d'ACTA

Type: task
Status: resolved
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
- **25.11.2026, accès rétabli** : l'accès SSH répondait de nouveau. Cause des coupures : le pare-feu du serveur (`ufw`) applique la règle LIMIT au port 51837 et bloque un moment toute adresse qui ouvre plus de 6 connexions en 30 secondes. Une connexion silencieuse pendant plus de dix minutes est aussi coupée en route. Les mesures longues ont donc été lancées sur le serveur, détachées de SSH, avec une seule connexion pour l'envoi.
- **26.11.2026** : depuis le poste, le port HTTPS du serveur ne répond pas, alors qu'ACTA répond normalement depuis le serveur lui-même (code 200). C'est un problème de réseau entre le poste et le serveur, à surveiller, hors de ce ticket.

## Réponse

Mesures du 25 et du 26.11.2026, sur le serveur de production, en dehors des heures de travail, une demande à la fois. Le modèle est `qwen3.5:9b` servi par Ollama 0.40.18, sans carte graphique (Xeon D-2141I, 16 fils), avec un contexte réglé à 65 536 tokens. Les données, le corrigé, les scripts et les réponses complètes se trouvent dans [`.scratch/assistant/mesures/`](../mesures/).

**Données.** La base locale ne contient que des essais (la page la plus longue fait 2 700 caractères). Les mesures portent donc sur une initiative **fictive** de démonstration, « Dématérialisation des notes de frais », écrite pour l'occasion. Elle comprend des parties prenantes, des besoins, des exigences, des tickets, des actions suggérées et trois pages, dont une de 1 000 mots et une de 3 500 mots. Des défauts y ont été placés volontairement, et leur liste (`donnees/corrige.md`) sert à juger les réponses. Aucune donnée de production n'a été utilisée.

**Conditions.** Ollama a été appelé directement, avec un message système d'assistant en lecture seule, sans le prompt de Hermes : celui-ci ajoutera du contexte à lire, donc un peu de temps. Le mode « réflexion » était coupé, sauf pour un essai.

| Tâche | Durée | Contexte (tokens) | Qualité, d'après le corrigé | Verdict |
|---|---|---|---|---|
| Faire le point | 2 min 37 s | 1 991 | Exacte et utile. Elle ne signale pas que deux actions et une question ont dépassé leur échéance. | **Faisable** |
| Prochaines étapes | 2 min 11 s | 2 000 | Utile. Elle reprend bien les actions suggérées, mais oublie l'atelier en retard et invente deux noms de techniques, faute de référentiel fourni. | **Faisable** (avec le référentiel BABOK dans le contexte) |
| Préparer un atelier | 5 min 17 s | 2 000 | Utile et bien structurée. Une erreur de fait (une source dite absente) ; elle ne voit pas que l'atelier est en retard. | **Faisable** |
| Critiquer les parties prenantes | 7 min 19 s | 3 278 | La meilleure réponse : elle trouve les collaborateurs du terrain, la fiduciaire et l'influence sous-évaluée des ressources humaines et des responsables d'équipe. Elle oublie l'informatique et le fournisseur du logiciel comptable. | **Faisable** |
| Gherkin (3 exigences) | 6 min 33 s | 2 049 | Brouillon utilisable, mots-clés français. Plusieurs erreurs : la DAF confondue avec la BA, une note refusée qui « reste Soumise », des lignes sans mot-clé, le seuil de 500 CHF exactement non testé. | **Limite** : brouillon à relire de près |
| Technique BABOK | 4 min 11 s | 4 176 | Techniques bien tirées du référentiel, mais elle n'en propose pas la plus évidente (10.33 Priorisation) et ses alternatives sont faibles (Glossaire, Mind Mapping). | **Limite** |
| Relire une page longue (3 500 mots) | 10 min 12 s | 4 553 | 5 défauts sur 9 trouvés, dont les deux contradictions chiffrées. Elle manque l'exigence non vérifiable (« intuitive »), l'exigence qui en regroupe trois et une référence erronée. Un peu de bruit. | **Limite** |
| Relire une page moyenne (1 000 mots) | 7 min 31 s | 3 288 | 1 défaut sur 6 à peine (le sigle non défini, en partie). Elle affirme qu'il n'y a « pas de contradiction » sur les volumes (800 par mois contre 20 000 par an) et fait une erreur de calcul. Beaucoup de remarques sans intérêt. | **Infaisable** sans réflexion |
| Cohérence entre deux pages | 7 min 05 s | 3 230 | 3 contradictions sur 5. Elle propose de corriger la vision, pourtant validée par la sponsor, en affirmant à tort qu'elle a été « révisée tardivement ». | **Limite** sans réflexion |
| Cohérence entre deux pages, **avec réflexion** | 23 min 24 s | 3 228 | 5 contradictions sur 5, bien citées, avec la bonne orientation (aligner la spécification sur la vision ou faire confirmer par la sponsor). | **Faisable**, mais 3,3 fois plus long |

**Constats généraux.**
1. **La vitesse d'écriture fixe la durée.** Le modèle lit environ 40 tokens par seconde mais n'en écrit que 5. Le temps dépend surtout de la longueur de la réponse, bien plus que de la taille du contexte. Demander des réponses courtes est le levier le plus efficace.
2. **Le contexte n'est pas une limite pour ces usages.** Il faut 4 600 tokens au plus pour une page longue avec toute l'initiative, loin des 65 536 disponibles.
3. **Les durées vont de 2 à 10 minutes sans réflexion, et de 20 à 25 minutes avec.** Avec une demande à la fois, cela donne de 6 à 25 demandes par heure sans réflexion, et 2 ou 3 avec.
4. **La qualité est la vraie limite, pas le temps.** Le modèle repère bien les contradictions chiffrées et les manques visibles. Il rate les défauts de rédaction (exigence vague ou composée), les dates dépassées et les calculs. Il commet des erreurs de fait qui ont l'air sûres (noms, états). La réflexion corrige une bonne part de ces erreurs, mais elle triple le temps.
5. **Les échéances dépassées ne sont jamais vues.** Le modèle ne déduit pas qu'une échéance au 10.10 est dépassée au 25.11, même quand la date du jour est donnée. ACTA devra calculer ces retards elle-même et les fournir tout faits.
6. **Charge du serveur.** Pendant une demande, Ollama occupe tout le processeur. Hermes-webui et l'assistant d'ACTA se partagent le même modèle : une mesure a attendu environ 4 minutes qu'un autre appel se termine.

**Ce que ce ticket ne tranche pas** (ticket « Choix du premier lot ») :
- le premier lot ;
- l'usage ou non du mode « réflexion » ;
- la valeur initiale du délai maximal ;
- l'ouverture de la question du renforcement du serveur.

Une seule relecture a été mesurée avec réflexion. Les autres tâches « limite » pourraient en profiter, ce qui reste à mesurer si le choix du premier lot le demande.
