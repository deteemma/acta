# 07: Actions et « Mes actions »

**What to build:** Un BA crée une Action sur une initiative, toujours rattachée à une tâche BABOK, et la suit jusqu'à son terme. L'écran d'accueil « Mes actions » regroupe toutes ses actions, toutes initiatives confondues ; le bouton flottant « + Action » permet une création rapide depuis n'importe quel écran.

**Blocked by:** 03 — Fiche Initiative complète ; 06 — Référentiel BABOK

**Status:** ready-for-agent

- [ ] Une Action porte : titre, description (texte mis en forme, qui accueille aussi les comptes rendus d'élicitation), tâche BABOK (obligatoire), technique (facultative, parmi les 50), responsable (un membre de l'initiative), échéance (facultative), statut.
- [ ] Statuts : À faire, En cours, Terminée, Annulée.
- [ ] Une Action peut être supprimée tant qu'elle n'est liée à rien ; sinon, on utilise le statut Annulée.
- [ ] « Mes actions » est l'écran d'accueil : toutes les actions dont je suis responsable, toutes initiatives confondues, filtrables par statut et par initiative, triées par échéance.
- [ ] Le bouton flottant « + Action » ouvre une création rapide (initiative, titre, tâche BABOK) depuis tout écran.
- [ ] Une Action s'ouvre dans un panneau latéral ; sa tâche et sa technique s'affichent avec un aperçu au survol.
- [ ] La date de création et la date de dernière modification sont conservées, avec leur auteur.
- [ ] Toute nouvelle table partagée a ses politiques RLS (migration SQL) et ses guards NestJS ; `scripts/tester-roles.mjs` couvre les deux barrières pour propriétaire, contributeur, lecteur et non-membre.
- [ ] Tous les libellés existent en français et en anglais (ADR-0013).
