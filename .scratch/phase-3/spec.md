# Spécification — Phase 3 : scénarios Gherkin

Validée décision par décision avec la responsable fonctionnelle le 14.11.2026, en un seul entretien (questions Q1 à Q31). Vocabulaire : [`CONTEXT.md`](../../CONTEXT.md) (Fonctionnalité, Scénario Gherkin, Contexte, Validation de syntaxe Gherkin).

## Objectif

Sur le web, une équipe documente chaque exigence de solution fonctionnelle par des **scénarios Gherkin** (*Étant donné / Quand / Alors*), précédés au besoin d'un **Contexte** commun. Elle peut demander une **validation de syntaxe** et télécharger le tout en un fichier `.feature` standard pour les équipes de développement ou de test. Les scénarios sont de la documentation : ACTA ne les exécute pas.

## Périmètre

Compris : les décisions ci-dessous, sur le web.

Non compris :
- le téléphone (D19) ;
- un écran « Scénarios » à l'échelle de l'initiative, un export groupé de l'initiative, une action suggérée liée aux scénarios (D18, D16) ;
- les liens directs entre un scénario et un ticket ou une page (D8) ;
- l'exécution des scénarios.

## Décisions

Chaque ticket de réalisation renvoie à ces décisions : **les lire avant de coder**. En cas de doute ou de contradiction, s'arrêter et poser la question à la responsable fonctionnelle (`CLAUDE.md`).

### Rattachement

- **D1** — Seule une exigence de solution **fonctionnelle** a des scénarios et un Contexte. Les exigences non fonctionnelles, métier, partie prenante et de transition n'en ont jamais. (Q2)
- **D2** — Le type d'une exigence (type et sous-type) ne change pas tant qu'elle a au moins un scénario ou un Contexte : la modification est refusée, avec un message qui en donne la raison. (Q3)
- **D3** — Supprimer une exigence supprime ses scénarios, son Contexte et leurs historiques, après une confirmation qui indique le nombre de scénarios. Les références des scénarios ne sont pas réattribuées. Les autres conditions de suppression de l'exigence (liens) sont inchangées. (Q25)

### Fonctionnalité

- **D4** — La Fonctionnalité est l'ensemble des scénarios d'une exigence. Elle n'a ni titre ni description propres : ce sont ceux de l'exigence (titre, énoncé). (Q4)
- **D5** — La Fonctionnalité porte une **langue**, français ou anglais, commune à son Contexte et à tous ses scénarios. Elle est fixée à la création du premier scénario ou du Contexte, à la langue de son auteur par défaut, et reste modifiable par un propriétaire ou un contributeur. La changer ne traduit aucun texte : la validation signalera alors les mots-clés de l'autre langue. (Q17 corrigée par Q24)

### Scénario

- **D6** — Un scénario porte :
  - une **référence** `CODE-SC-NNN` (acronyme `SC` par défaut, paramétrable par l'administration comme les autres, numéro incrémental par initiative, jamais réattribué) (Q6) ;
  - un **titre** obligatoire, distinct du texte (Q14) ;
  - un **texte** Gherkin libre de 10 000 caractères au plus, qui contient les étapes et, pour un plan de scénario, les Exemples (Q5, Q14, Q22).
- **D7** — Éléments admis dans le texte : étapes (Étant donné / Quand / Alors / Et / Mais et leurs équivalents anglais), Exemples (plan de scénario), tableaux de données, blocs de texte `"""`, étiquettes `@…`, commentaires `#`. Exclus : les lignes « Fonctionnalité » et « Règle » (*Feature*, *Rule*), ainsi que la ligne « Scénario : » puisque le titre est un champ. (Q15)
- **D8** — Un scénario n'a pas de statut propre (c'est l'exigence qu'on valide), ni de lien direct avec les tickets et les pages. Il ne se déplace pas vers une autre exigence. (Q7, Q9, Q21)
- **D9** — Les scénarios d'une exigence suivent un ordre libre, réglé à la main ; un nouveau scénario se place en dernier. (Q18)
- **D10** — Un scénario se supprime définitivement, sans condition. (Q21)
- **D11** — Un texte invalide s'enregistre toujours : la validation est une aide demandée, jamais un passage obligé. (Q11)

### Contexte

- **D12** — Le Contexte (*Background*) regroupe les étapes communes à tous les scénarios de la Fonctionnalité. Facultatif, un au plus par exigence, 10 000 caractères au plus, sans titre ni référence. (Q16, Q22)

### Historique et modification simultanée

