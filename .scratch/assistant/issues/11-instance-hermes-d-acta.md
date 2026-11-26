# 11: Instance Hermes d'ACTA

**What to build:** ACTA a sa propre instance Hermes, isolée et sans outil, déployée avec l'application. L'API sait dire si l'assistant est installé ; sans lui, rien de l'assistant n'apparaît.

**Blocked by:** 10 — Vérifications sur Hermes

**Status:** ready-for-agent

Règles : [spécification](../spec.md) AS25, AS35, AS36 ; [ADR-0022](../../../docs/adr/0022-assistant-lit-par-contexte-assemble.md), points 7 à 12 ; ADR 0007, ADR 0010.

- [ ] Service `assistant` de `compose.yaml`, profil Compose `assistant`, avec un `mem_limit` (AS35).
- [ ] Réseau dédié API ↔ Hermes ; réseau interne Hermes ↔ Ollama, sans Internet ; Hermes hors du réseau `socle`, sans port publié (AS35).
- [ ] Configuration de Hermes versionnée dans le dépôt et déployée par `deployer.sh` : aucun outil autorisé (liste explicite vide), mémoire, recherche dans l'historique, écriture de skills et révision automatique coupées, réglages issus du ticket 10 (AS36).
- [ ] Adresse et clé de Hermes par variables d'environnement ; clé aléatoire d'au moins 32 caractères (AS35, ADR 0007).
- [ ] Données de Hermes hors des sauvegardes (AS36, ADR 0010).
- [ ] Détection « assistant installé » côté API, exposée au web : sans adresse ou sans clé, l'assistant est absent (AS25).
- [ ] Procédure de mise en service sur le serveur décrite dans la documentation de déploiement.
- [ ] Validation en local : `acta.localhost` contacte l'instance Hermes du serveur (décision de la responsable du 26.11.2026). L'accès se fait sans publier de port de Hermes (AS35), par exemple par un tunnel SSH ouvert depuis le poste ; adresse et clé en variables d'environnement locales, jamais commitées. Si ce n'est pas possible sans publier de port ni sortir Hermes de ses réseaux, s'arrêter et poser la question.
- [ ] Procédure d'ouverture de l'accès local décrite dans la documentation.
