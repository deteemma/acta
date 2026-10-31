# Règles de l'encart « Actions suggérées »

**Objet :** fixer la liste des règles de l'encart « Actions suggérées » du tableau de bord de l'initiative (ticket 14). Le ticket ne peut pas être développé avant que vous ayez validé cette liste : seules les règles que vous retiendrez ici seront mises en œuvre.

**De :** Emmanuel, **À :** la responsable fonctionnelle, **Utilisation de vos réponses :** elles deviennent le document de règles du ticket 14. Ce document vous sera renvoyé pour validation explicite avant le développement.

## Contexte

Le tableau de bord de l'initiative (ticket 12) montre, pour chaque domaine de connaissance, les tâches BABOK couvertes par des actions et celles qui ne le sont pas. L'encart « Actions suggérées » s'y ajoute : quand l'initiative se trouve dans une certaine situation, il propose une Action. Chaque suggestion affiche une justification d'une ligne et permet de créer l'Action en un clic. Elle disparaît dès que la situation qui l'a déclenchée n'existe plus. Les règles sont fixes et explicables : aucune intelligence artificielle, aucun apprentissage.

Une règle ne peut s'appuyer que sur ce qu'ACTA connaît en phase 1 :
- **l'initiative** : approche d'analyse, date de début, date de fin prévue ;
- **les membres** et leurs rôles ;
- **les actions** : tâche, technique, responsable, échéance, statut ;
- **les parties prenantes** : rôles BABOK, influence, intérêt, lien avec un compte ;
- **les besoins** : nature, parties prenantes d'origine ;
- **les exigences** : type, sous-type, statut, sources, besoins liés, exigence parente.

Les questions, décisions, risques et pages n'existent pas encore.

Pour rappel, le ticket 13 fixe déjà la tâche proposée **à la création** d'une Action, selon l'endroit d'où on la crée :
- initiative sans aucune action → 3.1 ;
- depuis une partie prenante → 3.2 ou 4.5 ;
- depuis un besoin → 6.1 ou 6.2 ;
- depuis une exigence Proposée → 7.2, Vérifiée → 7.3, Validée → 5.5 ;
- depuis toute exigence, 5.1 en second choix.

## Comment répondre

Comptez environ 45 minutes. Écrivez sous chaque question, après le chevron `>`. Une réponse partielle ou un « je ne sais pas » nous aide aussi : signalez vos doutes plutôt que de laisser une question vide. Les sections sont classées de la plus importante à la moins importante. Si vous manquez de temps, la section 1 suffit pour démarrer.

## 1. La liste des règles

### Lesquelles de ces situations doivent déclencher une suggestion, et laquelle ?

_Pourquoi c'est important : ces situations sont seulement celles que les données d'ACTA permettent de détecter. Ce ne sont pas des règles proposées. Rien ne sera retenu sans votre « oui »._

Pour chaque ligne, indiquez : oui ou non, la tâche BABOK proposée, la technique éventuelle et la justification à afficher (une ligne, en français).

| # | Situation détectable | Oui / non | Tâche BABOK | Technique | Justification affichée |
|---|---|---|---|---|---|
| 1 | L'initiative n'a aucune action | Oui | 3.1 | — | Aucune action n'est encore prévue : commencez par planifier l'approche de l'analyse. |
| 2 | L'approche d'analyse n'est pas renseignée | Oui | 3.1 | — | L'approche d'analyse, prédictive ou adaptative, n'est pas encore choisie. |
| 3 | L'initiative n'a aucune partie prenante | Oui | 3.2 | 10.43 | Aucune partie prenante n'est encore identifiée. |
| 4 | Aucune partie prenante n'a le rôle Sponsor | Oui | 3.2 | 10.43 | Aucune partie prenante n'a le rôle Sponsor. |
| 5 | Une partie prenante n'a pas d'influence ou pas d'intérêt renseigné | Oui | 3.2 | 10.43 | {n} partie(s) prenante(s) sans influence ou sans intérêt renseigné. |
| 6 | Une partie prenante n'est liée à aucune action | Oui | 4.5 | — | {n} partie(s) prenante(s) liée(s) à aucune action. |
| 7 | L'initiative n'a aucun besoin | Oui | 6.1 | 10.25 | Aucun besoin n'est encore identifié. |
| 8 | Un besoin n'a aucune partie prenante d'origine | Oui | 5.1 | — | {n} besoin(s) sans partie prenante d'origine. |
| 9 | Un besoin n'a aucune exigence liée | Oui | 7.1 | — | {n} besoin(s) sans exigence liée. |
| 10 | Une exigence n'a aucune source | Oui | 5.1 | — | {n} exigence(s) sans source. |
| 11 | Une exigence est au statut Proposée | Oui, depuis plus de 14 jours | 7.2 | 10.37 | {n} exigence(s) Proposée(s) depuis plus de 14 jours. |
| 12 | Une exigence est au statut Vérifiée | Oui, depuis plus de 14 jours | 7.3 | 10.37 | {n} exigence(s) Vérifiée(s) depuis plus de 14 jours. |
| 13 | Une exigence est au statut Validée | Oui, depuis plus de 14 jours | 5.5 | 10.37 | {n} exigence(s) Validée(s) depuis plus de 14 jours. |
| 14 | Une tâche BABOK n'est couverte par aucune action | Non | | | |
| 15 | Un domaine de connaissance n'est couvert par aucune action | Oui, pour chaque domaine, 8 compris | 1re tâche du domaine dans l'ordre du référentiel (3.1, 4.1, 5.1, 6.1, 7.1, 8.1) | — | Aucune action ne couvre le domaine « {domaine} ». |
| 16 | La date de fin prévue de l'initiative approche ou est dépassée | Oui, à partir de 30 jours avant, tant que l'initiative n'est pas archivée | 3.5 | — | La date de fin prévue est dans {n} jour(s). / La date de fin prévue est dépassée depuis {n} jour(s). |

