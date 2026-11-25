# Valeur pour le BA des dix usages candidats

Type: grilling
Status: resolved
Label: wayfinder:grilling

## Question

Pour chacun des dix usages candidats, quelle est la valeur pour le BA : fréquence du besoin, gain par rapport à ce qu'ACTA offre déjà, risque si l'avis est faux ? Les usages :

1. identifier les prochaines étapes ;
2. suivre une initiative ;
3. relire une page après sa rédaction ;
4. répondre à une question libre sur l'état d'une initiative ;
5. suggérer une technique BABOK ;
6. préparer un atelier d'élicitation ;
7. contrôler la traçabilité et la cohérence ;
8. proposer un brouillon de scénarios Gherkin ;
9. envoyer un point périodique ;
10. challenger la liste des parties prenantes.

Résultat : un classement par valeur, que le ticket 06 croise avec la faisabilité.

## Réponse

Échange avec la responsable fonctionnelle du 25.11.2026. Les notes viennent de l'**appréciation de la responsable, en tant que BA** ; elles n'ont pas été mesurées.

**Méthode.** Chaque usage est noté sur trois niveaux (faible / moyen / fort) selon trois critères :
- **fréquence** du besoin ;
- **gain** par rapport à ce qu'ACTA offre déjà (règles R1 à R15, tableau de bord, alertes, validation de syntaxe Gherkin, matrice influence × intérêt) ;
- **risque**, c'est-à-dire ce qui se passe si le BA suit un avis faux sans s'en apercevoir.

Le classement se fait à l'appréciation, sans formule. En tête viennent une fréquence et un gain forts avec un risque faible.

**Périmètre des usages.**
- Les usages 2 (suivre une initiative) et 9 (point périodique) sont fusionnés en **faire le point sur une initiative**, posé à la demande. La version périodique contredit le cadre « répond seulement à la demande » : elle reste dans la zone floue « plus tard » et sort du classement.
- La **question libre** est notée comme un usage à part entière. Le choix entre questions types et saisie libre revient à la maquette du panneau.

**Classement.**

| Rang | Usage | Fréquence | Gain | Risque | Groupe |
|---|---|---|---|---|---|
| 1 | Relire une page après sa rédaction | fort | fort | faible | Prioritaire |
| 2 | Identifier les prochaines étapes | fort | moyen | faible | Prioritaire |
| 3 | Préparer un atelier d'élicitation | moyen | fort | faible | Prioritaire |
| 4 | Contrôler la traçabilité et la cohérence | moyen | fort | moyen | Secondaire |
| 5 | Proposer un brouillon de scénarios Gherkin | moyen | fort | moyen | Secondaire |
| 6 | Faire le point sur une initiative | moyen | moyen | moyen | Secondaire |
| 7 | Suggérer une technique BABOK | faible | moyen | faible | Différable |
| 8 | Challenger la liste des parties prenantes | faible | moyen | faible | Différable |
| 9 | Répondre à une question libre | moyen | moyen | fort | Différable |

**Justifications retenues.**
1. **Relire une page** : chaque page rédigée est concernée et rien n'existe aujourd'hui. Les remarques sont jugées une à une par le BA.
2. **Prochaines étapes** : R1 à R15 détectent les manques de structure ; l'assistant ajoute le fond (contenu des pages, questions sans réponse, décisions en attente).
3. **Préparer un atelier** : ordre du jour, questions et participants, établis à partir des besoins et des tickets Question. Le BA relit la préparation avant l'atelier.
4. **Traçabilité et cohérence** : R8 à R10 voient les liens manquants, mais rien ne compare le fond. Le risque est un « rien à signaler » faux.
5. **Brouillon Gherkin** : seule la syntaxe se contrôle aujourd'hui. Le risque est qu'un scénario plausible mais faux entre dans la documentation.
6. **Faire le point** : le tableau de bord donne les chiffres, pas la synthèse. Le risque est qu'un point faux soit repris devant un sponsor.
7. **Technique BABOK** : un BA expérimenté connaît ses techniques et le référentiel se consulte déjà dans ACTA.
8. **Parties prenantes** : le besoin se présente surtout en début d'initiative ; R3 à R6 voient les manques de saisie, pas les oublis.
9. **Question libre** : rien ne cadre la demande, et une affirmation fausse passe facilement pour un fait.

**Départage des ex aequo.**
- La traçabilité passe devant Gherkin : un brouillon entre directement dans la documentation, alors qu'un contrôle se vérifie avant d'agir.
- La technique passe devant les parties prenantes : elle sert dans toutes les phases.
