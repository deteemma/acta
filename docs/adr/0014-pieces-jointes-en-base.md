# ADR-0014 — Pièces jointes stockées dans PostgreSQL

- **Statut** : accepté
- **Date** : 2026-10-26

## Contexte

À partir de la phase 2, les tickets et les pages acceptent des pièces jointes. Le socle ne fournit que Caddy, PostgreSQL et Keycloak : aucun service de stockage de fichiers. Options envisagées : ajouter un stockage objet (type S3) au socle ; un volume Docker propre au module ; la base PostgreSQL de l'application.

## Décision

Les pièces jointes sont stockées dans la base PostgreSQL de l'application, dans des tables soumises à la RLS comme le reste des données de l'initiative. Taille maximale : 10 Mo par fichier.

## Conséquences

- Les pièces jointes sont sauvegardées et restaurées avec la base (ADR-0010) et protégées par les mêmes droits (ADR-0006), sans nouveau service (ADR-0007).
- La base et ses sauvegardes grossissent avec les fichiers : surveiller leur volume. Si le besoin dépasse ce cadre, proposer un nouvel ADR (stockage objet).
