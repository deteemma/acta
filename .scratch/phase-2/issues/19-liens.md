# 19: Liens

**What to build:** Depuis la fiche d'un ticket, on le lie à un autre ticket avec une nature, ou à un besoin ou une exigence. Le lien apparaît des deux côtés et empêche la suppression.

**Blocked by:** 18 — Types de ticket livrés et Epics

**Status:** ready-for-agent

Règles : décision [04](04-liens.md).

- [ ] Natures fixes, avec chaque côté affichant son libellé ; un seul lien par paire de tickets ; pas de lien vers soi-même ni entre initiatives.
- [ ] Tout type de ticket se lie aux besoins et aux exigences ; les fiches de besoin et d'exigence listent leurs tickets. Les liens actuels des actions sont conservés (ticket 16).
- [ ] Créer ou retirer un lien depuis l'un ou l'autre objet, hors de tout historique ; blocage purement informatif.
- [ ] Un objet lié ne se supprime pas : refus clair sur les tickets, besoins et exigences.
- [ ] Règles dans `shared/`, avec tests ; deux barrières dans `scripts/roles/` ; libellés dans les deux langues.
