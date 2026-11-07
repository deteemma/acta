# 30: Administration : modèles de page

**What to build:** L'administrateur consulte les modèles, désactive ceux qui ne servent pas, et ajoute ses propres modèles.

**Blocked by:** 27 — Créer une page depuis un modèle

**Status:** ready-for-agent

Règles : décisions [09](09-modeles-de-page.md) (point 6) et [14](14-ecrans-d-administration.md) (points 1 et 3).

- [ ] Onglet « Modèles de page » : liste par domaine de connaissance, mention « livré » ou « ajouté », état actif ou désactivé.
- [ ] Modèle ouvert en panneau, un onglet par langue : lecture seule si livré, éditeur de page si ajouté, sans image.
- [ ] Modèle ajouté : nom et contenu dans les deux langues, tâche BABOK facultative ; modifiable, désactivable, supprimable seulement s'il n'a jamais servi.
- [ ] Modèle livré : se désactive, ne se modifie pas. Modèle désactivé : plus proposé, pages existantes inchangées.
- [ ] Réservé à l'administrateur ; `scripts/roles/` à jour ; libellés dans les deux langues.
