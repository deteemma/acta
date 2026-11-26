# 15: Relire une page et traçabilité

**What to build:** Depuis une page, le BA demande une relecture de cohérence ou un contrôle de traçabilité sur une ou deux pages. L'avis se range dans l'onglet « Assistant » de la page.

**Blocked by:** 12 — Faire le point, de bout en bout

**Status:** ready-for-agent

Règles : [spécification](../spec.md) AS10, AS14, AS17, AS21, AS22, AS29, AS30, « Points de vigilance » (contenu des pages). Détail aux tickets [06](06-choix-premier-lot.md) et [07](07-donnees-par-usage.md) ; textes au [ticket 08](08-maquette-du-panneau.md).

- [ ] Bouton « Demander à l'assistant » dans l'en-tête d'une page ; fenêtre avec les usages « Relire une page » et « Contrôler la traçabilité et la cohérence » ; seconde page facultative pour la traçabilité (AS10, AS22).
- [ ] Contenu de la page (document éditeur, ADR 0019) transmis en texte lisible (titres, listes, tableaux), jamais en JSON brut ; c'est ce texte qui est compté (AS21).
- [ ] Instructions « Relire une page », « Traçabilité, une page » et « Traçabilité, deux pages », en français et en anglais (AS29).
- [ ] Mise en garde de la relecture de cohérence ajoutée par ACTA (AS30).
- [ ] Page supprimée avant le passage En cours → Échouée « l'élément choisi n'existe plus » (AS17).
- [ ] Onglet « Assistant » de la page, avec le nombre de demandes. Pour une traçabilité sur deux pages, l'avis se range seulement sur la page d'où la demande est partie (décision de la responsable du 26.11.2026).
- [ ] Refus à la création si la page est trop longue, avec le message d'AS20.
