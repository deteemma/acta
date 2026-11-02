# Modifications non enregistrées

Type: grilling
Status: resolved
Blocked by: —

## Question

Demande de la responsable fonctionnelle (02.11.2026) : aujourd'hui, on peut modifier un objet dans le panneau de droite puis fermer ce panneau sans aucun avertissement, et la saisie est perdue. Une alerte doit bloquer la fermeture en indiquant que des données ont été saisies mais pas enregistrées, et permettre d'enregistrer directement, sans repasser par le bouton « Enregistrer ».

Constat dans le code : le panneau se ferme par la croix, par Échap, par un glissement vers le bas, ou quand un autre contenu le remplace (palette → fiche). Aucune de ces sorties n'est gardée aujourd'hui.

Trancher :

- **portée** : tous les panneaux qui permettent une saisie, y compris les objets de la phase 1 (initiative, action, partie prenante, besoin, exigence, administration), ou seulement les tickets et pages de la phase 2 ;
- **ce qui compte comme « saisi »** : toute valeur différente de celle enregistrée, ou tout champ touché, même si la valeur a été remise comme avant ; en création, un formulaire encore vide ;
- **sorties gardées** : croix, Échap, glissement, remplacement par un autre panneau, changement d'écran, fermeture ou rechargement de l'onglet du navigateur (le navigateur n'y propose que son propre message, sans bouton « Enregistrer »), déconnexion ;
- **choix proposés par l'alerte** : par exemple « Enregistrer », « Abandonner les modifications », « Continuer la saisie » ; libellés en français et en anglais ;
- **échec de l'enregistrement depuis l'alerte** (champ obligatoire vide, refus du serveur, initiative archivée entre-temps) : le panneau reste ouvert avec les erreurs affichées ;
- **panneaux empilés** : fermer un panneau du dessous qui en porte un modifié au-dessus ;
- **téléphone** : la fiche d'action de « Mes actions » est-elle concernée.

## Réponse

Tranché avec la responsable fonctionnelle le 02.11.2026.

1. **Portée** : tous les panneaux du web qui permettent une saisie, ceux de la phase 1 (initiative, action, partie prenante, besoin, exigence, équipe, administration) comme ceux à venir (tickets, pages) ; au téléphone, la création rapide d'une action et le formulaire d'initiative. La fiche d'action du téléphone, en lecture seule, n'est pas concernée.
2. **Ce qui compte comme « saisi »** : au moins un champ a une valeur différente de celle enregistrée ; en création, différente de celle de départ. Remettre la valeur d'avant ne déclenche pas d'alerte ; un formulaire de création resté à ses valeurs de départ non plus.
3. **Sorties gardées par l'alerte d'ACTA** : croix, Échap, glissement vers le bas, remplacement du panneau (palette → fiche, clic sur une autre ligne de la liste quand le panneau est ancré), fermeture d'un panneau du dessous, changement d'écran, déconnexion ; au téléphone, fermeture de la feuille et retour en arrière. Fermeture ou rechargement de l'onglet, et bouton « Précédent » du navigateur (l'application ne navigue pas par adresse, il fait quitter ACTA) : seulement le message du navigateur, sans bouton « Enregistrer ».
4. **Alerte** : « Des modifications n'ont pas été enregistrées. Voulez-vous les enregistrer avant de fermer ? », avec trois choix : « Enregistrer », « Abandonner les modifications », « Continuer la saisie » (anglais : *Save*, *Discard changes*, *Keep editing*). Échap ou un clic hors de l'alerte valent « Continuer la saisie ».
5. **Enregistrement réussi** : la sortie demandée se poursuit aussitôt (fermeture, ouverture de la ligne cliquée, changement d'écran, déconnexion).
6. **Échec de l'enregistrement** (champ obligatoire vide, refus du serveur, initiative archivée ou droits retirés entre-temps) : la sortie est annulée ; le panneau reste ouvert, saisie intacte, erreurs affichées comme avec le bouton « Enregistrer » de la fiche.
7. **Plusieurs panneaux modifiés** : une alerte par panneau modifié, en commençant par celui du dessus ; « Continuer la saisie » arrête tout, les panneaux restants restent ouverts.
8. **Panneau à plusieurs formulaires** (fiche d'initiative et invitation d'un membre ; administration) : une seule alerte pour le panneau. « Enregistrer » fait ce que ferait le bouton de chaque formulaire modifié, envoi d'une invitation compris. Si l'un échoue, les autres restent faits et le panneau reste ouvert avec l'erreur.

Glossaire `CONTEXT.md` mis à jour : Modification non enregistrée.
