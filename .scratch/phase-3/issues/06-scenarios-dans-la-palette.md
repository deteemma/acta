# 06: Scénarios dans la palette de recherche

**What to build:** La palette de recherche trouve un scénario par sa référence ou son titre et ouvre la fiche de son exigence sur ce scénario.

**Blocked by:** 01 — Scénarios d'une exigence

**Status:** done (validé par la responsable fonctionnelle le 20.11.2026)

Règles : [spécification](../spec.md), décision D20.

- [x] Recherche par référence et par titre, avec la même correspondance que pour les tickets et les pages.
- [x] Le résultat ouvre la fiche de l'exigence, la section « Scénarios » visible et le scénario mis en évidence.
- [x] Seuls les scénarios des initiatives dont l'utilisateur est membre ; `scripts/roles/` à jour.
- [x] Libellés dans les deux langues.

**Réalisation :** les scénarios rejoignent la liste des références (`GET /references`, avec leur exigence) que la palette parcourt ; le résultat ouvre la fiche de l'exigence, qui défile jusqu'au scénario encadré, une fois le Contexte chargé. Les scénarios ne se citent pas dans les textes (`isCitableReference`, `shared/src/references.ts`) : non demandé. Questions laissées ouvertes à la responsable fonctionnelle : citer un scénario par `#` dans un texte ; durée de la mise en évidence.
