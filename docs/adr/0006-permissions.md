# ADR-0006 — Permissions : partage par entité, trois rôles, double barrière

- **Statut** : accepté
- **Date** : 2026-10-24

## Décision

Partage par ENTITÉ PARTAGÉE, avec trois rôles : propriétaire, contributeur, lecteur. Appliqués par des guards NestJS ET par la RLS PostgreSQL.

## Mise en œuvre dans le modèle

- Entité d'exemple : `project` (« projet »), table de partage `project_member`. Elle est renommée au démarrage de chaque application (`docs/renommer-entite-partagee.md`).
- Règles écrites une fois dans `shared/src/roles.ts` : consulter = lecteur, modifier = contributeur, gérer les membres et supprimer = propriétaire.
- Barrière 1 : `@RequireProjectRole(...)` (guard NestJS). Un non-membre reçoit 404, pour ne pas révéler l'existence de l'entité.
- Barrière 2 : politiques RLS de `api/migrations/0001_projets_et_rls.sql`.
- Preuve : `scripts/tester-roles.sh` vérifie les deux barrières.