> Ligne 14 écartée : le tableau de bord (ticket 12) montre déjà les tâches non couvertes, et l'encart serait noyé en début d'initiative.
>
> Titre de l'Action créée, par ligne :
> 1. Planifier l'approche de l'analyse
> 2. Choisir l'approche d'analyse
> 3. Identifier les parties prenantes
> 4. Identifier le sponsor
> 5. Évaluer l'influence et l'intérêt des parties prenantes
> 6. Associer les parties prenantes au travail d'analyse
> 7. Recueillir les besoins
> 8. Retrouver l'origine des besoins
> 9. Spécifier les exigences des besoins
> 10. Retrouver la source des exigences
> 11. Vérifier les exigences proposées
> 12. Valider les exigences vérifiées
> 13. Faire approuver les exigences validées
> 15. Le nom de la tâche proposée (par exemple « Préparer l'élicitation »)
> 16. Faire le bilan de l'analyse avant la fin de l'initiative
>
> Textes anglais (titre — justification), avec les termes du BABOK et ceux déjà employés par ACTA :
> 1. Plan the business analysis approach — No action is planned yet: start by planning the business analysis approach.
> 2. Choose the analysis approach — The analysis approach, predictive or adaptive, has not been chosen yet.
> 3. Identify stakeholders — No stakeholder has been identified yet.
> 4. Identify the sponsor — No stakeholder has the Sponsor role.
> 5. Assess stakeholder influence and interest — {n} stakeholder(s) without influence or interest set.
> 6. Involve stakeholders in the analysis work — {n} stakeholder(s) not linked to any action.
> 7. Elicit needs — No need has been identified yet.
> 8. Trace the origin of needs — {n} need(s) without an originating stakeholder.
> 9. Specify requirements for the needs — {n} need(s) without a linked requirement.
> 10. Trace the source of requirements — {n} requirement(s) without a source.
> 11. Verify proposed requirements — {n} requirement(s) Proposed for more than 14 days.
> 12. Validate verified requirements — {n} requirement(s) Verified for more than 14 days.
> 13. Get validated requirements approved — {n} requirement(s) Validated for more than 14 days.
> 15. English name of the proposed task (for example "Prepare for Elicitation") — No action covers the "{domain}" Knowledge Area.
> 16. Review the analysis before the initiative ends — The planned end date is in {n} day(s). / The planned end date passed {n} day(s) ago.

### Quelles autres situations doivent déclencher une suggestion ?

Ajoutez autant de lignes que nécessaire, avec les mêmes colonnes.

| Situation | Tâche BABOK | Technique | Justification affichée |
|---|---|---|---|
| | | | |

> Aucune pour l'instant.

### Une règle qui concerne un objet donne-t-elle une suggestion par objet, ou une seule pour toute l'initiative ?

_Pourquoi c'est important : avec 20 besoins sans exigence, l'encart montrerait soit 20 suggestions, soit une seule, du type « 20 besoins n'ont pas d'exigence »._

> Une seule suggestion, regroupée pour toute l'initiative (« {n} besoins sans exigence liée »).

### Certaines situations doivent-elles durer un certain temps avant de déclencher une suggestion ?

_Par exemple « exigence Proposée depuis plus de N jours » plutôt que « exigence Proposée ». Indiquez les règles concernées et la durée._

> Lignes 11, 12 et 13 seulement : l'exigence doit être à ce statut depuis plus de 14 jours. Ligne 16 : à partir de 30 jours avant la date de fin prévue. Toutes les autres règles se déclenchent dès que la situation existe.

### L'approche d'analyse (prédictive ou adaptative) change-t-elle certaines règles ?

> Non : les mêmes règles pour les deux approches en phase 1.

### Faut-il réutiliser les règles du ticket 13 à l'identique quand une suggestion porte sur le même objet ?

_Par exemple : pour une exigence Vérifiée, la suggestion de l'encart propose-t-elle forcément 7.3, comme à la création depuis cette exigence ?_

> Oui, toujours. Si une règle du ticket 13 change, la règle correspondante de l'encart change avec elle.

### Qui rédige la justification en anglais ?

_Toutes les justifications doivent exister en français et en anglais. Nous pouvons traduire vos textes et vous les soumettre pour relecture._

> Claude traduit les titres et les justifications avec les termes anglais officiels du BABOK, sans relecture de ma part. Traduction : sous le tableau de la section 1.

## 2. Disparition et priorité

### Une suggestion disparaît-elle dès qu'une Action est créée à partir d'elle, ou seulement quand la situation a changé ?

_Pourquoi c'est important : la suggestion « aucune partie prenante » peut donner une Action « Identifier les parties prenantes ». Tant qu'aucune partie prenante n'est saisie, la situation demeure : faut-il quand même continuer à la suggérer ?_

> Dès que l'Action est créée : la suggestion est masquée tant qu'une Action issue d'elle est À faire ou En cours. Elle disparaît aussi dès que la situation n'existe plus. Si l'Action issue d'elle est Terminée alors que la situation demeure, la suggestion réapparaît.

### Si l'Action créée depuis une suggestion est ensuite annulée, la suggestion doit-elle réapparaître ?

> Oui, si la situation demeure.

### Combien de suggestions l'encart affiche-t-il au plus ?

> 5 au plus ; un lien « voir tout » montre les autres.

### Dans quel ordre les suggestions s'affichent-elles ?

_Par exemple : selon l'ordre des domaines de connaissance du BABOK, selon une priorité que vous fixez par règle, ou de la plus ancienne situation à la plus récente._

> Dans l'ordre du référentiel BABOK de la tâche proposée. Quand deux règles proposent la même tâche, une seule suggestion s'affiche : celle qui porte sur des objets (parties prenantes, besoins, exigences) l'emporte sur celle qui porte sur toute l'initiative ; à égalité, la ligne au plus petit numéro.

## 3. Rejet et visibilité

### Un membre peut-il écarter une suggestion qu'il juge non pertinente ?

> Oui : un propriétaire ou un contributeur.

### Si oui, l'écart vaut-il pour lui seul ou pour toute l'équipe ?

> Pour toute l'équipe.

### Si oui, une suggestion écartée revient-elle un jour ?

_Par exemple : jamais, après un certain délai, ou quand la situation réapparaît après avoir disparu._

> Seulement si la situation disparaît puis réapparaît.

### Les lecteurs voient-ils l'encart ?

_Un lecteur ne peut pas créer d'Action. S'il voit l'encart, ce sera donc sans le bouton de création._

> Oui, sans bouton : ni création, ni écart.

### L'encart s'affiche-t-il sur une initiative archivée ?

_Une initiative archivée est en lecture seule : aucune Action ne peut y être créée._

> Non : l'encart est masqué.

## 4. Création en un clic

### « En un clic » : l'Action est-elle créée directement, ou le formulaire de création s'ouvre-t-il prérempli, à confirmer ?

> Créée directement ; sa fiche s'ouvre ensuite pour la compléter si besoin.

### Quel titre porte l'Action créée ?

_Un titre fixe par règle (par exemple « Identifier les parties prenantes »), le texte de la justification, ou autre chose._

> Un titre fixe par règle : voir la liste sous le tableau de la section 1.

### Qui en est le responsable par défaut ?

_Par exemple : le membre qui clique, ou le propriétaire de l'initiative._

> Le membre qui clique ; modifiable ensuite sur la fiche.

### La technique est-elle préremplie ?

_Si oui, selon le classement du ticket 13 (les techniques associées à la tâche, classées par fréquence d'usage), ou celle que vous indiquez dans la règle._

> Seulement la technique indiquée dans la règle (lignes 3, 4, 5, 7, 11, 12, 13). Pour les autres, laissée vide : elle se choisit sur la fiche, avec le classement du ticket 13.

### Une échéance est-elle préremplie ?

> Non.

### L'Action est-elle automatiquement liée à l'objet qui a déclenché la suggestion ?

_Par exemple : la partie prenante sans rôle Sponsor, le besoin sans exigence, l'exigence Proposée._

> Oui, à tous les objets concernés par la suggestion regroupée (parties prenantes, besoins, exigences). Aucun lien pour les règles qui portent sur toute l'initiative.

## Autre chose ?

Y a-t-il un point que nous n'avons pas abordé et que nous devrions connaître avant de développer cet encart ?

> Non.
