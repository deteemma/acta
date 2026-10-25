# ADR-0008 — Installation chez un tiers

- **Statut** : accepté
- **Date** : 2026-10-24

## Décision

Conçue pour deux modes (paquet complet ou intégration dans son infrastructure), mais seul le paquet complet est documenté, dans INSTALL.md, y compris la création pas à pas des applications OAuth Google et Microsoft.

## Mise en œuvre dans le modèle

- Le socle a son propre `INSTALL.md` (serveur, DNS, socle).
- Le `INSTALL.md` de l'application couvre l'enregistrement auprès du socle, le déploiement et la création des applications OAuth Google et Microsoft.
