# Choix du premier lot

Type: grilling
Status: resolved
Label: wayfinder:grilling
Blocked by: 02, 03

## Question

En croisant la valeur pour le BA (ticket 03) et la faisabilité mesurée sur le modèle local (ticket 02), quels usages forment le **premier lot** de l'assistant, et lesquels sont reportés ? Ce ticket fixe aussi la valeur initiale du délai maximal de traitement d'une demande (ticket 04, règle 8), d'après les mesures. Il décide enfin si un usage à forte valeur mais jugé infaisable justifie d'ouvrir la question du renforcement du serveur.

## Avancement

- **26.11.2026** : mesures complémentaires lancées avec le mode « réflexion » (relire une page moyenne, relire une page longue, Gherkin), car seule la cohérence avait été mesurée ainsi.
- **26.11.2026, série 1, réponses de la responsable** :
  1. « Prochaines étapes » et « Préparer un atelier » font partie du premier lot. ACTA fournit les retards d'échéance tout calculés ;
  2. « Faire le point » fait partie du premier lot ;
  3. le mode est **au choix du BA** à chaque demande, réponse rapide ou approfondie, avec un avertissement sur le choix approfondi (option b, préférée à un réglage par usage) ;
  4. « Parties prenantes » et « Technique BABOK » restent hors du premier lot ;
  5. la **question libre fait partie du premier lot**, **sans aucune donnée envoyée**, pour comprendre comment fonctionne l'échange avec Hermes. Le choix des données à joindre à la question libre relève d'un lot suivant.
- **26.11.2026, série 2, validée par la responsable** :
  6. « Réponse rapide » est proposée par défaut. Choisir « Réponse approfondie » affiche un avertissement : plus complète, environ trois fois plus longue, elle fait attendre les autres demandes ; texte exact à fixer à la maquette. L'avis indique le mode. « Reposer en précisant » et « Reposer la question » reprennent le mode, qui reste modifiable ;
  7. les deux modes s'offrent pour tous les usages du premier lot, question libre comprise ;
  8. **deux délais maximaux** paramétrables, un par mode. Cela modifie la règle 8 du ticket « Cycle de vie d'une demande à l'assistant », qui en prévoyait un seul. Les valeurs initiales attendent les mesures avec réflexion ;
  9. la question libre se pose sur une initiative et suit toutes les règles d'une demande. Son avis porte « Réponse établie sans lire votre initiative », sans date de lecture ni signal de changement ;
  10. avant l'envoi d'une question libre, un avertissement prévient que l'assistant ne lit pas l'initiative et répond d'après ses connaissances générales. Les instructions demandent au modèle de dire qu'il ne connaît pas l'initiative si la question y renvoie ;
  11. la question libre est limitée à 2 000 caractères, avec un compteur visible.
- **26.11.2026, mesures avec réflexion** :
  - relire une page moyenne : 26 min 33 s, environ 1,5 défaut sur 6 ;
  - relire une page longue : 28 min 38 s, environ 5,5 sur 9, avec une erreur de fait.
  La réflexion ne sauve pas la relecture avec ce modèle.
- **26.11.2026, série 3, validée par la responsable** :
  12. « Relire une page » fait partie du premier lot, présentée comme une **relecture de cohérence**. L'avis dit ce qu'elle sait voir (contradictions chiffrées, points laissés en suspens) et ce qu'elle ne voit pas (défauts de rédaction, calculs, termes vagues), pour qu'un « rien à signaler » ne passe pas pour un feu vert ;
  13. « Contrôler la traçabilité et la cohérence » fait partie du premier lot ; pour cet usage, le mode approfondi est conseillé ;
  14. délais maximaux initiaux : **20 minutes** en réponse rapide, **60 minutes** en réponse approfondie, soit environ deux fois le pire cas mesuré ;
  15. le renforcement du serveur n'est **pas ouvert maintenant** : on attend les retours d'usage du premier lot. Constat noté : la relecture bute sur la capacité du modèle, pas sur le temps ; un modèle plus gros sans carte graphique serait environ trois fois plus lent.
- **26.11.2026, mesure Gherkin avec réflexion** : 16 min 55 s, contre 6 min 33 s sans. Les erreurs graves sont corrigées (note refusée à « Refusée », bonne DAF, mots-clés sur chaque ligne). D'autres restent : le plafond confondu avec le seuil de 500 CHF, la source et le besoin intervertis, le cas « exactement 500 CHF » absent.
- **26.11.2026, série 4, validée par la responsable** :
  16. le « Brouillon de scénarios Gherkin » fait partie du premier lot, avec le mode approfondi conseillé. L'avis rappelle qu'il s'agit d'un brouillon à vérifier avant de l'ajouter à une exigence.

## Réponse

Échange avec la responsable des 26.11.2026, seize points validés en quatre séries (détail ci-dessus, sous « Avancement »), synthèse confirmée par elle. Les réponses des mesures avec réflexion sont rangées dans [`.scratch/assistant/mesures/reponses/`](../mesures/reponses/) (fichiers `TR*`). Termes ajoutés au glossaire (`CONTEXT.md`) : **Mode de réponse** et **Question libre**.

**Premier lot : 7 usages.**

| Usage | Mode conseillé | Particularité |
|---|---|---|
| Relire une page | au choix | Présentée comme « relecture de cohérence » : l'avis dit ce qu'elle voit et ce qu'elle ne voit pas |
| Prochaines étapes | rapide | ACTA fournit les retards d'échéance tout calculés |
| Préparer un atelier | rapide | Retards fournis par ACTA |
| Contrôler la traçabilité et la cohérence | approfondi | |
| Brouillon de scénarios Gherkin | approfondi | Brouillon à vérifier avant de l'ajouter à une exigence |
| Faire le point | rapide | Retards fournis par ACTA |
| Question libre | au choix | Aucune donnée de l'initiative transmise ; 2 000 caractères au plus ; avertissement avant l'envoi ; avis « Réponse établie sans lire votre initiative » ; pour le reste, règles d'une demande ordinaire |

**Reportés** : Technique BABOK ; Parties prenantes (mesure bonne, peu coûteuse à ajouter) ; choix des données jointes à une question libre.

**Mode de réponse** :
- l'auteur choisit à chaque demande « Réponse rapide » (par défaut) ou « Réponse approfondie », pour tous les usages ;
- le choix approfondi affiche un avertissement : plus complète, environ trois fois plus longue, elle fait attendre les autres demandes ;
- l'avis indique le mode ; « Reposer en précisant » et « Reposer la question » le reprennent, et il reste modifiable.

**Délais maximaux** : deux paramètres d'administration, **20 minutes** en rapide et **60 minutes** en approfondi. Cela modifie la règle 8 du ticket « Cycle de vie d'une demande à l'assistant », qui prévoyait un seul délai.

**Renforcement du serveur** : il n'est pas ouvert. On attend les retours d'usage du premier lot. Constat : la relecture bute sur la capacité du modèle (même avec réflexion : 1,5 défaut sur 6 et 5,5 sur 9), pas sur le temps. Un modèle plus gros sans carte graphique serait environ trois fois plus lent.
