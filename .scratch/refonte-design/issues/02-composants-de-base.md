# 02: Composants de base

**What to build:** Les éléments d'interface communs ont une seule apparence et un seul comportement dans toute l'application web.

**Blocked by:** 01 — Fondations visuelles

**Status:** done (validé par la responsable fonctionnelle le 01.11.2026 ; vérifié par Claude dans l'application le même jour, et les écrans d'administration le 02.11.2026 : trois défauts relevés, voir plus bas)

Vérification dans l'application (01.11.2026, Chrome, compte de test alice) : « Mes actions », fiche d'initiative (fiche, analyse, équipe), fiche d'exigence, tableau de bord.
- Bouton principal (vert plein) : seulement « Enregistrer », « Inviter » et « + Action ». Tous les « Supprimer » et « Retirer » sont rouges.
- Badges : statuts à la couleur de leur famille (« À faire » neutre, « En cours » en cours), « Non couverte » rouge ; rôles et types neutres.
- Focus visible au clavier sur chaque élément atteignable.
- Écrans d'administration : vérifiés le 02.11.2026 (Chrome, session administrateur ouverte par la responsable fonctionnelle), sur les quatre onglets. « Désactiver » et « Supprimer » rouges, « Créer le compte » et « Ajouter » en bouton principal, « Enregistrer » désactivé tant que rien n'a changé, badges neutres (« Actif », « BABOK », « Actif · utilisé »), focus visible au clavier.
- Défauts relevés dans l'administration, corrigés le 02.11.2026 et vérifiés dans l'application :
  - le bouton flottant « + Action » recouvrait le bas du panneau, dont le bouton « Créer le compte » : le contenu d'un panneau qui porte ce bouton garde une marge basse à sa hauteur ;
  - dans les listes, les libellés touchaient le bord gauche du cadre : la règle `.links li` annulait la marge intérieure de toutes les listes denses (`.dense-list`) ; corrigé pour toutes les listes de l'application, pas seulement l'administration (listes des autres écrans vérifiées par la responsable fonctionnelle le 02.11.2026) ;
  - « Supprimer » était proposé sur un statut d'exigence déjà utilisé : le bouton disparaît (décision de la responsable fonctionnelle du 02.11.2026).

- [x] Maquette des composants et de leurs états dans le système de design ACTA (Claude Design), validée.
- [x] Boutons : principal, secondaire, discret, danger ; états survol, focus, désactivé, en cours.
- [x] Champs : texte, zone de texte, liste déroulante, case à cocher, groupe d'options ; libellé, aide, erreur.
- [x] Badge de statut coloré selon sa famille de statut ; badge de compteur (alertes).
- [x] Carte, liste dense (une ligne par objet), onglets, notice, info-bulle d'aperçu.
- [x] Chaque écran existant utilise ces composants à la place des contrôles natifs.
- [x] Navigation au clavier et focus visible sur chaque composant (WCAG 2.1 AA).

Règles validées le 01.11.2026 :
- Seul le bouton qui enregistre ou qui crée est le bouton principal (vert plein) ; les autres sont secondaires ou discrets ; « Supprimer » est toujours rouge.
- « Non couverte » (tâche BABOK sans action) en rouge clair, « Nouvelle » (alerte pas encore vue) en bleu ; les autres étiquettes (rôle, nature d'un besoin, type de partie prenante) sont neutres.

Réalisation :
- Maquette : plan de travail « Composants de base — Sauge » sur https://claude.ai/artifact/HXES7msoVNsGF3AxRMJeTZ.
- Shared : `actionStatusTone` et `requirementStatusTone` (`status-tones.ts`) donnent la famille de statut ; un statut d'exigence ajouté par l'administration est neutre ; avec tests.
- Web, `styles.css` : boutons (secondaire par défaut, bouton d'envoi = principal, `ghost`, `danger`, bascule enfoncée, désactivé), champs (bordure, focus vert, erreur via `aria-invalid`, cases et options à la couleur d'accent), cadres de groupe, liste dense, badges et familles de statut (`tone-*`), carte, onglets Liste / Matrice, message d'erreur en notice rouge. Les règles sur les éléments sont sans poids (`:where`), toute classe les remplace.
- Badges : les statuts d'action et d'exigence portent la couleur de leur famille partout (listes, fiches, tableau de bord, aperçus) ; « Nouvelle » et « Non couverte » selon la règle ci-dessus.
- Listes denses : actions, besoins, exigences, parties prenantes, alertes, initiatives, membres et comptes de l'administration.
- Système de design : style de texte « badge » ajouté.

Points laissés aux tickets suivants :
- Les filtres de statut de « Mes actions » restent des cases à cocher ; leur passage en boutons bascule, comme sur la maquette, se fera avec l'écran (ticket 04).
- Les codes d'initiative dans les listes ne sont pas encore en police à chasse fixe (ticket 04).
- Coque (barre latérale, largeur) : ticket 03.
