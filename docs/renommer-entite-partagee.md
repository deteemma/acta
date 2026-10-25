# Renommer l'entité partagée d'exemple (`project`)

Le modèle est livré avec une entité partagée d'exemple, `project` (« projet »).
Dans la « balle traçante » d'une nouvelle application, on la renomme en
l'ENTITÉ PARTAGÉE réelle (exemple : `folder` / « dossier »). Remplacer à la fois
le singulier, le pluriel et les variantes de casse : `project`, `projects`,
`Project`, `PROJECT_`, `projectId`, `project_member`.

## Liste des endroits à modifier

| Zone | Fichiers |
|---|---|
| Règles et schémas | `shared/src/roles.ts` (`PROJECT_ROLES`, `ProjectRole`, `PROJECT_PERMISSIONS`…), `shared/src/schemas.ts` |
| Base de données | `api/migrations/0001_projets_et_rls.sql` et `0002_publication_powersync.sql` (avant tout déploiement en production : on peut modifier ces fichiers ; sinon, nouvelle migration), `api/src/db/schema.ts` |
| API | dossier `api/src/projects/` (contrôleur, service, guard `RequireProjectRole`), `api/src/app.module.ts` |
| Web | `web/src/App.tsx`, `web/src/api.ts` |
| Mobile | `mobile/src/*.tsx`, `mobile/src/api.ts`, `mobile/src/powersync.ts` (schéma local) |
| Synchronisation | `powersync/powersync.yaml` (règles de synchronisation) |
| Tests | `scripts/tester-roles.mjs` |
| Documentation | `CONTEXT.md` (glossaire). Les ADR ne sont **pas** modifiés. |

## Autres renommages au démarrage

- `mobile/app.json` : `name`, `slug`, `scheme` (= `APP_NAME`, utilisé par le realm pour la redirection).
- `web/index.html` : titre. `web/vite.config.ts` et `mobile/.env.example` : adresse par défaut `https://<app>.localhost`.
- `package.json` racine : `name`. `.env.example` : `IMAGE=ghcr.io/<propriétaire>/<dépôt>`.

## Vérification

1. Réinitialiser la base locale si les migrations 0001/0002 ont été modifiées :
   supprimer puis recréer la base avec `ajouter-application.sh` (voir README).
2. `pnpm lint`, `pnpm typecheck`, `docker compose up -d --build`, `bash scripts/tester-roles.sh`.
3. `grep -ri project` ne doit plus rien trouver hors de `docs/adr/`.
4. `/code-review` pour contrôler la conformité aux ADR.
