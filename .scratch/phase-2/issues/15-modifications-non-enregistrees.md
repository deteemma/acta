# 15: Modifications non enregistrées

**What to build:** Quitter une saisie non enregistrée, dans n'importe quel panneau du web ou formulaire du téléphone, déclenche une alerte qui propose d'enregistrer, d'abandonner ou de continuer. Le mécanisme sert ensuite aux tickets et aux pages.

**Blocked by:** —

**Status:** ready-for-agent

Règles : décision [12](12-modifications-non-enregistrees.md).

- [ ] Tous les panneaux de saisie de la phase 1 : initiative, action, partie prenante, besoin, exigence, équipe, administration.
- [ ] Une valeur revenue à son état enregistré, ou un formulaire de création resté à ses valeurs de départ, ne déclenche rien.
- [ ] Toutes les sorties listées au point 3 sont gardées ; fermeture ou rechargement de l'onglet : message du navigateur.
- [ ] Réussite : la sortie demandée se poursuit. Échec : panneau resté ouvert, saisie intacte, erreur affichée.
- [ ] Plusieurs panneaux modifiés : une alerte par panneau, du dessus vers le dessous ; panneau à plusieurs formulaires : une seule alerte.
- [ ] Téléphone : création rapide d'une action et formulaire d'initiative.
- [ ] Règle de comparaison dans `shared/`, avec tests. Libellés en français et en anglais.
