# Recherche 06 — Livrables (*outputs*) des 30 tâches du BABOK v3

Question : quels sont les livrables (*Outputs*, « Extrants » dans la traduction
française) de chacune des 30 tâches du BABOK v3, avec leur nom officiel en
anglais et en français ; lesquels se prêtent à une **page** d'ACTA, lesquels
correspondent déjà à un autre objet d'ACTA ?

Contrainte (ADR-0012) : ce document ne relève que les **noms** des livrables et
la tâche qui les produit. Aucune définition ni citation du guide n'est
reproduite ; les avis de la dernière colonne sont rédigés pour ACTA.

## Sources et méthode

| Abréviation | Fichier (dossier `reference/` du dépôt principal) | Usage |
|---|---|---|
| **EN** | `01-BABOK-A-Guide-to-the-business-analysis-body-of-knowledge_v3_EN.pdf` | Nom anglais : section `x.y.8 Outputs` de chaque tâche |
| **FR** | `01-BABOK-Le-Guide-du-corpus-de-connaissance-en-analyse-metier_v3_FR.pdf` | Nom français : section `x.y.8 Extrants` de chaque tâche |
| **ST** | `_BABOK3_StudyTablesv2.pdf` (Watermark Learning) | Contrôle croisé : colonne *Outputs* des tableaux par tâche |
| **GL** | `french-glossary.pdf` (annexe A, glossaire FR) | Contrôle de la terminologie française |

Pages : numéro de page **du lecteur PDF** (1 = première page du fichier), puis
entre parenthèses le numéro **imprimé** sur la page. Décalage constant :
EN imprimé = PDF − 10 ; FR imprimé = PDF − 13. Les tableaux ST couvrent les
pages PDF 7 (domaine 3) à 14 (domaine 8), une page par domaine (deux pour 6 et 7).

Clé : identifiant stable de la tâche de `api/migrations/0009_referentiel_babok.sql`
(3.1 … 8.5 ; le domaine 8 compte 5 tâches, soit 5+5+5+4+6+5 = 30).

Le nom anglais de chaque livrable a été lu dans **EN** et confirmé par **ST**
(aucun livrable en plus ou en moins dans ST) ; le nom français a été lu dans **FR**.

## Tableau des livrables

Colonne « ACTA » : **Page** = document rédigé, candidat à un modèle de page
(`page_template`, phase 2) ; sinon l'objet d'ACTA qui le porte déjà.

