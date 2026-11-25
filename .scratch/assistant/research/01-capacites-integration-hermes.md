# Recherche 01 — Ce que Hermes Agent permet pour une intégration avec ACTA

- **Date** : 25.11.2026
- **Question** : avec la version installée, comment ACTA peut-elle faire travailler Hermes Agent ? (API, accès aux données, isolement entre utilisateurs, sécurité, réseau, modèle)
- **Version consultée** : Hermes Agent **v0.23.4** (dernière version publiée le 24.11.2026), commit `8fc0374447313e276f6b9a2764bfc750190c966a`. Le 25.11.2026, sur Docker Hub, l'étiquette `nousresearch/hermes-agent:latest` a le même condensé (`sha256:3bc37fd8…`) que `v0.23.4`.
- **Réserve sur la version** : l'image du serveur a pu être téléchargée avant cette date. Personne n'a lu la version qui tourne réellement (il faudrait lancer `hermes --version` dans le conteneur ou `docker image inspect`). Tout ce qui suit vaut pour v0.23.4.
- **Sources** : le dépôt [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent/tree/v0.23.4) à l'étiquette `v0.23.4`. Ce sont la documentation (`website/docs/…`, publiée sur <https://hermes-agent.nousresearch.com/docs/>), `SECURITY.md` et le code du serveur API (`gateway/platforms/api_server*.py`). S'y ajoutent la documentation Ollama (<https://docs.ollama.com>), la fiche du modèle sur ollama.com et le README de [nesquena/hermes-webui](https://github.com/nesquena/hermes-webui) (commit `ff37f42`).

Abréviations des liens :
- **[doc]** = `https://github.com/NousResearch/hermes-agent/blob/v0.23.4/website/docs/`
- **[code]** = `https://github.com/NousResearch/hermes-agent/blob/v0.23.4/`

Chaque affirmation porte l'une de ces deux marques :
- **Confirmé** : écrit dans la doc ou constaté dans le code de v0.23.4.
- **Supposé** : déduction ou hypothèse, non vérifiée.

---

## 1. API serveur : points d'entrée et traitement différé

### 1.1 Points d'entrée disponibles

**Confirmé.** Ce tableau reprend la table des routes du code ([code]`gateway/platforms/api_server.py`, l. 1569-1606) et la doc [doc]`user-guide/features/api-server.md`.

| Famille | Routes | Rôle |
|---|---|---|
| Compatibilité OpenAI | `POST /v1/chat/completions`, `GET /v1/models` | Format Chat Completions, sans état : tout l'historique part dans `messages` |
| Responses (OpenAI) | `POST /v1/responses`, `GET` et `DELETE /v1/responses/{id}` | Historique gardé côté serveur avec `previous_response_id` ou `conversation` (conversation nommée) |
| **Runs** (propre à Hermes) | `POST /v1/runs` ; `GET /v1/runs/{run_id}` ; `GET /v1/runs/{run_id}/events` (SSE) ; `POST …/stop`, `…/approval`, `…/clarify`, `…/steer`, `…/resolve-unknown` | Soumettre un travail, puis en suivre l'état |
| Sessions | `GET` et `POST /api/sessions` ; `GET`, `PATCH` et `DELETE /api/sessions/{id}` ; `GET …/messages` ; `POST …/fork` ; `POST …/chat` (synchrone) ; `POST …/chat/stream` (SSE) | Gérer des conversations côté serveur |
| Jobs (cron) | `GET` et `POST /api/jobs` ; `GET`, `PATCH` et `DELETE /api/jobs/{id}` ; `…/pause`, `…/resume`, `…/run` | Travaux planifiés |
| Découverte | `GET /v1/capabilities`, `GET /v1/skills`, `GET /v1/toolsets`, `GET /api/model/options` | Ce que l'instance sait faire |
| Santé | `GET /health` et `/v1/health` (sans authentification) ; `GET /health/detailed` (avec authentification) | Surveillance |

**Confirmé.** Autres éléments de l'API :
- **Message système.** Un message `system` (Chat Completions) ou un champ `instructions` (Responses) **s'ajoute** au prompt système de Hermes ; il ne le remplace pas. L'agent garde tous ses outils, sa mémoire et ses skills ([doc]`user-guide/features/api-server.md`, section « System Prompt Handling »).
- **Fichiers.** Les fichiers joints ne sont pas acceptés (`input_file`, `file_id` et les `data:` qui ne sont pas des images renvoient `400 unsupported_content_type`). Les images en ligne sont acceptées ([doc]`user-guide/features/api-server.md`, section « Limitations »).
- **Concurrence.** Au plus 10 exécutions simultanées par défaut (`gateway.api_server.max_concurrent_runs`). Au-delà, le serveur répond **HTTP 429** (même page, section « Concurrent-run cap »).
- **File d'admission.** « API requests use the gateway's durable admission queue » : les requêtes entrent dans une file durable. Les tours d'une même session sont traités l'un après l'autre (verrou de session, « session turn leases ») (même page, en-tête et section `POST /v1/runs`).

### 1.2 Traitement différé : possible par interrogation, sans rappel

**Confirmé.** Le Runs API permet de « soumettre puis récupérer » :
1. `POST /v1/runs` avec `input` (et en option `session_id`, `instructions`, `conversation_history`, `previous_response_id`). La réponse est immédiate : `{"run_id": "...", "status": "started"}`.
2. `GET /v1/runs/{run_id}` donne l'état (`completed`, `failed`, `cancelled`, `interrupted`, ou `unknown` après un redémarrage) et, une fois le travail fini, `output` et `usage`. La doc présente ce point d'entrée comme fait pour un client qui ne garde pas de connexion SSE ouverte ou qui se reconnecte.
3. Il est aussi possible de suivre le travail en direct par SSE (`/v1/runs/{id}/events` : `tool.started`, `tool.completed`, `message.delta`, `run.completed`…).

Source : [doc]`user-guide/features/api-server.md`, section « Runs API ».

**Confirmé.** Ce que le serveur garantit pour ces travaux :
- **Clé d'idempotence.** Avec l'en-tête `Idempotency-Key`, une nouvelle tentative identique rend le même `run_id`, même après un redémarrage de Hermes. La clé est conservée 24 heures (même section).
- **Durée de conservation.** L'état final d'un travail ne reste interrogeable que **3 600 secondes** (`_RUN_STATUS_TTL = 3600`). Le tampon d'événements SSE non consommés expire après 300 s ([code]`gateway/platforms/api_server.py`, l. 3809-3810).
- **Redémarrage de Hermes.** Un travail en cours lors d'un arrêt de Hermes passe à `interrupted`. Après un redémarrage brutal, il peut passer à `unknown`. Dans ce cas, les tours suivants de la session restent bloqués jusqu'à un `POST …/resolve-unknown` (doc, même section).

**Confirmé.** Il n'existe pas de **rappel HTTP (webhook) vers l'appelant** quand un travail se termine :
- Aucune route ni aucun paramètre de rappel dans `api_server_runs.py`. Les seuls « callbacks » du fichier sont des fonctions internes qui alimentent le flux SSE (l. 369-403).
- Les jobs cron livrent leur résultat sur des canaux de messagerie (Telegram, Slack, e-mail…), dans des fichiers locaux ou dans « bot-chat ». La liste ne contient pas d'URL HTTP arbitraire ([doc]`user-guide/features/cron.md`, section « Delivery options »).

**Supposé.** Pour être prévenu de la fin d'un travail, il faudrait un plugin Hermes sur mesure (par exemple sur le hook `on_session_end` ou `post_llm_call`, [doc]`developer-guide/plugins/index.md`, l. 1752-1764) qui appelle ACTA. Cette piste n'a pas été testée.

**Conséquence factuelle.** Pour un travail long, ACTA doit faire elle-même le suivi, de l'une de deux manières :
- garder une connexion SSE ouverte ;
- interroger `GET /v1/runs/{id}` à intervalles réguliers, **en moins d'une heure** après la fin du travail.

Dans les deux cas, ACTA doit enregistrer de son côté la demande, le `run_id` et le résultat. Sinon le résultat est perdu quand l'état expire ou quand Hermes redémarre. Avec la limite de 10 exécutions simultanées (réponse 429), ACTA doit aussi limiter elle-même ses envois (file d'attente avec reprise). **Supposé** : il est aussi possible de relire le résultat dans l'historique de session (`GET /api/sessions/{id}/messages`) si la demande a été faite avec un `session_id`. Cela n'a pas été vérifié pour le Runs API.

