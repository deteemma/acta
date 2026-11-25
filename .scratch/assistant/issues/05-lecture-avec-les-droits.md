# Comment l'assistant lit une initiative avec les droits de l'utilisateur

Type: grilling
Status: open
Label: wayfinder:grilling
Blocked by: 01

## Question

Comment l'assistant accède-t-il au contenu d'une initiative sans jamais voir plus que l'utilisateur qui l'interroge (ADR 0006), et sans qu'une information lue pour une personne ressorte chez une autre ? Deux pistes au moins sont à départager :

- **(a)** Hermes **interroge l'API d'ACTA** (par MCP ou par un outil) avec un jeton propre à l'utilisateur ;
- **(b)** ACTA **assemble le contexte** déjà filtré par les permissions et le transmet avec la demande ; Hermes n'a aucun accès à ACTA.

Il faut aussi décider :
- où vit la file d'attente des demandes asynchrones ;
- quel réseau relie les deux conteneurs ;
- comment l'API de Hermes est protégée ;
- quels outils de Hermes sont coupés.

Résultat : un **ADR proposé**, sur le gabarit `docs/adr/0000-modele-adr.md`, soumis à la validation explicite de la responsable.
