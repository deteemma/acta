# Consignes pour Claude

La responsable fonctionnelle est Business Analyst et ne code pas : Claude écrit le code.
Elle est la source de vérité fonctionnelle.

## Règles

- **Ne jamais inventer une règle de gestion.** Si une règle manque ou est ambiguë, s'arrêter et poser la question.
- **ADR** : `docs/adr/0001` à `0011` sont non négociables. Ne jamais les modifier de sa propre initiative ; proposer un nouvel ADR (gabarit `0000-modele-adr.md`) et attendre une validation explicite.
- **Langues** : identifiants de code en anglais ; documentation, tickets, messages à l'utilisateur en français. Glossaire dans `CONTEXT.md`.
- **Règles métier, rôles, schémas de validation** : une seule fois, dans `shared/`.
- **Permissions** : toute nouvelle table partagée a ses politiques RLS (migration SQL) ET ses guards NestJS ; étendre `scripts/tester-roles.mjs`.
- **Accès base** : toujours via `DatabaseService.asUser()` (jamais de requête métier hors transaction utilisateur).
- **Socle** : le module ne le connaît que par les variables de `.env` (ADR-0007).

## Commandes

| Besoin | Commande |
|---|---|
| Installer | `pnpm install` |
| Lint / types | `pnpm lint` · `pnpm --filter @app/shared build && pnpm typecheck` |
| Démarrer (Docker, socle démarré) | `docker compose up -d --build` |
| Tester les permissions | `bash scripts/tester-roles.sh` |
| Web en rechargement à chaud | `pnpm dev:web` (http://localhost:5173) |
| Mobile | `pnpm dev:mobile` (lire `mobile/AGENTS.md` avant de toucher au code Expo) |
| Déployer | `./deployer.sh <application> <version>` |

## Démarrage d'une nouvelle application

Lancer le skill personnel `/nouvelle-application`. Pour renommer l'entité
partagée d'exemple : `docs/renommer-entite-partagee.md`.