---

## 2. Accès aux données d'ACTA

### 2.1 Les moyens disponibles

**Confirmé**, sauf mention contraire.

- **Contexte passé dans la demande.** ACTA envoie les données utiles dans `input`, `instructions` ou `messages`. C'est le moyen le plus simple : Hermes n'appelle alors jamais ACTA. Sa limite est la fenêtre de contexte du modèle (voir § 6).
- **Client MCP.** Hermes est un client MCP. Il accepte des serveurs `stdio` et des serveurs HTTP distants (`url` et `headers`), configurés dans `config.yaml` sous `mcp_servers`. Chaque serveur devient une boîte à outils `mcp-<nom>`. Les filtres `tools.include` et `tools.exclude` choisissent les outils exposés. Une option `trust: untrusted` impose une approbation avant chaque outil qui écrit ([doc]`user-guide/features/mcp.md` ; [doc]`reference/toolsets-reference.md`, section « MCP server toolsets » ; [doc]`user-guide/features/api-server.md`, l. 680).
- **Outils sur mesure (plugins Python).** `ctx.register_tool()`. Le gestionnaire d'outil reçoit en paramètres de contexte `session_id`, `conversation_id`, `task_id`, etc. ([doc]`developer-guide/plugins/index.md`, l. 986-1000). Un plugin s'exécute dans le processus Hermes avec tous ses privilèges (`SECURITY.md` § 2.5).
- **Skills.** Ce sont des procédures en Markdown, parfois accompagnées de scripts. Elles guident l'agent ; elles ne donnent pas accès aux données à elles seules ([doc]`user-guide/features/skills.md`).

