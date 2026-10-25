# ADR-0007 — Docker : un module qui rejoint le réseau socle

- **Statut** : accepté
- **Date** : 2026-10-24

## Décision

Cette application est un module qui rejoint le réseau externe `socle`. Services : `api`, `migrations`, et `powersync` sous le profil Compose `mobile-hors-ligne`. Chaque conteneur a un `mem_limit`. Règle d'or : le module ne connaît le socle que par des variables d'environnement (DATABASE_URL, OIDC_ISSUER_URL, PUBLIC_URL, GOOGLE_CLIENT_ID/SECRET, MICROSOFT_CLIENT_ID/SECRET), jamais par des noms de conteneurs.

## Mise en œuvre dans le modèle

- Variables complémentaires : `MIGRATIONS_DATABASE_URL` (compte propriétaire), `OIDC_JWKS_URL` (adresse interne des clés de Keycloak), `POWERSYNC_*`. Toutes sont remplies par le socle dans `.env`.
- L'API s'annonce sur le réseau sous l'alias `<APP_NAME>-api`, que la route Caddy du socle utilise (c'est le socle qui connaît le module, pas l'inverse).
- Limites par défaut : api 384 Mo, migrations 256 Mo, powersync 512 Mo (modifiables dans `.env`).
