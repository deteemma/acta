# ADR-0012 — Référentiel BABOK : données de référence livrées, sans texte de l'IIBA

- **Statut** : accepté
- **Date** : 2026-10-25

## Contexte

ACTA applique le BABOK v3 : chaque Action est rattachée à une tâche BABOK, et l'utilisateur doit pouvoir consulter les domaines de connaissance, tâches et techniques. Le texte du BABOK est protégé par le droit d'auteur de l'IIBA. Options envisagées : reproduire le contenu du guide ; laisser chaque équipe saisir son propre référentiel ; livrer un référentiel minimal avec l'application.

## Décision

Le référentiel BABOK est livré avec l'application, identique pour toutes les initiatives, en lecture seule pour tous les utilisateurs, administrateur compris. Pour chaque élément, il ne contient que : un identifiant stable, le nom officiel en anglais et en français, un résumé rédigé pour ACTA dans les deux langues, et le renvoi de section du guide. Aucun extrait du texte de l'IIBA n'est reproduit. La phase 1 couvre le BABOK v3 seul ; l'Extension Agile v2 sera ajoutée plus tard comme module activable par initiative.

## Conséquences

- L'utilisateur consulte son propre exemplaire du BABOK pour le détail.
- Les Actions référencent les tâches par leur identifiant stable : une future version du BABOK exigera une correspondance entre anciens et nouveaux identifiants.
- Les résumés maison sont relus par la responsable fonctionnelle avant livraison.
