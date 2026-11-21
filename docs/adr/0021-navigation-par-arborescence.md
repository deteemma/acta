# ADR-0021 — Navigation par arborescence de l'initiative

- **Statut** : accepté
- **Date** : 2026-11-20

## Contexte

Depuis la refonte du design (ticket 02 et suivants), le web superpose trois
niveaux de navigation : la barre latérale (initiatives, puis Tickets et Pages),
l'écran principal (Mes actions, Tickets, Pages) et une pile de panneaux à droite
(fiche de l'initiative, besoin, exigence, ticket…). Avec les tickets, les pages
et les scénarios Gherkin, les informations d'une initiative ne tiennent plus
dans une seule fenêtre :

- la fiche de l'initiative et celle d'une exigence occupent cinq à six hauteurs
  d'écran dans un panneau ;
- besoins, exigences et parties prenantes ne sont accessibles que depuis le
  panneau de l'initiative ; ouvrir une exigence remplace ce panneau sans chemin
  de retour visible ;
- le panneau ancré écrase l'écran principal (colonnes du tableau des tickets
  masquées, barre du haut sur deux lignes).

La critique de design du 20.11.2026 et un prototype jetable (branche
`prototype/navigation-arborescence`) ont comparé trois présentations des
sous-écrans : onglets, page continue avec sommaire, sous-écrans dans l'arbre.

## Décision

1. Le web abandonne les panneaux. L'écran se divise en deux zones : à gauche
   l'**arborescence** d'une initiative, à droite l'**écran de données** de
   l'élément choisi.
2. Un sélecteur au-dessus de l'arborescence choisit l'initiative. « Mes
   actions », le référentiel BABOK et l'administration restent en bas de la
   colonne de gauche, hors de l'arborescence.
3. La racine de l'arborescence est l'initiative ; ses branches sont : Tableau
   de bord, Parties prenantes, Besoins, Exigences, Tickets, Pages, Équipe.
4. Les exigences sont imbriquées sous leur exigence parente ; les scénarios
   Gherkin d'une exigence apparaissent sous elle. Besoins et exigences forment
   deux branches distinctes ; leur relation se lit dans le sous-écran
   « Traçabilité » de l'exigence.
5. La branche Tickets ne montre que les tickets ouverts, rangés par Epic puis
   sous « Sans Epic ». Les tickets fermés se retrouvent par la liste du nœud
   Tickets (filtre Ouverts / Fermés / Ouverts et fermés).
6. Les pages suivent leur arborescence propre (sous-pages).
7. L'écran de données porte un fil d'Ariane depuis l'initiative, le titre, la
   référence et le statut de l'élément, puis ses **sous-écrans en onglets** :
   un seul affiché à la fois (variante A du prototype).
8. Chaque élément et chaque sous-écran a sa propre adresse dans le navigateur.
9. Une création (action, ticket, besoin, exigence, page…) passe par une petite
   fenêtre de dialogue centrée ; une fois enregistré, l'élément s'ouvre dans
   l'écran de données et apparaît dans l'arborescence.
10. Cette décision ne concerne que le web : le mobile garde sa navigation.

## Conséquences

- Plus aucun écran ne dépasse environ une hauteur et demie de fenêtre ; on sait
  toujours où l'on est dans l'initiative.
- La coque actuelle (`panels.tsx`, `screens.tsx`, la plupart des `*-panels.tsx`)
  est à refaire : le contenu des fiches est repris, leur conteneur change.
- L'alerte des modifications non enregistrées s'applique au passage d'un
  élément ou d'un onglet à l'autre.
- Web et mobile n'ont plus la même navigation.
- La performance d'une arborescence très fournie (centaines de tickets ouverts)
  est à surveiller.
