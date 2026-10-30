# 10: Exigences

**What to build:** Le BA formalise les exigences de l'initiative selon les types du BABOK, les relie aux besoins et aux parties prenantes, et suit leur cycle de vie ; toute modification est historisée.

**Blocked by:** 09 — Références et Besoins

**Status:** done (validé par la responsable fonctionnelle le 30.10.2026)

- [x] Une Exigence porte : référence (ex. CRM-EX-012), titre, énoncé, type (métier, partie prenante, solution, transition), sous-type fonctionnelle ou non fonctionnelle pour le type solution, statut, sources (parties prenantes), besoins liés, exigence parente.
- [x] Une exigence est liée à au moins un besoin ou à une exigence parente.
- [x] Statuts : Proposée, Vérifiée, Validée, Approuvée, Différée, Rejetée ; tout contributeur passe librement d'un statut à un autre.
- [x] L'historique complet des modifications (qui, quand, quoi, y compris les changements de statut) est conservé et consultable.
- [x] Aucune priorité en phase 1.
- [x] Une Action peut être liée à des exigences ; la fiche d'une exigence affiche ses actions liées.
- [x] Toute référence citée dans un texte s'affiche avec un aperçu au survol.
- [x] Une exigence ne peut être supprimée que si elle n'est liée à rien.
- [x] Toute nouvelle table partagée a ses politiques RLS (migration SQL) et ses guards NestJS ; `scripts/tester-roles.mjs` couvre les deux barrières pour propriétaire, contributeur, lecteur et non-membre.
- [x] Tous les libellés existent en français et en anglais (ADR-0013).

Réalisation :
- Migration `0013_exigences.sql` : table `requirement` (référence attribuée et figée par déclencheur, statut Proposée par défaut, sous-type réservé au type solution, parente de la même initiative, boucle refusée), liens `requirement_stakeholder` (sources), `requirement_need` et `action_requirement` ; historique `requirement_version` (état complet après chaque transaction qui modifie l'exigence, avec auteur et date), écrit seulement par la base ; vérification en fin de transaction qu'une exigence a un besoin ou une parente. RLS : tout membre consulte (historique compris) ; propriétaires et contributeurs écrivent ; archivée : lecture seule ; personne n'écrit l'historique directement. Clés étrangères NO ACTION : une exigence liée à une action ou qui a des enfants, un besoin lié à une exigence, une source d'exigence ne se suppriment pas ; sources, liens vers les besoins et historique partent avec l'exigence.
- API : `GET|POST /api/initiatives/:id/requirements` ; `GET|PATCH|DELETE /api/initiatives/:id/requirements/:requirementId` ; `GET …/:requirementId/history` (guards `view` / `editRequirements`) ; `requirementIds` à la création et à la modification d'une action, `requirements` dans chaque action ; exigences dans `GET /api/references`, avec type et statut pour l'aperçu.
- Règles dans shared : `requirements.ts` (schémas, `checkRequirementShape`, `createsParentCycle`, `requirementHistory`, refus), références reconnues dans les textes (`rich-text.ts`), `requirementIds` dans `actions.ts`, permission `editRequirements` dans `roles.ts`, avec tests.
- Web : section « Exigences » dans la fiche Initiative ; fiche de l'exigence en panneau (création, modification, statut, sources, besoins, parente, exigences enfants, actions liées, historique, suppression) ; case « Exigences » dans la fiche d'une action ; « Exigences liées » dans la fiche d'un besoin ; « Exigences dont elle est la source » dans la fiche d'une partie prenante ; exigences dans la palette Ctrl+K ; références citées reliées à leur fiche avec aperçu au survol dans les textes mis en forme et la description d'une initiative.
- `scripts/tester-roles.mjs` étendu aux deux barrières pour propriétaire, contributeur, lectrice et non-membre : tous les contrôles passent.

Précisions de la responsable fonctionnelle (30.10.2026) :
- Droits : comme les besoins (propriétaire et contributeurs écrivent, statut compris ; lecteurs consultent ; archivée : lecture seule).
- Champs : titre obligatoire (200 caractères) ; énoncé obligatoire, texte mis en forme (20 000) ; type obligatoire ; sous-type obligatoire pour le type solution et absent pour les autres ; statut Proposée à la création, modifiable ensuite ; zéro, une ou plusieurs sources.
- Parente : de la même initiative, de n'importe quel type, une seule, sans boucle, profondeur libre ; une exigence peut avoir à la fois une parente et des besoins liés.
- Suppression : bloquée par les actions liées et les exigences enfants ; les liens vers les besoins, la parente et les sources partent avec elle. Un besoin lié à une exigence et une partie prenante source d'une exigence ne se suppriment pas.
- Historique : la création puis chaque modification, avec qui, quand, et pour chaque champ modifié l'ancienne et la nouvelle valeur (titre, énoncé, type, sous-type, statut, sources, besoins liés, parente) ; consultable par tout membre ; disparaît avec l'exigence supprimée.
- Aperçu des références : dans tout texte mis en forme et la description d'une initiative ; une référence écrite telle quelle est reconnue si elle existe dans une initiative dont je suis membre ; l'aperçu montre référence, titre et, pour une exigence, type et statut ; un clic ouvre la fiche.
- Écrans validés tels que proposés.
