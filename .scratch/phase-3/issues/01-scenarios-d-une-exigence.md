# 01: Scénarios d'une exigence

**What to build:** Sur la fiche d'une exigence de solution fonctionnelle, propriétaires et contributeurs écrivent, ordonnent et suppriment des scénarios Gherkin que tout membre peut lire.

**Status:** done (validé par la responsable fonctionnelle le 19.11.2026)

Règles : [spécification](../spec.md), décisions D1 à D4, D6 à D11, D14, D17 à D19.

- [x] Section « Scénarios » sur la fiche d'une exigence de solution fonctionnelle seulement (D1, D18).
- [x] Scénario : référence `CODE-SC-NNN` (nouvelle catégorie livrée, acronyme `SC` paramétrable dans l'onglet d'administration des acronymes), titre obligatoire, texte libre de 10 000 caractères au plus (D6, D7). Si `SC` a déjà été porté, repli sur `SCE` puis `SCEN`, sinon arrêt de la migration (contrainte technique « Références » de la spécification).
- [x] Création en dernier, ordre réglé à la main, suppression définitive après confirmation, sans déplacement vers une autre exigence (D8 à D10).
- [x] Un texte s'enregistre même s'il n'est pas du Gherkin correct (D11).
- [x] Modification simultanée : enregistrement refusé si le scénario a changé entre-temps, avec message ; pas de comparaison (D14).
- [x] Type et sous-type de l'exigence figés tant qu'elle a un scénario, refus expliqué (D2). Suppression de l'exigence : confirmation qui donne le nombre de scénarios, puis suppression des scénarios avec elle (D3).
- [x] Droits : propriétaire et contributeur écrivent, tout membre lit ; initiative archivée en lecture seule (D17). Alerte de modification non enregistrée sur la saisie.
- [x] Web seulement, rien vers le téléphone (D19).
- [x] Règles dans `shared/`, avec tests ; deux barrières dans `scripts/roles/` ; libellés dans les deux langues.
- [x] La table et les routes prévoient l'historique (ticket 03) et le Contexte (ticket 02) sans refaire la migration.