### 2.2 Transmettre un jeton propre à chaque utilisateur

**Confirmé.** L'API n'offre **aucun mécanisme documenté** pour faire passer un jeton d'utilisateur, demande par demande, jusqu'aux outils ou aux serveurs MCP :
- **En-têtes MCP fixes.** Les `headers` d'un serveur MCP sont résolus **à la connexion au serveur**, à partir de variables d'environnement (`${VAR}`), et non à chaque demande ([doc]`user-guide/features/mcp.md`, section « Runtime ${ENV_VAR} substitution »). Le code construit l'URL et les en-têtes une seule fois par connexion ([code]`tools/mcp_tool_transport.py`, `_connect_inputs`, l. 141-150).
- **En-tête d'identité limité.** `identity_header` envoie au serveur MCP une valeur `static` (fixée dans la configuration) ou `profile` (le nom du profil Hermes, « resolved once at connect time ») ([doc]`user-guide/features/mcp.md`, section « Per-user identity header »). Il ne transporte donc ni l'utilisateur d'ACTA ni son jeton.
- **En-têtes acceptés par l'API.** Les seuls en-têtes `X-Hermes-*` que lit le serveur API sont `X-Hermes-Session-Id`, `X-Hermes-Session-Key` (portée de la mémoire, voir § 3) et `X-Hermes-Peer-Principal`. Ce dernier ne sert qu'aux journaux d'audit ([code]`gateway/platforms/api_server.py`, l. 1389).
- **Connexions MCP partagées.** Une connexion MCP est partagée par profil, et non par demande ([code]`tools/mcp_tool_scope.py`).

