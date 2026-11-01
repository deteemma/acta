# 11: Statuts d'exigence paramétrables

**What to build:** L'administrateur complète la liste des statuts d'exigence, valable pour toute l'application.

**Blocked by:** 10 — Exigences

**Status:** done (validé par la responsable fonctionnelle le 31.10.2026)

- [x] L'administrateur ajoute un statut avec un libellé obligatoire en français et en anglais.
- [x] Les 6 statuts du BABOK ne peuvent être ni supprimés ni renommés.
- [x] Un statut ajouté peut être désactivé ; il ne peut pas être supprimé s'il est déjà utilisé.
- [x] Un statut désactivé n'est plus proposé, mais reste affiché sur les exigences qui le portent.
- [x] Tous les libellés existent en français et en anglais (ADR-0013).

Précisions de la responsable fonctionnelle (31.10.2026) :
- « Utilisé » : porté par une exigence, ou présent dans l'historique d'une exigence (l'historique garde ainsi toujours un libellé).
- Les 6 statuts du BABOK ne sont jamais désactivés.
- Un statut ajouté se renomme (français et anglais) ; partout, historique compris, le nouveau libellé s'affiche.
- Ordre proposé : les 6 statuts du BABOK dans leur ordre, puis les statuts ajoutés par ordre d'ajout.
- Libellés : obligatoires en français et en anglais, 50 caractères au plus ; un libellé ne reprend pas celui d'un autre statut dans la même langue (majuscules et accents ignorés), BABOK compris.
- Un statut désactivé peut être réactivé.
- Un statut ajouté n'a pas d'info-bulle (ce n'est pas un terme du BABOK).
- Écran : section « Statuts d'exigence » dans l'administration, sous « Acronymes des références ». Validé tel que proposé.

Réalisation :
- Règles dans shared : `requirement-statuses.ts` (statuts du BABOK, schémas des libellés, `checkStatusLabels`, `checkStatusUpdate`, `checkStatusDeletion`, `checkRequirementStatus`, `sortRequirementStatuses`, `selectableStatuses`, `requirementStatusLabel`, refus), avec tests. Le statut d'une exigence devient un code de cette liste (`requirements.ts`).
- Migration `0017_statuts_d_exigence.sql` : table `requirement_status` (les 6 du BABOK, sans libellé en base, toujours actifs ; statuts ajoutés avec leurs deux libellés et leur date d'ajout), lisible par tous, écrite seulement par les fonctions `admin_add_requirement_status`, `admin_update_requirement_status`, `admin_delete_requirement_status` (refus pour un statut du BABOK ou déjà utilisé) ; `admin_used_requirement_statuses` ne renvoie que des codes. Le statut d'une exigence référence la liste (clé étrangère) ; un déclencheur refuse de donner un statut désactivé, l'exigence qui le porte le garde.
- API : `GET /api/requirement-statuses` (tout utilisateur connecté) ; `GET|POST /api/admin/requirement-statuses`, `PATCH|DELETE /api/admin/requirement-statuses/:code` (rôle administrateur) ; refus `inactiveStatus` et `unknownStatus` à la modification d'une exigence.
- Web : section « Statuts d'exigence » dans l'administration (ajout, renommage, désactivation, réactivation, suppression) ; la fiche d'une exigence propose les statuts actifs et celui qu'elle porte ; libellés des statuts ajoutés dans la fiche, l'historique et l'aperçu des références.
- Section `scripts/roles/12-statuts-d-exigence.mjs` : lecture par tous, administration réservée à l'administrateur, statuts du BABOK verrouillés, statut désactivé ou utilisé, sur les deux barrières. Les statuts portés par une exigence ne sont créés qu'en base, dans une transaction annulée, pour ne rien laisser dans la base de développement.

Points gardés tels que livrés, avec la validation du ticket (31.10.2026) :
- Pastilles « Actif / Désactivé · utilisé » et texte d'aide sous le titre de la section.
- En base, l'unicité des libellés ne tient compte que des majuscules ; la règle complète (accents ignorés, BABOK compris) est appliquée par l'application.
