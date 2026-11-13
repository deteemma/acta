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

## Réalisation

**À trancher par la responsable fonctionnelle : choix que les décisions 10 et 08 ne fixent pas.** Ils sont réalisés ainsi en attendant, et faciles à changer :
1. **Mention « affichée dans le texte »** : portée par une image tant qu'elle figure dans le dernier enregistrement de la page. Retirée du texte et enregistrée, l'image reste dans la liste sans la mention.
2. **Place de la section « Pièces jointes »** sur la page : sous les commentaires, au-dessus des boutons « Déplacer » et « Supprimer la page » (sur un ticket, elle est aussi sous les commentaires). Comme les commentaires, elle n'est pas affichée pendant l'écriture ni sur un ancien enregistrement.
3. **Joindre un fichier à la page** (bouton « Joindre des fichiers ») l'ajoute aussitôt, comme sur un ticket, sans passer par un enregistrement de la page : seules les images insérées dans le texte attendent l'enregistrement.
4. **Insérer une image** se fait seulement depuis le poste (bouton « Image », collage ou dépôt), plusieurs à la fois. Une image déjà dans la liste ne se réinsère pas depuis la liste ; une image retirée par erreur revient avec « Annuler la frappe » tant que la saisie est ouverte.
5. **Collage ou dépôt d'un fichier qui n'est pas une image** dans le texte : refusé avec un message qui renvoie à la section « Pièces jointes ». Le format et la taille d'une image sont vérifiés à l'insertion ; la limite de l'initiative à l'enregistrement, qui est alors refusé en entier avec le nom du fichier en cause.
6. **Image copiée d'une autre page** (copier-coller entre deux pages d'ACTA) : enregistrement refusé avec un message qui demande de la retirer et de l'insérer de nouveau depuis le poste.
7. **Affichage** : l'image occupe sa propre ligne, à sa taille, jamais plus large que le texte ; pas de légende ni de redimensionnement. Une image supprimée laisse « Image supprimée » à sa place.
8. **Avertissement avant suppression** : la confirmation liste les enregistrements qui affichent l'image (date, auteur, numéro de version s'il y en a), du plus récent au plus ancien.
9. **Comparaison de deux enregistrements** : une image ajoutée ou retirée n'y apparaît pas (la comparaison porte sur le texte, décision 08 point 8).

**Vérifié.**
- Règles dans `shared/src/page-images.ts` (nœud `image`, fichiers envoyés avec la saisie, images de la page seulement, suppression refusée dans le dernier enregistrement) : 8 tests ; la suite complète passe (341 tests).
- `web/src/page-content-tiptap-3.32.0.json` contient désormais une image, comme prévu au ticket 23 ; `web/src/page-content-compat.test.ts` passe.
- `scripts/roles/23-images-des-pages.mjs`, API et base : création et modification avec images en une requête ; lecture par la lectrice, refus pour le non-membre et depuis une autre initiative ; envoi coupé au milieu d'un fichier, refus et saisie dépassée (ticket 24) sans aucun fichier gardé ; formats, 10 Mo et images seulement, avec le nom du fichier ; image d'une autre page refusée par l'API et par la base ; image retirée du texte toujours listée et lisible ; suppression refusée dans le dernier enregistrement, par l'API et par la base ; enregistrements touchés listés ; « image supprimée » après une restauration ; suppression d'un enregistrement sans effet sur les fichiers ; lectrice et initiative archivée refusées ; fichiers emportés avec la page. L'ensemble de `scripts/tester-roles.sh` passe.
- Écrans non vérifiés dans le navigateur par l'agent : l'application demandait une connexion, que l'agent n'a pas faite. Le collage et le dépôt sont donc à essayer à l'écran.

**Technique.**
- Une image insérée reste dans le navigateur jusqu'à « Enregistrer ». Elle part alors avec la page dans une seule requête (`application/x-acta-page-save` : longueur de l'en-tête, en-tête JSON, puis les fichiers), sur `POST /initiatives/<id>/pages/with-images` ou `PATCH /initiatives/<id>/pages/<page>/with-images`. L'API la lit fichier par fichier, avec un seul fichier en mémoire, et écrit page et fichiers dans une seule transaction : une fermeture brutale annule tout, sans fichier orphelin ni nettoyage différé. Ces enregistrements passent par la même file de 4 transferts que les pièces jointes du ticket 21.
- JSON de la page : nœud `image` avec `attrs.attachmentId` seulement, jamais d'adresse ; pendant la saisie, `upload:<clé>`, remplacé par l'API. Les images s'affichent après lecture avec le jeton du membre (`GET …/attachments/<fichier>/content`).
- Migration `0028` : contrôle en fin de transaction que le texte d'une page n'affiche que ses propres images ; refus de supprimer une image du dernier enregistrement. Routes : `GET`/`POST /initiatives/<id>/pages/<page>/attachments`, `GET …/pages/<page>/attachments/<fichier>/revisions`. `AttachmentDto.inText`.
- Docker Compose 5 construit toujours avec « bake », qui demandait ici une permission de plus : l'image a été construite par `docker build -f api/Dockerfile -t ghcr.io/deteemma/acta:local .`, puis `docker compose up -d`.
- Après la revue : un collage depuis Word ou Excel (texte accompagné d'une image de la sélection) colle le texte, pas l'image ; seules les images seules du presse-papiers s'insèrent. Les images sont relues à chaque ouverture d'une page, pour qu'une image supprimée par un autre membre y affiche « Image supprimée ». Un envoi arrêté plus de 30 secondes sans aucun octet reçu est abandonné, pour ne pas retenir la transaction et ses verrous.
- Limite connue : pendant l'envoi d'un enregistrement avec images, les autres ajouts de fichiers de la même initiative attendent qu'il se termine (verrou de la limite de pièces jointes, comme au ticket 21).
