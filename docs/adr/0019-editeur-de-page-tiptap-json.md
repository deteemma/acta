# ADR-0019 — Éditeur de page : Tiptap, contenu enregistré en JSON

- **Statut** : accepté
- **Date** : 2026-11-05

## Contexte

Une page est un document long, avec titres, listes, tableaux, images et
références (ticket « Modèle de la page », phase 2). L'ADR-0017 limite les
dépendances d'interface à Lucide et à la police, et les descriptions d'actions
sont aujourd'hui saisies en Markdown dans une zone de texte.

Un prototype a comparé, sur les mêmes parcours, l'édition native du navigateur,
le Markdown avec aperçu, un éditeur par blocs écrit pour ACTA et Tiptap.
L'édition native gère mal le collage depuis Word et les tableaux au clavier ; la
responsable fonctionnelle a retenu Tiptap, sur une page pleine largeur.

Enregistrer ce que Tiptap écrit en Markdown (`@tiptap/markdown`) déforme le
contenu à la réouverture : le texte collé `# Budget 2027` devient un titre,
`2026. Une année` une liste commençant à 2026, et `a < b & c` est stocké avec des
entités HTML. Le format natif de Tiptap (JSON) restitue ces mêmes textes à
l'identique.

## Décision

1. Le contenu d'une page est écrit avec **Tiptap** (licence MIT), sans extension
   payante. Cette dépendance est une exception à l'ADR-0017, point 4, limitée à
   l'écriture et à l'affichage du contenu des pages ; les composants d'interface
   restent écrits pour ACTA et la barre d'outils utilise les tokens de design.
2. Le contenu d'une page est enregistré dans le **format JSON de Tiptap**, pas en
   Markdown. Les limites de taille et la comparaison portent sur le texte extrait
   de ce JSON.
3. Une référence reste du **texte** dans le contenu ; l'affichage la relie à son
   objet, comme dans le reste d'ACTA.
4. Les descriptions de tickets et les commentaires gardent leur format actuel.
5. Le code de l'éditeur est chargé seulement quand on en a besoin, et la version
   de Tiptap est fixée exactement, sur une version sortie depuis au moins deux
   semaines.

## Conséquences

- Collage, tableaux, raccourcis clavier et annulation viennent de Tiptap et ne
  sont pas à écrire ; environ 174 Ko compressés de plus, chargés à la demande.
- Deux formats de texte mis en forme coexistent : `shared/src/rich-text.ts` ne lit
  pas le contenu d'une page. Une recherche ou un export devra extraire le texte
  du JSON.
- Le JSON dépend du schéma des extensions : retirer ou renommer une extension
  demande de migrer les enregistrements déjà conservés, car les anciens
  enregistrements doivent rester lisibles. À surveiller à chaque montée de version.
- La comparaison reste au mot à mot sur le texte : un changement de mise en forme
  seul n'y apparaît pas.
- À vérifier dès la réalisation : l'affichage en lecture seule à partir du JSON, non
  couvert par le prototype, et le retour à « non modifié » après une annulation.
