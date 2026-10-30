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
| 1 | L'initiative n'a aucune action | | | | |
| 2 | L'approche d'analyse n'est pas renseignée | | | | |
| 3 | L'initiative n'a aucune partie prenante | | | | |
| 4 | Aucune partie prenante n'a le rôle Sponsor | | | | |
| 5 | Une partie prenante n'a pas d'influence ou pas d'intérêt renseigné | | | | |
| 6 | Une partie prenante n'est liée à aucune action | | | | |
| 7 | L'initiative n'a aucun besoin | | | | |
| 8 | Un besoin n'a aucune partie prenante d'origine | | | | |
| 9 | Un besoin n'a aucune exigence liée | | | | |
| 10 | Une exigence n'a aucune source | | | | |
| 11 | Une exigence est au statut Proposée | | | | |
| 12 | Une exigence est au statut Vérifiée | | | | |
| 13 | Une exigence est au statut Validée | | | | |
| 14 | Une tâche BABOK n'est couverte par aucune action | | | | |
| 15 | Un domaine de connaissance n'est couvert par aucune action | | | | |
| 16 | La date de fin prévue de l'initiative approche ou est dépassée | | | | |

>

### Quelles autres situations doivent déclencher une suggestion ?

Ajoutez autant de lignes que nécessaire, avec les mêmes colonnes.

| Situation | Tâche BABOK | Technique | Justification affichée |
|---|---|---|---|
| | | | |

>

### Une règle qui concerne un objet donne-t-elle une suggestion par objet, ou une seule pour toute l'initiative ?

_Pourquoi c'est important : avec 20 besoins sans exigence, l'encart montrerait soit 20 suggestions, soit une seule, du type « 20 besoins n'ont pas d'exigence »._

>

### Certaines situations doivent-elles durer un certain temps avant de déclencher une suggestion ?

_Par exemple « exigence Proposée depuis plus de N jours » plutôt que « exigence Proposée ». Indiquez les règles concernées et la durée._

>

### L'approche d'analyse (prédictive ou adaptative) change-t-elle certaines règles ?

>

### Faut-il réutiliser les règles du ticket 13 à l'identique quand une suggestion porte sur le même objet ?

_Par exemple : pour une exigence Vérifiée, la suggestion de l'encart propose-t-elle forcément 7.3, comme à la création depuis cette exigence ?_

>

### Qui rédige la justification en anglais ?

_Toutes les justifications doivent exister en français et en anglais. Nous pouvons traduire vos textes et vous les soumettre pour relecture._

>

## 2. Disparition et priorité

### Une suggestion disparaît-elle dès qu'une Action est créée à partir d'elle, ou seulement quand la situation a changé ?

_Pourquoi c'est important : la suggestion « aucune partie prenante » peut donner une Action « Identifier les parties prenantes ». Tant qu'aucune partie prenante n'est saisie, la situation demeure : faut-il quand même continuer à la suggérer ?_

>

### Si l'Action créée depuis une suggestion est ensuite annulée, la suggestion doit-elle réapparaître ?

>

### Combien de suggestions l'encart affiche-t-il au plus ?

>

### Dans quel ordre les suggestions s'affichent-elles ?

_Par exemple : selon l'ordre des domaines de connaissance du BABOK, selon une priorité que vous fixez par règle, ou de la plus ancienne situation à la plus récente._

>

## 3. Rejet et visibilité

### Un membre peut-il écarter une suggestion qu'il juge non pertinente ?

>

### Si oui, l'écart vaut-il pour lui seul ou pour toute l'équipe ?

>

### Si oui, une suggestion écartée revient-elle un jour ?

_Par exemple : jamais, après un certain délai, ou quand la situation réapparaît après avoir disparu._

>

### Les lecteurs voient-ils l'encart ?

_Un lecteur ne peut pas créer d'Action. S'il voit l'encart, ce sera donc sans le bouton de création._

>

### L'encart s'affiche-t-il sur une initiative archivée ?

_Une initiative archivée est en lecture seule : aucune Action ne peut y être créée._

>

## 4. Création en un clic

### « En un clic » : l'Action est-elle créée directement, ou le formulaire de création s'ouvre-t-il prérempli, à confirmer ?

>

### Quel titre porte l'Action créée ?

_Un titre fixe par règle (par exemple « Identifier les parties prenantes »), le texte de la justification, ou autre chose._

>

### Qui en est le responsable par défaut ?

_Par exemple : le membre qui clique, ou le propriétaire de l'initiative._

>

### La technique est-elle préremplie ?

_Si oui, selon le classement du ticket 13 (les techniques associées à la tâche, classées par fréquence d'usage), ou celle que vous indiquez dans la règle._

>

### Une échéance est-elle préremplie ?

>

### L'Action est-elle automatiquement liée à l'objet qui a déclenché la suggestion ?

_Par exemple : la partie prenante sans rôle Sponsor, le besoin sans exigence, l'exigence Proposée._

>

## Autre chose ?

Y a-t-il un point que nous n'avons pas abordé et que nous devrions connaître avant de développer cet encart ?

>