- **D13** — Chaque modification d'un scénario est conservée dans son propre historique : qui, quand, et pour chaque champ modifié l'ancienne et la nouvelle valeur. Il en va de même pour le Contexte. Consultables par tout membre ; ces historiques n'apparaissent pas dans celui de l'exigence. Un changement d'ordre des scénarios ou de langue de la fonctionnalité ne figure dans aucun historique. (Q19, Q28 ; précisé le 15.11.2026)
- **D14** — Si un scénario ou le Contexte a changé depuis son ouverture, l'enregistrement est refusé avec un message qui le dit. Il n'y a pas d'outil de comparaison : on recharge le texte et on refait la modification. (Q29)

### Validation de syntaxe

- **D15** — Tout membre peut demander la validation du texte d'un scénario ou du Contexte. Elle contrôle :
  1. la grammaire Gherkin ;
  2. les mots-clés de la seule langue de la Fonctionnalité ;
  3. pour un scénario, au moins une étape « Quand » et une étape « Alors » ;
  4. pour un plan de scénario (texte qui contient des Exemples), que chaque `<paramètre>` des étapes a sa colonne dans les Exemples.

  Elle affiche « Syntaxe correcte » ou la liste des erreurs, chacune avec son numéro de ligne et un message dans la langue de l'utilisateur. Le résultat n'est pas conservé. Une bulle d'aide présente ces règles à l'utilisateur. (Q5, Q12, Q13, Q15, Q27)

### Export

- **D16** — Depuis la fiche de l'exigence, tout membre télécharge un fichier `.feature` nommé d'après la référence de l'exigence (ex. `CRM-EX-012.feature`), dans la langue de la Fonctionnalité. Il contient, dans l'ordre :
  - la ligne `Fonctionnalité: CRM-EX-012 <titre de l'exigence>` ;
  - l'énoncé de l'exigence en description ;
  - le Contexte ;
  - chaque scénario dans l'ordre, précédé de l'étiquette `@CRM-SC-001`, introduit par `Scénario:` ou `Plan du scénario:` selon que son texte contient des Exemples ou non, suivi de son titre et de son texte.

  L'export est proposé même sans scénario ni Contexte (précisé le 15.11.2026). Pas d'export groupé de l'initiative. L'export tableur des exigences est inchangé. (Q20, Q26)

### Accès et écrans

- **D17** — Propriétaires et contributeurs créent, modifient, ordonnent et suppriment les scénarios et le Contexte, et changent la langue. Tout membre les consulte. Sur une initiative archivée, tout est en lecture seule, mais la consultation, la validation et l'export restent possibles. (Q8, Q31)
- **D18** — Les scénarios apparaissent dans une section « Scénarios » de la fiche de l'exigence, présente seulement pour une exigence de solution fonctionnelle. Pas d'écran à l'échelle de l'initiative, pas d'action suggérée. (Q23)
- **D19** — Web seulement. (Q10)
- **D20** — La palette de recherche trouve un scénario par sa référence ou son titre et ouvre la fiche de son exigence sur ce scénario. (Q30)

## Contraintes techniques

- ADR `docs/adr/` : 0006 (deux barrières, guards et RLS), 0013 (deux langues).
- Nouvelle entité : suivre `docs/ajouter-entite-partagee.md`, dont les permissions de bout en bout dans `scripts/roles/`.
- Règles métier dans `shared/`, avec tests : `CODING_STANDARDS.md`. La validation (D15) et la construction du `.feature` (D16) y vivent.
- Références : nouvelle catégorie livrée dans `shared/src/references.ts` (`DEFAULT_ACRONYMS`) et dans la base. La migration donne aux scénarios le premier acronyme jamais porté parmi `SC`, `SCE`, `SCEN` (un acronyme porté reste réservé à sa catégorie, même renommée) ; l'administrateur peut ensuite le changer. Si les trois sont pris, la migration s'arrête avec un message explicite, et la question revient à la responsable fonctionnelle. (Validé le 15.11.2026 ; `SC` est libre dans la base locale.)
- Pas de table synchronisée vers le téléphone (D19).
- L'alerte de modification non enregistrée s'applique aux saisies de scénario et de Contexte, comme à tout panneau.

## Découpage

Chaque ticket livre quelque chose de visible et se valide seul.

| N° | Ticket | Dépend de |
|---|---|---|
| 01 | [Scénarios d'une exigence](issues/01-scenarios-d-une-exigence.md) | — |
| 02 | [Contexte et langue de la fonctionnalité](issues/02-contexte-et-langue-de-la-fonctionnalite.md) | 01 |
| 03 | [Historique des scénarios et du contexte](issues/03-historique-des-scenarios-et-du-contexte.md) | 02 |
| 04 | [Validation de syntaxe Gherkin](issues/04-validation-de-syntaxe-gherkin.md) | 02 |
| 05 | [Export .feature](issues/05-export-feature.md) | 02 |
| 06 | [Scénarios dans la palette de recherche](issues/06-scenarios-dans-la-palette.md) | 01 |