**Supposé.** Contournements possibles, non vérifiés :
- **(a) Session associée côté ACTA.** ACTA ouvre une session Hermes (`session_id` choisi par ACTA) et garde de son côté la correspondance entre ce `session_id` et l'utilisateur. Un outil sur mesure (plugin) qui reçoit `session_id` appelle ACTA avec un secret de service et ce `session_id`. ACTA applique alors les droits de l'utilisateur associé. Ce montage est à concevoir, et `SECURITY.md` § 2.6 règle 3 le prévient : « Session identifiers are routing handles, not authorization boundaries ».
- **(b) Jeton dans le texte de la demande.** Le modèle le voit, il est enregistré dans l'historique (`state.db`) et il peut ressortir (voir § 3). C'est à éviter.
- **(c) Instance par utilisateur.** Une instance Hermes par utilisateur, chacune avec son propre jeton de service. C'est lourd (voir § 3.3).
- **(d) Pas d'appel vers ACTA.** ACTA filtre elle-même les données selon les droits de l'utilisateur et les place dans la demande (moyen « contexte passé »). Hermes n'appelle jamais ACTA.

---

## 3. Isolement entre utilisateurs

### 3.1 Ce qui est partagé dans une même instance (un même profil)

**Confirmé.** `SECURITY.md` § 2 : « Hermes Agent is a single-tenant personal agent ». Hermes est un agent personnel pour un seul utilisateur. Le § 2.6, règle 4, précise : « Within the authorized set, all callers are equally trusted. Hermes Agent does not model per-caller capabilities inside a single adapter » (tous les appelants autorisés ont la même confiance, sans droits par appelant).

