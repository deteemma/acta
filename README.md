# Modèle d'application

Dépôt modèle (*GitHub template repository*) de la famille d'applications. Chaque
nouvelle application est créée à partir de lui (bouton « Use this template »),
puis démarrée avec le skill personnel `/nouvelle-application`.

Il contient le squelette conforme aux décisions d'architecture
[ADR-0001 à ADR-0011](docs/adr/), une entité partagée d'exemple (`project`)
fonctionnelle de bout en bout, et les skills de Matt Pocock (`.claude/skills/`),
hérités par chaque application.

## Contenu

| Dossier | Rôle |
|---|---|
| `shared/` | rôles, règles métier, schémas de validation (écrits une seule fois) |
| `api/` | NestJS + Fastify : jetons OIDC, guards de rôles, RLS, migrations SQL ; sert aussi le web |
| `web/` | React + Vite, connexion Keycloak |
| `mobile/` | Expo ; mode hors ligne PowerSync en option |
| `keycloak/` | realm de l'application (`realm.json`) et comptes de test locaux |
| `powersync/` | configuration PowerSync (profil `mobile-hors-ligne`) |
| `scripts/` | test de bout en bout des permissions |
| `deployer.sh` | déploiement : sauvegarde, migrations, démarrage |

## Démarrer en local (PC, Docker Desktop)

Prérequis : le [socle](../socle) démarré, Node 24 et pnpm.

```bash
# 1. Enregistrer l'application dans le socle (base, route, realm, .env)
cd ../socle
bash scripts/ajouter-application.sh modele ../modele-application --comptes-test
#    ajouter --hors-ligne pour le mobile hors ligne (PowerSync)

# 2. Construire et démarrer
cd ../modele-application
docker compose up -d --build

# 3. Vérifier les permissions (API + RLS)
bash scripts/tester-roles.sh
```

Ouvrir https://modele.localhost et se connecter avec `alice` / `Test1234!`
(autres comptes de test : `bruno`, `chloe`, `admin`).

## Développement

```bash
pnpm install
pnpm --filter @app/shared build
pnpm lint && pnpm typecheck
pnpm dev:web      # http://localhost:5173, /api relayé vers https://modele.localhost
pnpm dev:mobile   # Expo
```

### Mobile

- Copier `mobile/.env.example` en `mobile/.env`.
- **Mode connecté** : fonctionne dans Expo Go. Le téléphone doit joindre
  l'adresse publique de l'application : `*.localhost` n'est joignable que depuis
  le PC, donc il faut un serveur réel ou un tunnel.
- **Mode hors ligne** (`EXPO_PUBLIC_HORS_LIGNE=true`) : PowerSync utilise un module
  natif ; il faut un *development build* (`npx expo run:android`) au lieu d'Expo Go.

## Publier et déployer

1. Étiqueter une version : `git tag v1.0.0 && git push --tags`. GitHub Actions
   vérifie le code, puis publie l'image `ghcr.io/<propriétaire>/<dépôt>:1.0.0`.
2. Sur le serveur : `./deployer.sh <application> 1.0.0` (voir [INSTALL.md](INSTALL.md)).

## Restaurer la sauvegarde d'avant déploiement

`deployer.sh` sauvegarde la base dans `sauvegardes/` avant les migrations. Pour
revenir à cet état (en cas de migration défaillante) :

```bash
docker compose stop api
docker run --rm -i --network socle -e URL="<MIGRATIONS_DATABASE_URL du .env>" \
  postgres:17.11-alpine sh -c 'pg_restore --clean --if-exists --no-owner -d "$URL"' \
  < sauvegardes/<fichier>.dump
./deployer.sh <application> <version précédente>
```

La procédure complète de restauration des sauvegardes nocturnes viendra avec le
chantier « Sauvegardes » du socle.
