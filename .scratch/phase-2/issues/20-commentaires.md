# 20: Commentaires

**What to build:** Propriétaires et contributeurs commentent un ticket dans un fil simple que tout membre peut lire.

**Blocked by:** 18 — Types de ticket livrés et Epics

**Status:** ready-for-agent

Règles : décision [05](05-commentaires.md).

- [ ] Fil du plus ancien au plus récent ; texte mis en forme de 5 000 caractères au plus, références reliées à leur objet ; ni mention ni pièce jointe.
- [ ] Modification par l'auteur encore propriétaire ou contributeur, avec « modifié le … », sans garder l'ancien texte.
- [ ] Suppression par cet auteur ou un propriétaire, après confirmation, en laissant une ligne de trace.
- [ ] Ticket fermé : commentable. Initiative archivée : lecture seule. Commentaires hors historique, supprimés avec le ticket, absents du téléphone.
- [ ] La table sert aussi aux pages au ticket 25 : prévoir les deux supports sans refaire la migration.
- [ ] Règles dans `shared/`, avec tests ; deux barrières dans `scripts/roles/`, dont un auteur devenu lecteur ; libellés dans les deux langues.
