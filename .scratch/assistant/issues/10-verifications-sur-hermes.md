# 10: Vérifications sur Hermes

**What to build:** Les cinq points de vigilance de la spécification sont vérifiés sur une instance Hermes configurée comme celle d'ACTA, avant toute construction. Les résultats sont consignés ici et rapportés à la responsable fonctionnelle ; un résultat contraire n'est pas contourné.

**Status:** ready-for-agent

Règles : [spécification](../spec.md), « Points de vigilance » 1 à 5 ; AS13, AS26, AS36 ; [ADR-0022](../../../docs/adr/0022-assistant-lit-par-contexte-assemble.md), « À surveiller ».

- [ ] Réflexion par demande : Hermes active ou coupe la réflexion du modèle demande par demande (AS13). Sinon, s'arrêter et rapporter.
- [ ] Instructions de Hermes : les instructions envoyées s'ajoutent au prompt système de Hermes ; taille de ce prompt sans aucun outil, durée d'une demande type passée par Hermes, comparée aux mesures directes du [ticket 02](02-mesure-modele-local.md).
- [ ] Version de Hermes déployée (la recherche porte sur la v0.23.4) ; liste vide d'outils autorisés pour la plateforme API ; mémoire, recherche dans l'historique, écriture de skills et révision automatique coupées (AS36).
- [ ] Journaux de Hermes : ils ne gardent pas le texte des demandes ; sinon, proposer une rotation courte.
- [ ] Un travail lancé par `POST /v1/runs` avec un identifiant de session se supprime par `DELETE /api/sessions/{id}`.
- [ ] Résultats consignés sous `## Commentaires`, avec les commandes passées ; aucune donnée réelle d'une initiative utilisée pour les essais.
