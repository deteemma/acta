# 28: Rédaction des 22 modèles

**What to build:** Les 22 modèles livrés existent en français et en anglais, avec leur plan et leurs textes d'aide, relus par la responsable fonctionnelle.

**Blocked by:** 27 — Créer une page depuis un modèle

**Status:** done (validé par la responsable fonctionnelle le 12.11.2026)

Règles : décision [09](09-modeles-de-page.md) (points 1 à 3), ADR-0012 et ADR-0013. Noms officiels : recherche sur la branche `research/livrables-babok-v3`.

- [x] Les 22 modèles, sous leur nom officiel français et anglais, avec leur tâche.
- [x] Plan de titres et court texte d'aide en italique ; tableau à remplir quand il est utile ; ni image ni donnée vivante.
- [x] Textes rédigés pour ACTA : **aucun extrait du guide de l'IIBA**.
- [x] « Description de l'état futur » contient une section sur les objectifs métier. « Actions recommandées » précise qu'une action retenue peut devenir un ticket Action. « Résultats d'élicitation » rappelle qu'on confirme en déclarant une version.
- [x] Relecture : un document de relecture des 22 modèles, comme pour les résumés du référentiel (`.scratch/phase-1/06-referentiel-babok-resumes.md`), validé avant la migration.
- [x] Migration des données livrées ; retrait des deux modèles d'essai du ticket 27.

## Réalisation

**12.11.2026 — rédaction.** Les 22 modèles sont rédigés dans
[`28-modeles-de-page-relecture.md`](../28-modeles-de-page-relecture.md), en
français et en anglais. En attente de relecture par la responsable
fonctionnelle, avec six points à trancher en tête du document (noms anglais de
« Conception » et de 7.1, phrase d'introduction, sort des modèles d'essai déjà
utilisés…). Aucune migration avant validation : le document validé sert ensuite
de source à la migration.

**12.11.2026 — validation et migration.** La responsable fonctionnelle accepte
les six propositions et valide les 22 modèles tels quels.
- La migration `0026` est générée depuis le document validé : un titre `####`
  devient un titre de niveau 2, un paragraphe en italique un texte d'aide, un
  tableau un tableau avec une ligne vide. Chaque modèle passe le contrôle de
  contenu des pages (`pageContentSchema`) avant d'être écrit.
- Les modèles d'essai sont supprimés s'ils n'ont jamais servi, sinon
  désactivés. En local, ils avaient servi lors de la recette du ticket 27 : les
  deux sont désactivés, et les pages créées gardent leur mention « (essai) ».
- `scripts/roles/20-modeles-de-page.mjs` vérifie : 22 modèles livrés actifs,
  un par livrable retenu ; plus aucun modèle d'essai proposé ; la section
  « Objectifs métier » dans les deux langues de « Description de l'état futur ».
  Tous les contrôles passent.
