# Contexte et glossaire métier

Glossaire français ↔ anglais : la documentation et les tickets sont en français,
les identifiants de code en anglais. Ce fichier est amorcé par le dépôt modèle et
complété au démarrage de chaque application (étape 2 du skill `nouvelle-application`).

## L'application

- **Nom** : ACTA — *Agenda, Cogitata, Tractata, Acta* (Business Analysis Team Action Tracker). Le nom est une marque, sans signification fonctionnelle.
- **Objectif** : aider un business analyst dans ses tâches quotidiennes en appliquant le cadre BABOK v3, sans orientation vers un secteur métier particulier.
- **Utilisateurs visés** : des business analysts, chacun avec son compte, travaillant en équipe dédiée à chaque initiative ; des parties prenantes peuvent être invitées sur une initiative.
- **Langues** : français et anglais. Le BABOK a l'anglais pour langue de référence : en français, le terme anglais est visible en info-bulle.
- **Entité partagée** : Initiative (`initiative`)
- **Hors ligne sur mobile** : OUI — périmètre à définir
- **Données présentes sur le téléphone** : _à définir_
- **Phasage** : 1) BABOK v3 ; 2) tickets et pages (sur le modèle de Jira et Confluence, sans intégration ; connexion envisagée plus tard) ; 3) scénarios Gherkin. Extension Agile : module activable, après la phase 1.

## Glossaire

### Partage et accès

| Français | Code (anglais) | Définition |
|---|---|---|
| Initiative | `initiative` | Périmètre d'un travail d'analyse métier, équivalent d'un projet ; c'est l'objet que l'on partage. Correspond au **Changement** (*Change*) du BABOK. _À éviter_ : projet, mission. |
| Code d'initiative | `initiative_code` | Code court et unique d'une initiative (ex. `CRM`) : 2 à 10 lettres majuscules ou chiffres, commençant par une lettre ; choisi par son propriétaire à la création, modifiable par le propriétaire seul ; figé dès qu'une référence existe. |
| Initiative archivée | `archived_at` | Initiative mise en lecture seule par son propriétaire, pour tous ses membres : plus aucune modification de la fiche ni des membres. Seul le propriétaire peut la désarchiver ou la supprimer. |
| Membre | `initiative_member` | Lien entre un utilisateur et une initiative, avec un rôle. L'ensemble des membres BA forme l'équipe de l'initiative. |
| BA de l'équipe | `is_team_ba` | Indication portée par un membre propriétaire ou contributeur, en plus de son rôle : il fait partie de l'équipe BA de l'initiative. Un BA de l'équipe peut désigner un nouveau propriétaire et attribuer ou retirer cette indication. Une initiative a toujours au moins un BA de l'équipe. |
| Désignation de propriétaire | `owner_designation` | Trace de chaque passage d'un membre au rôle de propriétaire (création de l'initiative, invitation, changement de rôle, désignation par un BA de l'équipe) : qui, quand, au profit de qui. Consultable par tous les membres. |
| Propriétaire | `owner` | Peut tout faire sur l'initiative, y compris gérer les membres et la supprimer. Une initiative a toujours au moins un propriétaire. |
| Contributeur | `contributor` | Peut consulter et modifier l'initiative. |
| Lecteur | `reader` | Peut seulement consulter l'initiative. |
| Administrateur | `administrateur` (rôle Keycloak) | Rôle global de l'application : gestion des comptes et des paramètres (statuts, types de tickets, acronymes, modèles de page). N'a pas accès au contenu des initiatives dont il n'est pas membre ; peut seulement y désigner un nouveau propriétaire quand aucun propriétaire actif ne reste. |
| Utilisateur | `app_user` | Personne connectée au moins une fois ; identifiant = `sub` du jeton Keycloak. |

### Référentiel BABOK

| Français | Code (anglais) | Définition |
|---|---|---|
| Référentiel BABOK | `babok_reference` | Catalogue en lecture seule des éléments du BABOK v3 : noms officiels FR/EN, résumé rédigé pour ACTA, renvoi de section. Ne reproduit pas le texte de l'IIBA. |
| Domaine de connaissance | `knowledge_area` | L'un des six regroupements de tâches du BABOK (*Knowledge Area*). |
| Tâche BABOK | `babok_task` | L'une des 30 tâches du BABOK, rattachée à un domaine de connaissance. _À éviter_ : activité. |
| Technique | `technique` | L'une des 50 techniques du BABOK, utilisables dans plusieurs tâches. |
| Approche d'analyse | `analysis_approach` | Manière de conduire l'analyse sur une initiative : **prédictive** ou **adaptative** (tâche BABOK 3.1). |
| Changement | `change` | Concept du BACCM : transformation en réponse à un besoin. Dans ACTA, il est porté par l'initiative. |

