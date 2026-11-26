# Maquette du panneau de l'assistant

Type: prototype
Status: resolved
Label: wayfinder:prototype

## Question

À quoi ressemble l'assistant dans le web d'ACTA ? Une maquette jetable doit montrer :

- **où l'on pose une demande** dans l'arborescence de l'initiative (ADR 0021) : choix de l'usage, choix du mode de réponse avec l'avertissement du mode approfondi, saisie d'une question libre avec son compteur et son avertissement ;
- **le choix de l'élément** selon l'usage (une ou deux pages, une action, de 1 à 3 exigences), l'encadré « Transmis à l'assistant / Non transmis » avant l'envoi et le refus « Trop de données pour cet usage » (ticket « Données transmises à l'assistant pour chaque usage du premier lot ») ;
- **la file et les statuts** : position dans la file, « assistant momentanément indisponible », annulation ;
- **l'avis** : date de lecture ou mention « sans lire votre initiative », mode, « L'initiative a changé depuis cet avis », mises en garde propres à l'usage (relecture de cohérence, brouillon Gherkin), rubrique repliable « Données lues », « Reposer en précisant » et « Reposer la question » ;
- **l'Avis non lu** sur l'initiative et dans le compteur global ;
- **l'historique** des demandes de l'auteur et l'effacement (une demande, ou toutes celles d'une initiative) ;
- **comment distinguer un avis d'une suggestion** produite par les règles R1 à R15.

