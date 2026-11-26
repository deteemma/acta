# 11: Instance Hermes d'ACTA

**What to build:** ACTA a sa propre instance Hermes, isolée et sans outil, déployée avec l'application. L'API sait dire si l'assistant est installé ; sans lui, rien de l'assistant n'apparaît.

**Blocked by:** 10 — Vérifications sur Hermes

**Status:** done (validé par la responsable fonctionnelle le 26.11.2026)

Règles : [spécification](../spec.md) AS25, AS35, AS36 ; [ADR-0022](../../../docs/adr/0022-assistant-lit-par-contexte-assemble.md), points 7 à 12 ; ADR 0007, ADR 0010.

- [x] Service `assistant` de `compose.yaml`, profil Compose `assistant`, avec un `mem_limit` (AS35).
- [x] Réseau dédié API ↔ Hermes ; réseau interne Hermes ↔ Ollama, sans Internet ; Hermes hors du réseau `socle`, sans port publié (AS35).
- [x] Configuration de Hermes versionnée dans le dépôt et déployée par `deployer.sh` : aucun outil autorisé (liste explicite vide), mémoire, recherche dans l'historique, écriture de skills et révision automatique coupées, réglages issus du ticket 10 (AS36) : titre de session coupé, journaux en `WARNING`. Point de départ : [`mesures/hermes/config.yaml`](../mesures/hermes/config.yaml), essayé sur le serveur.
- [x] Données de Hermes (`/opt/data`) en `tmpfs` dimensionné avec le `mem_limit` ; configuration fournie à chaque démarrage (ADR 0023 ; ticket 10, second essai).
- [x] Adresse et clé de Hermes par variables d'environnement ; clé aléatoire d'au moins 32 caractères (AS35, ADR 0007).
- [x] Données de Hermes hors des sauvegardes (AS36, ADR 0010).
- [x] Détection « assistant installé » côté API, exposée au web : sans adresse ou sans clé, l'assistant est absent (AS25).
- [x] Procédure de mise en service sur le serveur décrite dans la documentation de déploiement.
- [x] Validation en local : `acta.localhost` contacte l'instance Hermes du serveur (décision de la responsable du 26.11.2026). L'accès se fait sans publier de port de Hermes (AS35), par exemple par un tunnel SSH ouvert depuis le poste ; adresse et clé en variables d'environnement locales, jamais commitées. Si ce n'est pas possible sans publier de port ni sortir Hermes de ses réseaux, s'arrêter et poser la question.
- [x] Procédure d'ouverture de l'accès local décrite dans la documentation.

## Commentaires

### 26.11.2026 — Réalisation (validée le même jour)

**Ce qui a été construit.**
- `compose.yaml` : service `assistant` (profil `assistant`) :
  - image Hermes v0.23.4 épinglée par empreinte (celle vérifiée au ticket 10) ;
  - `mem_limit` de 2 Go (`ASSISTANT_MEM_LIMIT`) ;
  - `/opt/data` en `tmpfs` de 512 Mo (`ASSISTANT_TMPFS_SIZE`) ;
  - `hermes/config.yaml` monté en lecture seule ;
  - aucun port publié.
- Deux réseaux internes, sans Internet :
  - `acta_assistant` relie l'API et Hermes ;
  - `acta-assistant-modele` relie Hermes et Ollama.

  Hermes ne rejoint pas `socle`.
- `hermes/config.yaml` : la configuration essayée au ticket 10, avec les deux réglages retenus (titre de session coupé, journaux en `WARNING`). L'adresse d'Ollama vient de la variable `OLLAMA_URL`.
- Variables `HERMES_URL` et `HERMES_API_KEY` (`.env.example`). Une clé de moins de 32 caractères empêche l'API de démarrer, avec un message clair.
- Règle « assistant installé » écrite dans `shared/src/assistant.ts` et testée : sans adresse ou sans clé, l'assistant est absent. L'API l'expose dans `/api/config` (`assistant: true/false`), le web la lit par `isAssistantInstalled()`. Aucun écran ne l'utilise encore : les tickets suivants s'en serviront.
- `deployer.sh` :
  - Hermes ne redémarre que si sa configuration a changé, car un redémarrage efface ses travaux ;
  - le script attend ensuite que Hermes réponde.
- Sauvegardes : celles d'ACTA ne portent que sur la base (`pg_dump`). Les données de Hermes, en mémoire vive, n'y entrent donc pas.
- Documentation : `INSTALL.md`, § 7 (mise en service, retrait, accès depuis le poste). Script `scripts/ouvrir-acces-assistant.sh`.

**Mise en service sur le serveur (accord de la responsable du 26.11.2026).**
- Hermes a été installé **seul**, sans nouvelle version d'ACTA. L'API de production reste en 1.0.0, sans `HERMES_URL` : rien n'a changé pour les utilisateurs.
- Les fichiers de ce ticket sont dans `/opt/applications/acta-assistant-anticipe`.
- Le `.env` de production a reçu `HERMES_API_KEY` (48 caractères aléatoires) et `OLLAMA_URL`. Une copie de l'ancien fichier est gardée : `.env.avant-assistant`.
- Ollama est branché sur `acta-assistant-modele`. hermes-webui n'a pas été touché.

**Vérifications faites le 26.11.2026 sur le serveur.**

| Point | Résultat |
|---|---|
| Réseaux | `acta_assistant` (Hermes seul tant que l'API 1.0.0 tourne) et `acta-assistant-modele` (Hermes, Ollama), tous deux `internal` |
| Ports publiés | aucun |
| Internet, socle | injoignables depuis Hermes (`example.com`, Keycloak) |
| Ollama | joignable depuis Hermes |
| `/opt/data` | `tmpfs` de 512 Mo ; `config.yaml` en lecture seule |
| Version | Hermes Agent 0.23.4, commit `8fc03744` |
| Clé | sans clé, 401 |
| Outils | les 26 jeux d'outils « non activés » |
| Après une demande | rien de la demande hors du `tmpfs` (`docker diff`) ; rien dans les journaux |

**Validation depuis le poste.**
- Le tunnel SSH relie `127.0.0.1:8642` du poste au conteneur Hermes, par l'hôte du serveur. Le port n'est pas publié et Hermes reste sur ses réseaux.
- Le `.env` local, non versionné, contient `HERMES_URL=http://host.docker.internal:8642` et la clé du serveur.
- `https://acta.localhost/api/config` répond `"assistant": true`. Sans ces variables, il répondait `false`.
- Demande de test depuis le conteneur de l'API locale : « 17 × 23 », sans réflexion, aucune donnée réelle. Réponse « 391 » en 6 s. La session a ensuite été supprimée : réponse 404.
- Le premier tunnel s'est coupé au bout de quelques minutes (« Connection reset »). Le script rouvre maintenant le tunnel tout seul, avec une pause de 20 s pour ménager le pare-feu.

**À savoir.**
- Hermes signale au démarrage que son API est accessible sur le réseau alors que le terminal n'est pas isolé. Ce message est générique : le terminal fait partie des outils coupés.
- Lors du vrai déploiement d'une version qui contient ce ticket :
  - suivre `INSTALL.md` § 7.2 (`COMPOSE_PROFILES=assistant` ; `HERMES_URL` quand l'assistant devra apparaître en production) ;
  - supprimer ensuite `/opt/applications/acta-assistant-anticipe`.
