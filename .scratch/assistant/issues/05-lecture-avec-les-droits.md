# Comment l'assistant lit une initiative avec les droits de l'utilisateur

Type: grilling
Status: resolved
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
- quels outils de Hermes sont coupés ;
- ce que Hermes conserve des demandes (historique, sessions, journaux), et comment l'effacement par l'auteur s'y applique pour être réel et sans trace (ticket 04, règle 11) ;
- comment ACTA vérifie les droits juste avant la lecture, et annule une demande dont l'auteur a perdu l'accès (ticket 04, règle 10).

Résultat : un **ADR proposé**, sur le gabarit `docs/adr/0000-modele-adr.md`, soumis à la validation explicite de la responsable.

## Avancement

- **25.11.2026, série 1 validée par la responsable** :
  1. piste (b) : ACTA assemble le contexte filtré par les droits de l'auteur ; Hermes n'a aucun accès à ACTA ;
  2. file des demandes dans la base d'ACTA, avancée par un traitement de fond du conteneur `api` ; nombre de demandes envoyées en parallèle à Hermes réglable par l'administrateur ;
  3. instance Hermes réservée à ACTA, données séparées de hermes-webui ; Ollama partagé ;
  4. Hermes ne conserve rien de durable : mémoire, recherche dans l'historique, skills générés et révision automatique coupés ; session supprimée dès l'avis récupéré, l'échec ou l'annulation ; journaux sans le texte des demandes ; données de Hermes hors sauvegardes ;
  5. réseau dédié ACTA ↔ Hermes, Hermes hors du réseau `socle` ; clé aléatoire d'au moins 32 caractères transmise par variable d'environnement ; aucun port publié.
- **25.11.2026, série 2 validée par la responsable** :
  6. Hermes est gardé ; ses seuls outils sont la lecture de skills écrits par l'équipe (`skills_list`, `skill_view`) ; l'appel direct à Ollama est noté comme alternative écartée ;
  7. tout le reste est coupé par une liste explicite d'outils autorisés ; réseau Hermes ↔ Ollama interne, sans Internet ; le contenu de l'initiative est présenté comme données, jamais comme consignes ;
  8. droits revérifiés au passage En cours et avant d'enregistrer l'avis ; perte d'accès → Annulée « vous n'avez plus accès à cette initiative », avis jeté ;
  9. compte désactivé avec une demande non terminée → Annulée « compte désactivé » (glossaire mis à jour) ;
  10. Hermes injoignable avant l'envoi → la demande reste En attente, « assistant momentanément indisponible » ; travail perdu après l'envoi → Échouée « assistant indisponible » ;
  11. paramètre « demandes traitées en même temps » : 1 au départ, de 1 à 10, appliqué aux demandes suivantes ; la limite d'une demande non terminée par personne ne change pas.
- **25.11.2026, série 3 validée par la responsable** :
  12. instance Hermes d'ACTA dans `compose.yaml`, sous le profil `assistant`, configuration et skills versionnés, déployée par `deployer.sh` ; Ollama reste hors d'ACTA et rejoint le réseau interne ;
  13. sans adresse ou sans clé de Hermes, l'assistant n'est pas proposé et le reste d'ACTA fonctionne normalement.
- **ADR proposé** : [ADR-0022](../../../docs/adr/0022-assistant-lit-par-contexte-assemble.md), validé par la responsable le 25.11.2026.
- L'estimation de l'effort d'un connecteur MCP (piste a) a été donnée à la responsable : deux à trois fois plus lourd que (b), à cause d'un plugin Python dans Hermes et de la liaison session ↔ utilisateur. Il reste possible plus tard par un nouvel ADR, pour la question libre.

## Réponse

Échange avec la responsable du 25.11.2026, treize recommandations acceptées en trois séries (détail ci-dessus, sous « Avancement »). Elles sont consignées dans l'[ADR-0022](../../../docs/adr/0022-assistant-lit-par-contexte-assemble.md), **accepté** le 25.11.2026. Le statut Annulée du glossaire (`CONTEXT.md`) compte désormais aussi le compte désactivé.

En bref :
- **ACTA assemble le contexte** avec les droits de l'auteur, par les deux barrières de l'ADR 0006. Hermes n'a aucun accès à ACTA.
- **Les droits sont revérifiés** au passage En cours et avant d'enregistrer l'avis.
- **La file vit dans la base d'ACTA**, avancée par un traitement de fond de l'API. L'administrateur règle le nombre de demandes traitées en même temps : 1 au départ, de 1 à 10.
- **Hermes** :
  - une instance réservée à ACTA, dans `compose.yaml` sous le profil `assistant` ;
  - pour seuls outils, la lecture de skills écrits par l'équipe ;
  - rien de durable conservé ;
  - aucun accès à Internet ni au réseau `socle`, une clé d'au moins 32 caractères, aucun port publié.
- **Indisponibilité** : Hermes injoignable avant l'envoi, la demande reste En attente ; travail perdu après l'envoi, elle devient Échouée « assistant indisponible ».
- **Assistant facultatif** : sans configuration de Hermes, il n'est pas proposé.
