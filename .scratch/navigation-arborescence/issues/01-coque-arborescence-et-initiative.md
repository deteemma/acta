# 01: Coque, arborescence et fiche de l'initiative

**What to build:** La nouvelle coque du web : sélecteur d'initiative, arborescence complète de l'initiative à gauche, écran de données à onglets à droite. L'initiative, son tableau de bord et son équipe s'y affichent ; les autres éléments s'ouvrent encore dans leur panneau actuel jusqu'à leur ticket.

**Status:** done (validé par la responsable fonctionnelle le 21.11.2026)

Règles : [spec](../spec.md) N1 à N5, N10 à N13, N15 (création d'une initiative), N16 ; [ADR-0021](../../../docs/adr/0021-navigation-par-arborescence.md). Référence visuelle : variante A du prototype (branche `prototype/navigation-arborescence`).

- [ ] Coque en deux zones ; sélecteur d'initiative (actives puis archivées), dernière initiative consultée retenue sur ce navigateur ; « Mes actions », référentiel BABOK et administration en bas de la colonne.
- [ ] « Mes actions » s'affiche dans la zone de droite et reste l'écran d'accueil.
- [ ] Arborescence complète (N5 à N10), au clavier, avec les nombres par branche ; tickets ouverts seulement, par Epic puis « Sans Epic ».
- [ ] Écran de données : fil d'Ariane, en-tête (type, référence, titre, badges), onglets accessibles.
- [ ] Initiative : onglets Aperçu (fiche et nombres par branche), Membres (membres, invitation), Désignations, Paramètres (code, archivage, suppression) ; droits actuels inchangés (lecteur, archivée).
- [ ] Tableau de bord et Équipe en nœuds, avec leurs onglets.
- [ ] Nouvelle initiative en fenêtre de dialogue ; « + Action » toujours disponible.
- [ ] Adresse par élément et par onglet ; rechargement, « Précédent », retour après connexion ; alerte des modifications non enregistrées au changement d'élément, d'onglet ou d'initiative.
- [ ] Petit écran : arborescence repliée, ouverte par-dessus.
- [ ] Palette : un résultat ouvre son nœud (élément pas encore repris : son panneau actuel).
- [ ] Construction de l'arborescence et lecture de l'adresse dans `shared/`, avec tests. Libellés en français et en anglais.
