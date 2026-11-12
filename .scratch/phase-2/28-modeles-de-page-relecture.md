# Ticket 28 — Les 22 modèles de page (validés le 12.11.2026)

Document de relecture destiné à la responsable fonctionnelle (décision 09,
ADR-0012, ADR-0013). Les noms des modèles sont les noms officiels des livrables
du BABOK v3 en français et en anglais (recherche du ticket 06, branche
`research/livrables-babok-v3`) ; les plans et les textes d'aide sont rédigés
pour ACTA et ne reproduisent aucun texte de l'IIBA.

Après validation, ce document devient la source de la migration : chaque titre
de niveau 4 (`####`) devient un titre de la page, chaque paragraphe en italique
un texte d'aide, chaque tableau un tableau à remplir (une ligne vide sous
l'en-tête). Les apostrophes deviennent typographiques (’) dans les deux langues.
Toute correction après livraison passera par une nouvelle migration.

À contrôler : l'exactitude et l'utilité des plans, le ton des textes d'aide,
la fidélité de l'anglais au français, et qu'aucune phrase ne reprenne le texte
de l'IIBA.

## Points à trancher avant la migration

**Validé le 12.11.2026** par la responsable fonctionnelle : les six propositions
ci-dessous sont acceptées, et les 22 modèles validés tels quels. Source de la
migration `api/migrations/0026_modeles_de_page_livres.sql`.

1. **Nom anglais de « Conception » (5.1)** — le livrable officiel s'appelle
   *Designs* (au pluriel, avec un état entre parenthèses). Proposé : **Design**,
   au singulier comme « Conception », puisqu'une page porte une conception.
2. **Nom anglais de « Exigences spécifiées et modélisées » (7.1)** — le
   livrable officiel s'appelle *Requirements (specified and modelled)*.
   Proposé : **Specified and Modelled Requirements**, sans parenthèses comme
   le nom français.
3. **Résultats d'élicitation (4.2)** — le nom français retenu par la décision
   09 reprend celui du 4.2 sans « (non confirmés) » ; anglais proposé :
   **Elicitation Results**.
4. **Orthographe anglaise** — britannique, comme le guide anglais et les
   résumés du référentiel (*organisation*, *modelled*).
5. **Phrase d'introduction** — chaque modèle commence par la même ligne en
   italique : « Les textes en italique sont des aides : remplacez-les par votre
   contenu ou effacez-les. » Proposé pour que l'auteur sache quoi faire des
   aides ; à retirer si vous la jugez superflue.
6. **Retrait des deux modèles d'essai** — une page créée depuis un modèle
   garde un lien vers lui, et un modèle qui a servi ne se supprime pas (décision
   09, point 6). Si des pages ont déjà été créées depuis un modèle d'essai sur
   une installation, la migration ne peut pas le supprimer. Proposé : la
   migration supprime un modèle d'essai qui n'a jamais servi et **désactive**
   celui qui a servi (il n'est plus proposé ; les pages créées gardent leur
   mention « … (essai) »).

## 3 — Planification et surveillance de l'analyse métier

### 3.1 — Approche de l'analyse métier · *Business Analysis Approach*

Tâche : 3.1 Planifier l'approche de l'analyse métier · *Plan Business Analysis Approach*

**Français**

*Les textes en italique sont des aides : remplacez-les par votre contenu ou effacez-les.*

#### Objet et contexte

*Résumez le changement visé par l'initiative et ce que le travail d'analyse doit lui apporter.*

#### Démarche retenue

*Indiquez si l'analyse sera menée de façon prédictive, adaptative ou mixte, et ce qui justifie ce choix : degré d'incertitude, rythme des livraisons, contraintes réglementaires.*

#### Activités et livrables prévus

*Listez les principales activités d'analyse, ce qu'elles produiront, qui les mène et pour quand.*

| Activité | Livrable attendu | Responsable | Échéance |
|---|---|---|---|

#### Niveau de formalisme

*Précisez le degré de détail attendu pour les exigences et la documentation, et ce qui doit être approuvé formellement.*

#### Liens avec les autres approches

*Indiquez où se trouvent l'engagement des parties prenantes, la gouvernance et la gestion de l'information ; vous pouvez les rédiger dans des sous-pages de celle-ci.*

#### Hypothèses et points ouverts

*Notez les hypothèses sur lesquelles repose cette approche. Une question qui attend une réponse peut devenir un ticket Question.*

**English**

*Text in italics is guidance: replace it with your own content or delete it.*

#### Purpose and context

*Summarise the change the initiative aims for and what the analysis work should bring to it.*

#### Chosen approach

*State whether the analysis will be predictive, adaptive or mixed, and what justifies this choice: level of uncertainty, delivery pace, regulatory constraints.*

