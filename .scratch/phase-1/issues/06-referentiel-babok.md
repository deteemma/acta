# 06: Référentiel BABOK (ADR-0012)

**What to build:** Tout utilisateur consulte le référentiel BABOK v3 livré avec l'application : les 6 domaines de connaissance, les 30 tâches, les 50 techniques et la correspondance entre tâches et techniques. Chaque élément porte son nom officiel en anglais et en français, un résumé rédigé pour ACTA dans les deux langues et son renvoi de section ; aucun extrait du texte de l'IIBA n'est reproduit.

**Blocked by:** 02 — Coque de navigation

**Status:** done (validé par la responsable fonctionnelle le 29.10.2026)

- [x] Le référentiel est livré par migration, identique pour toutes les initiatives, en lecture seule pour tous, administrateur compris.
- [x] Chaque élément a un identifiant stable (par exemple le numéro de section de la tâche), utilisé par les autres objets.
- [x] Un écran de consultation présente les domaines, leurs tâches et les techniques associées à chaque tâche ; chaque technique liste les tâches qui l'utilisent.
- [x] En français, le nom anglais de chaque élément est visible en info-bulle.
- [x] Les éléments du référentiel sont accessibles par la palette Ctrl+K.
- [x] Les résumés rédigés pour ACTA sont soumis à la responsable fonctionnelle et validés avant la livraison du ticket.
- [x] Aucun texte de l'IIBA n'est reproduit (contrôle par la responsable fonctionnelle).

Réalisation :
- Migration `0009_referentiel_babok.sql` : 6 domaines, 30 tâches, 50 techniques et 341 liens tâche ↔ technique. Lecture par tout utilisateur connecté ; aucune écriture possible avec le compte applicatif, administrateur compris (RLS sans politique d'écriture, API sans route d'écriture).
- Identifiant stable = numéro de section du BABOK v3 (`3`, `3.1`, `10.33`) ; le renvoi de section est gardé à part, pour une édition future qui renumérote.
- Noms officiels repris des tables des matières du guide anglais et de sa traduction française (contrôle automatique : 86/86). Correspondance tâches ↔ techniques reprise de la rubrique « Techniques » de chaque tâche du guide anglais.
- Écran « Référentiel BABOK » (bouton en haut de page) : domaines et leurs tâches, techniques de chaque tâche ; liste des techniques et des tâches qui les utilisent ; fiche de chaque élément (résumé, renvoi de section, éléments liés).
- Résumés à relire : `.scratch/phase-1/06-referentiel-babok-resumes.md`.

Précisions de la responsable fonctionnelle (validées le 29.10.2026) :
- Recherche de la palette : chaque mot saisi figure dans le numéro de section ou le nom, français **ou anglais** (un BA qui tape « Interviews » trouve « Entretiens »). Résultats : initiatives, puis domaines, tâches, techniques ; saisie vide = les initiatives seules, comme au ticket 02. La recherche par section porte sur le texte : « 10.3 » ramène aussi 10.30 à 10.39.
- Le nom officiel français de la tâche 5.1 est « Traçabilité des exigences » (traduction officielle), bien que le terme anglais soit un verbe (*Trace Requirements*).

Points en suspens :
- `scripts/tester-roles.sh` : 3 échecs dans la partie administration (ticket 05), dus aux comptes de test : `alice` a le rôle administrateur dans Keycloak, ce que le script ne lui donne jamais. Retirer ce rôle à `alice` dans l'application (écran d'administration) rétablit l'état attendu.
