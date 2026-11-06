# 17: Navigation et écran Tickets

**What to build:** Sous l'initiative, une entrée « Tickets » affiche en pleine page un tableau filtrable et triable de ses tickets. La fiche s'ouvre en panneau à côté. L'adresse du navigateur suit l'écran.

**Blocked by:** 16 — Ticket générique et passage de l'Action

**Status:** ready-for-agent

Règles : décisions [11](11-ecrans-des-tickets.md) (points 1 à 3, 5, 8) et [13](13-coexistence-de-la-navigation.md). Référence visuelle : variante B de la branche `prototype/ecrans-des-tickets`.

- [ ] Clic sur une initiative : fiche en panneau et entrée dépliée, une seule initiative à la fois. « Mes actions » et « Tickets » remplacent l'écran principal et ferment les panneaux, avec l'alerte du ticket 15 si besoin.
- [ ] Tableau : colonnes, tri par défaut et sur chaque colonne, filtres et état « ouverts » par défaut ; responsable qui n'est plus membre et échéance dépassée signalés ; ligne du ticket ouvert mise en évidence.
- [ ] Le panneau ouvert ne doit pas rendre le tableau illisible : les captures du prototype montrent des titres écrasés. Solution à proposer à la validation.
- [ ] Adresse : recharger reste sur l'écran ; non-membre : refus. Le bouton « Précédent » du navigateur revient à l'écran d'avant, avec l'alerte du ticket 15 s'il y a une saisie non enregistrée.
- [ ] Panneau d'initiative : section « Actions » inchangée ; ligne « Tickets » avec son nombre et un bouton vers l'écran. « + Action » reste partout.
- [ ] Palette : trouve les tickets par référence et par titre ; une référence de ticket citée dans un texte mène à sa fiche.
- [ ] Petit écran : liste compacte sur deux lignes, fiche pleine largeur. Lecteur et initiative archivée : lecture seule.
- [ ] Filtrage et tri dans `shared/`, avec tests. Libellés en français et en anglais.
