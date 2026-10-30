# Consignes pour Claude

La responsable fonctionnelle est Business Analyst et ne code pas : Claude écrit le code.
Elle est la source de vérité fonctionnelle.

## Règles

- **Ne jamais inventer une règle de gestion.** Si une règle manque ou est ambiguë, s'arrêter et poser la question.
- **ADR** : `docs/adr/0001` à `0011` sont non négociables. Ne jamais les modifier de sa propre initiative ; proposer un nouvel ADR (gabarit `0000-modele-adr.md`) et attendre une validation explicite.
- **Langues** : identifiants de code en anglais ; documentation, tickets, messages à l'utilisateur en français. Glossaire dans `CONTEXT.md`.
- **Normes de code** (règles métier dans `shared/`, permissions, accès base, socle) : `CODING_STANDARDS.md`.
- **Nouvelle entité d'une initiative** : suivre `docs/ajouter-entite-partagee.md`.
- **Modifier un fichier** : outil Edit ou Write. Un script de plus de quelques lignes s'écrit d'abord dans le scratchpad avec Write, puis s'exécute : sous Git Bash, les longs heredocs à apostrophes échouent.

## Commandes

| Besoin | Commande |
|---|---|
| Installer | `pnpm install` |
| Lint (+ RLS des migrations) / types | `pnpm lint` · `pnpm --filter @app/shared build && pnpm typecheck` |
| Démarrer (Docker, socle démarré) | `docker compose up -d --build` |
| Tester les permissions | `bash scripts/tester-roles.sh` (une section par fichier dans `scripts/roles/`) |
| Web en rechargement à chaud | `pnpm dev:web` (http://localhost:5173) |
| Mobile | `pnpm dev:mobile` (lire `mobile/AGENTS.md` avant de toucher au code Expo) |
| Déployer | `./deployer.sh <application> <version>` |

Un hook pre-commit (`.husky/pre-commit`) relance les vérifications de la CI.

## Démarrage d'une nouvelle application

Lancer le skill personnel `/nouvelle-application`. Pour renommer l'entité
partagée d'exemple : `docs/renommer-entite-partagee.md`.
