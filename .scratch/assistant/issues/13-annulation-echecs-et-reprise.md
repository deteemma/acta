# 13: Annulation, échecs et reprise

**What to build:** Le cycle de vie d'une demande est complet : l'auteur annule, ACTA traite l'indisponibilité de Hermes, la perte des droits et le redémarrage de l'API, et l'auteur repose une question échouée.

**Blocked by:** 12 — Faire le point, de bout en bout

**Status:** ready-for-agent

Règles : [spécification](../spec.md) AS5 à AS8, AS12, AS37 à AS39. Détail au [ticket 04](04-cycle-de-vie-demande.md) ; textes au [ticket 08](08-maquette-du-panneau.md).

- [ ] Annulation par l'auteur tant que la demande n'est pas terminée : travail arrêté chez Hermes, aucun avis partiel gardé, session supprimée (AS6, AS37).
- [ ] Droits revérifiés au passage En cours et avant d'enregistrer l'avis : perte d'accès → Annulée « vous n'avez plus accès à cette initiative », avis jeté ; compte désactivé → Annulée « compte désactivé » (AS8).
- [ ] Hermes injoignable avant l'envoi : la demande reste En attente, avec « Assistant momentanément indisponible : votre demande partira dès son retour. » (AS38).
- [ ] Travail perdu après l'envoi (`interrupted`, `unknown`, travail introuvable) → Échouée « assistant indisponible » ; réponse vide ou en erreur → Échouée « l'assistant n'a pas pu répondre » ; session supprimée après chaque échec (AS37, AS38).
- [ ] Pas de nouvelle tentative automatique ; « Reposer la question » crée une nouvelle demande, modifiable avant l'envoi, mode repris (AS7, AS12).
- [ ] Une modification du délai ne vaut que pour les demandes qui passent En cours ensuite (AS5).
- [ ] Au redémarrage de l'API, reprise des demandes En cours d'après leur identifiant de travail Hermes, sans les renvoyer (AS39).
- [ ] Tests du traitement de fond avec un Hermes simulé pour chaque cas ci-dessus.
