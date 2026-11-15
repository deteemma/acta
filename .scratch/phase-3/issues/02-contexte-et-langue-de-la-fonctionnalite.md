# 02: Contexte et langue de la fonctionnalité

**What to build:** Une exigence de solution fonctionnelle reçoit un Contexte facultatif, et sa fonctionnalité une langue commune au Contexte et aux scénarios.

**Blocked by:** 01 — Scénarios d'une exigence

**Status:** ready-for-agent

Règles : [spécification](../spec.md), décisions D2, D3, D5, D12, D14, D17.

- [ ] Contexte : un au plus par exigence, facultatif, 10 000 caractères au plus, sans titre ni référence ; affiché en tête de la section « Scénarios » (D12).
- [ ] Langue de la fonctionnalité (français ou anglais) : fixée à la création du premier scénario ou du Contexte, à la langue de l'auteur par défaut ; modifiable par un propriétaire ou un contributeur, sans traduire les textes ; visible dans la section (D5).
- [ ] Modification simultanée du Contexte : même refus que pour un scénario (D14).
- [ ] Un Contexte, même sans scénario, fige le type de l'exigence (D2) et part avec elle à sa suppression (D3).
- [ ] Droits et initiative archivée comme au ticket 01 (D17) ; alerte de modification non enregistrée.
- [ ] Règles dans `shared/`, avec tests ; `scripts/roles/` à jour ; libellés dans les deux langues.
