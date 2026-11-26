# Données transmises à l'assistant pour chaque usage du premier lot

Type: grilling
Status: resolved
Label: wayfinder:grilling

## Question

Pour chacun des six usages du premier lot qui lisent l'initiative, quelles données ACTA assemble-t-elle et transmet-elle à l'assistant ? La question libre n'en transmet aucune (ticket « Choix du premier lot »). Les six usages sont : relire une page, prochaines étapes, préparer un atelier, traçabilité et cohérence, Gherkin, faire le point.

Points à trancher :

- **Choix fait par le BA** au moment de la demande : quelle page relire, quelles deux pages comparer, quel atelier préparer, quelles exigences pour le Gherkin…
- **Éléments de l'initiative** joints à chaque usage : fiche, parties prenantes, besoins, exigences, tickets, pages, actions suggérées par R1 à R15, et la part du référentiel BABOK à joindre.
- **Faits calculés par ACTA** et fournis tout faits, puisque le modèle ne les voit pas lui-même : échéances dépassées et leur retard, date du jour…
- **Élément lu modifié depuis l'avis** : ce qui déclenche « L'initiative a changé depuis cet avis » (ticket « Cycle de vie d'une demande à l'assistant », règle 6).
- **Taille maximale** du contexte transmis, et ce qui se passe au-delà. Les mesures n'ont pas dépassé 4 600 tokens, pour 65 536 disponibles.

Matériaux :
- ADR 0022 (ACTA assemble le contexte avec les droits de l'auteur) ;
- `.scratch/assistant/mesures/` (contextes utilisés lors des mesures).

## Réponse

Échange avec la responsable du 26.11.2026, douze points validés en trois séries, synthèse confirmée par elle. Terme ajouté au glossaire (`CONTEXT.md`) : **Données lues**.

1. **Données lues.** C'est l'ensemble transmis à l'assistant pour une demande. Il comprend une **partie commune** et, selon l'usage, l'**élément choisi** par le BA. Le mot « socle » est écarté, car il désigne déjà la plateforme commune.
2. **Partie commune**, identique pour les six usages :
   - la fiche : référence, titre, statut, approche d'analyse, dates, propriétaire, membres et leur rôle, module agile activé ou non ;
   - les parties prenantes : référence, nom, rôles, influence, intérêt ;
   - les besoins : référence, titre, nature, description, sources ;
   - les exigences : référence, titre, type, statut et date de ce statut, énoncé, exigence parente, besoins, sources ;
   - les tickets de tous types : référence, type, titre, statut, échéance, responsable, Epic, tâche et technique BABOK. La description n'est transmise que pour les tickets non fermés ;
   - les actions suggérées affichées à ce jour (R1 à R15, avec leur justification), sans celles qui ont été écartées ;
   - la **liste** des pages (référence, titre, page parente), sans leur contenu.
3. **Élément choisi** au moment de la demande :

   | Usage | Choix du BA | Ajouté à la partie commune |
   |---|---|---|
   | Relire une page | une page | son dernier enregistrement (titre et contenu) |
   | Traçabilité et cohérence | une ou deux pages | leur dernier enregistrement et leurs liens (besoins, exigences, tickets) |
   | Préparer un atelier | un ticket Action non fermé | sa description, ses parties prenantes concernées, ses liens |
   | Brouillon Gherkin | de 1 à 3 exigences de solution fonctionnelle | leurs scénarios et leur contexte existants, la langue de leur fonctionnalité |
   | Prochaines étapes | aucun | — |
   | Faire le point | aucun | — |

   Avec une seule page, la traçabilité confronte cette page aux exigences et aux besoins. Avec deux pages, elle les compare aussi entre elles.
4. **Contenu des pages** : il n'est transmis que pour les pages choisies. « Prochaines étapes » et « Faire le point » reçoivent seulement la liste des pages.
5. **Jamais transmis** :
   - les commentaires ;
   - les historiques (exigences, tickets, enregistrements et versions de page) ;
   - les pièces jointes, images comprises ;
   - les descriptions des tickets fermés ;
   - les avis précédents de l'assistant.
6. **Faits calculés par ACTA**, en tête des données, pour les six usages :
   - la date du jour ;
   - pour chaque ticket non fermé dont l'échéance est passée, le nombre de jours de retard ;
   - les jours restants avant la date de fin prévue, ou les jours de dépassement ;
   - pour chaque exigence, le nombre de jours depuis son dernier changement de statut ;
   - les décomptes du tableau de bord : tickets par type et par statut, tâches BABOK couvertes.
7. **Référentiel BABOK** : « Prochaines étapes », « Faire le point » et « Préparer un atelier » reçoivent les 30 tâches (numéro, nom) en indiquant celles qui sont couvertes. Si le module agile est activé, les noms des trois horizons s'y ajoutent. Les résumés des techniques ne sont pas transmis : ils restent avec l'usage « Technique BABOK », reporté.
8. **« L'initiative a changé depuis cet avis »** :
   - le signal s'allume quand un élément transmis est modifié, ajouté ou supprimé après la date de lecture ;
   - pour une page dont seule la liste a été transmise, seul compte un changement de titre, un ajout ou une suppression ;
   - le passage du temps, qui fait varier les faits calculés, ne compte pas.
9. **Taille maximale** :
   - le plafond est de **16 000 tokens** de données, un paramètre de l'administration ;
   - aucune troncature n'est faite ;
   - à la création, une demande qui dépasse le plafond est refusée avec le message « Trop de données pour cet usage : choisissez une page plus courte ou moins d'exigences » ;
   - au passage En cours, un dépassement rend la demande Échouée, avec la raison « données trop volumineuses ».
10. **Langue** : les libellés fixes (statuts, types, noms BABOK, intitulés des rubriques) sont dans la langue d'ACTA de l'auteur. Les textes saisis sont transmis tels quels.
11. **Information du BA** :
    - avant l'envoi, un encadré propre à l'usage montre « Transmis à l'assistant » et « Non transmis » ;
    - dans l'avis, une rubrique repliable « Données lues » reprend cette liste et nomme les éléments choisis par leur référence ;
    - pour la question libre, l'avertissement déjà prévu en tient lieu ;
    - le texte exact sera fixé par le ticket « Maquette du panneau de l'assistant ».
12. **L'élément choisi entre la demande et sa lecture** :
    - le contenu est lu au passage En cours, et non à la création ;
    - un élément choisi supprimé entre-temps rend la demande Échouée, avec la raison « l'élément choisi n'existe plus » ;
    - une exigence qui n'est plus de solution fonctionnelle, pour le Gherkin, rend la demande Échouée, avec la raison « l'élément choisi ne convient plus à cet usage » ;
    - tout autre changement (action fermée, statut modifié, page modifiée) laisse la demande se poursuivre avec l'état du moment.

**Effet sur d'autres tickets** : les points 9 et 12 ajoutent trois raisons d'échec à la règle 9 du ticket « Cycle de vie d'une demande à l'assistant », qui en prévoyait trois.
