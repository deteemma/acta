# 26: Images et pièces jointes des pages

**What to build:** On insère des images dans le texte d'une page et on lui joint des fichiers, qui restent visibles dans les anciens enregistrements.

**Blocked by:** 21 — Pièces jointes des tickets ; 23 — Enregistrements et versions

**Status:** ready-for-agent

Règles : décisions [10](10-pieces-jointes.md) (points 7 à 9) et [08](08-editeur-de-page.md) (point 5).

- [ ] Image par bouton, collage et dépôt, avec les formats et limites du ticket 21 ; collage et dépôt non vérifiés dans le prototype.
- [ ] Rattachée seulement à l'enregistrement de la saisie : abandonner ne laisse rien, y compris pour une page pas encore créée. Aucun fichier orphelin après une fermeture brutale.
- [ ] Listée parmi les pièces jointes avec la mention « affichée dans le texte ». La liste n'est pas versionnée.
- [ ] Une image retirée du texte reste dans la liste et s'affiche dans les anciens enregistrements. Supprimer un enregistrement ne supprime aucun fichier.
- [ ] Suppression refusée si l'image figure dans le dernier enregistrement ; sinon avertissement listant les enregistrements touchés, puis « image supprimée » à sa place, y compris après une restauration.
- [ ] L'image n'est pas lisible par un non-membre ; deux barrières dans `scripts/roles/` ; libellés dans les deux langues.
