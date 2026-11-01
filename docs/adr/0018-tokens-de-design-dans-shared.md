# ADR-0018 — Tokens de design écrits une seule fois, dans `shared`

- **Statut** : accepté
- **Date** : 2026-11-01

## Contexte

ADR-0017 définit les tokens de design comme des propriétés personnalisées CSS
sur le web (`web/src/tokens.css`) et renvoie à plus tard leur partage avec le
mobile. Le mobile (Expo) écrit encore ses couleurs en dur, sans thème sombre.
La refonte du design (ticket 06) lui applique l'identité du web. Options
envisagées (01.11.2026) : une seule source dans `shared` ; deux copies
contrôlées par un test ; deux copies sans contrôle. La responsable
fonctionnelle a retenu la première.

## Décision

1. Les valeurs de design (couleurs des thèmes clair et sombre, familles de
   statut, espacements, rayons, ombres, tailles de texte) sont écrites une
   seule fois, dans `shared/src/design-tokens.ts`, en valeurs indépendantes
   de la plateforme (couleurs hexadécimales, longueurs en pixels).
2. Le web en tire ses propriétés personnalisées CSS au démarrage, avant le
   premier affichage ; `web/src/tokens.css` ne garde que le chargement des
   polices. Les noms des propriétés CSS ne changent pas.
3. Le mobile les lit dans le même fichier, selon le thème du téléphone.
4. Aucune valeur de couleur, d'espacement ni de rayon n'est écrite hors de
   `shared/src/design-tokens.ts` (complète le point 3 d'ADR-0017).
5. Le système de design ACTA dans Claude Design reste la référence visuelle ;
   ses valeurs sont reprises dans ce fichier.

## Conséquences

- Une valeur changée l'est à la fois sur le web et sur le mobile.
- Sur le web, les couleurs ne sont plus lisibles dans un fichier CSS mais dans
  un fichier TypeScript ; une erreur dans ce fichier empêche le web de démarrer
  avec ses couleurs, d'où un test dans `shared` sur sa forme (chaque couleur
  a sa valeur claire et sombre).
- Les polices restent propres à chaque plateforme : embarquées par
  `@fontsource` sur le web, par `expo-font` sur le mobile.
