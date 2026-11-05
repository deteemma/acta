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
| Code d'initiative | `initiative_code` | Code court et unique d'une initiative (ex. `CRM`) : 2 à 10 lettres majuscules ou chiffres, commençant par une lettre ; choisi par son propriétaire à la création, modifiable par le propriétaire seul ; figé dès la première référence attribuée dans l'initiative, même si l'objet référencé est ensuite supprimé. |
| Initiative archivée | `archived_at` | Initiative mise en lecture seule par son propriétaire, pour tous ses membres : plus aucune modification de la fiche ni des membres. Seul le propriétaire peut la désarchiver ou la supprimer. |
| Membre | `initiative_member` | Lien entre un utilisateur et une initiative, avec un rôle. L'ensemble des membres BA forme l'équipe de l'initiative. |
| BA de l'équipe | `is_team_ba` | Indication portée par un membre propriétaire ou contributeur, en plus de son rôle : il fait partie de l'équipe BA de l'initiative. Un BA de l'équipe peut désigner un nouveau propriétaire et attribuer ou retirer cette indication. Une initiative a toujours au moins un BA de l'équipe. |
| Désignation de propriétaire | `owner_designation` | Trace de chaque passage d'un membre au rôle de propriétaire (création de l'initiative, invitation, changement de rôle, désignation par un BA de l'équipe) : qui, quand, au profit de qui. Consultable par tous les membres. |
| Propriétaire | `owner` | Peut tout faire sur l'initiative, y compris gérer les membres et la supprimer. Une initiative a toujours au moins un propriétaire. |
| Contributeur | `contributor` | Peut consulter et modifier l'initiative. |
| Lecteur | `reader` | Peut seulement consulter l'initiative. |
| Administrateur | `administrateur` (rôle Keycloak) | Rôle global de l'application : gestion des comptes et des paramètres (statuts, types de tickets, acronymes, modèles de page). N'a pas accès au contenu des initiatives dont il n'est pas membre ; peut seulement y désigner un nouveau propriétaire quand aucun propriétaire actif ne reste. |
| Compte désactivé | `deactivated_at` | Compte bloqué par l'administrateur : la personne ne peut plus se connecter. Un compte n'est jamais supprimé, pour garder la trace des auteurs ; il peut être réactivé. |
| Initiative sans propriétaire actif | `orphan_initiative` | Initiative dont tous les propriétaires ont un compte désactivé. L'administrateur en voit seulement le nom, le code et les membres, et peut y désigner un propriétaire parmi les membres au compte actif, même si elle est archivée. |
| Utilisateur | `app_user` | Personne connectée au moins une fois ; identifiant = `sub` du jeton Keycloak. |

### Référentiel BABOK

| Français | Code (anglais) | Définition |
|---|---|---|
| Référentiel BABOK | `babok` | Catalogue en lecture seule des éléments du BABOK v3 : identifiant stable (numéro de section du BABOK v3, ex. `3.1`), noms officiels FR/EN, résumé rédigé pour ACTA, renvoi de section. Ne reproduit pas le texte de l'IIBA. |
| Domaine de connaissance | `babok_knowledge_area` | L'un des six regroupements de tâches du BABOK (*Knowledge Area*). |
| Tâche BABOK | `babok_task` | L'une des 30 tâches du BABOK, rattachée à un domaine de connaissance. _À éviter_ : activité. |
| Technique | `babok_technique` | L'une des 50 techniques du BABOK, utilisables dans plusieurs tâches. |
| Approche d'analyse | `analysis_approach` | Manière de conduire l'analyse sur une initiative : **prédictive** ou **adaptative** (tâche BABOK 3.1). |
| Changement | `change` | Concept du BACCM : transformation en réponse à un besoin. Dans ACTA, il est porté par l'initiative. |

### Objets d'analyse

