# 27: Créer une page depuis un modèle

**What to build:** « Nouvelle page » propose une page vide ou un modèle par domaine de connaissance. La page reprend le plan du modèle, dans la langue de son auteur, et affiche sa tâche BABOK.

**Blocked by:** 22 — Pages : arborescence et écriture

**Status:** ready-for-agent

Règles : décision [09](09-modeles-de-page.md) (points 3, 4, 7, 8, 9).

- [ ] Modèles en base, valables pour toute l'application : nom et contenu en français et en anglais, tâche BABOK, mention « livré » ou « ajouté », état actif. Livrés avec deux modèles d'essai ; le contenu réel arrive au ticket 28.
- [ ] Titre prérempli et modifiable, page ouverte en écriture, créée au premier enregistrement ; un modèle sert autant de fois qu'on veut.
- [ ] Contenu copié une fois pour toutes, dans la langue d'interface de l'auteur ; modifier le modèle ne touche aucune page.
- [ ] La page garde la mention de son modèle d'origine, sous le nom qu'il portait, et affiche sa tâche BABOK. La fiche de la tâche retrouve ces pages.
- [ ] La page ne rend pas la tâche couverte et ne change pas les suggestions : un test le garantit.
- [ ] Réservé aux propriétaires et aux contributeurs ; `scripts/roles/` à jour ; libellés dans les deux langues.
