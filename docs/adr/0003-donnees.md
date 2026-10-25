# ADR-0003 — Données : PostgreSQL, base dédiée, migrations, RLS

- **Statut** : accepté
- **Date** : 2026-10-24

## Décision

PostgreSQL ≥ 14, une base dédiée à cette application sur l'instance du socle. Migrations exécutées par un conteneur dédié `migrations`. La Row Level Security (RLS) applique les rôles au niveau de la base, en double barrière avec l'API.

## Mise en œuvre dans le modèle

- Deux comptes PostgreSQL, créés par le socle (`ajouter-application.sh`) :
  - `<app>_owner`, propriétaire de la base, utilisé **uniquement** par les migrations ;
  - `<app>_app`, sans privilèges, utilisé par l'API : il est soumis à la RLS.
- Migrations : fichiers SQL versionnés dans `api/migrations/`, appliqués dans l'ordre par `api/src/migrations/run.ts`, chacun dans sa transaction.
- Requêtes typées avec Kysely. Toute requête métier passe par `DatabaseService.asUser()`, qui transmet l'utilisateur courant à PostgreSQL (`set_config('app.user_id', …)`) pour la durée de la transaction ; les politiques RLS s'en servent.
