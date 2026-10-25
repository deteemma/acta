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

## Mettre à jour

Pour chaque nouvelle version : `APPLICATIONS_DIR=/opt/applications ./deployer.sh monappli <version>`.
Si `keycloak/realm.json` a changé dans la version, recopiez-le dans le socle et
réappliquez-le :

```bash
cp /opt/applications/monappli/keycloak/realm.json /opt/socle/keycloak/realms/monappli.json
bash /opt/socle/scripts/appliquer-realm.sh monappli /opt/applications/monappli/.env
```
