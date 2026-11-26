# 21: Administration de l'assistant

**What to build:** Un onglet « Assistant » de l'administration permet de régler les quatre paramètres de l'assistant et montre des chiffres globaux, sans jamais donner accès aux demandes.

**Blocked by:** 13 — Annulation, échecs et reprise

**Status:** ready-for-agent

Règles : [spécification](../spec.md) AS5, AS20, AS25, AS32 à AS34, AS40.

- [ ] Onglet « Assistant » après « Pièces jointes », visible seulement si l'assistant est installé (AS25, AS32).
- [ ] Quatre paramètres avec leurs bornes ; valeur hors bornes refusée avec un message qui donne les bornes ; délai approfondi jamais inférieur au délai rapide (AS32).
- [ ] Effet d'une modification : demandes suivantes pour le parallélisme ; demandes qui passent En cours ensuite pour les délais ; demandes créées ou passant En cours ensuite pour le plafond (AS5, AS20, AS32).
- [ ] Chiffres sur les 30 derniers jours et depuis le début : demandes par statut, par usage et par mode ; durée moyenne de traitement par mode ; attente moyenne dans la file ; échecs par raison ; demandes En attente et En cours en ce moment (AS33).
- [ ] Jamais par personne ni par initiative ; calculés sur les demandes conservées seulement (AS34).
- [ ] Administrateur : paramètres et chiffres seulement ; section de `scripts/roles/` qui le vérifie (AS40).
