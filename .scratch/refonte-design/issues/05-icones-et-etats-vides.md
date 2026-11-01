# 05: Icônes et états vides

**What to build:** Des icônes discrètes guident la lecture, et une liste vide explique quoi faire au lieu d'être muette.

**Blocked by:** 04 — Écrans un par un

**Status:** à valider par la responsable fonctionnelle (un point ouvert : affichage direct de la connexion)

- [x] Icônes Lucide pour la navigation, les boutons d'action et les statuts ; jamais à la place du texte des boutons importants.
- [x] Style d'illustration choisi dans Claude Design, validé.
- [x] Un état vide illustré, avec un texte et l'action utile, pour chaque liste (actions, initiatives, parties prenantes, besoins, exigences, alertes).
- [x] Écran de connexion et d'accueil avec le logotype et une illustration.

Choix validés le 01.11.2026 (maquette « Icônes, états vides et connexion ») :
- États vides en style A (illustration au trait) ; écran de connexion en style B (blocs de couleur et trame de points).
- Aides des états vides, mot pour mot, et accroche « Le suivi des actions d'une équipe de business analysts, sur le BABOK. ».

Réalisation :
- Icônes `lucide-react` : barre latérale (Mes actions, Archivées, Administration ; les initiatives gardent leur code), barre du haut (menu et alertes en icône seule avec libellé accessible, recherche, référentiel, déconnexion), bouton « + Action », Nouvelle initiative, Tableau de bord, Liste et matrice, Nouveau besoin, Nouvelle exigence, Exporter, Archiver / Désarchiver, Supprimer l'initiative, Inviter, fermeture des panneaux. « Enregistrer » et « Créer » restent sans icône.
- `EmptyState` (`empty-state.tsx`) : feuille au trait gris, icône du sujet en vert, texte actuel, aide ajoutée. Mes actions propose « + Action » ; dans la barre latérale et la fiche initiative, l'état vide est réduit et l'action reste le bouton de l'en-tête de section (pour ne pas la doubler).
- Connexion : logotype, accroche, « Se connecter » en bouton principal, langue, illustration à droite (masquée sur petit écran).
- Libellés `app.tagline` et `empty.*` en français et en anglais.

Point ouvert :
- « L'écran de connexion s'affiche sans devoir passer par le bouton connexion » : interprétation à confirmer (voir la question posée le 01.11.2026).
