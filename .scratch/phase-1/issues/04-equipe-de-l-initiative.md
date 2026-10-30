# 04: Équipe de l'initiative (ADR-0015)

**What to build:** Les membres d'une initiative gèrent son équipe selon le principe de subsidiarité de l'ADR-0015 : inviter un membre et lui donner un rôle, marquer les BA de l'équipe, transmettre ou désigner un propriétaire. Une initiative a toujours au moins un propriétaire et au moins un BA de l'équipe.

**Blocked by:** 02 — Coque de navigation

**Status:** done (validé par la responsable fonctionnelle le 29.10.2026)

- [x] Le propriétaire invite un utilisateur (connecté au moins une fois) par son e-mail, avec un rôle ; il change le rôle d'un membre et retire un membre.
- [x] Tout propriétaire et tout BA de l'équipe peut attribuer ou retirer l'indication « BA de l'équipe » à un autre membre propriétaire ou contributeur ; un lecteur ne peut pas la porter.
- [x] Le dernier BA de l'équipe ne peut pas se retirer l'indication.
- [x] Faire passer un BA de l'équipe au rôle de lecteur exige de lui retirer d'abord l'indication.
- [x] Un propriétaire peut transmettre la propriété : nommer un autre membre propriétaire, puis se retirer.
- [x] Tout BA de l'équipe peut, à tout moment, désigner un nouveau propriétaire parmi les membres, y compris lui-même ; il ne peut ni retirer ni rétrograder un propriétaire existant.
- [x] Le dernier propriétaire ne peut ni quitter l'initiative, ni être retiré ou rétrogradé.
- [x] Chaque désignation de propriétaire est tracée (qui, quand, au profit de qui) et consultable par les membres.
- [x] Toute nouvelle table partagée a ses politiques RLS (migration SQL) et ses guards NestJS ; `scripts/tester-roles.mjs` couvre les deux barrières pour propriétaire, contributeur, lecteur et non-membre.
- [x] Tous les libellés existent en français et en anglais (ADR-0013).

Précisions de la responsable fonctionnelle (26.10.2026) :
- « Se retirer » : tout membre (propriétaire, contributeur, lecteur) peut quitter l'initiative de lui-même, sauf le dernier propriétaire et le dernier BA de l'équipe. Un propriétaire peut aussi se rétrograder lui-même, s'il n'est pas le dernier.
- Indication « BA de l'équipe » sur soi-même : un BA peut se la retirer (sauf le dernier) ; un propriétaire ne peut pas se l'attribuer lui-même.
- Trace : tout passage au rôle de propriétaire est tracé (invitation comme propriétaire, changement de rôle, désignation par un BA), y compris la création de l'initiative. Les initiatives existantes reçoivent la trace de leur création.
- Invitation : e-mail, rôle et, au choix, l'indication « BA de l'équipe » (pas pour un lecteur).
- Initiative archivée (29.10.2026, après revue) : tout membre peut encore la quitter (mêmes limites : dernier propriétaire, dernier BA). Exception à la lecture seule du ticket 03 ; aucun autre changement de l'équipe.

Points en suspens :
- Désignation par l'administrateur quand aucun propriétaire actif ne reste : ticket 05 (la trace la prendra en compte automatiquement).
- Mobile : l'application Expo affiche les rôles synchronisés mais ne gère pas l'équipe. À traiter au ticket 17 si besoin.
