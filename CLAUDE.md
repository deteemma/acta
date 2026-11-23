# Consignes pour Claude

La responsable fonctionnelle est Business Analyst et ne code pas : Claude écrit le code.
Elle est la source de vérité fonctionnelle.

## Règles

- **Ne jamais inventer une règle de gestion.** Si une règle manque ou est ambiguë, s'arrêter et poser la question.
- **ADR** : `docs/adr/0001` à `0011` sont non négociables. Ne jamais les modifier de sa propre initiative ; proposer un nouvel ADR (gabarit `0000-modele-adr.md`) et attendre une validation explicite.
- **Français pour tout message à la responsable**, comptes rendus de fin de ticket, PR et déploiement compris (un hook `Stop` le vérifie). Documentation et tickets aussi en français.
- **Identifiants de code en anglais.** Glossaire dans `CONTEXT.md`.
- **Normes de code** (règles métier dans `shared/`, permissions, accès base, socle) : `CODING_STANDARDS.md`.
- **Nouvelle entité d'une initiative** : suivre `docs/ajouter-entite-partagee.md`.
- **Modifier un fichier** : outil Edit ou Write, plusieurs appels Edit dans une même réponse pour plusieurs changements (un hook refuse `python -` et `cat > fichier <<`). Un script qui n'édite pas le dépôt s'écrit d'abord dans le scratchpad avec Write, puis s'exécute.

## Commandes

Outil Bash (Git Bash) par défaut ; la construction Docker seule passe par l'outil PowerShell.

| Besoin | Commande |
|---|---|
| Installer | `pnpm install` |
| Lint (+ RLS des migrations) / types | `pnpm lint` · `pnpm --filter @app/shared build && pnpm typecheck` |
| Démarrer (Docker, socle démarré) | **outil PowerShell** : `docker compose up -d --build` |
| Tester les permissions | `bash scripts/tester-roles.sh 2>&1 \| tail -20` (échecs récapitulés à la fin ; une section par fichier dans `scripts/roles/`) |
| Lire la base locale (diagnostic) | `bash scripts/sql.sh "SELECT …"` (lecture seule, toutes les lignes) |
| Web en rechargement à chaud | `pnpm dev:web` (http://localhost:5173) |
| Mobile | `pnpm dev:mobile` (lire `mobile/AGENTS.md` avant de toucher au code Expo) |
| Déployer | `./deployer.sh <application> <version>` |

Un hook pre-commit (`.husky/pre-commit`) relance les vérifications de la CI.

## Démarrage d'une nouvelle application

Lancer le skill personnel `/nouvelle-application`. Pour renommer l'entité
partagée d'exemple : `docs/renommer-entite-partagee.md`.

## Agent skills

### Issue tracker

Tickets en fichiers markdown dans `.scratch/<sujet>/issues/`, pas dans GitHub Issues. Voir `docs/agents/issue-tracker.md`.

### Triage labels

Les cinq statuts par défaut (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), dans la ligne `**Status:**` du ticket. Voir `docs/agents/triage-labels.md`.

### Domain docs

Un seul contexte : glossaire `CONTEXT.md` (à la place de `GLOSSARY.md`) et `docs/adr/`. Voir `docs/agents/domain.md`.
