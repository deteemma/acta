# 22: Pages : arborescence et écriture

**What to build:** Sous l'initiative, une entrée « Pages » affiche l'arborescence et le document en pleine page. On y crée une page vide, on l'écrit avec Tiptap, on la déplace et on la supprime.

**Blocked by:** 17 — Navigation et écran Tickets

**Status:** ready-for-agent

Règles : décisions [07](07-modele-de-la-page.md) (points 1 à 3, 7, 8), [08](08-editeur-de-page.md) (points 1 à 4, 6, 7), [13](13-coexistence-de-la-navigation.md), ADR-0019. Référence visuelle : variante D de la branche `prototype/editeur-de-page`.

- [ ] Tiptap déclaré en dépendance, en version fixée et sortie depuis au moins deux semaines ; code chargé à la demande ; barre d'outils sur les tokens de design.
- [ ] Contenu enregistré en JSON : vérifier en priorité l'affichage en lecture seule, jamais prototypé, et le retour à « non modifié » après une annulation (alerte du ticket 15). Refaire les essais de fidélité : `# Budget 2027`, `2026. Une année`, `a < b & c`.
- [ ] Référence `CODE-PA-NNN` ; catégorie visible dans l'onglet des références. La page n'existe, avec sa référence, qu'au premier enregistrement.
- [ ] Limite de 200 000 caractères comptée sur le texte. Références : saisie par `#` et par le bouton, restent du texte, reliées à leur objet.
- [ ] Arborescence : profondeur illimitée, ordre libre, déplacement avec les sous-pages par glissement, avec une solution au clavier ; pas sous soi-même. Glissement non vérifié dans le prototype.
- [ ] Suppression refusée si la page a des sous-pages ou des liens.
- [ ] Adresse : suit l'écran Pages et la page ouverte ; lien partageable, refus pour un non-membre. Panneau d'initiative : ligne « Pages ». Palette : pages par référence et titre.
- [ ] Petit écran : arborescence au-dessus du document. Lecteur et initiative archivée : lecture seule.
- [ ] Règles dans `shared/`, avec tests ; deux barrières dans `scripts/roles/` ; libellés dans les deux langues.
