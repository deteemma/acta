# 04: Technique agile d'une action

**What to build:** Dans une initiative où le module est activé, une action est rattachée au besoin à une technique agile, en plus de sa tâche BABOK. Le module ne se désactive plus tant qu'une action en porte une.

**Blocked by:** 02 — Consultation du référentiel agile ; 03 — Activation du module sur une initiative

**Status:** ready-for-human (réalisé, à valider par la responsable fonctionnelle)

Règles : [spécification](../spec.md), décisions D6, D13 à D17.

- [x] Champ « Technique agile » sur l'action, distinct de « Technique » : facultatif, une valeur au plus, avec ou sans technique BABOK, visible seulement si le module est activé (D14).
- [x] Liste triée par numéro de section, « Aucune » en tête (D15).
- [x] Rempli par un propriétaire ou un contributeur, à la création comme en modification ; toute modification figure dans l'historique du ticket ; aucune technique agile sur une action créée depuis une action suggérée (D16).
- [x] La valeur ouvre la fiche de la technique agile (D8).
- [x] Désactivation du module refusée tant qu'une action de l'initiative porte une technique agile, quel que soit son statut ; le message donne le nombre d'actions (D13).
- [x] Téléphone : technique agile affichée en lecture seule sur la fiche de l'action (D17).
- [x] Rien de changé au tableau de bord, à la couverture, aux suggestions ni aux filtres (périmètre).
- [x] Permissions vérifiées dans `scripts/roles/`.

## Commentaires

**22.11.2026, responsable fonctionnelle** (question de Claude sur D16) : une action créée depuis une action suggérée n'a pas de technique agile à sa création ; elle peut en recevoir une ensuite, en modification, comme toute autre action.

**22.11.2026, Claude** : réalisé, à valider sur acta.localhost (image reconstruite).

- Migration `0037_technique_agile_d_une_action.sql` : champ « Technique agile » sur l'action, distinct de « Technique ». La base refuse une technique agile quand le module est désactivé, sur une création depuis une action suggérée et sur un autre type de ticket. Elle refuse aussi la désactivation du module tant qu'une action en porte une, quel que soit son statut (D13, D14, D16).
- Fiche de l'action (web), création rapide « + Action » et « Nouveau ticket » de type Action : le champ apparaît sous « Technique », seulement si le module est activé. La liste commence par « Aucune », puis les techniques agiles par numéro de section (« EA 7.2 » avant « EA 7.10 »). La valeur choisie ouvre la fiche de la technique agile (D8, D14, D15).
- Lecteur et initiative archivée : le champ est en lecture seule.
- Historique du ticket : chaque changement de technique agile y figure (D16).
- La création en un clic depuis l'encart « Actions suggérées » ne pose jamais de technique agile.
- Désactivation refusée avec le message : « L'Extension Agile ne peut pas être désactivée : 3 action(s) de l'initiative portent une technique agile, quel que soit leur statut. Retirez-la d'abord de ces actions. » (D13).
- Téléphone : la fiche de l'action affiche la technique agile en lecture seule, sous la technique BABOK, si le module est activé. Pas de saisie sur le téléphone (D17).
- Tableau de bord, couverture, suggestions et filtres de l'écran Tickets : inchangés.
- Permissions vérifiées sur les deux barrières : `scripts/roles/33-technique-agile-d-une-action.mjs`. Les cas couverts sont le propriétaire, la contributrice, la lectrice, le module désactivé, l'action suggérée, les actions Terminée et Annulée, et l'initiative archivée.

Deux points à signaler :

1. **Test du ticket 03 modifié.** Le contrôle « les initiatives existantes ont l'Extension Agile désactivée » échouait. Il comptait toutes les initiatives activées, et « AG1 · Agile V1 », créée avant la migration, a été activée à la main depuis. Il vérifie maintenant que la colonne est non nulle et vaut « désactivée » par défaut, ce qui garantit D10 pour les initiatives existantes. La règle ne change pas.
2. **Texte proposé, à confirmer ou corriger.** Le message de refus de désactivation ci-dessus. Le refus « Cette tâche, cette technique ou cette technique agile n'existe pas dans le référentiel » couvre désormais aussi la technique agile.