| Français | Code (anglais) | Définition |
|---|---|---|
| Partie prenante | `stakeholder` | Personne ou groupe en relation avec le changement, le besoin ou la solution (BABOK). Objet d'analyse de l'initiative, distinct de l'utilisateur et du membre ; peut être reliée à un compte utilisateur, et un utilisateur est relié à au plus une partie prenante par initiative, mais peut l'être dans plusieurs initiatives. |
| Rôle de partie prenante | `stakeholder_role` | L'un des 11 rôles du BABOK v3 (§2.4) : Analyste métier, Client, Expert métier du domaine, Utilisateur final, Expert de la mise en œuvre, Support opérationnel, Chef de projet, Régulateur, Sponsor, Fournisseur, Testeur. Une partie prenante en a au moins un. |
| Matrice influence × intérêt | `stakeholder_matrix` | Positionnement des parties prenantes d'une initiative selon leur influence et leur intérêt (faible, moyen, fort). |
| Besoin | `need` | Problème ou opportunité à traiter (concept du BACCM). Porte une référence (ex. `CRM-BE-001`), un titre, une nature (problème ou opportunité), une description et les parties prenantes à son origine ; peut être lié à des tickets et à des pages. |
| Exigence | `requirement` | Représentation utilisable d'un besoin, d'un des types du BABOK : métier, partie prenante, solution (fonctionnelle ou non fonctionnelle), transition. Répond à au moins un besoin ou dérive d'une exigence parente. Porte une référence (ex. `CRM-EX-012`), un titre, un énoncé, un statut et ses sources (parties prenantes) ; peut être liée à des tickets et à des pages. Toute modification est conservée dans son historique. |
| Exigence parente | `parent_id` | Exigence dont une autre dérive, de la même initiative et de n'importe quel type ; une exigence a au plus une parente et ne peut pas descendre d'elle-même. |
| Source d'une exigence | `requirement_stakeholder` | Partie prenante dont provient une exigence ; une exigence en a zéro, une ou plusieurs. |
| Historique d'une exigence | `requirement_version` | État complet d'une exigence enregistré à chaque modification : qui, quand, et pour chaque champ modifié l'ancienne et la nouvelle valeur. Consultable par tout membre ; disparaît avec l'exigence. |
| Statut d'exigence | `requirement_status` | Étape du cycle de vie d'une exigence : Proposée, Vérifiée, Validée, Approuvée, Différée, Rejetée (statuts du BABOK, fixes) ; liste complétée par l'administration, valable pour toute l'application. Un statut ajouté a un libellé en français et en anglais ; désactivé, il n'est plus proposé mais reste sur les exigences qui le portent ; il ne se supprime que s'il n'a jamais été porté. |
| Famille de statut | `status_tone` | Signification visuelle commune à des statuts de natures différentes : neutre, en cours, positif, attention, négatif. Exigence : Proposée = neutre ; Vérifiée, Validée = en cours ; Approuvée = positif ; Différée = attention ; Rejetée = négatif. Tickets : À faire, Ouverte, Proposée, Soumise = neutre ; En cours, Répondue, Traité, Analysée = en cours ; Terminée, Terminé, Close, Clos, Actée, Acceptée = positif ; En attente, Identifié = attention ; Refusée = négatif ; Annulée, Annulé = neutre atténué. Un statut d'exigence ajouté par l'administration est neutre ; pour un statut de ticket ajouté, l'administration choisit la famille (neutre par défaut). |
| Statut de ticket | `ticket_status` | Étape du cycle de vie d'un ticket, propre à son type. Les statuts des types livrés sont fixes ; l'administration en ajoute à tout type, avec un libellé en français et en anglais, une famille, et l'indication « fermé » ou non. Le premier statut d'un type est son statut initial : tout ticket est créé dans celui-ci, puis passe librement d'un statut à l'autre. Un statut ajouté se renomme ; désactivé, il n'est plus proposé mais reste sur les tickets qui le portent ; il ne se supprime que s'il n'a jamais été porté. Le statut initial et le dernier statut fermé actif d'un type ne se désactivent pas. Liste valable pour toute l'application. |
| Statut fermé | `closed` | Statut de ticket qui signifie que le ticket est terminé : plus d'alerte, et rangé parmi les « fermés » des filtres. Types livrés : Terminée, Annulée (Action) ; Close, Refusée (Question) ; Actée, Refusée (Décision) ; Clos (Risque) ; Acceptée, Refusée (Demande de changement) ; Terminé, Annulé (Epic). En attente n'est jamais fermé. |
| En attente | `on_hold` | Statut de chacun des types de ticket livrés : il manque une information pour continuer. Non fermé. |
| Référence | `reference` | Identifiant lisible d'un besoin, d'une exigence, d'un ticket ou d'une page, de la forme `CODE-ACRONYME-NUMÉRO` (ex. `CRM-EX-012`). L'acronyme de chaque catégorie (2 à 4 lettres majuscules ; par défaut BE, EX, PA, et pour les types de ticket AC, QU, DE, RI, DC, EP) est paramétré par l'administration ; un acronyme porté par une catégorie lui reste réservé. Le numéro, sur 3 chiffres au moins, est incrémental par initiative et par catégorie, jamais réutilisé. Une référence attribuée ne change plus. |
| Vérification | `verification` | Contrôle qu'une exigence est de bonne qualité (tâche BABOK 7.2). _À ne pas confondre avec_ validation. |
| Validation | `validation` | Contrôle qu'une exigence répond au besoin (tâche BABOK 7.3). |
| Fonctionnalité | `feature` | Ensemble des scénarios Gherkin d'une exigence de solution fonctionnelle (*Feature*). |
| Scénario Gherkin | `gherkin_scenario` | Description d'un comportement attendu en langage Gherkin (*Étant donné / Quand / Alors*), rattachée à une exigence de solution fonctionnelle. Documentation vérifiée, non exécutée. |

