# Modifications non enregistrées

Type: grilling
Status: open
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
