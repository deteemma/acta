# 13: Suggestions de technique et de tâche

**What to build:** À la création d'une Action, ACTA aide le BA par des suggestions à règles fixes, chacune accompagnée d'une ligne de justification : les techniques associées à la tâche choisie, et la tâche adaptée à l'endroit d'où l'Action est créée.

**Blocked by:** 10 — Exigences

**Status:** done (validé par la responsable fonctionnelle le 31.10.2026)

- [x] Quand une tâche est choisie, les techniques que le BABOK associe à cette tâche sont proposées en premier, classées par fréquence d'usage dans l'initiative, puis dans toute l'application.
- [x] Tâche proposée selon l'origine de la création : initiative sans aucune action → 3.1 ; depuis une partie prenante → 3.2 ou 4.5 ; depuis un besoin → 6.1 ou 6.2 ; depuis une exigence Proposée → 7.2, Vérifiée → 7.3, Validée → 5.5 ; depuis toute exigence, 5.1 en second choix.
- [x] Chaque suggestion affiche sa justification en une ligne ; le BA reste libre de choisir une autre tâche ou une autre technique.
- [x] Les règles sont écrites une seule fois, dans le code partagé.
- [x] Tous les libellés existent en français et en anglais (ADR-0013).

Précisions de la responsable fonctionnelle (30.10.2026) :
- Une Action est « créée depuis » une partie prenante, un besoin ou une exigence par le bouton « + Action » de sa fiche, ou par le bouton « Nouvelle action » de la section Actions de sa fiche ; elle est liée à cet objet.
- Fréquence d'usage d'une technique : nombre d'actions qui l'utilisent, toutes tâches et tous statuts confondus. Tri : dans l'initiative, à égalité dans toute l'application, puis ordre du référentiel.
- « Toute l'application » : toutes les initiatives, y compris celles dont le BA n'est pas membre ; il ne voit que des nombres.
- La première tâche proposée est présélectionnée.

Réalisation :
- Règles dans shared : `suggestions.ts` (`suggestTasks`, `rankTechniques`, `analysisObjectLinks`), avec tests.
- Migration `0014_usage_des_techniques.sql` : fonction `technique_usage_counts()`, qui ne renvoie qu'un nombre par technique ; route `GET /api/babok/technique-usage`. Section `scripts/roles/09-usage-des-techniques.mjs` : un non-membre obtient le comptage, jamais les actions.
- Web : panneau « Nouvelle action » avec les tâches proposées (bouton et justification), la première présélectionnée ; menu des techniques avec le groupe « Proposées : associées à la tâche par le BABOK, les plus utilisées d'abord », chaque technique suivie de son usage ; bouton « Nouvelle action » dans la section Actions des fiches partie prenante, besoin et exigence.

Points validés par la responsable fonctionnelle (31.10.2026) :
- **ADR-0016 accepté** (`docs/adr/0016-comptages-agreges-hors-appartenance.md`) : le comptage sur toutes les initiatives est une exception à ADR-0006 (contenu réservé aux membres). Il est mis en œuvre selon la précision du 30.10.2026.
- Exigence Approuvée, Différée ou Rejetée : seule 5.1 est proposée, donc présélectionnée (lecture de « depuis toute exigence, 5.1 »).
- Création depuis un objet dans une initiative sans aucune action : seule la tâche de l'objet est proposée, pas 3.1 (la règle 3.1 est lue comme « depuis l'initiative »).
- Les initiatives archivées comptent dans l'usage « dans toute l'application ».
- Justifications rédigées par Claude, validées (FR et EN dans `shared/src/i18n.ts`, clés `suggestion.*`) :
  - 3.1 : « Aucune action n'est encore prévue : commencez par planifier l'approche de l'analyse. » (texte de R1, ticket 14)
  - 3.2 : « Depuis une partie prenante : planifier son engagement dans l'analyse. »
  - 4.5 : « Depuis une partie prenante : gérer la collaboration avec elle. »
  - 6.1 : « Depuis un besoin : analyser la situation actuelle qui le fait naître. »
  - 6.2 : « Depuis un besoin : définir la situation future qui y répond. »
  - 7.2 : « Exigence Proposée : la vérifier, pour en contrôler la qualité. »
  - 7.3 : « Exigence Vérifiée : la valider, pour s'assurer qu'elle répond au besoin. »
  - 5.5 : « Exigence Validée : la faire approuver. »
  - 5.1 : « Depuis une exigence : tracer ses liens avec les besoins, ses sources et les autres exigences. »
  - Technique : « utilisée {n} fois dans l'initiative, {m} fois dans ACTA ».
- Ajouts gardés : la ligne « Liée à : … » dans le panneau de création ; le menu Initiative figé quand on part d'un objet ; le bouton « + Action » de la liste des parties prenantes propose aussi son initiative.
