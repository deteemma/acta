# 31: Administration : limite de pièces jointes

**What to build:** L'administrateur règle le volume total de pièces jointes par initiative, sans jamais dépasser le plafond.

**Blocked by:** 21 — Pièces jointes des tickets

**Status:** ready-for-agent

Règles : décision [14](14-ecrans-d-administration.md) (points 1 et 4).

- [ ] Onglet « Pièces jointes » : champ en Mo, 500 par défaut, entre 10 et 1 024 ; refus en dehors, contrôlé côté serveur.
- [ ] Limite valable pour toute l'application. La taille maximale d'un fichier (10 Mo) n'est pas réglable.
- [ ] Baisser la limite ne supprime aucun fichier : seuls les ajouts sont refusés.
- [ ] L'administrateur ne voit pas l'occupation de chaque initiative.
- [ ] Réservé à l'administrateur ; `scripts/roles/` à jour ; libellés dans les deux langues.
