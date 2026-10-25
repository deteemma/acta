# ADR-0011 — Exécution locale identique à la production

- **Statut** : accepté
- **Date** : 2026-10-24

## Décision

Exécution locale sur le PC, avec Docker Desktop et exactement les mêmes fichiers Compose que la production.

## Mise en œuvre dans le modèle

- Sur le PC, le socle tourne avec `DOMAINE=localhost` : `https://<app>.localhost` et `https://auth.localhost`, certificats émis par l'autorité locale de Caddy.
- Seul le contenu des fichiers `.env` diffère entre le PC et la production.
