# 02: Consultation du référentiel agile

**What to build:** Le référentiel agile validé au ticket 01 est livré avec l'application et consultable par tout utilisateur, dans trois nouveaux onglets de l'écran du référentiel et par la palette de recherche.

**Blocked by:** 01 — Référentiel agile à relire

**Status:** done (validé par la responsable fonctionnelle le 22.11.2026)

Règles : [spécification](../spec.md), décisions D1, D2, D5 à D9.

- [x] Migration : principes, horizons, techniques agiles et relations technique ↔ horizon, repris tels quels du fichier validé au ticket 01 ; lecture seule pour tous, administrateur compris (D1, D2).
- [x] Écran du référentiel : onglets Domaines et tâches, Techniques, Principes agiles, Horizons, Techniques agiles, chacun avec son adresse (D7).
- [x] Fiches principe, horizon et technique agile ; pastilles cliquables entre horizons et techniques agiles ; chaque fiche a son adresse (D8).
- [x] Numéro préfixé « EA » en français, « AE » en anglais ; nom anglais en info-bulle en français (D3, D5).
- [x] Consultable partout, même sans initiative où le module est activé (D6).
- [x] La palette de recherche trouve les éléments agiles (D9).
- [x] Tests dans `shared/` en français et en anglais.

## Commentaires

**22.11.2026, Claude** : réalisé, à valider sur acta.localhost (image reconstruite).

- Migration `0035_referentiel_agile.sql` : 7 principes, 3 horizons, 24 techniques agiles et 48 relations technique ↔ horizon. Elle est générée à partir de [`referentiel-agile.md`](../referentiel-agile.md) tel que vous l'avez validé, sans les signes ⚠. Lecture seule pour tous, administrateur compris : c'est vérifié sur les deux barrières (`scripts/roles/31-referentiel-agile.mjs`).
- Écran du référentiel : cinq onglets dans l'ordre de D7. Adresses : `/babok/principles`, `/babok/horizons`, `/babok/agile-techniques` ; chaque fiche a la sienne, par exemple `/babok/ae-7.17`. Le fil d'Ariane d'une fiche ramène à son onglet.
- Numéro « EA 7.17 » en français, « AE 7.17 » en anglais : il figure partout où un numéro de section est affiché (onglets, fiches, pastilles, palette, aperçu).

Deux points ne sont pas dans la spécification. Merci de les confirmer ou de les corriger :

1. **Bandeau des onglets agiles.** Les onglets BABOK affichent un bandeau qui renvoie à l'exemplaire du BABOK. Les trois onglets agiles affichent à la place : « Extension Agile au Guide BABOK v2 : noms traduits et résumés rédigés pour ACTA. Pour le détail, reportez-vous à votre exemplaire, à la section indiquée. » Le titre de l'écran reste « Référentiel BABOK v3 ».
2. **Palette.** Elle trouve un élément agile par son numéro préfixé dans les deux langues : en français, « AE 7.16 » trouve la technique aussi bien que « EA 7.16 ». C'est le même principe que le nom anglais, qui est cherché quelle que soit la langue. Conséquence : taper seulement « ae » ou « ea » fait apparaître tous les éléments agiles.

**22.11.2026, responsable fonctionnelle** : bandeau des onglets agiles et recherche par préfixe dans les deux langues confirmés.

**22.11.2026, responsable fonctionnelle** : ticket validé.