| Élément | Portée | Source |
|---|---|---|
| Mémoire `MEMORY.md` et `USER.md` (ajoutée au prompt système de **chaque** session) | Une par profil, commune à toutes les demandes | [doc]`user-guide/features/memory.md`, l. 17-23 et 82 |
| `session_search` (recherche plein texte dans tout l'historique `state.db`) | « reads the whole session store of the profile it runs in: every chat, from every platform and every user » | [doc]`user-guide/sessions.md`, section « Who can search what » |
| Skills créés par l'agent (`skill_manage`, révision automatique après un tour) | Écrits dans `~/.hermes/skills/` du profil, donc visibles pour tous | [doc]`user-guide/features/skills.md`, l. 425 et 607-640 |
| `X-Hermes-Session-Key` | Ne délimite que la mémoire d'un **fournisseur externe** (Honcho). Les fichiers de mémoire intégrés ne sont pas concernés. | [doc]`user-guide/features/api-server.md`, section « Long-term memory scoping » ; [code]`agent/agent_init_memory_provider.py`, l. 143-148 |

**Réponse à la question (confirmé par la doc).** Oui, une information lue pour un utilisateur peut ressortir chez un autre, de trois façons :
- par la mémoire, si l'agent l'y a enregistrée (écriture libre par défaut, `write_approval: false`) ;
- par `session_search`, qui lit toutes les conversations du profil ;
- par un skill généré automatiquement.

La doc le dit explicitement : « anyone allowed to talk to it can ask the agent to find and read anyone else's conversations ».

**Supposé.** Le conteneur `hermes-webui` fait tourner l'agent « in-process, reading your `HERMES_HOME` config directly » (README de hermes-webui, section « How chat runs by default »). S'il monte le même `HERMES_HOME` que `hermes-agent`, les conversations, la mémoire et les skills seraient communs entre l'interface web et ACTA. Les montages réels du serveur n'ont pas été vérifiés.

### 3.2 Désactiver ou cloisonner

**Confirmé.** Réglages dans `config.yaml` :
- **Mémoire.** `memory.memory_enabled: false` **et** `memory.user_profile_enabled: false` retirent l'outil `memory` et son bloc du prompt. Plus radical encore : `agent.disabled_toolsets: [memory]` retire aussi les outils des fournisseurs externes ([doc]`user-guide/features/memory.md`, section « Configuration »).
- **Historique.** `agent.disabled_toolsets: [session_search]` désactive la recherche dans l'historique. La boîte à outils existe ([doc]`reference/toolsets-reference.md`).
- **Skills.** Pour les skills générés :
  - `skills.write_approval: true` met chaque écriture de skill en attente de validation ([doc]`user-guide/configuration.md`, l. 935-944) ;
  - `auxiliary.background_review.enabled: false` arrête la révision automatique après chaque tour ([doc]`user-guide/features/memory.md`, l. 434-446) ;
  - `disabled_toolsets: [skills]` retire `skill_manage` ([doc]`reference/toolsets-reference.md`).
  - La doc précise que ces barrières ne couvrent pas les écritures faites par les outils fichiers ou le terminal ([doc]`user-guide/configuration.md`, l. 944).
- **Historique enregistré.** L'historique des conversations reste enregistré dans `state.db`. La doc ne mentionne aucun réglage pour ne rien enregistrer, mais elle documente la suppression (`DELETE /api/sessions/{id}`).

### 3.3 Cloisonnement réel

**Confirmé.** Les **profils ne sont pas des locataires isolés** (« Profiles are not tenants ») : un agent qui a le terminal ou l'exécution de code peut lire les fichiers des autres profils. Isoler des utilisateurs entre eux demande des utilisateurs système ou des conteneurs séparés (`SECURITY.md` § 2.2 et § 2.6 règle 4 ; [doc]`user-guide/sessions.md`). La doc « Multi-User Setup with Profiles » propose un profil par utilisateur, chacun avec son port et sa clé ([doc]`user-guide/features/api-server.md`). Cela sépare la configuration, la mémoire et les skills, mais ce n'est pas une frontière de sécurité.

---

## 4. Sécurité

### 4.1 Authentification de l'API (`API_SERVER_KEY`)

**Confirmé dans le code.**
- **Refus de démarrer.** Le serveur API **refuse de démarrer** si la clé est absente, si c'est une valeur de démonstration ou si elle fait **moins de 16 caractères**. L'erreur est fatale et sans nouvelle tentative (`api_server_key_invalid`). Le journal contient « Refusing to start: API_SERVER_KEY is required … » ([code]`gateway/platforms/api_server.py`, `_api_key_passes_startup_guard` et `connect`, l. 3874-3930).
- **Contrôle de chaque requête.** Le serveur vérifie l'en-tête `Authorization: Bearer <clé>` par une comparaison à temps constant (`secrets_match`). Une clé fausse donne un 401 `gateway_auth_failed` (l. 1429-1448).
- **Écart dans la doc.** [doc]`user-guide/docker.md` (l. 100) indique « minimum 8 characters » ; le code exige 16.

**Supposé.** Sur le serveur, `API_SERVER_KEY` est vide dans l'environnement du conteneur. La clé est lue par `_get_scoped_secret`, qui peut aussi la trouver dans `$HERMES_HOME/.env` ou dans `config.yaml` (`gateway.api_server.key`), comme le dit la doc. Deux cas sont possibles :
- une clé est définie dans l'un de ces fichiers ;
- le serveur API n'a pas démarré du tout (le journal du conteneur montrerait l'erreur ci-dessus).

Il faut vérifier lequel des deux, sans afficher la clé.

**Confirmé.** Si le serveur écoute sur une adresse accessible du réseau (`0.0.0.0`) avec le terminal `local`, Hermes affiche un avertissement : le travail envoyé par l'API s'exécute « with full terminal/file access » ([code]`gateway/platforms/api_server.py`, l. 3952-3965). La doc : « The API server gives full access to hermes-agent's toolset, **including terminal commands** » ([doc]`user-guide/features/api-server.md`, section « Authentication »).

### 4.2 Outils actifs par défaut pour l'API

