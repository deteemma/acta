# Règles de l'encart « Actions suggérées » (ticket 14)

**Statut :** validé par la responsable fonctionnelle le 30.10.2026

**Source :** réponses de la responsable fonctionnelle au questionnaire
`.scratch/phase-1/14-questionnaire-actions-suggerees.md`. Seules les règles
ci-dessous seront développées.

## 1. Règles de déclenchement

Une règle qui porte sur des objets (parties prenantes, besoins, exigences)
donne **une seule suggestion pour l'initiative**, qui compte les objets
concernés (`{n}`). Les règles sont les mêmes en approche prédictive et
adaptative. Quand une règle porte sur le même objet qu'une règle du ticket 13,
elle propose la même tâche que le ticket 13.

| # | Situation | Tâche | Technique | Titre de l'Action | Justification affichée |
|---|---|---|---|---|---|
| R1 | L'initiative n'a aucune action | 3.1 | — | Planifier l'approche de l'analyse | Aucune action n'est encore prévue : commencez par planifier l'approche de l'analyse. |
| R2 | L'approche d'analyse n'est pas renseignée | 3.1 | — | Choisir l'approche d'analyse | L'approche d'analyse, prédictive ou adaptative, n'est pas encore choisie. |
| R3 | L'initiative n'a aucune partie prenante | 3.2 | 10.43 | Identifier les parties prenantes | Aucune partie prenante n'est encore identifiée. |
| R4 | Aucune partie prenante n'a le rôle Sponsor | 3.2 | 10.43 | Identifier le sponsor | Aucune partie prenante n'a le rôle Sponsor. |
| R5 | Des parties prenantes n'ont pas d'influence ou pas d'intérêt renseigné | 3.2 | 10.43 | Évaluer l'influence et l'intérêt des parties prenantes | {n} partie(s) prenante(s) sans influence ou sans intérêt renseigné. |
| R6 | Des parties prenantes ne sont liées à aucune action | 4.5 | — | Associer les parties prenantes au travail d'analyse | {n} partie(s) prenante(s) liée(s) à aucune action. |
| R7 | L'initiative n'a aucun besoin | 6.1 | 10.25 | Recueillir les besoins | Aucun besoin n'est encore identifié. |
| R8 | Des besoins n'ont aucune partie prenante d'origine | 5.1 | — | Retrouver l'origine des besoins | {n} besoin(s) sans partie prenante d'origine. |
| R9 | Des besoins n'ont aucune exigence liée | 7.1 | — | Spécifier les exigences des besoins | {n} besoin(s) sans exigence liée. |
| R10 | Des exigences n'ont aucune source | 5.1 | — | Retrouver la source des exigences | {n} exigence(s) sans source. |
| R11 | Des exigences sont Proposées depuis plus de 14 jours | 7.2 | 10.37 | Vérifier les exigences proposées | {n} exigence(s) Proposée(s) depuis plus de 14 jours. |
| R12 | Des exigences sont Vérifiées depuis plus de 14 jours | 7.3 | 10.37 | Valider les exigences vérifiées | {n} exigence(s) Vérifiée(s) depuis plus de 14 jours. |
| R13 | Des exigences sont Validées depuis plus de 14 jours | 5.5 | 10.37 | Faire approuver les exigences validées | {n} exigence(s) Validée(s) depuis plus de 14 jours. |
| R14 | Un domaine de connaissance (3 à 8) n'est couvert par aucune action | 1re tâche du domaine dans l'ordre du référentiel (3.1, 4.1, 5.1, 6.1, 7.1, 8.1) | — | Nom de cette tâche | Aucune action ne couvre le domaine « {domaine} ». |
| R15 | La date de fin prévue est dans 30 jours ou moins, ou dépassée | 3.5 | — | Faire le bilan de l'analyse avant la fin de l'initiative | La date de fin prévue est dans {n} jour(s). / La date de fin prévue est dépassée depuis {n} jour(s). |

R14 donne une suggestion par domaine non couvert. « Depuis plus de 14 jours »
(R11 à R13) se compte depuis le dernier passage de l'exigence à ce statut.
Toutes les autres règles se déclenchent dès que la situation existe.

Non retenue : « une tâche BABOK n'est couverte par aucune action » (le tableau
de bord du ticket 12 la montre déjà).

## 2. Affichage

- G1. L'encart affiche **5 suggestions au plus**, dans l'ordre du référentiel
  BABOK de la tâche proposée ; un lien « voir tout » montre les autres.
- G2. Quand deux règles proposent la même tâche, **une seule suggestion**
  s'affiche : celle qui porte sur des objets l'emporte sur celle qui porte sur
  toute l'initiative ; à égalité, la règle au plus petit numéro.
- G3. Les **lecteurs** voient l'encart, sans bouton : ni création, ni écart.
- G4. L'encart est **masqué sur une initiative archivée**.

## 3. Disparition et retour

- G5. Une suggestion disparaît dès que sa situation n'existe plus.
- G6. Elle est masquée tant qu'une Action créée depuis elle est À faire ou
  En cours. Si cette Action est Annulée ou Terminée alors que la situation
  demeure, la suggestion réapparaît.
- G7. Un propriétaire ou un contributeur peut **écarter** une suggestion :
  elle disparaît pour toute l'équipe. Elle ne revient que si sa situation
  disparaît puis réapparaît.

## 4. Création en un clic

- G8. Un clic **crée directement** l'Action, puis ouvre sa fiche pour la
  compléter si besoin. Seuls les propriétaires et les contributeurs le peuvent.
- G9. L'Action reçoit le titre de la règle, la tâche de la règle, et la
  technique de la règle si elle en fixe une (R3, R4, R5, R7, R11, R12, R13) ;
  sinon, pas de technique.
- G10. Son responsable est le membre qui clique. Aucune échéance.
- G11. Elle est liée à **tous les objets** comptés par la suggestion (parties
  prenantes, besoins, exigences). Aucun lien pour les règles qui portent sur
  toute l'initiative (R1 à R4, R7, R14, R15).

## 5. Langues

- G12. Titres et justifications existent en français et en anglais
  (ADR-0013). Les textes anglais sont ceux du questionnaire, traduits par
  Claude sans relecture, à la demande de la responsable fonctionnelle.
