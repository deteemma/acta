# 06: Scénarios dans la palette de recherche

**What to build:** La palette de recherche trouve un scénario par sa référence ou son titre et ouvre la fiche de son exigence sur ce scénario.

**Blocked by:** 01 — Scénarios d'une exigence

**Status:** done (validé par la responsable fonctionnelle le 20.11.2026)

Règles : [spécification](../spec.md), décision D20.

- [x] Recherche par référence et par titre, avec la même correspondance que pour les tickets et les pages.
- [x] Le résultat ouvre la fiche de l'exigence, la section « Scénarios » visible et le scénario mis en évidence.
- [x] Seuls les scénarios des initiatives dont l'utilisateur est membre ; `scripts/roles/` à jour.
- [x] Libellés dans les deux langues.

**Réalisation :** les scénarios rejoignent la liste des références (`GET /references`, avec leur exigence) que la palette parcourt ; le résultat ouvre la fiche de l'exigence, qui défile jusqu'au scénario encadré, une fois le Contexte chargé. Les scénarios ne se citent pas dans les textes (`isCitableReference`, `shared/src/references.ts`) : non demandé. Réponses du 20.11.2026 : citation des scénarios (D21, ticket 07) ; mise en évidence tant que la fiche est ouverte (D22, déjà le cas).