**Confirmé.** La plateforme `api_server` utilise par défaut la boîte à outils `hermes-api-server` ([code]`hermes_cli/platforms.py`, l. 33). Elle reprend l'ensemble de `hermes-cli`, sauf `clarify`, `text_to_speech`, `computer_use` et les outils kanban ([doc]`reference/toolsets-reference.md`, section « Platform Toolsets »). Restent donc actifs, notamment :
- `terminal` (avec `process_manage`) ;
- `file` (`read_file`, `write_file`, `patch`, `search_files`) ;
- `code_execution` (`execute_code`) ;
- `browser` ;
- `web` ;
- `delegation` ;
- `cronjob` ;
- `memory` ;
- `session_search` ;
- `skills` ;
- tous les serveurs MCP configurés.

**Confirmé.** Par défaut, le terminal s'exécute **dans le conteneur Hermes lui-même**, avec les droits de l'utilisateur `hermes`. Ce conteneur contient `HERMES_HOME`, donc `.env`, les clés et `state.db` ([doc]`user-guide/docker.md`, l. 12 et 555-556 ; `SECURITY.md` § 2.1). Les commandes jugées dangereuses passent par une approbation en mode `smart` par défaut. C'est un modèle auxiliaire qui juge ; la doc le décrit comme une heuristique et non comme une barrière (`approvals.mode`, [doc]`user-guide/configuration.md`, l. 3211-3229 ; `SECURITY.md` § 2.4).

### 4.3 Couper les outils dangereux

**Confirmé.** Réglages dans `config.yaml` :

```yaml
agent:
  disabled_toolsets: [terminal, file, code_execution, browser, delegation, cronjob, memory, session_search, skills]
```

`agent.disabled_toolsets` s'applique à toutes les plateformes, en dernier, outil par outil ([doc]`user-guide/configuration.md`, section « Global Toolset Disable »).

Autre possibilité : une liste explicite pour la seule plateforme API :

```yaml
platform_toolsets:
  api_server: [mcp-acta]
```

La syntaxe `platform_toolsets.<plateforme>` est documentée avec l'exemple `acp` ([doc]`user-guide/features/acp.md`, l. 53-56). La clé de plateforme `api_server` vient de [code]`hermes_cli/platforms.py`. Une liste qui nomme des serveurs MCP ne garde que ceux-là ([doc]`reference/toolsets-reference.md`).

Il existe aussi la boîte à outils `safe` (recherche web et images, sans terminal ni écriture). Dans `approvals.deny`, des motifs bloquent des commandes sans condition.

**Supposé.** Le nom `mcp-acta` n'est qu'un exemple : il suppose un serveur MCP nommé `acta`.

**Confirmé.** `SECURITY.md` § 2.2 : « The only security boundary against an adversarial LLM is the operating system ». Couper des outils réduit les risques, mais la vraie barrière reste le conteneur : ce qu'il monte et le réseau qu'il peut joindre.

---

## 5. Réseau entre conteneurs

**Confirmé**, par le constat sur le serveur et par `compose.yaml` d'ACTA :
- l'API d'ACTA est sur le réseau externe `socle`, avec l'alias `${APP_NAME}-api`, port 3000 ;
- Hermes est sur `hermes-webui_hermes-net`.

Deux conteneurs ne se joignent par leur nom que s'ils partagent un réseau Docker défini par l'utilisateur (documentation Docker : <https://docs.docker.com/engine/network/>).

**Confirmé.** Côté Hermes :
- le serveur API écoute sur `API_SERVER_PORT`, 8642 par défaut ;
- `API_SERVER_HOST=0.0.0.0` est nécessaire pour qu'un autre conteneur le joigne (c'est déjà le cas) ;
- CORS est inutile entre serveurs ;
- la doc recommande de ne pas exposer l'API sur Internet sans VPN ni pare-feu (`SECURITY.md` § 4).

Source : [doc]`user-guide/features/api-server.md`, sections « Configuration » et « CORS ».

