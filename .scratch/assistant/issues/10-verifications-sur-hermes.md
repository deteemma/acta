# 10: Vérifications sur Hermes

**What to build:** Les cinq points de vigilance de la spécification sont vérifiés sur une instance Hermes configurée comme celle d'ACTA, avant toute construction. Les résultats sont consignés ici et rapportés à la responsable fonctionnelle ; un résultat contraire n'est pas contourné.

**Status:** resolved

Règles : [spécification](../spec.md), « Points de vigilance » 1 à 5 ; AS13, AS26, AS36 ; [ADR-0022](../../../docs/adr/0022-assistant-lit-par-contexte-assemble.md), « À surveiller ».

- [x] Réflexion par demande : Hermes active ou coupe la réflexion du modèle demande par demande (AS13). Sinon, s'arrêter et rapporter.
- [x] Instructions de Hermes : les instructions envoyées s'ajoutent au prompt système de Hermes ; taille de ce prompt sans aucun outil, durée d'une demande type passée par Hermes, comparée aux mesures directes du [ticket 02](02-mesure-modele-local.md).
- [x] Version de Hermes déployée (la recherche porte sur la v0.23.4) ; liste vide d'outils autorisés pour la plateforme API ; mémoire, recherche dans l'historique, écriture de skills et révision automatique coupées (AS36).
- [x] Journaux de Hermes : ils ne gardent pas le texte des demandes ; sinon, proposer une rotation courte.
- [x] Un travail lancé par `POST /v1/runs` avec un identifiant de session se supprime par `DELETE /api/sessions/{id}`.
- [x] Résultats consignés sous `## Commentaires`, avec les commandes passées ; aucune donnée réelle d'une initiative utilisée pour les essais.

## Commentaires

### 26.11.2026 — Résultats des vérifications

**Conditions.**
- Essais faits sur le serveur de production le 26.11.2026, de 14 h 40 à 15 h 00 UTC, une demande à la fois.
- Instance Hermes **d'essai**, distincte de celle de hermes-webui :
  - même image, son propre volume ;
  - un réseau Docker interne sans Internet, partagé avec Ollama ;
  - aucun port publié, une clé aléatoire de 40 caractères ;
  - `mem_limit` de 2 Go.
- Un petit relais placé entre Hermes et Ollama a consigné tout ce que Hermes envoie au modèle et tout ce qu'il en reçoit.
- Données utilisées : la question de calcul « 17 × 23 » et l'initiative **fictive** du ticket 02 (« Dématérialisation des notes de frais »), aucune donnée réelle.
- Tout a été démonté ensuite : conteneurs, réseau, volume, fichiers dans `/tmp`. hermes-webui et Ollama n'ont pas été modifiés, sinon par le branchement temporaire d'Ollama au réseau d'essai, retiré depuis.

**Configuration essayée** (celle prévue pour le ticket 11) : [`mesures/hermes/config.yaml`](../mesures/hermes/config.yaml) contient :
- `platform_toolsets.api_server: []` ;
- `memory.memory_enabled: false`, `user_profile_enabled: false`, `nudge_interval: 0` ;
- `skills.creation_nudge_interval: 0` ;
- `curator.enabled: false` ;
- `auxiliary.background_review.enabled: false`.

Le second essai y a ajouté `auxiliary.title_generation.enabled: false` et `logging.level: "WARNING"` (point 4).

#### 1. Réflexion par demande — conforme, avec une précaution

Hermes transmet le réglage `model_options.reasoning` de chaque `POST /v1/runs` :

