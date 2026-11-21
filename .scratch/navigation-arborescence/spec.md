# Spécification — Navigation par arborescence (web)

Décidée avec la responsable fonctionnelle le 20.11.2026, à partir d'une critique de design et d'un prototype jetable (branche `prototype/navigation-arborescence`, variante A retenue). Décision d'architecture : [ADR-0021](../../docs/adr/0021-navigation-par-arborescence.md). Vocabulaire : [`CONTEXT.md`](../../CONTEXT.md).

Chantier placé **avant l'Extension Agile** (décision du 20.11.2026), pour que celle-ci se construise directement dans la nouvelle navigation.

## Objectif

Une initiative se consulte et se modifie dans une seule fenêtre lisible : à gauche son **arborescence**, à droite l'**écran de données** de l'élément choisi, découpé en **onglets**. Les panneaux disparaissent.

## Périmètre

Compris : le web.

Non compris :
- le mobile, qui garde sa navigation (N14) ;
- toute nouvelle règle de gestion : les fiches reprennent les champs, droits et contrôles actuels ; seul leur conteneur change.

## Décisions

Chaque ticket renvoie à ces décisions : **les lire avant de coder**. En cas de doute ou de contradiction, s'arrêter et poser la question à la responsable fonctionnelle (`CLAUDE.md`).

### Mise en page

- **N1** — Plus aucun panneau. L'écran se divise en deux zones : l'arborescence à gauche, l'écran de données à droite.
- **N2** — Un sélecteur au-dessus de l'arborescence choisit l'initiative (actives, puis archivées). Au démarrage, il montre la dernière initiative consultée, retenue sur ce navigateur ; « Mes actions » reste l'écran d'accueil à droite.
- **N3** — En bas de la colonne de gauche, hors de l'arborescence : « Mes actions », le référentiel BABOK, l'administration (administrateur seulement). Ils s'affichent dans la zone de droite, comme les alertes ; l'arborescence reste visible, sans nœud sélectionné.
- **N4** — Petit écran (tablette, fenêtre étroite) : l'arborescence est repliée ; un bouton l'affiche par-dessus l'écran de données, et choisir un nœud la referme.

### Arborescence