**Supposé.** Ce qu'il faudrait pour qu'ils communiquent :
- **Sens ACTA vers Hermes.** Connecter le conteneur `hermes-agent` au réseau `socle` (`docker network connect socle hermes-agent`, ou réseau externe déclaré dans le compose de Hermes), ou l'inverse. ACTA appellerait alors `http://hermes-agent:8642/v1/...` avec la clé.
- **Sens Hermes vers ACTA** (MCP ou outil sur mesure). Le même réseau partagé suffit, avec l'URL `http://<APP_NAME>-api:3000/...`. La doc ne mentionne pas de filtre réseau par défaut pour les serveurs MCP : le proxy de sortie `iron-proxy`, qui bloque les adresses privées, est désactivé par défaut (`proxy.enabled: false`, [doc]`user-guide/egress/iron-proxy.md`).
- **Réserve.** Mettre Hermes sur `socle` lui donne aussi accès aux autres services de ce réseau (base, Keycloak, PowerSync…), et son terminal peut les joindre. Un réseau dédié, partagé par Hermes et l'API d'ACTA seulement, limiterait cet accès. Toute modification de la topologie relève de l'ADR-0007 (Docker) et de l'ADR-0001 (topologie).

---

## 6. Modèle : Ollama et limites d'un petit modèle

### 6.1 Configuration

**Confirmé.** Pour Hermes, Ollama local est un point d'accès « custom » compatible OpenAI ([doc]`guides/local-ollama-setup.md`, étape 3 ; [doc]`integrations/providers.md`, l. 772-850) :

```yaml
model:
  default: "qwen3.5:9b"
  provider: "custom"
  base_url: "http://ollama:11434/v1"
```

Il existe aussi la forme `providers.ollama.base_url`. Aucune clé d'API n'est nécessaire.

**Supposé.** Le nom d'hôte `ollama` suppose que les deux conteneurs partagent le réseau, ce qui semble être le cas.

### 6.2 Longueur de contexte

