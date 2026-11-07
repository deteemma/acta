# 29: Administration : types et statuts

**What to build:** L'administrateur ajoute des types de ticket et des statuts, sans toucher à ceux qui sont livrés.

**Blocked by:** 18 — Types de ticket livrés et Epics

**Status:** ready-for-agent

Règles : décisions [03](03-types-de-ticket-et-statuts-parametrables.md) (points 3, 6 à 10) et [14](14-ecrans-d-administration.md) (points 1 et 2).

- [ ] Onglet « Types de ticket », sur le modèle de celui des statuts d'exigence : types avec leur acronyme ; déplier montre les statuts, leur famille et « fermé » ; formulaires d'ajout.
- [ ] Type ajouté : libellés dans les deux langues, acronyme réservé à vie, au moins deux statuts dont un fermé ; il n'a que les champs communs et se lie comme tout ticket.
- [ ] Renommer, désactiver et supprimer selon les règles ; refus du dernier statut fermé actif et du statut initial.
- [ ] Types et statuts ajoutés proposés partout : création, création rapide, filtres, palette, références.
- [ ] Réservé à l'administrateur, sans accès au contenu des initiatives ; `scripts/roles/` à jour ; libellés dans les deux langues.
