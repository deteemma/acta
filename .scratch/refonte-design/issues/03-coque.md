# 03: Coque de navigation

**What to build:** Sur grand écran, l'application occupe toute la largeur disponible sans alourdir le visuel ; l'organisation validée (listes, panneaux, palette Ctrl+K, bouton « + Action ») ne change pas.

**Blocked by:** 02 — Composants de base

**Status:** done (validé par la responsable fonctionnelle le 01.11.2026 ; les deux points ci-dessous n'ont pas pu être testés)

- [x] Maquette de la coque dans Claude Design, validée.
- [x] Barre latérale repliable : Mes actions, initiatives (actives, archivées), administration pour l'administrateur.
- [x] Zone principale sur toute la largeur restante ; textes longs limités à environ 75 caractères par ligne.
- [x] À partir d'environ 1280 px, le panneau d'objet s'ancre à droite, à côté de la liste, qui reste utilisable ; en dessous, il passe par-dessus comme aujourd'hui.
- [x] Petit écran : comportement actuel conservé (plein écran, glissé depuis le bas).
- [x] En-tête, palette Ctrl+K, alertes et bouton « + Action » restyliés.

Fin de l'étape 3 : reprise des tickets fonctionnels.

Réalisation :
- Maquette : la piste B — Sauge validée au ticket 01 (barre latérale, barre du haut, zone pleine largeur, panneau ancré).
- Barre latérale : logotype, « Mes actions » (page en cours), « Mes initiatives » avec « Nouvelle initiative », les initiatives actives (code, nom, mon rôle), les archivées dans une section dépliable, « Administration » en bas pour l'administrateur. Le bouton « Masquer le menu » / « Afficher le menu » de la barre du haut la replie ; le choix est retenu sur ce navigateur.
- Barre du haut, fixe au défilement : menu, recherche (Ctrl+K), Référentiel BABOK, alertes, nom de l'utilisateur, langue, déconnexion.
- Zone principale : « Mes actions » sur toute la largeur ; textes mis en forme et textes sur plusieurs lignes limités à 75 caractères par ligne.
- Panneaux, à partir de 1280 px de large : le panneau latéral s'ancre à droite sans être modal, la page se resserre à côté et reste utilisable ; Échap le referme quand le focus y est. Un objet ouvert depuis la page remplace le panneau ancré au lieu de s'empiler ; ouvert depuis un panneau, il s'empile comme avant (retour au précédent en le fermant). La palette reste par-dessus.
- En dessous de 1280 px : panneaux modaux comme avant ; en dessous de 768 px, la barre latérale passe au-dessus de la page ; en dessous de 640 px, panneau plein écran glissé depuis le bas, inchangé.
- Libellés `shell.*` en français et en anglais.

Points à vérifier à la validation :
- Le passage d'un objet à l'autre depuis la liste remplace le panneau ancré (sinon chaque clic empilerait un panneau de plus) : à confirmer.
- Le mode du panneau (ancré ou par-dessus) est fixé à son ouverture : un panneau ouvert reste dans son mode si la fenêtre change de largeur.