| Demande | Ce que Hermes envoie à Ollama | Réflexion produite | Durée |
|---|---|---|---|
| `reasoning: {enabled: false}` | `think: false`, `reasoning_effort: "none"` | aucune | 26 s |
| `reasoning: {enabled: true}` | ni l'un ni l'autre (comportement par défaut d'Ollama) | oui, 920 caractères | 52 s |
| **aucun réglage** | `reasoning_effort: "medium"` | oui, 11 400 caractères (3 146 tokens) | **10 min 34 s** |

**Sans réglage, Hermes active la réflexion.** ACTA doit donc envoyer le réglage explicitement à chaque demande, `enabled: false` pour la réponse rapide et `enabled: true` pour la réponse approfondie (AS13). Une demande sans réglage serait traitée avec réflexion.

#### 2. Instructions de Hermes — elles s'ajoutent, mais le prompt de Hermes impose le texte brut

- Les instructions d'ACTA (`instructions` de `POST /v1/runs`) sont placées **à la fin** du prompt système de Hermes et ne le remplacent pas.
- Sans aucun outil, ce prompt système fait 3 079 caractères, dont environ 2 340 ajoutés par Hermes. Il contient :
  - sa présentation (« You are Hermes Agent… ») ;
  - un renvoi à sa documentation ;
  - le profil, la date, le modèle et le dossier de travail ;
  - la consigne suivante, propre à la plateforme API : *« assume plain text. No markdown formatting (no asterisks, bullets, headers, code fences). Treat this like a conversation, not a document. Keep responses brief and natural. »*
- Ni mémoire, ni profil d'utilisateur, ni liste de skills n'y figurent.
- **Demande type** « Faire le point », sans réflexion :

| | Contexte lu | Texte produit | Durée |
|---|---|---|---|
| Ollama en direct (ticket 02) | 1 991 tokens | 516 tokens | 157 s |
| À travers Hermes | 2 583 tokens (+ 592) | 356 tokens | 145 s pour le modèle, 151 s au total pour ACTA |

  Hermes ajoute environ 600 tokens à lire, soit une quinzaine de secondes, et presque rien d'autre.
- **Effet constaté sur la forme :** la réponse passée par Hermes est **un seul paragraphe**, sans liste ni structure. En direct, la même demande donnait une liste à puces. La consigne « texte brut » de Hermes l'emporte sur le « concise et structurée » des instructions d'ACTA (spécification, instructions communes).
- Hermes fait aussi, après chaque demande, un **second appel au modèle** pour donner un titre à la session (3 à 18 s de processeur). Cet appel transmet les 1 000 premiers caractères de la demande et garde le titre dans la session, par exemple « Digitalize expense reports at Coopérative Les Vergers du Lac ». Ce titre disparaît avec la session (point 5). `auxiliary.title_generation.enabled: false` le supprime : vérifié au second essai, aucun appel de titre.

#### 3. Version et réglages — conformes

- Version déployée : **Hermes Agent v0.23.4** (2026.9.24, commit `8fc03744`), dans le conteneur `hermes-agent` comme dans l'image `nousresearch/hermes-agent:latest` du serveur. C'est la version étudiée par la recherche.
- Liste vide d'outils : `GET /v1/toolsets` marque tous les jeux d'outils « non activés », skills compris. Surtout, **aucune** requête envoyée au modèle ne contient de champ `tools`.
- Mémoire, profil d'utilisateur, écriture de skills, révision automatique et curateur : réglages acceptés.
  - Rien de tout cela n'apparaît dans le prompt.
  - Aucun appel au modèle autre que la demande et le titre n'a été observé.
- Recherche dans l'historique : c'est un outil (`session_search`), absent puisque aucun outil n'est autorisé.
- À noter : Hermes installe d'office douze dossiers de skills fournis avec lui dans son volume. Ils ne sont ni listés dans le prompt ni lisibles par le modèle, faute d'outil.

#### 4. Journaux — le texte des demandes y entre, un réglage l'en retire

- **Réglages par défaut :**
  - `logs/agent.log` écrit pour chaque demande une ligne qui cite les **80 premiers caractères** de son texte, par exemple `msg='<donnees> # Initiative : Dématérialisation des notes de frais (DNF)  Organisatio...'`.
  - Ces lignes **restent après la suppression de la session**.
  - La rotation se fait par taille (5 Mo × 3 fichiers), pas par durée : ces lignes peuvent rester longtemps.
  - `gateway.log`, `errors.log` et `docker logs` ne contenaient pas de texte de demande.
- **Avec `logging.level: "WARNING"`** (second essai), aucun journal ne cite plus la demande. Les avertissements et les erreurs restent consignés.
- Proposition : utiliser ce réglage plutôt qu'une rotation courte. Il ne s'agit pas d'une nouvelle règle : c'est le moyen de respecter la décision 8 de l'ADR 0022.

#### 5. Suppression de session — conforme à l'API, avec un résidu dans le fichier

- Chaque travail lancé par `POST /v1/runs` avec `session_id` crée une session de ce nom.
- `DELETE /api/sessions/{id}` répond `"deleted": true`, et `GET /api/sessions/{id}` répond ensuite 404 « Session not found ». Cela vaut pour les quatre sessions.
- Après la suppression, **aucune table** de la base de Hermes (`state.db`) ne contient plus le texte, ni la demande, ni l'avis, ni le titre.
- **Mais le texte reste physiquement dans le fichier.** Il se trouve dans 22 pages libérées de `state.db` et dans son journal d'écriture (`state.db-wal`). SQLite marque ces pages comme libres sans les effacer (`secure_delete` et `auto_vacuum` coupés).
  - Ces octets restent lisibles avec un outil adapté, par quiconque accède au volume de Hermes, jusqu'à ce que ces pages soient réécrites.
  - L'API ne les montre plus.
  - La spécification veut un effacement « définitif et sans trace ». Ce résidu n'y répond pas au sens strict : c'est un résultat contraire, qui n'est pas contourné ici (question 2 ci-dessous).

#### Questions à la responsable fonctionnelle

1. **Forme des avis.** Hermes demande au modèle du texte brut, sans liste ni titre, et les avis sortent en un seul paragraphe. Deux possibilités :
   - (a) l'accepter ;
   - (b) écrire dans les instructions d'ACTA que la mise en forme demandée (listes, titres) prime sur toute consigne précédente de mise en forme. Il faudrait ensuite revérifier l'effet sur une demande type.

   Faut-il retenir (b) ?
2. **Résidu après suppression.** Le texte d'une demande supprimée reste dans les pages libérées du fichier de Hermes jusqu'à leur réécriture. Est-ce acceptable ? Sinon, plusieurs pistes sont possibles, à décider et sans doute à consigner dans un nouvel ADR, car elles touchent l'installation (ADR 0022, point 11) :
   - (a) données de Hermes en mémoire vive (`tmpfs`), donc perdues à chaque redémarrage, ce que la décision 5 de l'ADR 0022 traite déjà comme « assistant indisponible » ;
   - (b) compactage régulier de la base de Hermes (`VACUUM`) ;
   - (c) accepter le résidu, puisque le volume n'est ni sauvegardé ni accessible hors du serveur.
3. **Réglages ajoutés pour le ticket 11.**
   - `auxiliary.title_generation.enabled: false` supprime un appel au modèle par demande et une copie du début du texte.
   - `logging.level: "WARNING"` retire le texte des demandes des journaux.

   Ce sont des réglages de Hermes, pas des règles de gestion : sauf avis contraire, le ticket 11 les reprendra.

### 26.11.2026 — Décisions de la responsable et second essai

**Décisions :**
- question 1 : **(b)**, la mise en forme demandée prime ;
- question 2 : **(a)**, données de Hermes en mémoire vive, rédigé dans le projet d'[ADR-0023](../../../docs/adr/0023-donnees-de-hermes-en-memoire-vive.md), à valider ;
- question 3 : les deux réglages sont retenus.

**Second essai** (même méthode, instance démontée ensuite, données fictives). Hermes tourne avec `/opt/data` en `tmpfs` (512 Mo) et `config.yaml` monté en lecture seule. La demande type est « Faire le point », sans réflexion, avec les instructions générales actuelles de la spécification (AS28).

- **Mémoire vive : conforme.**
  - Hermes démarre en 30 s et occupe 5 Mo du `tmpfs`.
  - Au démarrage, `config-migrate` tente de réécrire la configuration et échoue (`Read-only file system`). C'est sans effet : les deux réglages retenus s'appliquent (aucun appel de titre, aucune demande citée dans `agent.log`).
  - Hors de `/opt/data`, `docker diff` ne montre que des fichiers techniques (`/run/s6`, `/tmp/hermes-runtime`). Le texte de la demande ne s'y trouve pas.
- **Mise en forme (décision 1b) :** la phrase essayée est « Mets en forme ta réponse en Markdown, avec des titres courts et des listes à puces : cette consigne remplace toute consigne précédente qui demande du texte brut. »

| Place de la phrase | Résultat | Durée |
|---|---|---|
| À la fin des instructions générales, donc du prompt système | **sans effet** : un seul paragraphe, comme sans la phrase | 57 s |
| À la fin du message, après l'instruction de l'usage | **efficace** : titres « ## » et listes à puces | 151 s |

  La réponse mise en forme est plus longue (texte produit plus long), donc plus lente. Le fond garde les défauts relevés au ticket 02 (approximations, une coquille).

**Question restante à la responsable :**
- AS27 fixe le message envoyé : les données lues, puis l'instruction de l'usage.
- Pour que la décision 1b prenne effet, la phrase de mise en forme doit **s'ajouter à la fin de ce message**, après l'instruction de l'usage, pour chaque usage et pour la question libre.
- Faut-il modifier AS27 en ce sens, avec la phrase ci-dessus, et sa traduction anglaise relue avec les autres textes (AS28) ?
- Le panneau devra aussi afficher le Markdown (titres, listes) de l'avis.

### 26.11.2026 — Clôture

- ADR-0023 validé par la responsable : statut « accepté ».
- AS27 modifié avec son accord : la consigne de mise en forme termine le message de chaque demande, après la question pour la question libre. La carte de l'avis affiche le Markdown.

#### Commandes passées

Les scripts se trouvent dans [`.scratch/assistant/mesures/hermes/`](../mesures/hermes/) :
- `essai.sh` : installation, lancement détaché, suppression, nettoyage ;
- `relais.py` : relais qui consigne les échanges avec Ollama ;
- `construire.mjs` : corps des demandes ;
- `analyse.mjs` : lecture des échanges consignés ;
- `residus.py` : recherche du texte dans les tables.

Depuis Git Bash, sur le poste :

```bash
# Corps des quatre demandes (R1 sans réflexion, R2 avec, R3 sans réglage, R4 « Faire le point »)
node .scratch/assistant/mesures/hermes/construire.mjs .scratch/assistant/mesures payloads
# Envoi en une seule connexion SSH (pare-feu LIMIT), puis sur le serveur :
tar -cf - relais.py config.yaml essai.sh payloads | base64 -w0 | /c/Windows/System32/OpenSSH/ssh.exe -o BatchMode=yes vps \
  'mkdir -p /tmp/acta-essai && cd /tmp/acta-essai && base64 -d | tar -xf - && bash essai.sh installer'
ssh vps 'cd /tmp/acta-essai && bash essai.sh lancer'      # les quatre demandes l'une après l'autre, détachées
ssh vps 'cd /tmp/acta-essai && bash essai.sh etat'        # durées et appels consignés par le relais
node analyse.mjs releve/journal 008 010 011 014 017 018   # réglages envoyés, usage, réflexion, réponse
ssh vps 'docker exec acta-essai-hermes grep -r -a -l -E "MARQUEUR-ESSAI-T10|Vergers du Lac" /opt/data'
ssh vps 'cd /tmp/acta-essai && bash essai.sh supprimer'   # GET, DELETE, GET de chaque session
ssh vps 'docker exec acta-essai-hermes /opt/hermes/.venv/bin/python /tmp/residus.py'
# title_generation et logging.level ajoutés, docker restart, une demande, recherche du marqueur
ssh vps 'cd /tmp/acta-essai && bash essai.sh nettoyer && rm -rf /tmp/acta-essai'
# Second essai : mémoire vive et mise en forme (R6 consigne dans le prompt système, R7 dans le message)
node .scratch/assistant/mesures/hermes/construire2.mjs .scratch/assistant/mesures payloads
ssh vps 'cd /tmp/acta-essai && MEMOIRE_VIVE=1 bash essai.sh installer && bash essai.sh boucle'
ssh vps 'docker exec acta-essai-hermes sh -c "mount | grep /opt/data"; docker diff acta-essai-hermes'
ssh vps 'cd /tmp/acta-essai && bash essai.sh nettoyer && rm -rf /tmp/acta-essai'
```

(`ssh vps` désigne `/c/Windows/System32/OpenSSH/ssh.exe -o BatchMode=yes vps`.)