#### Planned activities and deliverables

*List the main analysis activities, what they will produce, who leads them and by when.*

| Activity | Expected deliverable | Owner | Due date |
|---|---|---|---|

#### Level of formality

*Specify the level of detail expected for requirements and documentation, and what must be formally approved.*

#### Links to the other approaches

*Indicate where stakeholder engagement, governance and information management are described; you can write them as child pages of this one.*

#### Assumptions and open points

*Note the assumptions this approach relies on. A question awaiting an answer can become a Question ticket.*

### 3.2 — Approche d'engagement des parties prenantes · *Stakeholder Engagement Approach*

Tâche : 3.2 Planifier l'engagement des parties prenantes · *Plan Stakeholder Engagement*

**Français**

*Les textes en italique sont des aides : remplacez-les par votre contenu ou effacez-les.*

#### Parties prenantes concernées

*La liste des parties prenantes et leur matrice influence × intérêt se tiennent dans l'écran Parties prenantes. Résumez ici les principaux groupes et ce qui les distingue.*

#### Mode de collaboration

*Pour chaque partie prenante ou groupe, indiquez comment il participera à l'analyse et à quel rythme.*

| Partie prenante ou groupe | Rôle dans l'analyse | Mode de participation | Fréquence |
|---|---|---|---|

#### Communication

*Indiquez quelles informations seront transmises, à qui, sous quelle forme et à quel moment.*

| Information | Destinataires | Support | Moment |
|---|---|---|---|

#### Points d'attention

*Notez les attentes divergentes, les résistances prévisibles et les disponibilités limitées, ainsi que la manière d'en tenir compte.*

**English**

*Text in italics is guidance: replace it with your own content or delete it.*

#### Stakeholders involved

*The list of stakeholders and their influence × interest matrix are kept in the Stakeholders screen. Summarise here the main groups and what sets them apart.*

#### Collaboration

*For each stakeholder or group, state how they will take part in the analysis and how often.*

| Stakeholder or group | Role in the analysis | Form of participation | Frequency |
|---|---|---|---|

#### Communication

*State which information will be shared, with whom, in what form and when.*

| Information | Recipients | Medium | Timing |
|---|---|---|---|

#### Points of attention

*Note diverging expectations, foreseeable resistance and limited availability, and how they will be taken into account.*

### 3.3 — Approche de la gouvernance · *Governance Approach*

Tâche : 3.3 Planifier la gouvernance de l'analyse métier · *Plan Business Analysis Governance*

**Français**

*Les textes en italique sont des aides : remplacez-les par votre contenu ou effacez-les.*

#### Qui décide quoi

*Indiquez, pour chaque sujet de décision, qui décide, qui est consulté et dans quel délai une réponse est attendue.*

| Sujet de décision | Décideur | Personnes consultées | Délai attendu |
|---|---|---|---|

#### Priorités

*Décrivez comment les priorités sont fixées et revues, et qui tranche en cas de désaccord.*

#### Approbation

*Précisez ce qui doit être approuvé (exigences, conceptions, pages), par qui, et comment l'approbation est consignée.*

#### Changements

*Décrivez le circuit d'une demande de changement : qui peut la soumettre, qui l'analyse, qui décide. Dans ACTA, chaque demande est un ticket Demande de changement, et chaque arbitrage peut être consigné dans un ticket Décision.*

#### Escalade

*Indiquez vers qui un désaccord est remonté, et dans quels cas.*

**English**

*Text in italics is guidance: replace it with your own content or delete it.*

#### Who decides what

*For each decision topic, state who decides, who is consulted and how soon an answer is expected.*

| Decision topic | Decision maker | People consulted | Expected turnaround |
|---|---|---|---|

#### Priorities

*Describe how priorities are set and reviewed, and who settles disagreements.*

#### Approval

*Specify what must be approved (requirements, designs, pages), by whom, and how approval is recorded.*

#### Changes

*Describe the path of a change request: who may submit it, who analyses it, who decides. In ACTA, each request is a Change request ticket, and each ruling can be recorded in a Decision ticket.*

#### Escalation

*State to whom a disagreement is escalated, and in which cases.*

### 3.4 — Approche de la gestion de l'information · *Information Management Approach*

Tâche : 3.4 Planifier la gestion de l'information de l'analyse métier · *Plan Business Analysis Information Management*

**Français**

*Les textes en italique sont des aides : remplacez-les par votre contenu ou effacez-les.*

#### Organisation de l'information

*Décrivez comment l'information de l'initiative est rangée : arborescence des pages, conventions de titre, usage des Epics pour regrouper les tickets.*

#### Niveau de détail

*Précisez le niveau de détail attendu selon le type d'information et selon ses lecteurs.*

#### Traçabilité

