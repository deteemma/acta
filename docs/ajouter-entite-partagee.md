# Ajouter une entité d'une initiative

Liste des endroits touchés par une nouvelle entité rattachée à une initiative
(partie prenante, besoin, exigence…). Elle reprend les tickets 08 à 10 :
`git show --stat dbdbf3c` (ticket 10, exigences) en est l'exemple complet le
plus récent. Exemple ci-dessous : `requirement` / « exigence ».

## Liste, dans l'ordre

| Étape | Fichiers | À faire |
|---|---|---|
| Règles partagées (TDD) | `shared/src/<entités>.ts` + `.test.ts`, `shared/src/index.ts` | Schémas zod de création et de modification, DTO, `<ENTITÉ>_REFUSALS` et `is<Entité>Refusal`. |
| Droits | `shared/src/roles.ts` + `roles.test.ts` | Permission `edit<Entités>` dans la table des permissions. |
| Libellés | `shared/src/i18n.ts` | Clés dans le bloc `fr` **et** dans le bloc `en` ; le typage (`Record<MessageKey, string>`) refuse une clé anglaise manquante. Clés de refus : `<entité>.refusal.<refus>`. |
| Base | `api/migrations/00NN_<nom_en_francais>.sql` | Tables, `ENABLE ROW LEVEL SECURITY` et politiques par table (`pnpm lint` refuse une table sans RLS), déclencheurs. Tables de liens `<a>_<b>` avec leurs propres politiques. |
| Types Kysely | `api/src/db/schema.ts` | Une interface par table, ajoutée à `Database`. |
| API | `api/src/<entités>/<entités>.controller.ts` et `.service.ts`, `api/src/app.module.ts` | Contrôleur sous `initiatives/:initiativeId/<entités>`, chaque route avec `@RequireInitiativeRole(...)` ; service par `this.database.asUser(...)`. |
| Entités liées | services et `shared/src/<autre>.ts` des entités reliées (actions, besoins…) | Liens dans les DTO, refus de suppression d'un objet encore lié. |
| Client web | `web/src/api.ts`, `web/src/errors.tsx` | Appels de l'API ; `is<Entité>Refusal` → clé `<entité>.refusal.*`. |
| Panneaux | `web/src/<entité>-panels.tsx`, `web/src/panels.tsx` | Liste et fiche ; nouveau `kind` dans `PanelContent`. |
| Shell | `web/src/App.tsx` | Compteur `<entités>Version` et `<entités>Changed`, transmis aux panneaux qui affichent l'entité. |
| Recherche, références | `web/src/palette.tsx`, `shared/src/references.ts` (`REFERENCE_CATEGORIES`) | Seulement si l'entité porte une référence (`CODE-ACRONYME-NUMÉRO`). |
| Fiches liées | `web/src/initiative-panels.tsx` et panneaux des entités reliées | Section ou liste des objets liés. |
| Permissions de bout en bout | `scripts/roles/NN-<entités>.mjs`, liste `SECTIONS` et nettoyage de `scripts/tester-roles.mjs` | Barrière 1 (API) et barrière 2 (base), pour propriétaire, contributeur, lecteur, non-membre et initiative archivée. |
| Glossaire | `CONTEXT.md` | Le terme et sa définition. Les ADR ne sont pas modifiés. |

Mobile (`mobile/`) et synchronisation (`powersync/`) : seulement si le ticket
le demande ; les tickets 08 à 10 n'y ont pas touché.

## Vérification

`pnpm --filter @app/shared build && pnpm typecheck`, `pnpm lint`, `pnpm test`,
puis `docker compose up -d --build` et `bash scripts/tester-roles.sh`.
