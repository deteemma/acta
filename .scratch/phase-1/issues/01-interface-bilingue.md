# 01: Interface bilingue

**What to build:** L'utilisateur choisit sa langue d'interface (français ou anglais) ; ce choix est mémorisé sur son compte et retrouvé à chaque connexion, sur le web comme sur le mobile. L'interface existante (connexion, liste des initiatives, création) est entièrement traduite. Le contenu saisi n'est jamais traduit (ADR-0013).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Un sélecteur de langue est accessible à tout moment ; le changement s'applique immédiatement.
- [ ] La langue choisie est enregistrée sur le compte de l'utilisateur et appliquée à sa prochaine connexion, y compris sur un autre appareil.
- [ ] À la première connexion, la langue proposée est celle du navigateur ou du téléphone si c'est le français ou l'anglais, sinon le français.
- [ ] Aucun libellé de l'interface n'est écrit en dur : tous passent par le mécanisme de traduction, partagé entre web et mobile.
- [ ] Le nom d'une initiative saisi en français reste en français quand l'interface est en anglais.
