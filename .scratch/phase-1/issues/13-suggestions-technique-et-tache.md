# 13: Suggestions de technique et de tâche

**What to build:** À la création d'une Action, ACTA aide le BA par des suggestions à règles fixes, chacune accompagnée d'une ligne de justification : les techniques associées à la tâche choisie, et la tâche adaptée à l'endroit d'où l'Action est créée.

**Blocked by:** 10 — Exigences

**Status:** ready-for-agent

- [ ] Quand une tâche est choisie, les techniques que le BABOK associe à cette tâche sont proposées en premier, classées par fréquence d'usage dans l'initiative, puis dans toute l'application.
- [ ] Tâche proposée selon l'origine de la création : initiative sans aucune action → 3.1 ; depuis une partie prenante → 3.2 ou 4.5 ; depuis un besoin → 6.1 ou 6.2 ; depuis une exigence Proposée → 7.2, Vérifiée → 7.3, Validée → 5.5 ; depuis toute exigence, 5.1 en second choix.
- [ ] Chaque suggestion affiche sa justification en une ligne ; le BA reste libre de choisir une autre tâche ou une autre technique.
- [ ] Les règles sont écrites une seule fois, dans le code partagé.
- [ ] Tous les libellés existent en français et en anglais (ADR-0013).