| Tâche | Tâche FR | Livrable EN | Livrable FR | Page source (EN · FR · ST) | ACTA : page ou autre objet — justification |
|---|---|---|---|---|---|
| 3.1 | Planifier l'approche de l'analyse métier | Business Analysis Approach | Approche de l'analyse métier | EN 41 (31) · FR 53 (40) · ST 7 | **Page** — plan rédigé du travail d'analyse ; seul le choix prédictif/adaptatif existe déjà comme champ de la fiche Initiative. |
| 3.2 | Planifier l'engagement des parties prenantes | Stakeholder Engagement Approach | Approche d'engagement des parties prenantes | EN 46 (36) · FR 60 (47) · ST 7 | **Page** qui renvoie aux objets **Partie prenante** et à la **Matrice influence × intérêt** — la liste et l'analyse existent déjà ; reste à rédiger le mode de collaboration et de communication. |
| 3.3 | Planifier la gouvernance de l'analyse métier | Governance Approach | Approche de la gouvernance | EN 52 (42) · FR 66 (53) · ST 7 | **Page** — règles de décision et circuit d'approbation/changement à rédiger ; les arbitrages eux-mêmes sont des tickets **Décision**. |
| 3.4 | Planifier la gestion de l'information de l'analyse métier | Information Management Approach | Approche de la gestion de l'information | EN 57 (47) · FR 73 (60) · ST 7 | **Page** — conventions de rangement, de traçabilité et de réutilisation, sans équivalent objet dans ACTA. |
| 3.5 | Identifier les améliorations de performance de l'analyse métier | Business Analysis Performance Assessment | Évaluation de la performance de l'analyse métier | EN 61 (51) · FR 78 (65) · ST 7 | **Page** — bilan rédigé (type rétrospective) ; les améliorations décidées peuvent devenir des **Actions**. |
| 4.1 | Préparer l'élicitation | Elicitation Activity Plan | Plan d'activités d'élicitation | EN 71 (61) · FR 90 (77) · ST 8 | **Page** (une par séance) — préparation d'un entretien ou d'un atelier, à rattacher à l'Action de la tâche 4.1. |
| 4.2 | Conduire l'élicitation | Elicitation Results (unconfirmed) | Résultats d'élicitation (non confirmés) | EN 75 (65) · FR 95 (82) · ST 8 | **Page** (compte rendu de séance) ; les points ouverts deviennent des tickets **Question**. |
| 4.3 | Confirmer les résultats de l'élicitation | Elicitation Results (confirmed) | Résultats de l'élicitation (confirmés) | EN 77 (67) · FR 98 (85) · ST 8 | **Même page que 4.2, dans un autre état** — pas de nouveau document ; la façon de marquer « confirmé » (statut ou version de page) est à décider. |
| 4.4 | Communiquer les informations de l'analyse métier | Business Analysis Information (communicated) | Informations de l'analyse métier (communiquées) | EN 81 (71) · FR 102 (89) · ST 8 | **Ni page ni objet dédié** — état « diffusé » de n'importe quelle information d'analyse ; au plus une trace de diffusion sur la page ou le ticket concerné. |
| 4.5 | Gérer la collaboration avec les parties prenantes | Stakeholder Engagement | Engagement des parties prenantes | EN 84 (74) · FR 106 (93) · ST 8 | **Partie prenante** (et matrice) — c'est un état de la relation avec les parties prenantes, pas un document. |
| 5.1 | Traçabilité des exigences | Requirements (traced) | Exigences (suivies) | EN 93 (83) · FR 116 (103) · ST 9 | **Exigence** — liens existants vers besoin et exigence parente ; pas de page. |
| 5.1 | Traçabilité des exigences | Designs (traced) | Spécifications (suivies) | EN 93 (83) · FR 117 (104) · ST 9 | **Aucun objet ACTA aujourd'hui** — les conceptions (*designs*) ne sont pas modélisées ; candidates à une **page** de conception liée aux exigences. À décider. |
| 5.2 | Maintenir les exigences | Requirements (maintained) | Exigences (maintenues) | EN 96 (86) · FR 120 (107) · ST 9 | **Exigence** — l'historique (`requirement_version`) couvre la mise à jour. |
| 5.2 | Maintenir les exigences | Designs (maintained) | Spécifications (maintenues) | EN 96 (86) · FR 120 (107) · ST 9 | Comme 5.1 *Designs* : **page** de conception, versionnée (la page est versionnée par définition). |
| 5.3 | Prioriser les exigences | Requirements (prioritized) | Exigences (priorisées) | EN 101 (91) · FR 126 (113) · ST 9 | **Exigence** — mais l'attribut de priorité a été exclu en phase 1 (ticket 10) : à décider. |
| 5.3 | Prioriser les exigences | Designs (prioritized) | Spécifications (priorisées) | EN 101 (91) · FR 126 (113) · ST 9 | Dépend de la décision sur les conceptions (voir 5.1). |
| 5.4 | Évaluer les modifications apportées aux exigences | Requirements Change Assessment | Évaluation du changement des exigences | EN 105 (95) · FR 131 (118) · ST 9 | **Demande de changement** (ticket, statut « Analysée ») — l'évaluation est le contenu du ticket ; une page seulement si l'analyse d'impact est longue. |
| 5.4 | Évaluer les modifications apportées aux exigences | Designs Change Assessment | Évaluation du changement des spécifications | EN 105 (95) · FR 131 (118) · ST 9 | **Demande de changement** visant une conception plutôt qu'une exigence. |
| 5.5 | Approuver les exigences | Requirements (approved) | Exigences (approuvées) | EN 108 (98) · FR 136 (123) · ST 9 | **Exigence**, statut « Approuvée » ; l'accord obtenu peut être tracé par un ticket **Décision**. |
| 5.5 | Approuver les exigences | Designs (approved) | Spécifications (approuvées) | EN 108 (98) · FR 136 (123) · ST 9 | Dépend de la décision sur les conceptions (voir 5.1). |
| 6.1 | Analyser l'état actuel | Current State Description | Description de l'état actuel | EN 120 (110) · FR 152 (139) · ST 10 | **Page** — description rédigée de l'organisation actuelle, sans objet équivalent. |
| 6.1 | Analyser l'état actuel | Business Requirements | Exigences métier | EN 120 (110) · FR 152 (139) · ST 10 | **Exigence** de type métier (déjà prévue), reliée aux **Besoins**. |
| 6.2 | Définir l'état futur | Business Objectives | Objectifs métier | EN 129 (119) · FR 162 (149) · ST 10 | **À décider** — aucun objet ACTA ; soit une section de la page d'état futur, soit un futur objet si l'on veut tracer exigences → objectifs. |
| 6.2 | Définir l'état futur | Future State Description | Description de l'état futur | EN 129 (119) · FR 162 (149) · ST 10 | **Page** — pendant de la description de l'état actuel. |
| 6.2 | Définir l'état futur | Potential Value | Valeur potentielle | EN 129 (119) · FR 162 (149) · ST 10 | **Page** (ou section de la page d'état futur) — estimation rédigée, sans objet équivalent. |
| 6.3 | Évaluer les risques | Risk Analysis Results | Résultats de l'analyse des risques | EN 134 (124) · FR 168 (155) · ST 11 | **Risque** (tickets) — chaque risque est déjà un ticket ; une page de synthèse est facultative. |
| 6.4 | Définir la stratégie de changement | Change Strategy | Stratégie de changement | EN 141 (131) · FR 177 (164) · ST 11 | **Page** — choix argumenté de la trajectoire de changement, sans objet équivalent. |
| 6.4 | Définir la stratégie de changement | Solution Scope | Portée de la solution | EN 141 (131) · FR 177 (164) · ST 11 | **Page** — la fiche Initiative n'a qu'une description libre limitée à 4 000 caractères ; la portée mérite un document. |
| 7.1 | Spécifier et modéliser les exigences | Requirements (specified and modelled) | Exigences (spécifiées et modélisées) | EN 151 (141) · FR 188 (175) · ST 12 | **Exigence** pour la partie textuelle ; les modèles (diagrammes, matrices) relèvent d'une **page** liée aux exigences. |
| 7.2 | Vérifier les exigences | Requirements (verified) | Exigences (vérifiées) | EN 154 (144) · FR 191 (178) · ST 12 | **Exigence**, statut « Vérifiée ». |
| 7.3 | Valider les exigences | Requirements (validated) | Exigences (validées) | EN 157 (147) · FR 195 (182) · ST 12 | **Exigence**, statut « Validée ». |
| 7.4 | Définir l'architecture des exigences | Requirements Architecture | Architecture des exigences | EN 162 (152) · FR 201 (188) · ST 13 | **Mixte** — la structure vient des liens entre **Exigences** (parente, besoin) ; une **page** peut expliquer l'organisation retenue (points de vue, découpage). |
| 7.5 | Définir les options de conception | Design Options | Options de conception | EN 166 (156) · FR 206 (193) · ST 13 | **Page** — comparaison rédigée de plusieurs options. |
| 7.6 | Analyser la valeur potentielle et recommander une solution | Solution Recommendation | Recommandation de solution | EN 172 (162) · FR 211 (198) · ST 13 | **Page** ; la recommandation retenue peut être actée par un ticket **Décision**. |
| 8.1 | Mesurer les performances de la solution | Solution Performance Measures | Mesures de performance de la solution | EN 180 (170) · FR 221 (208) · ST 14 | **Page** — tableau de mesures rédigé ; ACTA n'a pas d'objet « mesure ». |
| 8.2 | Analyser les mesures de performance | Solution Performance Analysis | Analyse de la performance de la solution | EN 183 (173) · FR 226 (213) · ST 14 | **Page** — analyse rédigée des mesures de 8.1. |
| 8.3 | Évaluer les limites de la solution | Solution Limitation | Limites de la solution | EN 187 (177) · FR 230 (217) · ST 14 | **Page** — constat rédigé ; les défauts précis peuvent devenir des tickets. |
| 8.4 | Évaluer les limites de l'entreprise | Enterprise Limitation | Limites de l'entreprise | EN 192 (182) · FR 236 (223) · ST 14 | **Page** — pendant organisationnel de 8.3. |
| 8.5 | Recommander des actions pour augmenter la valeur de la solution | Recommended Actions | Actions recommandées | EN 196 (186) · FR 241 (228) · ST 14 | **Page** pour l'argumentaire ; chaque action retenue peut devenir un ticket (Action ou Epic). Attention : homonymie avec l'**Action** d'ACTA. |

