# 04: Technique agile d'une action

**What to build:** Dans une initiative où le module est activé, une action est rattachée au besoin à une technique agile, en plus de sa tâche BABOK. Le module ne se désactive plus tant qu'une action en porte une.

**Blocked by:** 02 — Consultation du référentiel agile ; 03 — Activation du module sur une initiative

**Status:** needs-triage

Règles : [spécification](../spec.md), décisions D6, D13 à D17.

- [ ] Champ « Technique agile » sur l'action, distinct de « Technique » : facultatif, une valeur au plus, avec ou sans technique BABOK, visible seulement si le module est activé (D14).
- [ ] Liste triée par numéro de section, « Aucune » en tête (D15).
- [ ] Rempli par un propriétaire ou un contributeur, à la création comme en modification ; toute modification figure dans l'historique du ticket ; aucune technique agile sur une action créée depuis une action suggérée (D16).
- [ ] La valeur ouvre la fiche de la technique agile (D8).
- [ ] Désactivation du module refusée tant qu'une action de l'initiative porte une technique agile, quel que soit son statut ; le message donne le nombre d'actions (D13).
- [ ] Téléphone : technique agile affichée en lecture seule sur la fiche de l'action (D17).
- [ ] Rien de changé au tableau de bord, à la couverture, aux suggestions ni aux filtres (périmètre).
- [ ] Permissions vérifiées dans `scripts/roles/`.
