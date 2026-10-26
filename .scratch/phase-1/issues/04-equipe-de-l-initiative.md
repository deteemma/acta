# 04: Équipe de l'initiative (ADR-0015)

**What to build:** Les membres d'une initiative gèrent son équipe selon le principe de subsidiarité de l'ADR-0015 : inviter un membre et lui donner un rôle, marquer les BA de l'équipe, transmettre ou désigner un propriétaire. Une initiative a toujours au moins un propriétaire et au moins un BA de l'équipe.

**Blocked by:** 02 — Coque de navigation

**Status:** ready-for-agent

- [ ] Le propriétaire invite un utilisateur (connecté au moins une fois) par son e-mail, avec un rôle ; il change le rôle d'un membre et retire un membre.
- [ ] Tout propriétaire et tout BA de l'équipe peut attribuer ou retirer l'indication « BA de l'équipe » à un autre membre propriétaire ou contributeur ; un lecteur ne peut pas la porter.
- [ ] Le dernier BA de l'équipe ne peut pas se retirer l'indication.
- [ ] Faire passer un BA de l'équipe au rôle de lecteur exige de lui retirer d'abord l'indication.
- [ ] Un propriétaire peut transmettre la propriété : nommer un autre membre propriétaire, puis se retirer.
- [ ] Tout BA de l'équipe peut, à tout moment, désigner un nouveau propriétaire parmi les membres, y compris lui-même ; il ne peut ni retirer ni rétrograder un propriétaire existant.
- [ ] Le dernier propriétaire ne peut ni quitter l'initiative, ni être retiré ou rétrogradé.
- [ ] Chaque désignation de propriétaire est tracée (qui, quand, au profit de qui) et consultable par les membres.
- [ ] Toute nouvelle table partagée a ses politiques RLS (migration SQL) et ses guards NestJS ; `scripts/tester-roles.mjs` couvre les deux barrières pour propriétaire, contributeur, lecteur et non-membre.
- [ ] Tous les libellés existent en français et en anglais (ADR-0013).
