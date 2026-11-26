# T5-technique-babok

- Durée totale : 251 s
- Contexte lu : 4176 tokens en 97 s
- Texte produit : 732 tokens en 154 s
- Réflexion : non

## Réponse du modèle

Pour prioriser les exigences par des responsables d'équipe réticents, voici mon analyse basée sur le cadre BABOK v3 :

### Recommandation principale
**Technique conseillée :** **10.21 Groupes de discussion (Focus Groups)**  
*(Ou en second choix immédiat : **10.50 Ateliers de travail**)*

**Pourquoi cette technique ?**
La technique 10.21 est indiquée pour « réunir un petit groupe choisi avec soin » afin de réagir à un produit ou une décision. Elle permet de structurer la discussion autour des points de blocage spécifiques (comme la réticence identifiée dans **DNF-RI-001**) sans l'inconvénient d'une foule hétérogène qui pourrait mener au chaos ou faire valoir les arguments des plus forts voix (souvent ceux qui sont opposés au changement).

Cependant, compte tenu du besoin de « prioriser » explicitement et de définir un résultat clair malgré les tensions, la technique **10.50 Ateliers de travail** est en réalité le choix le plus robuste pour ce scénario spécifique :
*   Elle permet d'organiser une séance structurée avec ces 12 responsables.
*   Elle vise à « produire ensemble un résultat défini » (la liste priorisée des exigences).
*   Cette structure aide à canaliser les réticences, transformant l'opposition en contributions concrètes sur le backlog (**DNF-AC-004** est d'ailleurs déjà assigné avec cette intention).

### Proposition alternative
**Technique alternative :** **10.23 Glossaire** (utilisée de manière stratégique) ou **10.29 Mind Mapping**.

*   **Raison du choix alternatif :** Avant ou pendant la réunion, il peut être nécessaire d'aligner la compréhension commune pour désamorcer les conflits. Si une partie des réticences vient de malentendus sur ce que signifie « validation » ou « remboursement », utiliser un **Glossaire (10.23)** pour clarifier le vocabulaire métier avant la priorisation est crucial.
*   Une fois les termes alignés, un **Mind Mapping (10.29)** pourrait être utilisé visuellement pour placer les exigences autour d'un thème central (ex: « Réduire les coûts », « Améliorer la rapidité ») et les regrouper par catégorie avant de voter sur la priorité.

**Références citées :**
*   **DNF-RI-001** : Risque identifié (Refus du changement).
*   **DNF-AC-004** : Ticket d'action « Atelier avec les responsables d'équipe » en cours de planification.
*   **10.21 Groupes de discussion** : Réunir un petit groupe choisi pour discuter d'un sujet.
*   **10.50 Ateliers de travail** : Réunir les parties prenantes pour produire un résultat défini.
*   **10.23 Glossaire** : Définir des termes pour une compréhension commune.
*   **10.29 Mind Mapping** : Organiser visuellement des idées et explorer un sujet.

**Note d'information manquante :** Les données ne précisent pas le nombre exact de responsables sur chaque site, ni leur répartition géographique précise, ce qui pourrait influencer la logistique des groupes (ex: nécessité de sessions virtuelles).