**Total : 39 livrables** (30 tâches ; 9 tâches en produisent deux ou trois :
5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.4 en produisent deux, 6.2 en produit trois).

Bilan pour ACTA : 19 livrables se prêtent à une page (3.1–3.5, 4.1, 4.2, 6.1
état actuel, 6.2 état futur et valeur potentielle, 6.4 ×2, 7.5, 7.6, 8.1–8.5) ;
10 correspondent déjà à un objet (Exigence, Partie prenante, Risque, Demande de
changement : 4.5, 5.1, 5.2, 5.4 ×2, 5.5, 6.1 exigences métier, 6.3, 7.2, 7.3) ;
7 restent à décider (les 4 *Designs* de 5.1, 5.2, 5.3, 5.5 ; la priorité 5.3 ;
les objectifs métier 6.2 ; la marque « confirmé » 4.3) ; 2 sont mixtes (7.1,
7.4) ; 1 n'appelle ni page ni objet (4.4).

## Livrables partagés entre plusieurs tâches

Aucun nom de livrable n'est produit tel quel par deux tâches : le BABOK
distingue chaque livrable par un **état** entre parenthèses. Mais plusieurs
tâches produisent ou mettent à jour **le même objet** dans un état différent :

1. **Requirements / Exigences** — 7 tâches : 5.1 (*traced*), 5.2
   (*maintained*), 5.3 (*prioritized*), 5.5 (*approved*), 7.1 (*specified and
   modelled*), 7.2 (*verified*), 7.3 (*validated*). S'y ajoutent les **Business
   Requirements** (6.1), qui sont des exigences d'un type particulier. Avis :
   un seul objet **Exigence** dont le statut et les attributs portent ces états ;
   aucune page.
