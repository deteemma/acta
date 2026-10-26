# 08: Parties prenantes

**What to build:** Le BA tient la liste des parties prenantes d'une initiative et les positionne sur la matrice influence × intérêt. Une fiche peut être reliée au compte de l'utilisateur correspondant ; une Action peut être liée à des parties prenantes.

**Blocked by:** 07 — Actions et « Mes actions »

**Status:** ready-for-agent

- [ ] Une fiche porte : nom, nature (personne, groupe, organisation), un ou plusieurs rôles BABOK parmi les 11 (§2.4), influence et intérêt (faible, moyen, fort), coordonnées (texte libre), notes.
- [ ] Une fiche peut être reliée à un compte utilisateur ; un utilisateur est relié à au plus une fiche par initiative, et peut l'être dans plusieurs initiatives.
- [ ] La liste des parties prenantes et la matrice influence × intérêt sont consultables ; un clic sur une partie prenante ouvre sa fiche en panneau.
- [ ] Une Action peut être liée à une ou plusieurs parties prenantes ; la fiche d'une partie prenante affiche ses actions liées.
- [ ] Une partie prenante ne peut être supprimée que si elle n'est liée à rien.
- [ ] Toute nouvelle table partagée a ses politiques RLS (migration SQL) et ses guards NestJS ; `scripts/tester-roles.mjs` couvre les deux barrières pour propriétaire, contributeur, lecteur et non-membre.
- [ ] Tous les libellés existent en français et en anglais (ADR-0013).
