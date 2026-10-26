# 03: Fiche Initiative complète

**What to build:** Le propriétaire et les contributeurs renseignent la fiche complète d'une initiative : nom, code, description, approche d'analyse (prédictive ou adaptative), date de début et date de fin prévue facultatives. Le propriétaire peut archiver l'initiative (elle passe en lecture seule pour tous) ou la supprimer.

**Blocked by:** 02 — Coque de navigation

**Status:** ready-for-agent

- [ ] La fiche affiche et permet de modifier : nom, description, approche d'analyse, date de début et date de fin prévue (facultatives).
- [ ] L'approche d'analyse vaut prédictive ou adaptative (tâche BABOK 3.1) ; en français, son libellé anglais est visible en info-bulle.
- [ ] Le code d'initiative est modifiable tant qu'aucune référence n'existe dans l'initiative, et reste unique dans l'application.
- [ ] Le propriétaire archive l'initiative : elle passe en lecture seule pour tous ses membres. Seul le propriétaire peut la désarchiver.
- [ ] La liste des initiatives distingue les initiatives actives et archivées.
- [ ] Le propriétaire peut supprimer l'initiative, après confirmation.
- [ ] Toute nouvelle table partagée a ses politiques RLS (migration SQL) et ses guards NestJS ; `scripts/tester-roles.mjs` couvre les deux barrières pour propriétaire, contributeur, lecteur et non-membre.
- [ ] Tous les libellés existent en français et en anglais (ADR-0013).
