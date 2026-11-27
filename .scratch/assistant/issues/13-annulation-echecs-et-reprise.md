# 13: Annulation, échecs et reprise

**What to build:** Le cycle de vie d'une demande est complet : l'auteur annule, ACTA traite l'indisponibilité de Hermes, la perte des droits et le redémarrage de l'API, et l'auteur repose une question échouée.

**Blocked by:** 12 — Faire le point, de bout en bout

**Status:** done (validé par la responsable fonctionnelle le 27.11.2026)

Règles : [spécification](../spec.md) AS5 à AS8, AS12, AS37 à AS39. Détail au [ticket 04](04-cycle-de-vie-demande.md) ; textes au [ticket 08](08-maquette-du-panneau.md).

- [x] Annulation par l'auteur tant que la demande n'est pas terminée : travail arrêté chez Hermes, aucun avis partiel gardé, session supprimée (AS6, AS37).
- [x] Droits revérifiés au passage En cours et avant d'enregistrer l'avis : perte d'accès → Annulée « vous n'avez plus accès à cette initiative », avis jeté ; compte désactivé → Annulée « compte désactivé » (AS8).
- [x] Hermes injoignable avant l'envoi : la demande reste En attente, avec « Assistant momentanément indisponible : votre demande partira dès son retour. » (AS38).
- [x] Travail perdu après l'envoi (`interrupted`, `unknown`, travail introuvable) → Échouée « assistant indisponible » ; réponse vide ou en erreur → Échouée « l'assistant n'a pas pu répondre » ; session supprimée après chaque échec (AS37, AS38).
- [x] Pas de nouvelle tentative automatique ; « Reposer la question » crée une nouvelle demande, modifiable avant l'envoi, mode repris (AS7, AS12).
- [x] Une modification du délai ne vaut que pour les demandes qui passent En cours ensuite (AS5).
- [x] Au redémarrage de l'API, reprise des demandes En cours d'après leur identifiant de travail Hermes, sans les renvoyer (AS39).
- [x] Tests du traitement de fond avec un Hermes simulé pour chaque cas ci-dessus.

## Commentaires

### 27.11.2026 — Réalisation

**Ce qui a été construit.**
- **Annulation** : bouton « Annuler la demande » sur une demande En attente ou En cours, avec la confirmation « Annuler cette demande ? L'assistant s'arrête et aucun avis partiel n'est conservé. » et les réponses « Oui » et « Non ». Route `POST …/assistant-requests/:id/cancel`, permission `cancelAssistantRequest` (tout membre, archivée comprise, sa propre demande seulement).
- **Migration 0039** : l'auteur peut passer sa demande à Annulée « annulée par vous », et rien d'autre. La lecture, le délai, le travail Hermes et l'avis restent au seul traitement de fond.
- **Courses** : une annulation pendant l'envoi arrête le travail qui vient de partir. Une annulation pendant le travail empêche d'enregistrer l'avis.
- **« Assistant momentanément indisponible… »** : affiché sur une demande En attente tant que le dernier appel à Hermes a échoué. L'état est gardé en mémoire de l'API : il repart à « joignable » après un redémarrage.
- **« Reposer la question »** : sur une demande Échouée, ouvre la fenêtre de la demande avec le même mode, modifiable.
- **Traitement de fond** : il passe désormais par une file, et il est testé avec un Hermes simulé (19 tests, `api/src/assistant/assistant-worker.test.ts`). Les tests de l'API sont ajoutés à la CI et au hook pre-commit.
- **Permissions** : `scripts/roles/34` couvre l'annulation sur les deux barrières.

**Vérifications.** `pnpm lint`, `pnpm typecheck`, `pnpm test` (471 + 2 + 19 tests) et `scripts/tester-roles.sh` passent. Image Docker reconstruite. Pas d'essai avec le vrai Hermes pour ce ticket.

**Questions à la responsable fonctionnelle.**
1. **Hermes refuse l'envoi** (clé refusée, demande jugée invalide : réponse 4xx). Aujourd'hui, ce refus est traité comme « injoignable ». La demande reste alors En attente avec « momentanément indisponible ». Elle est renvoyée toutes les 10 s et bloque la file. Faut-il plutôt la passer Échouée « l'assistant n'a pas pu répondre » ?
2. **Hermes injoignable au moment d'arrêter un travail** (annulation, délai dépassé, perte d'accès). La demande est bien Annulée ou Échouée dans ACTA, mais l'arrêt et la suppression de la session ne sont pas retentés. Le travail peut finir chez Hermes, et la session y reste jusqu'au prochain redémarrage de Hermes (données en mémoire vive, ADR 0023). Faut-il retenter l'arrêt ?
3. **Traduction anglaise** des quatre nouveaux textes (`assistant.unavailable`, `assistant.cancel`, `assistant.cancelConfirm`, `assistant.askAgain`) : à relire.

**Réponses de la responsable (27.11.2026).**
1. Oui : un refus de Hermes à l'envoi (réponse 4xx) rend la demande Échouée « l'assistant n'a pas pu répondre », sans nouvel envoi ; la file continue. Fait, avec un test.
2. Non : l'arrêt n'est pas retenté.
3. Traduction anglaise acceptée.
