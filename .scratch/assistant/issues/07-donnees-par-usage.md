# Données transmises à l'assistant pour chaque usage du premier lot

Type: grilling
Status: open
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
