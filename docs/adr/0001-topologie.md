# ADR-0001 — Topologie : le serveur est la source de vérité

- **Statut** : accepté
- **Date** : 2026-10-24

## Décision

Le serveur est la source de vérité. Le PC est un client web connecté (pas de réplique locale). Le mobile est une application installée ; si le besoin hors ligne = OUI, il est local-first avec une réplique partielle (voir ADR-0004).

## Conséquences

- Aucune donnée métier n'est stockée durablement par le navigateur.
- Le mode hors ligne n'existe que sur mobile, et seulement si l'application le déclare.
