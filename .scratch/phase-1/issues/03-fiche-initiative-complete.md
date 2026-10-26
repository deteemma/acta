# 03: Fiche Initiative complète

**What to build:** Le propriétaire et les contributeurs renseignent la fiche complète d'une initiative : nom, code, description, approche d'analyse (prédictive ou adaptative), date de début et date de fin prévue facultatives. Le propriétaire peut archiver l'initiative (elle passe en lecture seule pour tous) ou la supprimer.

**Blocked by:** 02 — Coque de navigation

**Status:** done (à valider par la responsable fonctionnelle)

- [x] La fiche affiche et permet de modifier : nom, description, approche d'analyse, date de début et date de fin prévue (facultatives).
- [x] L'approche d'analyse vaut prédictive ou adaptative (tâche BABOK 3.1) ; en français, son libellé anglais est visible en info-bulle.
- [x] Le code d'initiative est modifiable tant qu'aucune référence n'existe dans l'initiative, et reste unique dans l'application.
- [x] Le propriétaire archive l'initiative : elle passe en lecture seule pour tous ses membres. Seul le propriétaire peut la désarchiver.
- [x] La liste des initiatives distingue les initiatives actives et archivées.
- [x] Le propriétaire peut supprimer l'initiative, après confirmation.
- [x] Toute nouvelle table partagée a ses politiques RLS (migration SQL) et ses guards NestJS ; `scripts/tester-roles.mjs` couvre les deux barrières pour propriétaire, contributeur, lecteur et non-membre.
- [x] Tous les libellés existent en français et en anglais (ADR-0013).

Précisions de la responsable fonctionnelle (26.10.2026) :
- Approche d'analyse : facultative ; vide (« Non renseignée ») après la création rapide, qui reste limitée au code et au nom.
- Code d'initiative : modifiable par le propriétaire seul.
- Description : facultative, texte libre sans mise en forme, 4 000 caractères au plus.
- Dates : si les deux sont renseignées, la fin prévue est le même jour que le début ou après.
- Initiative archivée : plus aucune modification (fiche, membres) ; le propriétaire peut seulement la désarchiver ou la supprimer.
- La fiche affiche la date d'archivage ; l'auteur de l'archivage est enregistré sans être affiché.
- Liste : les actives d'abord, puis une section « Archivées » repliée par défaut.
- Palette : les archivées sont proposées après les actives, avec la mention « Archivée ».

Points en suspens :
- Code figé dès qu'une référence existe : les références n'existent pas encore ; le blocage est à ajouter au ticket 09 (repère dans `initiatives.service.ts`).
- Mobile : l'application Expo ne synchronise pas encore l'archivage ni les nouveaux champs ; une modification hors ligne d'une initiative archivée est refusée à la synchronisation. À traiter au ticket 17.
