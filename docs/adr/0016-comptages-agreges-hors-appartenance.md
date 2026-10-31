# ADR-0016 — Comptages agrégés sur toutes les initiatives, sans appartenance

- **Statut** : accepté
- **Date** : 2026-10-31

## Contexte

ADR-0006 réserve le contenu d'une initiative à ses membres, par deux barrières
(guards NestJS et RLS). Le ticket 13 classe les techniques proposées à la
création d'une action « par fréquence d'usage dans l'initiative, puis dans
toute l'application ». La responsable fonctionnelle a précisé (30.10.2026) que
« toute l'application » couvre aussi les initiatives dont le BA n'est pas
membre, qui ne voit alors que des nombres. Options envisagées : compter
seulement les initiatives dont l'utilisateur est membre (écart à la règle
fonctionnelle) ; exposer un comptage agrégé hors appartenance.

## Décision

Un comptage agrégé peut porter sur toutes les initiatives, y compris celles dont
l'utilisateur n'est pas membre, à trois conditions vérifiables :

1. il passe par une fonction PostgreSQL `SECURITY DEFINER` dédiée, qui ne
   renvoie que des nombres par élément du référentiel BABOK, jamais une ligne
   d'initiative, d'action ou d'objet d'analyse, ni un identifiant d'initiative ;
2. il ne renvoie rien sans utilisateur courant ;
3. `scripts/roles/` vérifie, par l'API et en base, qu'un non-membre obtient le
   comptage mais aucune donnée de l'initiative.

Première application : `technique_usage_counts()` (migration 0014), servie par
`GET /api/babok/technique-usage`.

## Conséquences

- Tout utilisateur connecté, administrateur compris, peut déduire l'usage global
  d'une technique ; avec très peu d'initiatives, un nombre peut laisser deviner
  l'activité d'une autre équipe.
- Les initiatives archivées sont comptées (lecture littérale de « toute
  l'application »), confirmé par la responsable fonctionnelle.
- Tout nouveau comptage hors appartenance doit respecter ces conditions ;
  au-delà (un détail, un filtre par initiative), il faut un nouvel ADR.
