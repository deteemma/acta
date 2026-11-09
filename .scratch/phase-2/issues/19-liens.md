# 19: Liens

**What to build:** Depuis la fiche d'un ticket, on le lie à un autre ticket avec une nature, ou à un besoin ou une exigence. Le lien apparaît des deux côtés et empêche la suppression.

**Blocked by:** 18 — Types de ticket livrés et Epics

**Status:** ready-for-human (réalisé, à valider par la responsable fonctionnelle)

Règles : décision [04](04-liens.md).

- [x] Natures fixes, avec chaque côté affichant son libellé ; un seul lien par paire de tickets ; pas de lien vers soi-même ni entre initiatives.
- [x] Tout type de ticket se lie aux besoins et aux exigences ; les fiches de besoin et d'exigence listent leurs tickets. Les liens actuels des actions sont conservés (ticket 16).
- [x] Créer ou retirer un lien depuis l'un ou l'autre objet, hors de tout historique ; blocage purement informatif.
- [x] Un objet lié ne se supprime pas : refus clair sur les tickets, besoins et exigences.
- [x] Règles dans `shared/`, avec tests ; deux barrières dans `scripts/roles/` ; libellés dans les deux langues.

## Réalisation

**À trancher par la responsable fonctionnelle : choix que la décision 04 ne fixe pas.** Ils sont réalisés ainsi en attendant, et faciles à changer :

1. Une section « Liens » sur la fiche de tout ticket, Action comprise, après les auteurs et dates (et les tickets de l'Epic), avant l'historique (décision 11, point 5). Elle regroupe tickets liés, besoins liés et exigences liées, chacun par référence.
2. Ajout d'un lien : une liste « Lien » (les cinq natures vues de ce ticket, puis « Besoin » et « Exigence »), une liste « Avec », un bouton « Lier ». Nature proposée par défaut : « est lié à ». Ni le ticket lui-même ni un objet déjà lié ne sont proposés.
3. Sur les fiches de besoin et d'exigence, la liste « Actions liées » devient « Tickets liés » (tous types, avec leur statut) ; on y lie un ticket et on en retire un. Le bouton « Nouvelle action » reste.
4. Retirer un lien se fait d'un clic, sans confirmation : il se recrée aussi facilement.
5. Fiche d'une Action : besoins et exigences quittent le formulaire et passent dans la section « Liens » (limite connue du ticket 18). Créer une action depuis un besoin ou une exigence la lie toujours à cet objet.

**Hors de tout historique.** Créer ou retirer un lien ne touche ni le ticket, ni le besoin, ni l'exigence : aucune entrée d'historique, et la date et l'auteur de la dernière modification ne changent pas. Cela vaut aussi pour l'ancien chemin de l'API de l'Action (besoins et exigences envoyés avec la modification), qui changeait jusqu'ici l'auteur de la modification.

**Vérifié.** Tests de `shared/src/links.test.ts` ; `scripts/roles/17-liens.mjs` (API et base, chaque rôle, initiative archivée) et l'ensemble de `scripts/tester-roles.sh` passent. Écrans non vérifiés dans le navigateur par l'agent : l'extension Chrome n'était pas disponible pendant la réalisation.

**Technique.** Migration `0022` : table `ticket_link` (source, cible, nature `blocks`, `duplicates` ou `relates_to`), une paire au plus quel que soit le sens (index unique), pas de lien vers soi-même, clés composites qui interdisent les liens entre initiatives et la suppression d'un ticket lié ; RLS. Les tables `ticket_need` et `ticket_requirement` restent telles quelles. Routes sous `/initiatives/<id>/links`, permission `editLinks` (propriétaire et contributeur).
