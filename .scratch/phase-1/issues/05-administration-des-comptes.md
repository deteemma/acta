# 05: Écrans d'administration des comptes (ADR-0005)

**What to build:** L'administrateur gère les comptes depuis l'application, qui pilote Keycloak. Lorsqu'une initiative n'a plus de propriétaire actif, il y désigne un nouveau propriétaire parmi les membres, sans accéder à son contenu.

**Blocked by:** 02 — Coque de navigation

**Status:** ready-for-agent

- [ ] Seul un utilisateur ayant le rôle administrateur accède aux écrans d'administration.
- [ ] L'administrateur liste les comptes, en crée un, le désactive et le réactive ; un compte n'est jamais supprimé, pour garder la trace des auteurs.
- [ ] L'administrateur voit les initiatives sans propriétaire actif (nom, code, membres), et rien d'autre de leur contenu.
- [ ] Sur une initiative sans propriétaire actif, l'administrateur désigne un nouveau propriétaire parmi les membres ; la désignation est tracée comme au ticket 04.
- [ ] L'administrateur n'a accès au contenu d'aucune initiative dont il n'est pas membre (vérifié sur les deux barrières).
- [ ] Tous les libellés existent en français et en anglais (ADR-0013).
