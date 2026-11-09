# 20: Commentaires

**What to build:** Propriétaires et contributeurs commentent un ticket dans un fil simple que tout membre peut lire.

**Blocked by:** 18 — Types de ticket livrés et Epics

**Status:** done (validé par la responsable fonctionnelle le 09.11.2026)

Règles : décision [05](05-commentaires.md).

- [x] Fil du plus ancien au plus récent ; texte mis en forme de 5 000 caractères au plus, références reliées à leur objet ; ni mention ni pièce jointe.
- [x] Modification par l'auteur encore propriétaire ou contributeur, avec « modifié le … », sans garder l'ancien texte.
- [x] Suppression par cet auteur ou un propriétaire, après confirmation, en laissant une ligne de trace.
- [x] Ticket fermé : commentable. Initiative archivée : lecture seule. Commentaires hors historique, supprimés avec le ticket, absents du téléphone.
- [x] La table sert aussi aux pages au ticket 25 : prévoir les deux supports sans refaire la migration.
- [x] Règles dans `shared/`, avec tests ; deux barrières dans `scripts/roles/`, dont un auteur devenu lecteur ; libellés dans les deux langues.

## Réalisation

**À trancher par la responsable fonctionnelle : choix que la décision 05 ne fixe pas.** Ils sont réalisés ainsi en attendant, et faciles à changer :

1. Une section « Commentaires » sur la fiche de tout ticket, Action comprise, après les liens et avant l'historique (décision 11, point 5). Le titre porte le nombre de commentaires, sans compter les lignes de trace.
2. Chaque commentaire affiche « Nom, le <date et heure> », puis « · modifié le <date et heure> » s'il a été modifié. Enregistrer un texte identique ne compte pas comme une modification.
3. Saisie en bas du fil, avec la même barre de mise en forme que la description, sur 4 lignes ; le bouton « Commenter » vide la zone une fois le commentaire enregistré. Un petit texte rappelle que les commentaires sont visibles par tous les membres et ne figurent pas dans l'historique.
4. « Modifier » et « Supprimer » n'apparaissent que pour qui en a le droit. La modification se fait sur place, avec « Enregistrer » et « Annuler ». La confirmation de suppression précise que le texte ne pourra pas être retrouvé.
5. Ligne de trace : « Commentaire supprimé par X le <date et heure> », en italique, à la place du commentaire. Elle ne se modifie ni ne se supprime.

**Vérifié.** Tests de `shared/src/comments.test.ts` et `shared/src/roles.test.ts` ; `scripts/roles/18-commentaires.mjs` (API et base, chaque rôle, auteur devenu lecteur, ticket fermé, initiative archivée, suppression du ticket) et l'ensemble de `scripts/tester-roles.sh` passent. Écrans non vérifiés dans le navigateur par l'agent : l'extension Chrome n'était pas disponible pendant la réalisation.

**Technique.** Migration `0023` : table `comment`, rattachée à un ticket ou à une page (exactement l'un des deux, de la même initiative, supprimés avec lui) : les pages (ticket 25) n'auront besoin que de nouvelles routes. Supprimer met le texte à null ; la base pose l'auteur et la date de la suppression, et refuse toute modification par un autre que l'auteur. Aucune ligne ne s'efface. Pas de déclencheur sur le ticket : rien dans l'historique. Table absente de la publication PowerSync, donc du téléphone. Routes : `GET`/`POST /initiatives/<id>/tickets/<ticket>/comments`, `PATCH`/`DELETE /initiatives/<id>/comments/<commentaire>` ; permissions `comment` (propriétaire et contributeur) et `deleteAnyComment` (propriétaire).
