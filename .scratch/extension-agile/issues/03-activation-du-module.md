# 03: Activation du module sur une initiative

**What to build:** Le propriétaire d'une initiative active ou désactive l'Extension Agile depuis la fiche de l'initiative.

**Status:** needs-triage

Règles : [spécification](../spec.md), décisions D10 à D12.

- [ ] Champ « Extension Agile : activée / désactivée » sur la fiche de l'initiative, modifiable par le propriétaire seul ; visible par tout membre (D11).
- [ ] Désactivé à la création, absent du formulaire de création ; les initiatives existantes sont désactivées (D10).
- [ ] Impossible de le changer sur une initiative archivée (D11).
- [ ] Indépendant de l'approche d'analyse (D12).
- [ ] Permissions vérifiées dans `scripts/roles/` (propriétaire, contributeur, lecteur, initiative archivée).