*Indiquez quels liens sont tenus systématiquement (besoin et exigence, exigence et page de conception, exigence et ticket) et qui les tient à jour.*

#### Accès et confidentialité

*Précisez qui doit pouvoir lire ou modifier l'information, et quelles informations sensibles demandent une attention particulière.*

#### Conservation et réutilisation

*Notez ce qui doit pouvoir resservir après l'initiative, sous quelle forme et où cela sera conservé.*

**English**

*Text in italics is guidance: replace it with your own content or delete it.*

#### Organising information

*Describe how the initiative's information is organised: page tree, title conventions, use of Epics to group tickets.*

#### Level of detail

*Specify the level of detail expected for each type of information and each audience.*

#### Traceability

*State which links are always maintained (need and requirement, requirement and design page, requirement and ticket) and who keeps them up to date.*

#### Access and confidentiality

*Specify who should be able to read or change the information, and which sensitive information needs particular care.*

#### Retention and reuse

*Note what should remain usable after the initiative, in what form and where it will be kept.*

### 3.5 — Évaluation de la performance de l'analyse métier · *Business Analysis Performance Assessment*

Tâche : 3.5 Identifier les améliorations de performance de l'analyse métier · *Identify Business Analysis Performance Improvements*

**Français**

*Les textes en italique sont des aides : remplacez-les par votre contenu ou effacez-les.*

#### Période et périmètre

*Indiquez la période et la partie du travail d'analyse sur lesquelles porte ce bilan.*

#### Ce qui a bien fonctionné

*Notez les pratiques à conserver et ce qui les a rendues efficaces.*

#### Difficultés rencontrées

*Décrivez les difficultés, leurs effets sur le travail et leurs causes probables.*

#### Mesures

