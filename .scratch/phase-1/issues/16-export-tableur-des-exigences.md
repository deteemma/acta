# 16: Export tableur des exigences

**What to build:** Un membre exporte les exigences d'une initiative dans un fichier tableur, pour les communiquer aux parties prenantes (tâche BABOK 4.4).

**Blocked by:** 10 — Exigences

**Status:** done (validé par la responsable fonctionnelle le 31.10.2026)

- [x] Tout membre de l'initiative peut exporter ses exigences au format Excel.
- [x] Le fichier contient une ligne par exigence avec ses champs : référence, titre, énoncé, type, sous-type, statut, sources, besoins liés, exigence parente.
- [x] Les en-têtes de colonnes sont dans la langue de l'utilisateur ; le contenu saisi n'est pas traduit.

Précisions de la responsable fonctionnelle (31.10.2026) :
- Énoncé en texte brut : mise en forme retirée ; retours à la ligne gardés ; puces « - » et numéros « 1. » en début de ligne ; un lien s'écrit « texte (adresse) ».
- Besoins liés et exigence parente : « référence titre » (ex. « CRM-BE-003 Réduire les ressaisies ») ; plusieurs besoins : un par ligne dans la cellule.
- Sources : le nom de chaque partie prenante, une par ligne dans la cellule.
- Type, sous-type et statut dans la langue de l'utilisateur, comme les en-têtes (un statut ajouté par l'administration prend son libellé dans cette langue).
- Toutes les exigences de l'initiative, par référence ; export permis aussi pour une initiative archivée.

Réalisation :
- Règles dans shared : `requirements-export.ts` (`requirementsSheet` : colonnes, en-têtes traduits, une ligne par exigence ; `requirementsWorkbook` ; `requirementsFileName`), `richTextToPlainText` dans `rich-text.ts`, et `xlsx.ts`, classeur Excel d'une feuille écrit sans dépendance (réutilisable par le mobile) ; avec tests. Fichier contrôlé à l'ouverture dans Excel.
- Web : bouton « Exporter (Excel) » dans l'en-tête de la section « Exigences » de la fiche Initiative, pour tout membre ; les exigences et les statuts sont relus au clic, le fichier est enregistré par le navigateur.
- Aucune route ni table nouvelle : l'export lit `GET /api/initiatives/:id/requirements` (guard `view`), déjà couverte par `scripts/roles/08-exigences.mjs` pour chaque rôle et le non-membre.

Points gardés tels que livrés, avec la validation du ticket (31.10.2026) :
- Le bouton n'apparaît que si l'initiative a au moins une exigence.
- Nom du fichier : `CRM-exigences-2026-10-31.xlsx` (`CRM-requirements-…` en anglais) ; feuille « Exigences » (« Requirements »).
- En-têtes en gras et figés au défilement ; largeurs de colonnes fixes ; cellules alignées en haut, texte renvoyé à la ligne.
- Énoncé : les blocs (titre, paragraphe, liste) sont séparés par une ligne vide, même si la saisie n'en avait pas, et plusieurs lignes vides n'en font qu'une ; les numéros d'une liste repartent de 1 et se suivent, comme à l'affichage.
