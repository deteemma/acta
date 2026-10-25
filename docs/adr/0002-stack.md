# ADR-0002 — Stack : TypeScript strict en monorepo

- **Statut** : accepté
- **Date** : 2026-10-24

## Décision

TypeScript strict de bout en bout. Monorepo propre à l'application :

| Dossier | Rôle |
|---|---|
| `api` | NestJS sur l'adaptateur Fastify |
| `web` | React |
| `mobile` | Expo / React Native |
| `shared` | types, schémas de validation, règles métier, rôles |

Une règle métier est écrite une seule fois, dans `shared`.

## Mise en œuvre dans le modèle

- Gestionnaire de paquets : pnpm (workspaces). Web : React + Vite. Validation : Zod.
- NestJS 12 est en modules ES natifs ; `shared` est compilé en ESM et consommé par les trois autres paquets.
- L'image `api` embarque aussi le web compilé et le sert : même origine, aucun service supplémentaire (conforme à ADR-0007).
