# 18: Signal « L'initiative a changé depuis cet avis »

**What to build:** Un avis signale, en les nommant, les éléments transmis qui ont été modifiés, ajoutés ou supprimés depuis sa date de lecture.

**Blocked by:** 12 — Faire le point, de bout en bout

**Status:** ready-for-agent

Règles : [spécification](../spec.md) AS11, AS19. Détail au [ticket 07](07-donnees-par-usage.md) ; textes au [ticket 08](08-maquette-du-panneau.md).

- [ ] Signal sur l'avis quand un élément transmis a été modifié, ajouté ou supprimé après la date de lecture ; le passage du temps ne compte pas (AS19).
- [ ] Page dont seule la liste a été transmise : seuls comptent un changement de titre, un ajout ou une suppression (AS19).
- [ ] Le signal nomme les éléments : « P-003 modifiée, EX-012 ajoutée, T-020 supprimé. » (AS19).
- [ ] Jamais sur l'avis d'une question libre (AS11).
- [ ] Règle de détection dans `shared/`, avec tests pour chaque usage livré.
