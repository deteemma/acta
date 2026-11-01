# 04: Écrans un par un

**What to build:** Chaque écran est revu pour sa hiérarchie visuelle : dense là où sont les données, aéré autour.

**Blocked by:** 03 — Coque de navigation

**Status:** en cours

Un passage par écran, chacun maquetté dans Claude Design puis validé :

- [x] Mes actions (à valider)
- [x] Fiche initiative et équipe (à valider)
- [x] Tableau de bord et actions suggérées (à valider)
- [ ] Parties prenantes (liste et matrice)
- [ ] Besoins
- [ ] Exigences (liste, fiche, historique)
- [ ] Référentiel BABOK
- [ ] Alertes
- [ ] Administration

Réalisation :
- Mes actions (maquette : piste B — Sauge) : filtres de statut en boutons bascule (même filtre, À faire et En cours par défaut), choix de l'initiative à côté ; liste en colonnes sur grand écran (initiative en police à chasse fixe, action, tâche BABOK avec son aperçu, échéance, statut), avec les en-têtes de colonnes ; la ligne de l'action ouverte dans le panneau est mise en évidence. Avec un panneau ancré et jusqu'à 1600 px de large, ou sur un écran plus petit, chaque action reste sur une ligne qui passe à la ligne au besoin. Les listes d'actions des panneaux (initiative, tableau de bord, besoin, exigence, partie prenante) gardent cette disposition en ligne, avec le responsable.
- Fiche initiative et équipe (maquette « Fiche initiative et équipe (panneau) », validée le 01.11.2026 avec ses trois ajouts) : en-tête avec « Initiative » et le code au-dessus du nom, badges « Mon rôle : … » et « BA de l'équipe » (si c'est le cas) ; trois groupes titrés Fiche, Analyse, Équipe ; chaque section (Actions, Parties prenantes, Besoins, Exigences, Membres) avec son compteur, qui remplace la phrase « n partie(s) prenante(s) » ; code et nom côte à côte ; « Exporter (Excel) » en bouton discret ; Archiver et Supprimer regroupés en bas sous le titre « Propriétaire ». Tous les panneaux gagnent la nouvelle marge intérieure et l'en-tête aligné en haut.
- Tableau de bord et actions suggérées (maquette « Tableau de bord et actions suggérées (panneau) », validée le 01.11.2026 avec ses trois choix) : en-tête « Tableau de bord » et le code au-dessus du nom de l'initiative ; groupes titrés « Actions suggérées » et « Couverture du BABOK » ; chaque suggestion présente son titre, sa justification et sa tâche, avec « Créer l'action » et « Écarter » à droite ; chaque domaine de connaissance a son numéro, son nom, « n tâche(s) couverte(s) sur N » et une barre de couverture ; une ligne par tâche, dépliable, avec ses compteurs par statut ou « Non couverte ».
