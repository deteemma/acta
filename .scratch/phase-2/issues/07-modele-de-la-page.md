# Modèle de la page

Type: grilling
Status: resolved
Blocked by: —

## Question

Qu'est-ce qu'une page et comment vit-elle ? Trancher :

- champs (titre, contenu, auteur, autres ?) ; porte-t-elle une référence ;
- arborescence : profondeur, ordre des pages sœurs, déplacement d'une page (avec ses sous-pages) ;
- versions : nouvelle version à chaque enregistrement ou à la demande, consultation et comparaison, restauration d'une ancienne version (sur le modèle de l'historique d'exigence ?) ;
- modification simultanée par deux membres ;
- droits par rôle ; comportement dans une initiative archivée ;
- suppression d'une page qui a des sous-pages, et de ses versions.

## Réponse

Tranché avec la responsable fonctionnelle le 02.11.2026.

1. **Champs** : référence, titre (obligatoire, 200 caractères au plus ; deux pages peuvent porter le même titre), contenu mis en forme (facultatif, 200 000 caractères au plus, images non comprises — limite à revoir à l'usage), page parente, auteur et date de création, auteur et date de dernière modification.
2. **Référence** : `CODE-PA-NNN`, acronyme PA par défaut paramétré par l'administration, selon la règle commune des références (jamais réutilisée, figée une fois attribuée).
3. **Arborescence** : plusieurs pages de premier niveau, profondeur illimitée, au plus une page parente de la même initiative. Les pages sœurs suivent un ordre libre, réglé à la main ; une nouvelle page se place en dernier. Une page se déplace avec ses sous-pages, n'importe où dans l'initiative sauf sous elle-même ou l'une de ses sous-pages. Déplacer ou réordonner ne crée pas d'enregistrement.
4. **Enregistrements** : chaque enregistrement qui change le titre ou le contenu est conservé (qui, quand, titre, contenu), sans limite de durée tant que la page existe.
   - Tout membre liste les enregistrements (versions mises en évidence, filtre « versions seulement »), en ouvre un et en compare deux de son choix (ajouts et suppressions mis en évidence).
   - Restaurer un enregistrement ou une version crée un nouvel enregistrement, qui n'est pas une version.
   - Un propriétaire ou un contributeur supprime définitivement, après confirmation, tout enregistrement sauf le dernier (l'état actuel de la page) ; l'historique garde une ligne sans contenu : enregistrement du …, supprimé par X le …
5. **Versions** : une version est un enregistrement déclaré comme jalon, au moment d'enregistrer (case « enregistrer comme nouvelle version ») ou après coup depuis l'historique.
   - Seul un enregistrement postérieur à la dernière version peut être déclaré ; les versions sont numérotées 1, 2, 3… dans l'ordre chronologique.
   - Note facultative de 500 caractères au plus, que tout propriétaire ou contributeur peut corriger.
   - Une page n'a aucune version à sa création.
   - Une version ne redevient pas un simple enregistrement. Supprimer une version supprime son enregistrement (règle du point 4) ; son numéro n'est jamais réattribué (ex. versions 1, 3, 4). Le dernier enregistrement ne se supprime pas, même s'il est une version.
   - Tout membre voit le dernier enregistrement (pas de brouillon réservé) ; la page affiche le numéro de sa dernière version et signale s'il y a eu des modifications depuis.
6. **Modification simultanée** : pas de verrou. Un enregistrement est refusé si la page a été enregistrée par quelqu'un d'autre depuis son ouverture ; l'application l'indique (« modifiée par X à 10 h 12 »), propose de comparer, et la saisie n'est pas perdue.
7. **Droits** : un lecteur consulte la page et son historique ; un propriétaire ou un contributeur crée, modifie, déplace, réordonne, déclare une version, corrige une note, restaure, supprime un enregistrement et supprime une page ; l'administrateur n'a pas accès au contenu. Dans une initiative archivée, tout est en lecture seule.
8. **Suppression d'une page** : définitive, sans corbeille, avec ses enregistrements, versions et pièces jointes. Refusée tant que la page porte un lien ou a des sous-pages.

Renvoyé aux tickets suivants : pièces jointes d'un ancien enregistrement (« Pièces jointes ») ; présentation de la comparaison, de la case « nouvelle version » et du refus pour modification simultanée (« Éditeur de page ») ; lien entre la page, son modèle et la tâche BABOK (« Modèles de page »).

Glossaire `CONTEXT.md` mis à jour : Page, Arborescence des pages, Enregistrement de page, Version de page, Référence.
