# 09: Références et Besoins

**What to build:** L'administration paramètre les acronymes des références ; le BA enregistre les besoins de l'initiative, chacun identifié par une référence lisible (ex. CRM-BE-001), et les relie aux parties prenantes à leur origine et aux actions.

**Blocked by:** 08 — Parties prenantes

**Status:** ready-for-agent

- [ ] L'administrateur paramètre l'acronyme de chaque catégorie d'objet (par défaut BE pour Besoin, EX pour Exigence) ; un changement d'acronyme ne modifie pas les références déjà attribuées.
- [ ] Une référence est de la forme CODE-ACRONYME-NUMÉRO ; le numéro est incrémenté par initiative et par catégorie, et jamais réutilisé, même après suppression.
- [ ] Dès qu'une référence existe dans une initiative, son code d'initiative n'est plus modifiable.
- [ ] Un Besoin porte : référence, titre, description, nature (problème ou opportunité), parties prenantes à l'origine.
- [ ] Une Action peut être liée à des besoins ; la fiche d'un besoin affiche ses actions liées.
- [ ] Un besoin ne peut être supprimé que s'il n'est lié à rien.
- [ ] Les références sont accessibles par la palette Ctrl+K.
- [ ] Toute nouvelle table partagée a ses politiques RLS (migration SQL) et ses guards NestJS ; `scripts/tester-roles.mjs` couvre les deux barrières pour propriétaire, contributeur, lecteur et non-membre.
- [ ] Tous les libellés existent en français et en anglais (ADR-0013).
