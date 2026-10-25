# ADR-0010 — Sauvegardes

- **Statut** : accepté
- **Date** : 2026-10-24

## Décision

`pg_dump` nocturne et chiffré de la base de l'application, conservé 7 jours sur le serveur, récupéré par le PC au démarrage ; sauvegarde automatique avant chaque déploiement ; procédure de restauration documentée dans RESTORE.md. Architecture prête pour la restauration à un instant précis (PITR) : `wal_level=logical`.

## État de mise en œuvre

- En place : sauvegarde avant chaque déploiement (`deployer.sh`) ; `wal_level=logical` dans le socle.
- **Reporté** (décision du 2026-10-24) : sauvegarde nocturne chiffrée, récupération vers le PC, RESTORE.md. Ces éléments relèvent du socle (voir son fichier `docs/a-faire-sauvegardes.md`). Choix déjà validés : chiffrement `age`, clé publique sur le serveur, clé privée conservée hors du serveur.
