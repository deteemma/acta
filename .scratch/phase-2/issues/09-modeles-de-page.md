# Modèles de page

Type: grilling
Status: resolved
Blocked by: 06, 07

## Question

Comment fonctionnent les modèles de page ? Trancher :

- lesquels sont livrés d'office, et à quels livrables BABOK ils correspondent (à partir des résultats du ticket 06) ;
- contenu d'un modèle (plan de titres, texte d'aide), écrit comme une page avec Tiptap en JSON (ADR-0019), et ses deux langues (ADR-0013) — la page créée prend-elle la langue de l'utilisateur ;
- création, modification, désactivation par l'administration ; modèles propres à une initiative ou non ;
- lien entre la page créée et son modèle après création (la modification du modèle touche-t-elle les pages existantes ?) ;
- une page créée depuis un modèle est-elle rattachée à la tâche BABOK du livrable ;
- les livrables restés en suspens dans le ticket 06 : les *Designs* (5.1, 5.2, 5.3, 5.5) et leur nom français (« Spécifications » dans le guide FR, « conception » dans le glossaire FR et dans la migration 0009) ; la priorité des exigences (5.3, exclue en phase 1) ; les objectifs métier (6.2) ; l'état « confirmé » des résultats d'élicitation (4.3) ; les livrables mixtes 7.1 et 7.4 ;
- l'homonymie du livrable 8.5 « Actions recommandées » avec l'Action d'ACTA.

## Réponse

Tranché avec la responsable fonctionnelle le 05.11.2026.

1. **22 modèles livrés**, sous le nom officiel du livrable en français et en anglais (recherche du ticket 06) :
   - Planification : Approche de l'analyse métier (3.1), Approche d'engagement des parties prenantes (3.2), Approche de la gouvernance (3.3), Approche de la gestion de l'information (3.4), Évaluation de la performance de l'analyse métier (3.5).
   - Élicitation : Plan d'activités d'élicitation (4.1), Résultats d'élicitation (4.2).
   - Cycle de vie des exigences : Conception (5.1).
   - Analyse de la stratégie : Description de l'état actuel (6.1), Description de l'état futur (6.2), Valeur potentielle (6.2), Stratégie de changement (6.4), Portée de la solution (6.4).
   - Analyse des exigences : Exigences spécifiées et modélisées (7.1), Architecture des exigences (7.4), Options de conception (7.5), Recommandation de solution (7.6).
   - Évaluation de la solution : Mesures de performance de la solution (8.1), Analyse de la performance de la solution (8.2), Limites de la solution (8.3), Limites de l'entreprise (8.4), Actions recommandées (8.5).
2. **Livrables en suspens** :
   - *Designs* (5.1, 5.2, 5.3, 5.5) : une page de conception liée aux exigences, sans nouvel objet ; terme retenu « Conception », et non « Spécifications » ; modèle rattaché à la tâche 5.1.
   - Priorité des exigences (5.3) : reste exclue, sans modèle ni champ ; hors périmètre de la phase 2.
   - Objectifs métier (6.2) : une section du modèle « Description de l'état futur », pas un objet ; une exigence se lie à la page, pas à un objectif précis.
   - Résultats confirmés (4.3) : même page que le 4.2, sans statut de page ; on confirme en déclarant une version, avec une note libre.
   - Livrables mixtes (7.1, 7.4) : l'exigence reste l'objet principal ; les deux modèles portent les diagrammes, matrices et l'organisation retenue.
   - « Actions recommandées » (8.5) : nom officiel gardé ; le texte d'aide précise qu'une action retenue peut devenir un ticket Action.
3. **Contenu d'un modèle** : un plan de titres, chacun suivi d'un court texte d'aide, éventuellement un tableau à remplir. Le texte d'aide est du texte ordinaire en italique, que l'auteur remplace ou efface ; oublié, il reste dans la page. Aucune donnée vivante de l'initiative. Textes rédigés pour ACTA, sans extrait de l'IIBA (ADR-0012), relus par la responsable fonctionnelle avant livraison.
4. **Langues** : chaque modèle existe en français et en anglais. La page reprend la langue d'interface de la personne qui la crée, ne change plus de langue et n'est jamais traduite (ADR-0013).
5. **Portée** : toute l'application, pas de modèle propre à une initiative. Reprendre le plan d'une page existante n'est pas prévu.
6. **Administration**, sur le modèle de l'écran des statuts : un modèle livré ne se modifie pas, mais se désactive. Un modèle ajouté a un nom et un contenu dans les deux langues, une tâche BABOK facultative ; il se modifie, se désactive, et ne se supprime que s'il n'a jamais servi. Un modèle désactivé n'est plus proposé ; les pages créées avec lui ne changent pas.
7. **Après la création** : le contenu est copié une fois pour toutes ; modifier le modèle ne touche aucune page. La page garde la mention de son modèle d'origine, sous le nom qu'il portait.
8. **Tâche BABOK de la page** : une page créée depuis un modèle rattaché à une tâche affiche cette tâche, information figée, et la fiche de la tâche permet de retrouver ces pages. Cela ne rend pas la tâche couverte et ne change pas les suggestions. Une page vide n'a pas de tâche.
9. **Création d'une page** : « Nouvelle page » propose « Page vide » ou les modèles actifs, par domaine de connaissance. Le titre est prérempli avec le nom du modèle, et modifiable. La page s'ouvre en écriture et n'existe, avec sa référence, qu'au premier enregistrement ; annuler avant ne laisse rien. Un même modèle sert autant de fois qu'on veut. Réservé aux propriétaires et aux contributeurs, sur le web.

Glossaire `CONTEXT.md` mis à jour : Modèle de page, Conception, Action.
