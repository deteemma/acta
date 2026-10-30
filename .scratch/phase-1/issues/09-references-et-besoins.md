# 09: Références et Besoins

**What to build:** L'administration paramètre les acronymes des références ; le BA enregistre les besoins de l'initiative, chacun identifié par une référence lisible (ex. CRM-BE-001), et les relie aux parties prenantes à leur origine et aux actions.

**Blocked by:** 08 — Parties prenantes

**Status:** done (validé par la responsable fonctionnelle le 30.10.2026)

- [x] L'administrateur paramètre l'acronyme de chaque catégorie d'objet (par défaut BE pour Besoin, EX pour Exigence) ; un changement d'acronyme ne modifie pas les références déjà attribuées.
- [x] Une référence est de la forme CODE-ACRONYME-NUMÉRO ; le numéro est incrémenté par initiative et par catégorie, et jamais réutilisé, même après suppression.
- [x] Dès qu'une référence existe dans une initiative, son code d'initiative n'est plus modifiable.
- [x] Un Besoin porte : référence, titre, description, nature (problème ou opportunité), parties prenantes à l'origine.
- [x] Une Action peut être liée à des besoins ; la fiche d'un besoin affiche ses actions liées.
- [x] Un besoin ne peut être supprimé que s'il n'est lié à rien.
- [x] Les références sont accessibles par la palette Ctrl+K.
- [x] Toute nouvelle table partagée a ses politiques RLS (migration SQL) et ses guards NestJS ; `scripts/tester-roles.mjs` couvre les deux barrières pour propriétaire, contributeur, lecteur et non-membre.
- [x] Tous les libellés existent en français et en anglais (ADR-0013).

Réalisation :
- Migration `0012_references_et_besoins.sql` : tables `reference_category` (acronyme actuel) et `reference_acronym` (acronymes portés, réservés à leur catégorie), modifiables seulement par `admin_set_reference_acronym` ; compteur `reference_counter` par initiative et par catégorie, inaccessible directement ; table `need` (référence attribuée et figée par déclencheur, auteurs et dates) ; liens `need_stakeholder` et `action_need` ; déclencheur qui fige le code d'initiative dès la première référence. RLS : tout membre consulte ; propriétaires et contributeurs écrivent ; archivée : lecture seule. Clés étrangères NO ACTION : un besoin lié à une action, une partie prenante à l'origine d'un besoin ne se suppriment pas ; les parties prenantes à l'origine partent avec le besoin.
- API : `GET|POST /api/initiatives/:id/needs` ; `GET|PATCH|DELETE /api/initiatives/:id/needs/:needId` (guards `view` / `editNeeds`) ; `GET /api/references` (palette) ; `GET /api/admin/reference-categories`, `PATCH /api/admin/reference-categories/:category` (rôle administrateur) ; `needIds` à la création et à la modification d'une action, `needs` dans chaque action ; `codeFrozen` dans chaque initiative, refus `codeFrozen`.
- Règles dans shared : `references.ts` (format, acronymes, recherche), `needs.ts` (schémas, refus), `needIds` dans `actions.ts`, permission `editNeeds` dans `roles.ts`, avec tests.
- Web : section « Besoins » dans la fiche Initiative ; fiche du besoin en panneau (création, modification, parties prenantes à l'origine, actions liées, auteurs, suppression) ; cases « Besoins » dans la fiche d'une action ; « Besoins dont elle est à l'origine » dans la fiche d'une partie prenante ; références dans la palette Ctrl+K ; section « Acronymes des références » dans l'administration ; code d'initiative signalé figé.
- `scripts/tester-roles.mjs` étendu aux deux barrières pour propriétaire, contributeur, lectrice et non-membre, et aux acronymes (administrateur / non-administrateur) : tous les contrôles passent. Les changements d'acronyme réels ne sont testés qu'en base, dans une transaction annulée, pour ne pas réserver d'acronyme dans la base de développement.

Précisions de la responsable fonctionnelle (30.10.2026) :
- Acronyme : 2 à 4 lettres majuscules ; unique entre catégories, et un acronyme porté par une catégorie n'est jamais repris par une autre (une catégorie peut reprendre l'un de ses anciens).
- Numéro sur 3 chiffres au moins : CRM-BE-001 … CRM-BE-999, puis CRM-BE-1000.
- Code d'initiative figé dès la première référence attribuée, même si l'objet est ensuite supprimé.
- Besoin : mêmes droits que les parties prenantes (propriétaire et contributeurs écrivent, lecteurs consultent, archivée : lecture seule) ; titre obligatoire (200 caractères), description mise en forme facultative (20 000), nature obligatoire, zéro, une ou plusieurs parties prenantes à l'origine ; auteurs et dates conservés.
- Suppression : seules les actions liées (et plus tard les exigences) bloquent ; les parties prenantes à l'origine partent avec le besoin. Une partie prenante à l'origine d'un besoin ne se supprime pas.
- Palette : besoins de toutes mes initiatives, recherche par référence ou titre, archivées incluses et signalées ; ordre : initiatives, références (par référence), BABOK.
- Écrans validés tels que proposés.
