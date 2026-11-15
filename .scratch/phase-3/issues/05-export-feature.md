# 05: Export .feature

**What to build:** Depuis la fiche d'une exigence de solution fonctionnelle, tout membre télécharge sa fonctionnalité en un fichier `.feature` standard.

**Blocked by:** 02 — Contexte et langue de la fonctionnalité

**Status:** ready-for-agent

Règles : [spécification](../spec.md), décisions D5, D16, D17.

- [ ] Fichier nommé d'après la référence de l'exigence (ex. `CRM-EX-012.feature`), dans la langue de la fonctionnalité (D5, D16).
- [ ] Contenu dans l'ordre : ligne « Fonctionnalité » avec référence et titre de l'exigence ; énoncé en description ; Contexte ; chaque scénario dans l'ordre, avec l'étiquette de sa référence, introduit par « Scénario » ou « Plan du scénario » selon la présence d'Exemples, puis titre et texte (D16).
- [ ] Les textes sont repris tels quels, même invalides.
- [ ] Disponible pour tout membre, y compris sur une initiative archivée (D17). Export tableur des exigences inchangé.
- [ ] Construction du fichier dans `shared/`, avec tests en français et en anglais.

- [ ] L'export est proposé même pour une exigence sans aucun scénario ni Contexte : le fichier contient alors la ligne « Fonctionnalité » et l'énoncé (D16, réponse de la responsable fonctionnelle du 15.11.2026).
