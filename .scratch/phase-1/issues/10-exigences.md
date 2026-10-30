# 10: Exigences

**What to build:** Le BA formalise les exigences de l'initiative selon les types du BABOK, les relie aux besoins et aux parties prenantes, et suit leur cycle de vie ; toute modification est historisée.

**Blocked by:** 09 — Références et Besoins

**Status:** ready-for-agent

- [ ] Une Exigence porte : référence (ex. CRM-EX-012), titre, énoncé, type (métier, partie prenante, solution, transition), sous-type fonctionnelle ou non fonctionnelle pour le type solution, statut, sources (parties prenantes), besoins liés, exigence parente.
- [ ] Une exigence est liée à au moins un besoin ou à une exigence parente.
- [ ] Statuts : Proposée, Vérifiée, Validée, Approuvée, Différée, Rejetée ; tout contributeur passe librement d'un statut à un autre.
- [ ] L'historique complet des modifications (qui, quand, quoi, y compris les changements de statut) est conservé et consultable.
- [ ] Aucune priorité en phase 1.
- [ ] Une Action peut être liée à des exigences ; la fiche d'une exigence affiche ses actions liées.
- [ ] Toute référence citée dans un texte s'affiche avec un aperçu au survol.
- [ ] Une exigence ne peut être supprimée que si elle n'est liée à rien.
- [ ] Toute nouvelle table partagée a ses politiques RLS (migration SQL) et ses guards NestJS ; `scripts/tester-roles.mjs` couvre les deux barrières pour propriétaire, contributeur, lecteur et non-membre.
- [ ] Tous les libellés existent en français et en anglais (ADR-0013).
