# Écrans d'administration

Type: grilling
Status: resolved
Blocked by: 03, 09, 10

## Question

Comment l'administration gère-t-elle ce que la phase 2 lui confie ? Les règles sont décidées (« Types de ticket et statuts paramétrables », « Modèles de page », « Pièces jointes ») ; il reste à trancher leur présentation dans l'écran d'administration : types de ticket et leurs statuts, acronymes, modèles de page, limite de pièces jointes.

## Réponse

Tranché avec la responsable fonctionnelle le 06.11.2026.

1. **Onglets** : le panneau d'administration garde ses onglets et en gagne trois : « Types de ticket », « Modèles de page », « Pièces jointes ». L'onglet existant des références affiche aussi les acronymes de la page et des types de ticket.
2. **Types de ticket** : liste des types avec leur acronyme. Déplier un type montre ses statuts dans l'ordre, avec leur famille et la mention « fermé », et les formulaires pour ajouter un statut ou un type. Modèle : l'onglet actuel des statuts d'exigence ; règles : ticket « Types de ticket et statuts paramétrables ».
3. **Modèles de page** : liste par domaine de connaissance, avec la mention « livré » ou « ajouté » et l'état actif ou désactivé. Un modèle s'ouvre en panneau, avec un onglet par langue : en lecture seule s'il est livré, avec l'éditeur de page s'il est ajouté.
4. **Pièces jointes** : deux limites distinctes. Par fichier : 10 Mo, fixe (ADR-0014). Par initiative : 500 Mo par défaut, réglable dans cet onglet entre 10 Mo et un plafond de 1 Go, pour ne pas surcharger la base et ses sauvegardes. Baisser la limite ne supprime aucun fichier : seuls les ajouts sont refusés. L'administrateur ne voit pas l'occupation de chaque initiative.

Glossaire `CONTEXT.md` mis à jour : Limite de pièces jointes.