Les textes exacts des avertissements et des mises en garde sont fixés ici. Règles à respecter :
- tickets « Cycle de vie d'une demande à l'assistant » et « Choix du premier lot » ;
- ADR 0017 (composants d'interface maison) et ADR 0018 (tokens de design).

## Avancement

- **26.11.2026** : maquette jetable sur la branche `prototype/assistant`, adresse `https://acta.localhost/prototype/assistant?variant=A` (B, C), flèches ← → pour changer de variante. Trois variantes :
  - **A** : une branche « Assistant » dans l'arborescence, avec deux onglets « Nouvelle demande » et « Mes demandes » ; chaque demande a son propre écran ;
  - **B** : la demande se pose depuis l'élément (bouton « Demander à l'assistant » sur l'initiative, une page, une action, une exigence fonctionnelle), dans une fenêtre de dialogue ; l'avis se range dans un onglet « Assistant » de l'élément ;
  - **C** : un fil de l'assistant par initiative, en bas de la colonne de gauche, avec la saisie en bas de l'écran.
  Communs aux trois : compteur global des avis non lus en haut à droite (distinct de la cloche des alertes), « N avis non lus » sous le sélecteur d'initiative, avis en bordure pointillée avec l'étiquette « Avis de l'assistant ». Les textes proposés sont dans `web/src/prototype-assistant/texts.ts` (branche jetable). Un panneau « Simulation » fait avancer la file, échouer une demande, rend l'assistant injoignable, dépasse le plafond ou modifie un élément lu.
  En attente du choix de la responsable et de sa validation des textes.

## Réponse

Choix de la responsable du 26.11.2026 : **variantes B et C combinées**, « B pour poser, C pour l'historique ». Textes de la maquette validés tels quels. L'élément modifié est nommé dans le signal de changement. Maquette conservée sur la branche jetable `prototype/assistant` (commit `c41ed20`, à ne pas fusionner) ; les textes y sont dans `web/src/prototype-assistant/texts.ts`.

### Où vit l'assistant

1. **Poser depuis l'élément (variante B).** Un bouton « Demander à l'assistant » se trouve dans l'en-tête de l'écran de données :
   - initiative et tableau de bord : Prochaines étapes, Faire le point, Question libre ;
   - page : Relire une page, Contrôler la traçabilité et la cohérence (la page est déjà choisie ; une deuxième page peut s'ajouter) ;
   - ticket Action non fermé : Préparer un atelier ;
   - exigence de solution fonctionnelle : Brouillon de scénarios Gherkin (l'exigence est déjà choisie ; deux autres peuvent s'ajouter).
   Les autres éléments n'ont pas de bouton. Le bouton ouvre une fenêtre de dialogue centrée (ADR 0021, point 9) : usage (s'il y en a plusieurs), élément, mode, question libre, encadré « Ce qui sera transmis » repliable, envoi. Une fois envoyée, la fenêtre affiche la position dans la file et rappelle qu'on peut la quitter.
2. **L'avis se range sur l'élément.** L'élément a un onglet « Assistant », avec le nombre de demandes, qui liste les demandes de l'auteur sur cet élément, en cartes repliables. Un avis non lu reste replié et l'ouvrir le marque comme lu. Les demandes sans élément se rangent sur l'initiative. Sa vue d'ensemble montre le dernier avis à côté des actions suggérées.
3. **Le fil de l'assistant (variante C) est l'historique de l'initiative.** Il remplace « Mes demandes à l'assistant » et s'ouvre par l'entrée « Assistant » en bas de la colonne de gauche, avec le nombre d'avis non lus. Il réunit toutes les demandes de l'auteur sur l'initiative, de la plus ancienne à la plus récente. La demande et son avis (ou son statut) se suivent l'un sous l'autre, **alignés à gauche sur la même largeur**, sans décalage droite/gauche façon messagerie (correction de la responsable du 27.11.2026, à soigner à la réalisation). Sa zone de saisie, en bas, ne propose que les usages sans élément : Prochaines étapes, Faire le point, Question libre. Il porte « Effacer toutes mes demandes de cette initiative ». Il rappelle que chaque demande est traitée seule.
4. **Avis non lu** : un compteur global en haut à droite, avec l'icône de l'assistant et à part de la cloche des alertes, ainsi que « N avis non lus » sous le sélecteur d'initiative et sur l'entrée « Assistant ».
5. **Distinguer un avis d'une action suggérée** : l'avis porte l'étiquette « Avis de l'assistant » et l'icône de l'assistant, dans une carte à bordure en pointillés. La carte d'une action suggérée reste pleine. L'avis se termine par la phrase de nature ci-dessous.

### Textes fixés

**Choix de l'usage** : « Que demandez-vous à l'assistant ? »

| Usage | Ligne d'aide | Élément à choisir |
|---|---|---|
| Relire une page | Relecture de cohérence : contradictions chiffrées, points laissés en suspens. | Page à relire |
| Prochaines étapes | Ce qu'il serait utile de faire ensuite, d'après l'état de l'initiative. | — |
| Préparer un atelier | Objectif, participants, questions à poser, pour une action à venir. | Action à préparer (non fermée) |
| Contrôler la traçabilité et la cohérence | Confronte une page aux besoins et aux exigences, ou deux pages entre elles. | Une ou deux pages |
| Brouillon de scénarios Gherkin | Propose des scénarios pour des exigences de solution fonctionnelles. | De 1 à 3 exigences de solution fonctionnelles |
| Faire le point | Où en est l'initiative : avancement, retards, points d'attention. | — |
| Question libre | Une question générale, sans lire votre initiative. | — |

**Mode de réponse** :
- « Réponse rapide » (par défaut), avec la ligne « En général de 2 à 10 minutes. » ;
- « Réponse approfondie », avec la ligne « Plus complète, environ trois fois plus longue. » ; pour la traçabilité et le Gherkin, elle est suivie de « · conseillée pour cet usage » ;
- avertissement affiché quand la réponse approfondie est choisie : « Réponse approfondie : plus complète, mais environ trois fois plus longue, jusqu'à une heure. Pendant ce temps, les demandes des autres membres attendent leur tour. »

**Question libre** :
- avertissement : « Pour une question libre, l'assistant ne lit pas votre initiative : il ne connaît ni ses besoins, ni ses exigences, ni ses pages, et répond d'après ses connaissances générales. » ;
- compteur : « 1 234 / 2 000 caractères », qui passe en rouge au-delà de 1 900.

**Encadré avant l'envoi et rubrique « Données lues » de l'avis** (rien pour la question libre) :
- « Transmis à l'assistant » : la ligne propre à l'usage, puis la partie commune :
  - Relire une page : « Le contenu de la page P-003, dans son dernier enregistrement » ;
  - Traçabilité : « Le contenu de P-003 et P-005, dans leur dernier enregistrement, et leurs liens (besoins, exigences, tickets) » ;
  - Préparer un atelier : « La description de l'action A-007, ses parties prenantes concernées et ses liens », puis la ligne BABOK ;
  - Gherkin : « Pour EX-004 : les scénarios et le contexte existants, la langue de la fonctionnalité » ;
  - Prochaines étapes, Faire le point (et Préparer un atelier) : « Les 30 tâches du BABOK, en indiquant celles qui sont couvertes » ;
  - partie commune : « La fiche de l'initiative : dates, statut, approche, équipe et rôles » · « Les parties prenantes, les besoins et les exigences » · « Les tickets de tous types, avec la description des seuls tickets non fermés » · « Les actions suggérées affichées aujourd'hui » · « La liste des pages (référence, titre), sans leur contenu » · « Des faits calculés par ACTA : date du jour, retards d'échéance, jours restants, décomptes du tableau de bord ».
- « Non transmis » : « Le contenu des autres pages » (relire, traçabilité) ou « Le contenu des pages » (autres usages), puis « Les commentaires » · « Les historiques et les versions » · « Les pièces jointes et les images » · « La description des tickets fermés » · « Vos avis précédents de l'assistant ».

**Envoi et refus** :
- bouton « Envoyer la demande » ;
- plafond dépassé : « Trop de données pour cet usage : choisissez une page plus courte ou moins d'exigences. » ;
- demande déjà non terminée : « Vous avez déjà une demande non terminée (« Faire le point », en attente). Attendez son avis ou annulez-la pour en poser une autre. »

**File et statuts** :
- statuts : En attente, En cours, Répondue, Échouée, Annulée ;
- position : « 2 demandes avant la vôtre. », « 1 demande avant la vôtre. », « Votre demande est la prochaine. » ;
- assistant injoignable : « Assistant momentanément indisponible : votre demande partira dès son retour. » ;
- en attente : « Vous pouvez quitter cet écran : l'avis vous attendra. » ;
- en cours : « L'assistant lit votre initiative et prépare son avis (20 minutes au plus). Vous pouvez quitter cet écran : l'avis vous attendra. » (60 minutes en mode approfondi) ;
- annulation : bouton « Annuler la demande », confirmation « Annuler cette demande ? L'assistant s'arrête et aucun avis partiel n'est conservé. » ;
- échec : « L'assistant n'a pas pu répondre : <raison>. », avec le bouton « Reposer la question ». Les six raisons sont : délai dépassé, assistant indisponible, l'assistant n'a pas pu répondre, données trop volumineuses, l'élément choisi n'existe plus, l'élément choisi ne convient plus à cet usage ;
- annulation constatée : « Demande annulée : <raison>. », avec la raison « annulée par vous » ou « vous n'avez plus accès à cette initiative ».

**Avis** :
- étiquette : « Avis de l'assistant » ;
- en-tête : « Établi d'après l'état de l'initiative au 26.11.2026 à 14:32 · Réponse rapide » ; pour la question libre : « Réponse établie sans lire votre initiative · Réponse rapide » ;
- signal de changement, avec les éléments et leur nature : « L'initiative a changé depuis cet avis : P-003 modifiée, EX-012 ajoutée, T-020 supprimé. » (accord selon l'élément) ;
- mise en garde de la relecture : « Relecture de cohérence. L'assistant repère les contradictions chiffrées et les points laissés en suspens. Il ne relève ni les défauts de rédaction, ni les erreurs de calcul, ni les termes vagues : « rien à signaler » ne vaut pas validation de la page. » ;
- mise en garde du Gherkin : « Brouillon à vérifier. Relisez chaque scénario (valeurs limites, règles, termes du domaine) avant de l'ajouter à une exigence : l'assistant ne l'ajoute jamais lui-même. » ;
- phrase de nature, à la fin de chaque avis : « Texte produit par un modèle de langue, sans contrôle par une règle d'ACTA : à retenir ou à écarter. Les actions suggérées du tableau de bord, elles, découlent de règles fixes. » ;
- rubrique repliable « Données lues » (voir l'encadré) ; boutons « Reposer en précisant » et « Effacer ».

**Historique et effacement** :
- « Vos demandes ne sont visibles que par vous. » ; liste vide : « Aucune demande sur cette initiative. » ;
- « Effacer » demande confirmation : « Effacer définitivement cette demande et son avis ? Ils ne pourront pas être retrouvés. » ;
- « Effacer toutes mes demandes de cette initiative » demande confirmation : « Effacer définitivement vos 5 demandes sur cette initiative, questions et avis compris ? Ils ne pourront pas être retrouvés. » ;
- signal : « Avis non lu », « 1 avis non lu », « 3 avis non lus ».

### Compteur global des avis non lus (complément du 27.11.2026)

Deuxième maquette, même branche (commit `7a97c08`, `?compteur=1|2|3`). Elle comparait trois réponses : un menu sous le compteur, un écran « Avis non lus » et un saut vers l'initiative. La responsable retient le **menu sous le compteur** :
- un clic sur le compteur ouvre un menu, sans quitter l'écran en cours ; Échap ou un clic à côté le referme ;
- titre : « 3 avis non lus », ou « Aucun avis non lu » ;
- les avis non lus y sont regroupés par initiative (code · nom), du plus récent au plus ancien ;
- chaque ligne donne l'usage et ses éléments, puis « Avis prêt » ou « Échouée : <raison> », puis la date de la demande ;
- un clic change d'initiative si besoin et ouvre la demande là où elle se range : l'onglet « Assistant » de l'élément, sinon le fil de l'initiative.
