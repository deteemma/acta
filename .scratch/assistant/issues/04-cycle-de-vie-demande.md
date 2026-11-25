# Cycle de vie d'une demande à l'assistant

Type: grilling
Status: open
Label: wayfinder:grilling

## Question

Quelles règles de gestion suit une **demande à l'assistant**, puisqu'elle est asynchrone ? Points à trancher :

- **États** de la demande : en attente, en cours, répondue, échouée, annulée… ;
- **Prévenir le BA** quand l'avis est prêt. Le terme « Alerte » est aujourd'hui réservé aux actions : faut-il l'étendre ou créer un autre signal ?
- **Nombre de demandes** en cours par personne et par initiative ;
- **Annulation** d'une demande, **délai maximal**, **échec** et nouvelle tentative ;
- **Perte de droits** entre la question et la réponse (la personne quitte l'initiative, devient lectrice, l'initiative est archivée ou supprimée) ;
- **Date de l'état lu** : l'avis porte sur l'état de l'initiative au moment où l'assistant l'a lue, et doit le dire ;
- **Effacement** : ce que l'auteur efface (la demande, l'avis, tout le fil) et ce qu'il en reste.