### Suivi du travail

| Français | Code (anglais) | Définition |
|---|---|---|
| Ticket | `ticket` | Élément de suivi générique d'une initiative, sur le modèle de Jira, caractérisé par son type et son statut ; porte une référence, un titre, une description, un responsable, une échéance, au plus un Epic, des commentaires et des liens. Se supprime définitivement, avec ses commentaires, pièces jointes et historique, seulement s'il n'est lié à rien. |
| Type de ticket | `ticket_type` | Nature d'un ticket : Epic, Action, Question, Décision, Risque, Demande de changement ; liste extensible par l'administration. Chaque type a ses propres statuts et son acronyme de référence. Choisi à la création, il ne change plus. Un type livré ne se renomme, ne se désactive ni ne se supprime. Un type ajouté par l'administration a un libellé en français et en anglais, un acronyme et au moins deux statuts (dont un fermé), et n'a que les champs communs ; il se renomme ; désactivé, il n'est plus proposé à la création mais ses tickets restent modifiables ; il ne se supprime que si aucun ticket de ce type n'a jamais été créé. Valable pour toute l'application. |
| Action | `action` | Type de ticket : unité de travail d'un BA, toujours rattachée à une tâche BABOK, éventuellement à une technique ; a toujours un responsable ; peut désigner des parties prenantes concernées, qui ne se suppriment plus tant qu'elles y figurent. Seul type de ticket que proposent les actions suggérées et qui couvre une tâche BABOK. Statuts : À faire, En cours, En attente, Terminée, Annulée. _À éviter_ : tâche (réservé aux tâches BABOK). |
| Responsable d'un ticket | `assignee` | Membre propriétaire ou contributeur chargé d'un ticket ; facultatif, sauf pour l'Action. Il le reste s'il quitte ensuite l'initiative ou devient lecteur, signalé, jusqu'à réattribution. |
| Historique d'un ticket | `ticket_version` | Trace de chaque modification des champs d'un ticket, quel que soit son type : qui, quand, et pour chaque champ modifié l'ancienne et la nouvelle valeur. Consultable par tout membre ; disparaît avec le ticket. |
| « Mes actions » | `my_actions` | Écran d'accueil : les actions dont je suis responsable, toutes initiatives confondues ; les tickets d'autres types n'y figurent pas. |
| Tableau de bord | `dashboard` | Vue d'une initiative : ses actions classées par domaine de connaissance puis par tâche BABOK, avec le nombre d'actions par statut. |
| Tâche couverte | `covered` | Tâche BABOK qui a au moins une action dans l'initiative, quel qu'en soit le statut (Annulée comprise). Un domaine est couvert dès qu'une de ses tâches l'est. |
| Action suggérée | `suggested_action` | Action que le tableau de bord propose selon l'état de l'initiative, par une règle fixe (R1 à R15), avec sa justification ; créée en un clic. L'action créée garde la suggestion d'origine (`suggestion_key`). |
| Alerte | `alert` | Signal dans l'application, sans courriel, sur une de mes actions dont le statut n'est pas fermé (ni Terminée ni Annulée ; En attente comprise), hors initiative archivée : action attribuée par un autre membre, ou échéance dépassée. Elle disparaît dès que sa situation cesse ; elle est « nouvelle » jusqu'à l'ouverture suivante du panneau des alertes. |
| Écarter une suggestion | `dismissal` | Masquer une action suggérée pour toute l'équipe ; elle ne revient que si sa situation disparaît puis réapparaît. |
| Question | `question` | Type de ticket : point ouvert d'élicitation posé à des parties prenantes ; peut désigner les parties prenantes interrogées, qui ne se suppriment plus tant qu'elles y figurent. Statuts : Ouverte, En attente, Répondue, Close, Refusée (écartée sans réponse : non pertinente, ou les parties prenantes ne répondent pas). |
| Décision | `decision` | Type de ticket : arbitrage obtenu. Statuts : Proposée, En attente, Actée, Refusée (l'arbitrage proposé n'est pas retenu). |
| Risque | `risk` | Type de ticket : risque identifié sur le changement (tâche BABOK 6.3) ; peut porter une probabilité et un impact (faible, moyen, fort). Statuts : Identifié, En attente, Traité, Clos. |
| Demande de changement | `change_request` | Type de ticket : demande de modification d'une exigence déjà approuvée (tâche BABOK 5.4). Statuts : Soumise, Analysée, En attente, Acceptée, Refusée. _À ne pas confondre avec_ Changement (BACCM). |
| Epic | `epic` | Type de ticket parent qui regroupe des tickets de tous types ; un ticket appartient à un Epic au plus, de la même initiative, et peut en changer ; un Epic ne contient pas d'Epic, et ne se supprime pas tant qu'il contient des tickets. Son statut ne se déduit pas de ses tickets. Appartenir à un Epic n'est pas un lien ; comme tout ticket, un Epic peut en plus porter des liens. Statuts : À faire, En cours, En attente, Terminé, Annulé. |
| Page | `page` | Document d'une initiative, sur le modèle de Confluence : une référence (ex. `CRM-PA-007`), un titre, un contenu mis en forme ; versionné. Peut être liée à des tickets, des besoins et des exigences, mais pas à une autre page. Se supprime définitivement, avec ses versions et pièces jointes, seulement si elle n'est liée à rien et n'a pas de sous-page. |
| Arborescence des pages | `parent_id`, `position` | Rangement des pages d'une initiative : plusieurs pages de premier niveau, profondeur illimitée, au plus une page parente de la même initiative ; les pages sœurs suivent un ordre libre, une nouvelle page se place en dernier. Une page se déplace avec ses sous-pages, n'importe où dans l'initiative sauf sous elle-même ou l'une de ses sous-pages. |
| Enregistrement de page | `page_revision` | État d'une page (titre et contenu) conservé à chaque enregistrement : qui, quand. Tout membre le consulte et en compare deux ; un propriétaire ou un contributeur le restaure, ce qui crée un nouvel enregistrement, ou le supprime définitivement, sauf le dernier ; une ligne sans contenu signale alors l'enregistrement supprimé, par qui et quand. Le déplacement et l'ordre des pages ne créent pas d'enregistrement. |
| Version de page | `page_version` | Enregistrement de page déclaré comme jalon par un propriétaire ou un contributeur, en enregistrant ou après coup, seulement s'il est postérieur à la dernière version ; numérotée 1, 2, 3… dans l'ordre chronologique, avec une note facultative modifiable. Une page n'a aucune version à sa création. Une version ne redevient pas un simple enregistrement ; supprimée avec son enregistrement, son numéro n'est pas réattribué. Tout membre voit le dernier enregistrement, pas seulement la dernière version. _À ne pas confondre avec_ Historique d'une exigence. |
| Lien | `link` | Relation entre deux objets de la même initiative : deux tickets (avec une nature), ou un ticket ou une page avec un besoin ou une exigence (sans nature), ou une page avec un ticket (sans nature). Deux tickets portent au plus un lien ; un ticket ne se lie pas à lui-même. Créé ou retiré par un propriétaire ou un contributeur, depuis l'un ou l'autre objet ; n'apparaît dans aucun historique. Un objet qui porte un lien ne se supprime pas. |
| Nature de lien | `link_kind` | Sens d'un lien entre deux tickets, dans une liste fixe : « bloque » / « est bloqué par », « duplique » / « est dupliqué par », « est lié à » (sans sens). Purement informative : un ticket bloqué peut changer de statut et être fermé. |
| Modèle de page | `page_template` | Plan prérempli pour créer une page, lié à un livrable d'une tâche BABOK ; liste extensible par l'administration. |
| Suggestion | `suggestion` | Proposition de tâche BABOK, de technique ou d'action, produite par une règle fixe et accompagnée de sa justification. |

### Saisie

| Français | Code (anglais) | Définition |
|---|---|---|
| Modification non enregistrée | `unsaved_changes` | Saisie dans un panneau ou un formulaire dont au moins un champ a une valeur différente de celle enregistrée (en création : de celle de départ) ; revenir à la valeur d'avant n'en est pas une. Quitter le panneau la signale par une alerte qui propose « Enregistrer », « Abandonner les modifications » ou « Continuer la saisie ». _À ne pas confondre avec_ Alerte (signal sur une action). |
