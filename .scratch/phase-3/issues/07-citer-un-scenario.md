# 07: Citer un scénario dans un texte

**What to build:** Un scénario se cite dans un texte comme les autres références : proposé à la saisie de `#`, lien vers la fiche de son exigence sur ce scénario, aperçu au survol.

**Blocked by:** 06 — Scénarios dans la palette de recherche

**Status:** done (validé par la responsable fonctionnelle le 20.11.2026)

Règles : [spécification](../spec.md), décisions D21, D22.

- [x] La saisie de `#` dans une page propose les scénarios des initiatives dont l'utilisateur est membre.
- [x] Une référence de scénario citée devient un lien, avec un aperçu au survol (référence, titre, « Scénario »).
- [x] Le lien ouvre la fiche de l'exigence, le scénario mis en évidence tant que la fiche est ouverte (D22).

**Réalisation :** les scénarios ne sont plus exclus des références citées (`web/src/references.tsx`) ; le lien s'appuie sur l'ouverture livrée par le ticket 06. Une citation ne fait qu'afficher : rien n'est enregistré en base.