**Confirmé.**
- **Minimum de Hermes.** Hermes exige au moins **64 000 tokens** de contexte (`MINIMUM_CONTEXT_LENGTH = 64_000`, [code]`agent/model_metadata.py`, l. 281). En dessous, l'agent **refuse de démarrer** avec une erreur `ValueError` ([code]`agent/agent_init.py`, l. 1906-1929).
- **Défaut d'Ollama.** Sans réglage, Ollama limite le contexte selon la mémoire vidéo : moins de 24 Go donne **4 096 tokens** (le cas d'un serveur sans GPU). Le réglage se fait avec `OLLAMA_CONTEXT_LENGTH=64000`. Un contexte plus grand consomme plus de mémoire (<https://docs.ollama.com/context-length>).
- **Pas de réglage par l'API OpenAI d'Ollama.** L'API compatible OpenAI ne permet pas de régler le contexte. Il faut une variable côté serveur ou un Modelfile avec `num_ctx` (<https://docs.ollama.com/api/openai-compatibility>).
- **Comportement de Hermes avec un serveur local.** Pour un serveur local, et la doc compte les noms de service Docker comme locaux ([doc]`integrations/providers.md`, l. 1168), Hermes lit la fenêtre maximale du modèle par `/api/show` et envoie `num_ctx` à chaque requête ([code]`agent/agent_init_ollama.py`, l. 10-48). Ce maximum peut être plafonné par `model.context_length` ou imposé par `model.ollama_num_ctx`.

**Confirmé.** `qwen3.5:9b` : fenêtre de 256 K, capacités « tools », « thinking » et « vision », 6,6 à 7,6 Go (<https://ollama.com/library/qwen3.5>).

**Supposé.** Sans plafond (`model.context_length: 64000`), Hermes pourrait demander une fenêtre de 256 K. Sur un serveur sans GPU, la mémoire nécessaire risque alors de dépasser celle disponible. Non vérifié.

### 6.3 Appels d'outils et performances

**Confirmé.**
- **Lenteur sans GPU.** La doc donne environ 10 tokens/s pour un modèle de 9 milliards de paramètres sur un processeur à 8 cœurs. Chaque appel envoie le prompt système et le schéma de **tous** les outils actifs, ce qui peut laisser le modèle « silent for minutes » avant de répondre ([doc]`guides/local-ollama-setup.md`, sections « What You Need » et « Slow first response »).
- **Réglages conseillés.** `HERMES_API_TIMEOUT=1800`, `OLLAMA_KEEP_ALIVE=24h`, mesure avec `hermes prompt-size` et désactivation des boîtes à outils inutiles (même page).
- **Fiabilité des appels d'outils.** Dans le tableau de la doc, seul `gemma4:31b` a des appels d'outils « fiables ». Hermes corrige automatiquement les appels mal formés et peut basculer vers un fournisseur cloud de secours après 3 échecs (`fallback_providers`) (même page, section « Model doesn't follow tool calls »). La doc ne dit rien de précis sur `qwen3.5:9b`.

**Supposé.** Couper les outils inutiles (§ 4.3) réduit à la fois le risque et le temps de traitement du prompt initial. Avec un 9B sur processeur, une demande avec outils pourrait prendre plusieurs minutes. Cela plaide pour un traitement différé (§ 1.2) plutôt qu'une attente synchrone dans une requête HTTP d'ACTA. Non mesuré.

---

## Conséquences pour ACTA

Ce sont des constats, non des décisions : les décisions appartiennent à la responsable fonctionnelle.

1. **Traitement différé.** Le traitement différé par interrogation existe (`POST /v1/runs`, puis `GET /v1/runs/{id}`). Hermes ne rappelle pas ACTA à la fin du travail, et l'état final n'est gardé qu'une heure. Pour un traitement différé fiable, ACTA devrait donc avoir sa propre table de demandes (état, `run_id`, résultat), un processus de suivi (interrogation ou SSE), une clé `Idempotency-Key` et une gestion du 429 (10 exécutions simultanées au maximum).
2. **Droits de l'utilisateur.** Hermes ne sait pas transmettre un jeton d'utilisateur demande par demande. Faire respecter les droits d'un utilisateur d'ACTA demande l'une de deux voies :
   - ACTA filtre elle-même les données envoyées dans la demande ;
   - un mécanisme sur mesure associe une session à un utilisateur (plugin Hermes et contrôle côté ACTA).
   Ce choix touche aux ADR-0005 et 0006 (identité, permissions).
3. **Isolement.** Une instance Hermes est faite pour un seul utilisateur. Mémoire, historique (`session_search`) et skills générés sont communs à toutes les demandes envoyées à la même instance, et peut-être aussi avec `hermes-webui` si `HERMES_HOME` est partagé. Ils peuvent être désactivés (`memory`, `session_search`, `skills`, révision automatique). Sinon, seule une séparation par conteneur isole réellement des utilisateurs.
4. **Outils dangereux.** Par défaut, l'API donne accès au terminal, aux fichiers, à l'exécution de code, au navigateur, à la délégation et au cron, dans le conteneur qui détient les clés. Ils peuvent être coupés par `agent.disabled_toolsets` ou par `platform_toolsets.api_server`.
5. **Clé d'API.** Une clé d'au moins 16 caractères est exigée pour que le serveur API démarre. Il reste à vérifier sur le serveur où elle est définie, ou si l'API a démarré.
6. **Réseau.** Les conteneurs ne partagent aujourd'hui aucun réseau. Un réseau commun ou dédié est nécessaire, ce qui touche à l'ADR-0007.
7. **Modèle.** Avec `qwen3.5:9b` sans GPU, le contexte doit être porté à au moins 64 000 tokens, sinon Hermes refuse de démarrer. Les temps de réponse attendus se comptent en minutes, et la fiabilité des appels d'outils n'est pas documentée pour ce modèle.
8. **Points à vérifier sur le serveur** (non faits, conformément à la consigne de ne pas s'y connecter) :
   - la version réelle de l'image ;
   - où est définie `API_SERVER_KEY` ;
   - les montages de `HERMES_HOME` communs à `hermes-agent` et `hermes-webui` ;
   - la valeur de `OLLAMA_CONTEXT_LENGTH` ;
   - le contenu de `config.yaml` (outils, mémoire, approbations).
