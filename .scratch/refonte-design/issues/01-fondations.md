# 01: Fondations visuelles

**What to build:** ACTA a son identité visuelle : couleurs, typographie, espacements, rayons, ombres et familles de statut, en thème clair et sombre, appliquées à toute l'application web sans changer son organisation.

**Blocked by:** validation de l'ADR-0017 — Composants d'interface maison (accepté le 01.11.2026)

**Status:** à valider par la responsable fonctionnelle

- [x] Trois pistes visuelles comparées dans Claude Design sur « Mes actions » avec un panneau d'exigence ouvert ; une piste choisie par la responsable fonctionnelle.
- [x] Le système de design ACTA est créé dans Claude Design à partir de la piste choisie.
- [x] Logotype typographique « ACTA » dans l'en-tête et sur l'écran de connexion.
- [x] Tokens : palette (neutres, accent, familles de statut : neutre, en cours, positif, attention, négatif), typographie, échelle d'espacements, rayons, ombres ; variante sombre de chacun.
- [x] La police est embarquée dans l'application, jamais chargée depuis Internet.
- [x] Plus aucune couleur, aucun espacement ni rayon écrit en dur hors des tokens (ADR-0017).
- [x] Contrastes conformes WCAG 2.1 AA dans les deux thèmes.

Réalisation :
- Pistes visuelles : https://claude.ai/artifact/HXES7msoVNsGF3AxRMJeTZ ; piste B — Sauge retenue le 01.11.2026.
- Système de design ACTA : https://claude.ai/artifact/1bsnhkiWspTYmYcTLzkZ1f (tokens, brand book, couverture).
- `web/src/tokens.css` : les tokens du système de design, thème clair puis sombre (réglage du système) ; IBM Plex Sans et IBM Plex Mono embarquées par `@fontsource`.
- `web/src/styles.css` : chaque couleur, espacement, rayon et ombre passe par un token ; texte en IBM Plex Sans 14px ; fonds `bg` et `surface` ; codes clavier en IBM Plex Mono. Les sélecteurs et l'organisation des écrans sont inchangés.
- Logotype : « ACTA » espacé, précédé d'une barre d'accent, dans l'en-tête à côté de « Mes actions » et en titre de l'écran de connexion.
- Contrastes calculés pour chaque couple texte / fond, dans les deux thèmes : 4.8:1 au minimum (pastille d'alerte), 5.6:1 pour le texte secondaire.

Points laissés aux tickets suivants :
- Boutons, champs et cases à cocher gardent l'apparence du navigateur, et les badges de statut ne prennent pas encore la couleur de leur famille : ticket 02.
- Colonne étroite de 40rem, sans barre latérale : ticket 03.
