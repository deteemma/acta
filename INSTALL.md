# Installation de l'application (paquet complet)

Ce document installe **cette application** sur un serveur où le **socle** est déjà
installé (voir le `INSTALL.md` du dépôt `socle`). Dans les exemples, l'application
s'appelle `monappli` et le domaine est `exemple.ch` : remplacez-les par les vôtres.

## 1. Récupérer les fichiers de déploiement

Sur le serveur :

```bash
sudo mkdir -p /opt/applications && sudo chown "$USER" /opt/applications
cd /opt/applications
git clone https://github.com/<propriétaire>/<dépôt>.git monappli
```

Le dépôt est privé : utilisez un jeton GitHub (*fine-grained token*, lecture seule
sur ce dépôt) comme mot de passe lors du `git clone`.

## 2. Autoriser le téléchargement des images (GHCR)

Créez sur GitHub un jeton classique (*Settings › Developer settings › Personal
access tokens › Tokens (classic)*) avec la seule permission `read:packages`, puis :

```bash
docker login ghcr.io -u <votre-compte-github>
# mot de passe : le jeton
```

## 3. Enregistrer l'application dans le socle

```bash
cd /opt/socle
bash scripts/ajouter-application.sh monappli /opt/applications/monappli
# ajouter --hors-ligne si l'application a un mobile hors ligne
# NE PAS utiliser --comptes-test en production
```

Le script crée la base et ses comptes, la route `https://monappli.exemple.ch`,
le realm Keycloak, et remplit `/opt/applications/monappli/.env`.

## 4. Déployer une version

```bash
cd /opt/applications/monappli
APPLICATIONS_DIR=/opt/applications ./deployer.sh monappli 1.0.0
```

Le script sauvegarde la base, applique les migrations, démarre les conteneurs et
attend que l'API réponde.

## 5. Créer le premier administrateur

Dans la console Keycloak (`https://auth.exemple.ch`, compte `admin` du socle) :
realm `monappli` › *Users* › *Add user* (renseigner nom, prénom, e-mail), onglet
*Credentials* › *Set password*, onglet *Role mapping* › *Assign role* ›
`administrateur`.

## 6. Connexion avec Google et Microsoft (facultatif)

Chaque fournisseur demande de créer une « application OAuth ». Adresses de retour
à déclarer (une par fournisseur) :

| Fournisseur | Adresse de retour (*redirect URI*) |
|---|---|
| Google | `https://auth.exemple.ch/realms/monappli/broker/google/endpoint` |
| Microsoft | `https://auth.exemple.ch/realms/monappli/broker/microsoft/endpoint` |

### 6.1 Google

1. Ouvrez https://console.cloud.google.com et connectez-vous avec un compte Google.
2. En haut, sélecteur de projet › **Nouveau projet** › nom `monappli` › **Créer**, puis sélectionnez-le.
3. Menu › **API et services** › **Écran de consentement OAuth** (ou *Google Auth Platform*) › **Commencer** :
   - nom de l'application, e-mail d'assistance ;
   - audience : **Externe** ;
   - coordonnées du développeur : votre e-mail › **Créer**.
4. **Accès aux données** › **Ajouter des champs d'application** : cochez `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` › **Mettre à jour** › **Enregistrer**.
5. **Clients** › **Créer un client** :
   - type : **Application Web** ;
   - nom : `Keycloak monappli` ;
   - **URI de redirection autorisés** › ajoutez l'adresse de retour Google ci-dessus › **Créer**.
6. Copiez l'**ID client** et le **Code secret du client**.
7. **Audience** › **Publier l'application** : sans cette étape, seuls les comptes déclarés comme testeurs peuvent se connecter.

### 6.2 Microsoft

1. Ouvrez https://portal.azure.com et connectez-vous (un compte Microsoft gratuit suffit).
2. Recherchez **Microsoft Entra ID** › **Inscriptions d'applications** › **Nouvelle inscription** :
   - nom : `Keycloak monappli` ;
   - types de comptes : **Comptes dans un annuaire organisationnel et comptes Microsoft personnels** ;
   - URI de redirection : plateforme **Web**, adresse de retour Microsoft ci-dessus › **S'inscrire**.
3. Sur la page de l'application, copiez l'**ID d'application (client)**.
4. **Certificats et secrets** › **Nouveau secret client** › description `keycloak`, expiration 24 mois › **Ajouter**.
5. Copiez immédiatement la colonne **Valeur** (pas « ID du secret ») : elle ne sera plus affichée.
6. Notez la date d'expiration dans votre agenda : il faudra créer un nouveau secret avant cette date.

### 6.3 Activer les boutons

