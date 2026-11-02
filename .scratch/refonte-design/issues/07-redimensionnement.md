# 07: Barre latérale et panneau ancré redimensionnables

**What to build:** Sur grand écran, l'utilisateur règle la largeur de la barre latérale et du panneau ancré à droite.

**Blocked by:** 03 — Coque de navigation

**Status:** done (validé le 01.11.2026 : vérifié par Claude dans l'application, à la demande de la responsable fonctionnelle)

Règles validées le 01.11.2026 :
- [x] Une poignée sur le bord intérieur de chaque zone (bord droit de la barre latérale, bord gauche du panneau ancré), glissée à la souris ; un double-clic revient à la largeur par défaut.
- [x] Barre latérale de 12 à 24 rem (192 à 384 px), 15 rem par défaut ; panneau ancré de 24 rem (384 px) à 60 % de la fenêtre, 32 rem par défaut.
- [x] Largeurs retenues sur ce navigateur (pas sur le compte).
- [x] Au clavier : la poignée prend le focus, les flèches gauche et droite élargissent ou rétrécissent (pas de 16 px), Début et Fin vont aux limites.
- [x] Pas de poignée quand le panneau passe par-dessus la liste (moins de 1280 px) ni sur petit écran.

Réalisation :
- `resize.tsx` : poignée (séparateur accessible, avec sa valeur), largeurs lues et enregistrées dans le navigateur, reprises au démarrage.
- CSS : largeurs bornées aussi en CSS, pour rester justes quand la fenêtre change de taille ; trait vert au survol, au focus et pendant le glissement.

Vérification dans l'application (01.11.2026, Chrome, compte de test alice) :
- Valeurs par défaut et bornes conformes : barre latérale 240 px (192 à 384), panneau 512 px (384 à 840 pour une fenêtre de 1400 px).
- Glisser à la souris : +80 px sur la barre latérale, largeur retenue après rechargement ; double-clic : retour au défaut.
- Clavier : flèches par pas de 16 px, Début et Fin aux limites, focus visible (trait vert). Sur le panneau, la flèche droite le rétrécit (la poignée est sur son bord gauche).
- Sous 1280 px, panneau par-dessus la liste sans poignée ; sous 768 px, plus de poignée sur la barre latérale.