- **N5** — Racine : l'initiative. Branches, dans cet ordre : Tableau de bord, Parties prenantes, Besoins, Exigences, Tickets, Pages, Équipe. Chaque branche montre son nombre d'éléments.
- **N6** — Exigences : imbriquées sous leur exigence parente ; les scénarios Gherkin d'une exigence apparaissent sous elle, dans leur ordre.
- **N7** — Besoins et exigences forment deux branches distinctes ; leur relation se lit dans l'onglet « Traçabilité » de l'exigence.
- **N8** — Tickets : seuls les tickets **ouverts** y figurent, rangés par Epic (l'Epic est le nœud parent de ses tickets) puis sous « Sans Epic » ; le ticket ouvert d'un Epic fermé va sous « Sans Epic », et le nombre de la branche compte les tickets ouverts (décisions du 21.11.2026). Les tickets fermés se retrouvent par la liste du nœud Tickets (filtre Ouverts / Fermés / Ouverts et fermés) ; ouvert depuis la liste, un ticket fermé s'affiche à droite sans apparaître dans l'arborescence. La liste ne met plus en évidence la ligne du ticket ouvert, la liste et le ticket n'étant plus affichés ensemble ; de même pour les listes d'actions (décision du 21.11.2026).
- **N9** — Pages : leur arborescence propre (sous-pages), avec le rangement actuel (glisser-déposer, Alt + flèches).
- **N10** — Le chemin vers le nœud choisi est toujours déplié. Les libellés sont alignés à gauche ; la référence courte (ex. `EX-001`) précède le titre.

### Écran de données

- **N11** — En tête : un fil d'Ariane depuis l'initiative, puis le type de l'élément, sa référence, son titre et ses badges (statut, type). Dessous, les **onglets** : un seul sous-écran affiché à la fois. Les onglets de chaque élément sont ceux du prototype validé :

  | Élément | Onglets |
  |---|---|
  | Initiative | Aperçu · Membres · Désignations · Paramètres |
  | Tableau de bord | Tâches BABOK · Actions suggérées |
  | Partie prenante | Fiche · À l'origine de |
  | Liste des parties prenantes | Liste · Matrice influence × intérêt |
  | Besoin | Fiche · Exigences · Liens |
  | Exigence | Fiche · Scénarios (fonctionnelle seulement) · Traçabilité · Liens · Historique |
  | Ticket | Fiche · Tickets de l'Epic (Epic seulement) · Liens · Commentaires · Pièces jointes · Historique |
  | Page | Contenu · Liens · Commentaires · Pièces jointes · Historique |
  | Équipe | Membres · Désignations |
  | Nœud de branche | la liste de ses éléments, avec le bouton de création |

  Tout champ ou section actuel d'un panneau trouve sa place dans l'un de ces onglets ; un cas qui n'y entre pas est une question pour la responsable fonctionnelle. Les actions liées à une partie prenante (avec « + Action ») vont dans son onglet Fiche, sous les champs (décision du 21.11.2026). Exigence : la Fiche garde les champs modifiables (besoins, exigence parente, sources) ; l'onglet Traçabilité les reprend en lecture, avec les exigences dérivées — ce libellé remplace « Exigences enfants » (décisions du 21.11.2026). Page : l'onglet Historique montre la liste des enregistrements ; un enregistrement ouvert ou la comparaison de deux s'y affiche à la place de la liste, avec « Retour à l'historique », sans adresse propre ; après une restauration, on reste dans l'onglet, la liste à jour (décisions du 21.11.2026).
- **N12** — Chaque élément et chaque onglet a sa propre adresse : recharger la page ou suivre un lien y ramène ; « Précédent » revient à l'élément ou à l'onglet d'avant. Après une connexion, on revient à l'adresse demandée.
- **N13** — L'alerte des modifications non enregistrées s'applique au passage d'un élément, d'un onglet ou d'une initiative à l'autre, comme aujourd'hui entre panneaux.

### Créations, recherche, mobile

- **N15** — Une création (initiative, action, ticket, partie prenante, besoin, exigence, page, scénario…) passe par une petite **fenêtre de dialogue** centrée avec les champs de création actuels. Une fois enregistré, l'élément s'ouvre à droite et apparaît dans l'arborescence. Le bouton « + Action » reste disponible partout. Une page ou une sous-page : la fenêtre fait choisir une page vide ou un modèle, puis le titre, prérempli par le modèle ; la page est créée avec le contenu du modèle et s'ouvre en écriture (décision du 21.11.2026). Une action suggérée créée depuis le tableau de bord s'ouvre de même à droite, à la place du tableau de bord ; une action choisie dans les alertes ouvre l'écran de son ticket (décisions du 21.11.2026).
- **N16** — La palette (Ctrl+K) est conservée : choisir un résultat change d'initiative si besoin, déplie l'arborescence et ouvre l'élément à droite ; un scénario ouvre l'onglet Scénarios de son exigence, le scénario mis en évidence. Une référence citée dans un texte fait de même. La mise en évidence suit l'adresse du scénario : elle tient tant qu'on reste sur cette adresse, et « Précédent » la retrouve ; un scénario tout juste créé s'ouvre de même (décisions du 21.11.2026).
- **N14** — Le mobile garde sa navigation actuelle.

## Points de vigilance

- Le design suit le système ACTA (ADR-0017, ADR-0018) : composants maison et tokens, aucun framework ajouté.
- Accessibilité WCAG 2.1 AA : arborescence au clavier (flèches, Entrée), onglets accessibles (`role="tablist"`), focus déplacé sur le titre à chaque changement d'élément.
- Performance d'une arborescence très fournie (centaines de tickets ouverts) : à mesurer.
- Pendant le chantier, les éléments pas encore repris s'ouvrent encore dans leur panneau actuel ; le dernier ticket retire les panneaux.