*Si des mesures ont été suivies (délais, retours des parties prenantes, reprises d'exigences), reportez-les ici.*

| Mesure | Valeur visée | Valeur constatée | Commentaire |
|---|---|---|---|

#### Améliorations décidées

*Listez ce que l'équipe fera autrement. Une amélioration retenue peut devenir un ticket Action.*

| Amélioration | Responsable | Échéance |
|---|---|---|

**English**

*Text in italics is guidance: replace it with your own content or delete it.*

#### Period and scope

*State the period and the part of the analysis work this review covers.*

#### What worked well

*Note the practices to keep and what made them effective.*

#### Difficulties encountered

*Describe the difficulties, their effects on the work and their likely causes.*

#### Measures

*If measures were tracked (lead times, stakeholder feedback, reworked requirements), record them here.*

| Measure | Target value | Observed value | Comment |
|---|---|---|---|

#### Improvements decided

*List what the team will do differently. An improvement that is adopted can become an Action ticket.*

| Improvement | Owner | Due date |
|---|---|---|

## 4 — Élicitation et collaboration

### 4.1 — Plan d'activités d'élicitation · *Elicitation Activity Plan*

Tâche : 4.1 Préparer l'élicitation · *Prepare for Elicitation*

**Français**

*Les textes en italique sont des aides : remplacez-les par votre contenu ou effacez-les.*

#### Objectif

*Indiquez ce que cette activité doit permettre d'apprendre ou de décider, et les besoins ou exigences qu'elle concerne.*

#### Technique et format

*Précisez la technique retenue (entretien, atelier, observation, questionnaire, étude de documents…), la date, la durée et le lieu ou l'outil de visioconférence.*

#### Participants

| Participant | Rôle dans l'activité | Présence confirmée |
|---|---|---|

#### Préparation

*Listez les documents à lire ou à envoyer avant l'activité, et ce que les participants doivent préparer.*

#### Déroulé et questions

| Séquence | Durée | Sujets ou questions |
|---|---|---|

#### Logistique

*Notez la salle, le matériel, les invitations et, le cas échéant, l'accord des participants pour un enregistrement.*

**English**

*Text in italics is guidance: replace it with your own content or delete it.*

#### Objective

*State what this activity should help learn or decide, and which needs or requirements it concerns.*

#### Technique and format

*Specify the chosen technique (interview, workshop, observation, survey, document analysis…), the date, the duration and the venue or video-conferencing tool.*

#### Participants

| Participant | Role in the activity | Attendance confirmed |
|---|---|---|

#### Preparation

*List the documents to read or send before the activity, and what participants need to prepare.*

#### Agenda and questions

| Segment | Duration | Topics or questions |
|---|---|---|

#### Logistics

*Note the room, equipment, invitations and, where relevant, participants' consent to a recording.*

### 4.2 — Résultats d'élicitation · *Elicitation Results*

Tâche : 4.2 Conduire l'élicitation · *Conduct Elicitation*

**Français**

*Les textes en italique sont des aides : remplacez-les par votre contenu ou effacez-les.*

#### Activité

*Indiquez la date, la technique, les participants et la référence de la page du plan d'activités d'élicitation, s'il y en a une.*

#### Ce qui a été recueilli

*Consignez ce qui a été dit, montré ou observé, sans l'interpréter encore. Précisez qui l'a exprimé quand c'est utile.*

#### Besoins et exigences pressentis

*Notez les besoins et les exigences qui se dégagent. Une fois créés dans ACTA, citez leurs références ici et liez-les à cette page.*

#### Questions ouvertes

*Notez ce qui reste à éclaircir. Une question qui attend une réponse peut devenir un ticket Question.*

#### Confirmation

*Vérifiez ces résultats auprès des participants ou en les recoupant avec d'autres sources. Pour les confirmer, déclarez une version de la page, en indiquant dans sa note qui a confirmé et comment.*

**English**

*Text in italics is guidance: replace it with your own content or delete it.*

#### Activity

*State the date, the technique, the participants and the reference of the elicitation activity plan page, if there is one.*

#### What was captured

*Record what was said, shown or observed, without interpreting it yet. Note who expressed it where useful.*

#### Emerging needs and requirements

*Note the needs and requirements that emerge. Once they exist in ACTA, quote their references here and link them to this page.*

#### Open questions

*Note what still needs clarifying. A question awaiting an answer can become a Question ticket.*

#### Confirmation

*Check these results with the participants or against other sources. To confirm them, declare a version of the page, stating in its note who confirmed and how.*

## 5 — Gestion du cycle de vie des exigences

### 5.1 — Conception · *Design*

Tâche : 5.1 Traçabilité des exigences · *Trace Requirements*

**Français**

*Les textes en italique sont des aides : remplacez-les par votre contenu ou effacez-les.*

#### Objet

*Indiquez ce que représente cette conception (écran, processus, règle de calcul, interface, rapport…) et le besoin auquel elle répond.*

#### Exigences couvertes

*Liez cette page aux exigences qu'elle met en œuvre et indiquez comment elle répond à chacune.*

| Exigence | Réponse apportée par la conception |
|---|---|

#### Description

*Décrivez la conception : enchaînement, règles, données, présentation. Vous pouvez insérer des images ou joindre des fichiers à la page.*

#### Choix et alternatives écartées

*Expliquez les choix faits et pourquoi d'autres possibilités ont été écartées.*

#### Approbation et changements

*Indiquez qui doit approuver cette conception et où en est l'approbation. Une modification demandée après approbation passe par un ticket Demande de changement.*

**English**

*Text in italics is guidance: replace it with your own content or delete it.*

#### Subject

*State what this design represents (screen, process, calculation rule, interface, report…) and the need it addresses.*

#### Requirements covered

*Link this page to the requirements it implements and state how it addresses each of them.*

| Requirement | How the design addresses it |
|---|---|

#### Description

*Describe the design: flow, rules, data, presentation. You can insert images or attach files to the page.*

#### Choices and discarded alternatives

*Explain the choices made and why other possibilities were discarded.*

#### Approval and changes

*State who must approve this design and where approval stands. A change requested after approval goes through a Change request ticket.*

## 6 — Analyse de la stratégie

### 6.1 — Description de l'état actuel · *Current State Description*

Tâche : 6.1 Analyser l'état actuel · *Analyze Current State*

**Français**

*Les textes en italique sont des aides : remplacez-les par votre contenu ou effacez-les.*

#### Besoin métier

*Décrivez le problème ou l'opportunité à l'origine de l'initiative, et citez les besoins correspondants.*

#### Périmètre observé

*Précisez les équipes, les processus et les outils décrits dans cette page.*

#### Organisation et rôles

*Décrivez qui fait quoi aujourd'hui, et comment les équipes concernées travaillent ensemble.*

#### Processus et outils

*Décrivez comment le travail se fait aujourd'hui, étape par étape, et les outils utilisés.*

#### Règles et contraintes

*Notez les règles internes, les obligations légales et les contraintes qui encadrent le fonctionnement actuel.*

#### Difficultés constatées

*Notez les problèmes observés, leurs effets et, si possible, leur ampleur.*

#### Points forts à conserver

*Notez ce qui fonctionne bien et doit survivre au changement.*

**English**

*Text in italics is guidance: replace it with your own content or delete it.*

#### Business need

*Describe the problem or opportunity behind the initiative, and quote the related needs.*

#### Scope observed

*Specify the teams, processes and tools described in this page.*

#### Organisation and roles

*Describe who does what today, and how the teams involved work together.*

#### Processes and tools

*Describe how the work is done today, step by step, and the tools used.*

#### Rules and constraints

*Note the internal rules, legal obligations and constraints that frame how things work today.*

#### Issues observed

*Note the problems observed, their effects and, where possible, their extent.*

#### Strengths to keep

*Note what works well and should survive the change.*

### 6.2 — Description de l'état futur · *Future State Description*

Tâche : 6.2 Définir l'état futur · *Define Future State*

**Français**

*Les textes en italique sont des aides : remplacez-les par votre contenu ou effacez-les.*

#### Vision

*Décrivez en quelques phrases l'organisation une fois le besoin satisfait.*

#### Objectifs métier

*Formulez les objectifs que le changement doit atteindre, mesurables et datés autant que possible. Pour montrer qu'une exigence sert ces objectifs, liez-la à cette page.*

| Objectif | Indicateur | Valeur actuelle | Valeur visée | Échéance |
|---|---|---|---|---|

#### Changements attendus

*Indiquez ce qui devra être différent de l'état actuel : processus, organisation, outils, compétences.*

#### Contraintes

*Notez ce que l'état futur doit respecter : budget, délais, obligations légales, choix déjà arrêtés.*

#### Hypothèses

*Notez les hypothèses sur lesquelles repose cette description, pour pouvoir les vérifier plus tard.*

**English**

*Text in italics is guidance: replace it with your own content or delete it.*

#### Vision

*Describe in a few sentences what the organisation looks like once the need is met.*

#### Business objectives

*State the objectives the change must achieve, measurable and dated wherever possible. To show that a requirement serves these objectives, link it to this page.*

| Objective | Indicator | Current value | Target value | Due date |
|---|---|---|---|---|

#### Expected changes

*State what will have to differ from the current state: processes, organisation, tools, skills.*

#### Constraints

*Note what the future state must respect: budget, deadlines, legal obligations, choices already made.*

#### Assumptions

*Note the assumptions this description relies on, so they can be checked later.*

### 6.2 — Valeur potentielle · *Potential Value*

Tâche : 6.2 Définir l'état futur · *Define Future State*

**Français**

*Les textes en italique sont des aides : remplacez-les par votre contenu ou effacez-les.*

#### Bénéfices attendus

*Listez les bénéfices que le changement peut apporter, pour qui, et comment les mesurer.*

| Bénéfice | Bénéficiaires | Mesure | Estimation |
|---|---|---|---|

#### Coûts et efforts

*Estimez ce que le changement demandera : investissement, fonctionnement, temps des équipes.*

#### Incertitudes

*Indiquez ce qui pourrait réduire la valeur attendue. Les risques précis se suivent dans des tickets Risque.*

#### Hypothèses d'estimation

*Notez les hypothèses et les sources des chiffres avancés.*

#### Synthèse

*Résumez en quelques lignes la valeur que l'on peut raisonnablement attendre.*

**English**

*Text in italics is guidance: replace it with your own content or delete it.*

#### Expected benefits

*List the benefits the change may bring, for whom, and how to measure them.*

| Benefit | Beneficiaries | Measure | Estimate |
|---|---|---|---|

#### Costs and effort

*Estimate what the change will require: investment, running costs, team time.*

#### Uncertainties

*State what could reduce the expected value. Specific risks are tracked in Risk tickets.*

#### Estimation assumptions

*Note the assumptions and sources behind the figures given.*

#### Summary

*Summarise in a few lines the value that can reasonably be expected.*

### 6.4 — Stratégie de changement · *Change Strategy*

Tâche : 6.4 Définir la stratégie de changement · *Define Change Strategy*

**Français**

*Les textes en italique sont des aides : remplacez-les par votre contenu ou effacez-les.*

#### Point de départ et point d'arrivée

*Résumez l'écart entre l'état actuel et l'état futur, en citant les pages qui les décrivent.*

#### Options envisagées

*Comparez les manières possibles de combler cet écart.*

| Option | Avantages | Inconvénients | Coût estimé | Risques |
|---|---|---|---|---|

#### Option retenue

*Indiquez l'option choisie et ce qui justifie ce choix. La décision peut être consignée dans un ticket Décision.*

#### Étapes de transition

*Décrivez les étapes pour passer de l'état actuel à l'état futur, et ce que chacune livre.*

| Étape | Contenu | Échéance visée |
|---|---|---|

#### Préparation de l'organisation

*Notez ce qu'il faut pour que les personnes concernées adoptent le changement : formation, communication, accompagnement.*

**English**

*Text in italics is guidance: replace it with your own content or delete it.*

#### Starting point and destination

*Summarise the gap between the current state and the future state, quoting the pages that describe them.*

#### Options considered

*Compare the possible ways of closing this gap.*

| Option | Advantages | Drawbacks | Estimated cost | Risks |
|---|---|---|---|---|

#### Chosen option

*State the option chosen and what justifies it. The decision can be recorded in a Decision ticket.*

#### Transition steps

*Describe the steps for moving from the current state to the future state, and what each one delivers.*

| Step | Content | Target date |
|---|---|---|

#### Organisational readiness

*Note what the people concerned need in order to adopt the change: training, communication, support.*

### 6.4 — Portée de la solution · *Solution Scope*

Tâche : 6.4 Définir la stratégie de changement · *Define Change Strategy*

**Français**

*Les textes en italique sont des aides : remplacez-les par votre contenu ou effacez-les.*

#### Ce que couvre la solution

*Listez ce qui fait partie de la solution et ce qui en est exclu, avec la raison quand elle n'est pas évidente.*

| Élément | Inclus ou exclu | Commentaire |
|---|---|---|

#### Utilisateurs et parties concernées

*Indiquez qui utilisera la solution ou sera touché par elle.*

#### Interfaces et dépendances

*Notez les systèmes, équipes ou projets avec lesquels la solution devra s'articuler.*

#### Hypothèses et contraintes

*Notez ce qui conditionne cette portée et pourrait la faire évoluer.*

**English**

*Text in italics is guidance: replace it with your own content or delete it.*

#### What the solution covers

*List what is part of the solution and what is excluded, with the reason when it is not obvious.*

| Item | In or out of scope | Comment |
|---|---|---|

#### Users and parties affected

*State who will use the solution or be affected by it.*

#### Interfaces and dependencies

*Note the systems, teams or projects the solution will have to work with.*

#### Assumptions and constraints

*Note what this scope depends on and what could make it change.*

## 7 — Analyse des exigences et spécification de la conception

### 7.1 — Exigences spécifiées et modélisées · *Specified and Modelled Requirements*

Tâche : 7.1 Spécifier et modéliser les exigences · *Specify and Model Requirements*

**Français**

*Les textes en italique sont des aides : remplacez-les par votre contenu ou effacez-les.*

#### Objet

*Indiquez l'ensemble d'exigences que cette page modélise. Les exigences elles-mêmes restent des exigences d'ACTA : liez-les à cette page.*

#### Modèles

*Insérez ou joignez les diagrammes (processus, données, cas d'utilisation, états…) et expliquez leur notation si elle n'est pas évidente.*

#### Matrices

*Croisez les exigences avec ce qui les éclaire : acteurs, processus, données, règles.*

| Exigence | Élément croisé | Remarque |
|---|---|---|

#### Définitions

*Définissez les termes métier employés, pour que tous les lecteurs les comprennent de la même façon.*

#### Points ouverts

*Notez ce qui reste à préciser. Une question qui attend une réponse peut devenir un ticket Question.*

**English**

*Text in italics is guidance: replace it with your own content or delete it.*

#### Subject

*State the set of requirements this page models. The requirements themselves remain ACTA requirements: link them to this page.*

#### Models

*Insert or attach the diagrams (process, data, use case, state…) and explain their notation if it is not obvious.*

#### Matrices

*Cross-reference the requirements with what sheds light on them: actors, processes, data, rules.*

| Requirement | Related item | Remark |
|---|---|---|

#### Definitions

*Define the business terms used, so that every reader understands them the same way.*

#### Open points

*Note what still needs specifying. A question awaiting an answer can become a Question ticket.*

### 7.4 — Architecture des exigences · *Requirements Architecture*

Tâche : 7.4 Définir l'architecture des exigences · *Define Requirements Architecture*

**Français**

*Les textes en italique sont des aides : remplacez-les par votre contenu ou effacez-les.*

#### Points de vue retenus

*Indiquez sous quels angles les exigences sont organisées (processus, données, utilisateurs, règles…) et pourquoi.*

#### Découpage

*Décrivez comment les exigences sont regroupées. Les liens entre exigences (besoin, exigence parente) en donnent la structure détaillée.*

| Ensemble | Contenu | Pages ou Epics associés |
|---|---|---|

#### Articulation des modèles

*Expliquez comment les pages de modélisation et de conception se complètent.*

#### Complétude et cohérence

*Notez les manques ou les contradictions repérés et la manière de les traiter.*

**English**

*Text in italics is guidance: replace it with your own content or delete it.*

#### Viewpoints chosen

*State from which angles the requirements are organised (processes, data, users, rules…) and why.*

#### Breakdown

*Describe how the requirements are grouped. The links between requirements (need, parent requirement) give the detailed structure.*

| Set | Content | Related pages or Epics |
|---|---|---|

#### How the models fit together

*Explain how the modelling and design pages complement each other.*

#### Completeness and consistency

*Note the gaps or contradictions found and how they will be handled.*

### 7.5 — Options de conception · *Design Options*

Tâche : 7.5 Définir les options de conception · *Define Design Options*

**Français**

*Les textes en italique sont des aides : remplacez-les par votre contenu ou effacez-les.*

#### Exigences visées

*Indiquez les exigences auxquelles les options doivent répondre, et liez-les à cette page.*

#### Options

*Décrivez chaque option envisagée et ce qu'elle couvre.*

| Option | Description | Exigences couvertes | Avantages | Limites |
|---|---|---|---|---|

#### Acheter, réutiliser ou développer

*Pour chaque option, indiquez ce qui existe déjà, ce qui s'achète et ce qui doit être construit.*

#### Critères de comparaison

*Notez les critères qui serviront à départager les options. La recommandation se rédige dans une page « Recommandation de solution ».*

**English**

*Text in italics is guidance: replace it with your own content or delete it.*

#### Requirements addressed

*State the requirements the options must meet, and link them to this page.*

#### Options

*Describe each option considered and what it covers.*

| Option | Description | Requirements covered | Advantages | Limits |
|---|---|---|---|---|

#### Buy, reuse or build

*For each option, state what already exists, what can be bought and what must be built.*

#### Comparison criteria

*Note the criteria that will be used to choose between the options. The recommendation is written in a "Solution Recommendation" page.*

### 7.6 — Recommandation de solution · *Solution Recommendation*

Tâche : 7.6 Analyser la valeur potentielle et recommander une solution · *Analyze Potential Value and Recommend Solution*

**Français**

*Les textes en italique sont des aides : remplacez-les par votre contenu ou effacez-les.*

#### Options évaluées

*Rappelez les options comparées, en citant la page des options de conception.*

#### Valeur de chaque option

| Option | Bénéfices | Coûts | Risques | Valeur estimée |
|---|---|---|---|---|

#### Recommandation

*Indiquez l'option recommandée et ce qui la justifie. Si elle est retenue, la décision peut être consignée dans un ticket Décision.*

#### Conditions et limites

*Notez les conditions de réussite et ce qui reste incertain.*

#### Prochaines étapes

*Indiquez ce qui doit suivre si la recommandation est acceptée.*

**English**

*Text in italics is guidance: replace it with your own content or delete it.*

#### Options assessed

*Recall the options compared, quoting the design options page.*

#### Value of each option

| Option | Benefits | Costs | Risks | Estimated value |
|---|---|---|---|---|

#### Recommendation

*State the recommended option and what justifies it. If it is adopted, the decision can be recorded in a Decision ticket.*

#### Conditions and limits

*Note the conditions for success and what remains uncertain.*

#### Next steps

*State what should follow if the recommendation is accepted.*

## 8 — Évaluation de la solution

### 8.1 — Mesures de performance de la solution · *Solution Performance Measures*

Tâche : 8.1 Mesurer les performances de la solution · *Measure Solution Performance*

**Français**

*Les textes en italique sont des aides : remplacez-les par votre contenu ou effacez-les.*

#### Objectifs suivis

*Rappelez les objectifs que la solution doit servir, en citant la page de description de l'état futur.*

#### Mesures

*Pour chaque mesure, indiquez l'objectif servi, la manière de la recueillir et la valeur visée.*

| Mesure | Objectif servi | Méthode de collecte | Fréquence | Valeur visée | Valeur constatée |
|---|---|---|---|---|---|

#### Sources et fiabilité

*Indiquez d'où viennent les données et ce qui pourrait fausser les résultats.*

#### Période de mesure

*Précisez la période couverte et la date des prochaines mesures.*

**English**

*Text in italics is guidance: replace it with your own content or delete it.*

#### Objectives tracked

*Recall the objectives the solution must serve, quoting the future state description page.*

#### Measures

*For each measure, state the objective it serves, how it is collected and the target value.*

| Measure | Objective served | Collection method | Frequency | Target value | Observed value |
|---|---|---|---|---|---|

#### Sources and reliability

*State where the data comes from and what could distort the results.*

#### Measurement period

*Specify the period covered and the date of the next measurements.*

### 8.2 — Analyse de la performance de la solution · *Solution Performance Analysis*

Tâche : 8.2 Analyser les mesures de performance · *Analyze Performance Measures*

**Français**

*Les textes en italique sont des aides : remplacez-les par votre contenu ou effacez-les.*

#### Période et sources

*Indiquez la période analysée et citez la page des mesures de performance.*

#### Écarts constatés

| Mesure | Valeur visée | Valeur constatée | Écart | Explication |
|---|---|---|---|---|

#### Interprétation

*Expliquez les tendances observées et ce qu'elles disent de la valeur apportée par la solution.*

#### Risques

*Notez ce que ces résultats révèlent comme risques. Les risques précis se suivent dans des tickets Risque.*

#### Conclusions

*Résumez si la solution apporte la valeur attendue et ce qui mérite d'être approfondi.*

**English**

*Text in italics is guidance: replace it with your own content or delete it.*

#### Period and sources

*State the period analysed and quote the performance measures page.*

#### Gaps observed

| Measure | Target value | Observed value | Gap | Explanation |
|---|---|---|---|---|

#### Interpretation

*Explain the trends observed and what they say about the value the solution delivers.*

#### Risks

*Note the risks these results reveal. Specific risks are tracked in Risk tickets.*

#### Conclusions

*Summarise whether the solution delivers the expected value and what deserves a closer look.*

### 8.3 — Limites de la solution · *Solution Limitation*

Tâche : 8.3 Évaluer les limites de la solution · *Assess Solution Limitations*

**Français**

*Les textes en italique sont des aides : remplacez-les par votre contenu ou effacez-les.*

#### Solution évaluée

*Précisez la solution ou la partie de solution examinée, et la période.*

#### Limites constatées

*Décrivez ce qui, dans la solution elle-même, l'empêche d'apporter toute la valeur attendue.*

| Limite | Effet sur la valeur | Cause probable | Gravité |
|---|---|---|---|

#### Causes

*Expliquez les causes identifiées et comment elles ont été établies.*

#### Pistes de correction

*Notez les corrections possibles. Un défaut précis peut devenir un ticket ; les actions proposées se rassemblent dans une page « Actions recommandées ».*

**English**

*Text in italics is guidance: replace it with your own content or delete it.*

#### Solution assessed

*Specify the solution or part of the solution examined, and the period.*

#### Limitations observed

*Describe what, within the solution itself, prevents it from delivering the full expected value.*

| Limitation | Effect on value | Likely cause | Severity |
|---|---|---|---|

#### Causes

*Explain the causes identified and how they were established.*

#### Possible remedies

*Note the possible remedies. A specific defect can become a ticket; proposed actions are gathered in a "Recommended Actions" page.*

### 8.4 — Limites de l'entreprise · *Enterprise Limitation*

Tâche : 8.4 Évaluer les limites de l'entreprise · *Assess Enterprise Limitations*

**Français**

*Les textes en italique sont des aides : remplacez-les par votre contenu ou effacez-les.*

#### Contexte

*Précisez la solution concernée et les parties de l'organisation examinées.*

#### Limites constatées

*Décrivez ce qui, hors de la solution, empêche d'en tirer toute la valeur : organisation, culture, compétences, processus, outils voisins.*

| Limite | Domaine | Effet sur la valeur | Cause probable |
|---|---|---|---|

#### Adoption

*Notez comment la solution est réellement utilisée et ce qui freine son adoption.*

#### Pistes de correction

*Notez les changements possibles dans l'organisation. Les actions proposées se rassemblent dans une page « Actions recommandées ».*

**English**

*Text in italics is guidance: replace it with your own content or delete it.*

#### Context

*Specify the solution concerned and the parts of the organisation examined.*

#### Limitations observed

*Describe what, outside the solution, prevents the organisation from getting its full value: structure, culture, skills, processes, neighbouring tools.*

| Limitation | Area | Effect on value | Likely cause |
|---|---|---|---|

#### Adoption

*Note how the solution is actually used and what holds back its adoption.*

#### Possible remedies

*Note the possible changes within the organisation. Proposed actions are gathered in a "Recommended Actions" page.*

### 8.5 — Actions recommandées · *Recommended Actions*

Tâche : 8.5 Recommander des actions pour augmenter la valeur de la solution · *Recommend Actions to Increase Solution Value*

**Français**

*Les textes en italique sont des aides : remplacez-les par votre contenu ou effacez-les.*

#### Constat

*Résumez les écarts de valeur relevés, en citant les pages d'analyse de la performance et de limites.*

#### Actions envisagées

*Listez les actions qui pourraient augmenter la valeur de la solution, y compris celle de ne rien changer.*

| Action recommandée | Valeur attendue | Coût ou effort | Priorité proposée |
|---|---|---|---|

#### Recommandation

*Indiquez les actions recommandées et ce qui justifie ce choix.*

#### Suivi

*Les actions recommandées sont des propositions. Une action retenue peut devenir un ticket Action : créez-le et citez sa référence ici.*

**English**

*Text in italics is guidance: replace it with your own content or delete it.*

#### Findings

*Summarise the value gaps identified, quoting the performance analysis and limitation pages.*

#### Actions considered

*List the actions that could increase the solution's value, including leaving things as they are.*

| Recommended action | Expected value | Cost or effort | Proposed priority |
|---|---|---|---|

#### Recommendation

*State the actions recommended and what justifies this choice.*

#### Follow-up

*Recommended actions are proposals. An action that is adopted can become an Action ticket: create it and quote its reference here.*
