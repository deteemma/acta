# Éditeur de page

Type: prototype
Status: resolved
Blocked by: 07

## Question

À quoi ressemble l'écriture d'une page et comment se comporte l'éditeur ? Texte mis en forme ou markdown, titres, listes, tableaux, images (pièces jointes affichées dans le texte), mentions de tickets, d'exigences ou de pages par leur référence. Selon « Modèle de la page » : la case « enregistrer comme nouvelle version », l'historique des enregistrements et la comparaison de deux d'entre eux, le refus d'enregistrer quand la page a changé entre-temps (sans perdre la saisie), l'arborescence et le déplacement des pages. Un prototype à manipuler pour réagir.

## Réponse

Tranché avec la responsable fonctionnelle le 05.11.2026, après manipulation du prototype. Prototype conservé sur la branche jetable `prototype/editeur-de-page` (à ne jamais fusionner) : `pnpm dev:web`, puis `/prototype-page.html?variant=D`. Choix technique : [ADR-0019](../../../docs/adr/0019-editeur-de-page-tiptap-json.md).

1. **Écriture** : Tiptap, directement dans le rendu final, avec une barre d'outils ; contenu enregistré dans le format JSON de Tiptap. Le prototype enregistrait en Markdown : ce format a déformé des textes à la réouverture, le JSON n'est donc pas prototypé mais seulement testé sur ces textes.
2. **Mise en forme disponible** : titres de trois niveaux, gras, italique, lien, listes à puces et numérotées, tableau (ajouter ou retirer une ligne ou une colonne, retirer le tableau ; pas de largeur de colonne réglable), image, annuler et rétablir. La responsable fonctionnelle n'a rien à ajouter ni à retirer pour l'instant.
3. **Au clavier** : `# ` sur une ligne vide fait un titre, `- ` une liste, `**gras**` du gras ; Tab passe à la cellule suivante et ajoute une ligne en fin de tableau.
4. **Références** : `#` suivi de quelques lettres propose tickets, exigences, besoins et pages, Entrée insère la référence ; le bouton « Référence » fait de même. Une référence reste du texte, mis en valeur et relié à son objet.
5. **Images** : bouton « Image » ; dans le prototype, coller ou déposer une image est prévu mais n'a pas été essayé. L'image est une pièce jointe affichée dans le texte (voir « Pièces jointes »).
6. **Place de la page** : pleine page, atteinte par l'entrée « Pages » sous l'initiative dans la barre latérale (voir « Écrans des tickets » ; le menu du haut montré par le prototype n'existe pas dans ACTA), arborescence à gauche, document au centre, historique dans un volet à droite. Bouton « Modifier » : la page passe en écriture au même endroit, avec la barre d'enregistrement en haut (Enregistrer, Annuler, case « Enregistrer comme version N » et sa note, compteur de caractères).
7. **Arborescence** : glisser une page sur le haut d'une ligne la place avant, sur le reste de la ligne elle devient sa sous-page ; `+` sur une ligne ajoute une sous-page, « Nouvelle page » une page de premier niveau. Le glissement n'a pas été vérifié par les tests automatiques du prototype.
8. **Comparaison** : dans un seul texte, ajouts et suppressions mis en évidence, sur le texte de la page. Un changement de mise en forme seul n'y apparaît pas et un tableau s'y lit avec ses séparateurs : retenu tel quel, la responsable fonctionnelle n'ayant pas demandé mieux.
9. **Refus d'enregistrer** : un bandeau reste affiché au-dessus de la saisie, avec qui a modifié et à quelle heure, et trois boutons : « Comparer avec ma saisie » ; « Enregistrer ma saisie à la suite » (l'enregistrement de l'autre membre reste dans l'historique, mais ses ajouts disparaissent de la page) ; « Abandonner ma saisie et prendre la sienne ».

Tiptap reste à déclarer en dépendance à la réalisation, en version fixée et sortie depuis au moins deux semaines (3.32.0 à ce jour, et non la 3.33.0 ajoutée le 05.11.2026 sans décision).