### Objets d'analyse

| Français | Code (anglais) | Définition |
|---|---|---|
| Partie prenante | `stakeholder` | Personne ou groupe en relation avec le changement, le besoin ou la solution (BABOK). Objet d'analyse de l'initiative, distinct de l'utilisateur et du membre ; peut être reliée à un compte utilisateur, et un utilisateur peut être relié à plusieurs parties prenantes. |
| Besoin | `need` | Problème ou opportunité à traiter (concept du BACCM). |
| Exigence | `requirement` | Représentation utilisable d'un besoin, d'un des types du BABOK : métier, partie prenante, solution (fonctionnelle ou non fonctionnelle), transition. Répond à au moins un besoin ou dérive d'une exigence parente. |
| Statut d'exigence | `requirement_status` | Étape du cycle de vie d'une exigence : Proposée, Vérifiée, Validée, Approuvée, Différée, Rejetée ; liste extensible par l'administration. |
| Référence | `reference` | Identifiant lisible d'un besoin, d'une exigence ou d'un ticket, de la forme `CODE-ACRONYME-NUMÉRO` (ex. `CRM-EX-012`). L'acronyme de chaque catégorie est paramétré par l'administration ; le numéro est incrémental par initiative et par catégorie, jamais réutilisé. Une référence attribuée ne change plus. |
| Vérification | `verification` | Contrôle qu'une exigence est de bonne qualité (tâche BABOK 7.2). _À ne pas confondre avec_ validation. |
| Validation | `validation` | Contrôle qu'une exigence répond au besoin (tâche BABOK 7.3). |
| Fonctionnalité | `feature` | Ensemble des scénarios Gherkin d'une exigence de solution fonctionnelle (*Feature*). |
| Scénario Gherkin | `gherkin_scenario` | Description d'un comportement attendu en langage Gherkin (*Étant donné / Quand / Alors*), rattachée à une exigence de solution fonctionnelle. Documentation vérifiée, non exécutée. |

### Suivi du travail

| Français | Code (anglais) | Définition |
|---|---|---|
| Ticket | `ticket` | Élément de suivi générique d'une initiative, sur le modèle de Jira, caractérisé par son type et son statut ; porte une référence, des commentaires et des liens. |
| Type de ticket | `ticket_type` | Nature d'un ticket : Epic, Action, Question, Décision, Risque, Demande de changement ; liste extensible par l'administration. Chaque type a ses propres statuts. |
| Action | `action` | Type de ticket : unité de travail d'un BA, toujours rattachée à une tâche BABOK, éventuellement à une technique. Statuts : À faire, En cours, Terminée, Annulée. _À éviter_ : tâche (réservé aux tâches BABOK). |
| Question | `question` | Type de ticket : point ouvert d'élicitation posé à des parties prenantes. Statuts : Ouverte, Répondue, Close. |
| Décision | `decision` | Type de ticket : arbitrage obtenu. Statuts : Proposée, Actée. |
| Risque | `risk` | Type de ticket : risque identifié sur le changement (tâche BABOK 6.3). Statuts : Identifié, Traité, Clos. |
| Demande de changement | `change_request` | Type de ticket : demande de modification d'une exigence déjà approuvée (tâche BABOK 5.4). Statuts : Soumise, Analysée, Acceptée, Refusée. _À ne pas confondre avec_ Changement (BACCM). |
| Epic | `epic` | Type de ticket parent qui regroupe des tickets de tous types ; un ticket appartient à un Epic au plus, un Epic ne contient pas d'Epic. Peut être lié à des besoins et des exigences. Statuts : À faire, En cours, Terminé, Annulé. |
| Page | `page` | Document d'une initiative, sur le modèle de Confluence, rangé dans une arborescence et versionné ; peut être rattaché à des tickets. |
| Modèle de page | `page_template` | Plan prérempli pour créer une page, lié à un livrable d'une tâche BABOK ; liste extensible par l'administration. |
| Suggestion | `suggestion` | Proposition de tâche BABOK, de technique ou d'action, produite par une règle fixe et accompagnée de sa justification. |