2. **Designs / Spécifications** — 4 tâches : 5.1, 5.2, 5.3, 5.5 (plus 5.4 pour
   l'évaluation des changements). Les livrables de 7.2 et 7.3, nommés
   « Requirements », couvrent aussi les conceptions d'après leur description.
   Avis : objet absent d'ACTA ; une **page** de conception liée aux exigences
   est la piste la plus simple, à faire valider.
3. **Elicitation Results / Résultats d'élicitation** — 2 tâches : 4.2
   (*unconfirmed*) puis 4.3 (*confirmed*). Avis : une seule **page** de compte
   rendu, dont l'état passe de non confirmé à confirmé.
4. **Change Assessment / Évaluation du changement** — une tâche (5.4) mais deux
   livrables jumeaux (exigences, spécifications). Avis : un seul objet,
   **Demande de changement**, qui vise une exigence ou une conception.
5. **Stakeholder Engagement Approach (3.2) / Stakeholder Engagement (4.5)** —
   noms proches, objets distincts : le premier est un plan (page), le second un
   état des parties prenantes. À ne pas fusionner.
6. **Business Analysis Approach (3.1)** — le guide indique que les autres
   livrables du domaine 3 (3.2 à 3.5) peuvent y être intégrés ou rester
   séparés. Avis : prévoir des pages distinctes, rangées sous la page
   d'approche dans l'arborescence.
7. **Solution Performance Measures (8.1) → Solution Performance Analysis
   (8.2)** et **Potential Value (6.2)** / tâche 7.6 : chaînes où un livrable
   alimente le suivant, sans partage de nom.

## Doutes de lecture et divergences EN/FR

- **Designs → « Spécifications »** dans les extrants du guide FR (5.1 à 5.5),
  alors que le glossaire FR (GL) traduit *design* par « conception » et que le
  guide FR lui-même parle d'« options de conception » (7.5). Les résumés d'ACTA
  (migration 0009) emploient « conceptions ». Choix du terme à faire valider.
- **Traced → « suivies »** (5.1) alors que la tâche s'intitule « Traçabilité
  des exigences » ; « tracées » serait plus cohérent, mais le nom officiel FR
  est « Exigences (suivies) ».
- **Article incohérent** : « Résultats d'élicitation (non confirmés) » (4.2) mais
  « Résultats de l'élicitation (confirmés) » (4.3). Noms relevés tels quels.
- **Nombre** : EN *Solution Limitation* / *Enterprise Limitation* (singulier),
  FR « Limites » (pluriel). EN *Recommended Actions* (pluriel) mais ST écrit
  *Recommended action* (singulier) ; le guide EN prévaut.
- **Orthographe** : EN guide *modelled* (britannique), ST *modeled*.
- **Majuscules** du guide FR : « Mesures de performance de la Solution » (8.1),
  « Stratégie de Changement » (6.4) ; normalisées en minuscules dans le tableau.
- **Glossaire FR (GL)** : il suit la variante « analyse d'affaires »
  (*business requirement* → « exigence d'affaires », *business objective* →
  « objectif d'affaires », *change strategy* → « stratégie de gestion du
  changement »), différente du guide FR « analyse métier ». Le guide FR, déjà
  retenu par la migration 0009, prévaut. GL confirme « portée de la solution »
  et « architecture des exigences ».
- **6.3** : dans les deux guides, le livrable n'a pas de puce (mise en page
  différente), mais il est bien seul dans la section 6.3.8 ; ST confirme.
- **Pages ST** : les tableaux ST ne portent qu'un numéro de page par domaine ;
  la colonne *Outputs* y est tronquée par l'extraction texte mais lisible à
  l'écran.
