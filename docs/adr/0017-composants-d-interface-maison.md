# ADR-0017 — Composants d'interface maison sur des tokens de design

- **Statut** : accepté
- **Date** : 2026-11-01

## Contexte

Le web s'est construit ticket après ticket sur environ 580 lignes de CSS, sans
système de design : police du système, une seule couleur d'accent, contrôles
natifs du navigateur, espacements choisis au cas par cas. Le mobile (Expo)
recopie les mêmes couleurs en dur. La refonte du design (validée le 01.11.2026)
demande une identité propre à ACTA, sobre dans les listes et chaleureuse
autour, en thème clair et sombre, au niveau WCAG 2.1 AA, puis reprise sur le
mobile. Options envisagées : un framework d'interface (Material UI, Mantine),
un framework de classes utilitaires (Tailwind), ou des composants maison sur
des variables de design.

## Décision

1. Les valeurs de design (couleurs, typographie, espacements, rayons, ombres,
   familles de statut) sont des **tokens** : propriétés personnalisées CSS sur
   le web, définies une seule fois, avec leur variante sombre.
2. Les composants d'interface (bouton, champ, badge, carte, liste, onglets,
   notice…) sont **écrits pour ACTA** dans `web/src`, sans framework
   d'interface ni framework de classes utilitaires.
3. Aucune valeur de couleur, d'espacement ou de rayon n'est écrite en dur hors
   du fichier des tokens.
4. Seules dépendances ajoutées : la bibliothèque d'icônes Lucide et la police
   retenue, embarquée dans l'application (jamais chargée depuis Internet).
5. Le système de design ACTA dans Claude Design est la référence visuelle ; les
   tokens du code en reprennent les valeurs.

## Conséquences

- L'apparence est entièrement maîtrisée et l'application reste légère ; aucun
  style imposé par un tiers à défaire.
- Les composants, leur accessibilité (focus, clavier, contrastes) et leurs états
  sont à notre charge : à vérifier à chaque ticket de la refonte.
- Le mobile reprendra les mêmes valeurs de tokens (étape 6) ; leur partage
  entre web et mobile sera décidé à ce moment.
- Ajouter plus tard un framework d'interface demanderait un nouvel ADR.
