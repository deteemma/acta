# ADR-0015 — Désignation d'un propriétaire par l'équipe BA (subsidiarité)

- **Statut** : accepté
- **Date** : 2026-10-26

## Contexte

L'ADR-0006 réserve la gestion des membres d'une initiative au propriétaire. En pratique, les BA d'une initiative forment une équipe autonome et responsable qui se répartit le travail : l'équipe doit pouvoir désigner un propriétaire sans dépendre d'un seul propriétaire ni de l'administrateur (principe de subsidiarité). ACTA n'a pas de rôle « BA » au niveau de l'application, et une partie prenante invitée peut être contributeur. Options envisagées : ouvrir ce droit à tout contributeur ; marquer explicitement les membres qui font partie de l'équipe BA.

## Décision

Chaque membre d'une initiative porte, en plus de son rôle (propriétaire, contributeur, lecteur), une indication « BA de l'équipe », réservée aux propriétaires et contributeurs. Le créateur d'une initiative en est automatiquement propriétaire et BA de l'équipe. Tout propriétaire et tout BA de l'équipe peut attribuer ou retirer cette indication à un autre membre ; le dernier BA de l'équipe ne peut pas se la retirer. Tout membre marqué « BA de l'équipe » peut, à tout moment, désigner un nouveau propriétaire parmi les membres, y compris lui-même. Désigner un propriétaire consiste à en ajouter un : retirer ou rétrograder un propriétaire reste réservé aux propriétaires. Chaque désignation est tracée (qui, quand, au profit de qui). L'administrateur conserve la possibilité de désigner un propriétaire quand aucun propriétaire actif ne reste.

Cet ADR précise l'ADR-0006 sans le remplacer : les trois rôles et la double barrière (guards NestJS et RLS) restent inchangés.

## Conséquences

- La règle est écrite une seule fois dans `shared/` ; les guards, les politiques RLS et `scripts/tester-roles.mjs` couvrent ce nouveau droit.
- Rétrograder un BA de l'équipe au rôle de lecteur suppose de lui retirer d'abord l'indication.