Dans `/opt/applications/monappli/.env`, renseignez :

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
```

puis réappliquez le realm :

```bash
bash /opt/socle/scripts/appliquer-realm.sh monappli /opt/applications/monappli/.env
```

Les boutons « Google » et « Microsoft » apparaissent sur la page de connexion.
Un fournisseur dont l'identifiant reste vide est désactivé.

## 7. Assistant (facultatif)

L'assistant utilise une instance **Hermes Agent** réservée à l'application
(service `assistant`, profil Compose `assistant`) et le modèle d'un conteneur
**Ollama** déjà installé sur le serveur, hors de l'application (ADR-0022,
ADR-0023). Sans adresse ou sans clé de Hermes, l'assistant n'apparaît pas et le
reste de l'application fonctionne normalement.

Ce que l'installation garantit :

- Hermes n'a ni port publié, ni nom de domaine, ni accès à Internet, et ne
  rejoint pas le réseau `socle`. Il est sur deux réseaux internes :
  - `monappli_assistant` : l'API et Hermes, rien d'autre ;
  - `monappli-assistant-modele` : Hermes et Ollama.
- Sa configuration est `hermes/config.yaml` : aucun outil, ni mémoire, ni skill
  écrit par Hermes, ni révision automatique, ni titre de session ; journaux
  limités aux avertissements. `deployer.sh` la déploie avec la version.
- Ses données sont en mémoire vive (`tmpfs`) : rien n'est écrit sur disque ni
  sauvegardé. **Un redémarrage de Hermes efface ses travaux en cours** : les
  demandes concernées deviennent « Échouée, assistant indisponible ».

### 7.1 Prérequis

- Ollama tourne dans un conteneur nommé `ollama`, avec le modèle `qwen3.5:9b` et
  une taille de contexte d'au moins 64 000 tokens.
- Mémoire libre : 2 Go pour Hermes (réglage `ASSISTANT_MEM_LIMIT`, qui inclut les
  512 Mo de `ASSISTANT_TMPFS_SIZE`).

### 7.2 Mise en service

Dans `/opt/applications/monappli/.env` :

```bash
cd /opt/applications/monappli
# Clé aléatoire de 48 caractères, jamais recopiée ailleurs que dans ce fichier
echo "HERMES_API_KEY=$(openssl rand -hex 24)" >> .env
```

puis, avec un éditeur, compléter ou modifier :

```
COMPOSE_PROFILES=assistant            # ou mobile-hors-ligne,assistant
HERMES_URL=http://assistant:8642
OLLAMA_URL=http://ollama:11434
```

Déployer la version (§ 4), puis brancher Ollama sur le réseau interne de
l'application et vérifier :

```bash
APPLICATIONS_DIR=/opt/applications ./deployer.sh monappli <version>
docker network connect monappli-assistant-modele ollama
docker compose exec assistant curl -s -o /dev/null -w "%{http_code}\n" http://ollama:11434/api/tags  # 200
docker compose exec assistant curl -s -m 5 -o /dev/null -w "%{http_code}\n" https://example.com      # 000 : pas d'Internet
docker compose exec api wget -qO- http://assistant:8642/health                                        # {"status": "ok"...}
```

Le branchement d'Ollama se garde après un redémarrage du serveur. Il est à
refaire seulement si le réseau `monappli-assistant-modele` a été supprimé (par
exemple après un `docker compose down`).

### 7.3 Retirer l'assistant

Vider `HERMES_URL` dans `.env`, retirer `assistant` de `COMPOSE_PROFILES`, puis :

```bash
docker compose stop assistant && docker compose rm -f assistant
docker network disconnect monappli-assistant-modele ollama
docker compose up -d api
```

### 7.4 Accès depuis le poste de développement

Pour essayer l'assistant sur `https://monappli.localhost` avec l'instance Hermes
du serveur, sans publier de port de Hermes : un tunnel SSH, ouvert depuis le
poste, relie un port local au conteneur Hermes en passant par l'hôte du serveur.

1. Dans le `.env` **local** (jamais versionné), ajouter :

   ```
   HERMES_URL=http://host.docker.internal:8642
   HERMES_API_KEY=<la valeur de HERMES_API_KEY du .env du serveur>
   ```

   Ne pas ajouter `assistant` à `COMPOSE_PROFILES` en local : aucune instance
   Hermes ne tourne sur le poste.

2. Ouvrir le tunnel dans un terminal Git Bash, et le laisser ouvert :

   ```bash
   bash scripts/ouvrir-acces-assistant.sh vps   # « vps » : alias SSH du serveur
   ```

   Le script lit l'adresse du conteneur Hermes sur le serveur (elle change à
   chaque redémarrage de Hermes : relancer alors le script).

3. Redémarrer l'API locale : `docker compose up -d api`.

4. Vérifier depuis le conteneur de l'API :

   ```bash
   docker compose exec api wget -qO- http://host.docker.internal:8642/health
   ```

Fermer le tunnel (Ctrl+C) coupe l'accès : les demandes restent alors « En
attente, assistant momentanément indisponible ». Pour revenir à une application
sans assistant, vider `HERMES_URL` dans le `.env` local et redémarrer l'API.

## Mettre à jour

Pour chaque nouvelle version : `APPLICATIONS_DIR=/opt/applications ./deployer.sh monappli <version>`.
Si `keycloak/realm.json` a changé dans la version, recopiez-le dans le socle et
réappliquez-le (à la première application, le script ajoute aussi au `.env` le
secret du compte technique `api-admin`, qui sert aux écrans d'administration des
comptes ; redémarrez alors l'application) :

```bash
cp /opt/applications/monappli/keycloak/realm.json /opt/socle/keycloak/realms/monappli.json
bash /opt/socle/scripts/appliquer-realm.sh monappli /opt/applications/monappli/.env
```
