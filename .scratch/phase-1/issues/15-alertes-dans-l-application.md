# 15: Alertes dans l'application

**What to build:** L'utilisateur est alerté dans l'application, sans courriel, quand une Action lui est attribuée et quand une de ses actions dépasse son échéance.

**Blocked by:** 07 — Actions et « Mes actions »

**Status:** à valider par la responsable fonctionnelle

- [x] Un badge signale les nouvelles alertes ; la liste des alertes s'ouvre en panneau, et chaque alerte ouvre l'Action concernée.
- [x] Une alerte est créée quand une Action m'est attribuée par un autre membre ; aucune alerte quand je me l'attribue moi-même.
- [x] Une alerte signale chacune de mes actions, ni Terminée ni Annulée, dont l'échéance est dépassée.
- [x] Aucune notification par courriel.
- [x] Tous les libellés existent en français et en anglais (ADR-0013).

Précisions de la responsable fonctionnelle (31.10.2026) :
- Une alerte cesse d'être nouvelle à l'ouverture du panneau ; elle reste dans la liste.
- Est nouvelle toute alerte absente de la liste à la dernière ouverture du panneau, y compris une alerte qui revient (action rouverte, initiative désarchivée, échéance remise dans le passé).
- Échéance dépassée : échéance antérieure à aujourd'hui. L'alerte disparaît dès que l'action est Terminée ou Annulée, que l'échéance est repoussée ou que l'action est réattribuée.
- Attribution : l'alerte reste tant que l'action est ouverte ; elle disparaît quand l'action est Terminée, Annulée, supprimée ou réattribuée à un autre membre.
- Aucune alerte pour une initiative archivée ; elles reviennent si elle est désarchivée.
- Actions existantes au déploiement : l'auteur de l'attribution est leur créateur ; les alertes qui en découlent ne sont pas nouvelles au premier affichage.
- Web seulement pour l'instant ; le mobile viendra avec le ticket 17 ou plus tard.

Réalisation :
- Règles dans shared : `alerts.ts` (`myAlerts`, `alertKey`, `localDate`), avec tests ; prédicat `isOpenAction` (ni Terminée ni Annulée) dans `actions.ts`, repris par l'encart du ticket 14.
- Migration `0016_alertes.sql` : l'action garde l'auteur et la date de sa dernière attribution (`assigned_by`, `assigned_at`, écrits par la base) ; le compte garde la dernière ouverture du panneau et les alertes alors listées. Avant la première ouverture, la date sert de référence : déploiement, ou création du compte.
- API : `ActionDto` porte `assignedBy` et `assignedAt` ; `PUT /api/me/alerts-seen` enregistre l'ouverture du panneau.
- Web : bouton « Alertes » dans l'en-tête, avec le nombre de nouvelles alertes ; panneau qui les liste (échéances dépassées d'abord, puis attributions), « Nouvelle » sur celles qui l'étaient à l'ouverture ; un clic ouvre l'action. Les alertes sont relues après chaque écriture sur une action et chaque minute.
- Section `scripts/roles/11-alertes.mjs` : attribution tracée par la base, lecture par rôle, alertes vues propres à chacun, initiative archivée.
- Terme « Alerte » ajouté au glossaire `CONTEXT.md`.

Points à valider par la responsable fonctionnelle :
- Ajouts non demandés : la ligne sous chaque alerte (« Échéance dépassée : 29 octobre 2026 », « Attribuée par Bruno le 31 octobre 2026 ») ; l'ordre de la liste ; la relecture chaque minute.
- Une action à la fois attribuée par un autre et en retard donne deux alertes.
