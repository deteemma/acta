# 12: Tableau de bord de l'initiative

**What to build:** Les membres voient l'avancement de l'initiative au regard du BABOK : les actions classées par domaine de connaissance puis par tâche, qui font apparaître les tâches couvertes et celles qui ne le sont pas.

**Blocked by:** 07 — Actions et « Mes actions »

**Status:** done (validé par la responsable fonctionnelle le 30.10.2026)

- [x] Le tableau de bord présente les 6 domaines de connaissance et leurs tâches, avec pour chaque tâche le nombre d'actions par statut.
- [x] Les tâches sans aucune action apparaissent comme non couvertes.
- [x] Un clic sur une tâche liste ses actions ; un clic sur une action ouvre son panneau.
- [x] Tous les libellés existent en français et en anglais (ADR-0013).

Réalisation :
- Règle dans shared : `dashboard.ts` (`initiativeDashboard`), avec tests : domaines et tâches dans l'ordre du référentiel, nombre d'actions par statut, tâche non couverte quand elle n'a aucune action.
- Web : bouton « Tableau de bord » dans la section « Actions » de la fiche Initiative ; panneau latéral qui liste, par domaine, chaque tâche avec ses statuts (ou « Non couverte ») ; un clic sur la tâche déplie ses actions, un clic sur une action ouvre sa fiche. Le bouton « + Action » y propose l'initiative du tableau de bord.
- Aucune nouvelle table ni route : le tableau de bord s'appuie sur la liste des actions de l'initiative (tout membre, lecteur compris ; initiative archivée en lecture).

Points validés par la responsable fonctionnelle (30.10.2026) :
- Une tâche est couverte dès qu'elle a une action, **quel qu'en soit le statut**, Annulée comprise (lecture littérale de « sans aucune action »). Le ticket 14 (R14, domaine non couvert) reprendra la même définition.
- Seuls les statuts présents sont affichés (« À faire : 2 · Terminée : 1 ») ; les statuts à 0 sont omis pour alléger les 30 lignes.
- Ajouts gardés : le total « n tâche(s) couverte(s) sur m » par domaine ; les actions d'une tâche triées par échéance comme dans « Mes actions ».
- Termes « tableau de bord » et « tâche couverte » ajoutés au glossaire `CONTEXT.md`.
