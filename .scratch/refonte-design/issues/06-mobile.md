# 06: Mobile

**What to build:** L'application mobile a la même identité visuelle que le web.

**Blocked by:** 05 — Icônes et états vides

**Status:** à valider par la responsable fonctionnelle

- [x] Partage des tokens entre web et mobile décidé (ADR-0017, conséquences).
- [x] Couleurs, typographie, espacements, familles de statut et icônes du web appliqués au mobile, en thème clair et sombre.
- [x] Plus aucune couleur écrite en dur dans `mobile/src`.
- [x] Écrans Mes actions, Mes initiatives, fiche d'action et création rapide revus.

Décisions validées le 01.11.2026 :
- ADR-0018 : tokens écrits une seule fois dans `shared/src/design-tokens.ts` (option A).
- Maquette « Mobile — quatre écrans » ; en-tête avec logotype, langue et déconnexion en icônes, onglets en deux segments ; fiche d'action avec « Action » et le code au-dessus du titre, statut en badge, informations dans une carte.

Réalisation :
- Shared : `design-tokens.ts` (couleurs claires et sombres, familles de statut, ombres, espacements, rayons, tailles de texte), avec tests.
- Web : `theme.ts` installe les propriétés CSS au démarrage ; `tokens.css` ne garde que les polices. Noms de propriétés inchangés.
- Mobile : `theme.tsx` (thème du téléphone, `useTheme`, `useStyles`) ; IBM Plex Sans et Mono par `@expo-google-fonts` (chargées au démarrage ; à défaut, police du téléphone) ; icônes `lucide-react-native` ; `Text` du thème à la place de celui de React Native.
- Écrans : en-tête validé, accueil avec logotype, accroche, « Se connecter » et langue ; Mes actions (filtres, lignes dans une carte : titre, code, échéance, statut coloré, tâche BABOK ; état vide) ; Mes initiatives (formulaire, lignes code, nom, rôle ; état vide) ; fiche d'action ; création rapide (champ et bouton principal du thème) ; texte mis en forme.
- Toutes les dépendances ajoutées sont incluses dans Expo Go : aucun build de développement nécessaire.

Points à vérifier sur un téléphone (non testé : pas d'appareil ni d'émulateur dans cette session) :
- Thème sombre du téléphone : lisibilité de chaque écran.
- Polices : chargement au démarrage.
