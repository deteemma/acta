# 14: Encart « Actions suggérées »

**What to build:** Le tableau de bord de l'initiative propose des actions selon l'état de l'initiative, par des règles fixes et explicables.

**Blocked by:** 12 — Tableau de bord de l'initiative ; 13 — Suggestions de technique et de tâche ; validation par la responsable fonctionnelle de la liste des règles

**Status:** à valider par la responsable fonctionnelle

- [x] La liste complète des règles est rédigée dans un document et validée par la responsable fonctionnelle avant tout développement : `.scratch/phase-1/14-regles-actions-suggerees.md` (validé le 30.10.2026).
- [x] Seules les règles validées sont mises en œuvre ; chaque suggestion affiche sa justification et permet de créer l'Action en un clic.
- [x] Une suggestion disparaît dès que la situation qui l'a déclenchée n'existe plus.
- [x] Tous les libellés existent en français et en anglais (ADR-0013).

Précisions de la responsable fonctionnelle (31.10.2026) :
- G2 s'applique aux suggestions encore visibles : si la gagnante d'une tâche est écartée (G7) ou masquée par son Action en cours (G6), l'autre règle de la même tâche s'affiche (ex. R4 quand R5 est écartée).
- Le titre de l'Action créée en un clic est écrit dans la langue de l'interface du membre qui clique.

Réalisation :
- Règles dans shared : `suggested-actions.ts` (`currentSituations`, `suggestActions`, `requirementStatusSince`, `suggestedActionText`, `suggestedActionInput`), avec tests pour chaque règle R1 à R15 et G2, G4, G6, G7, G9 à G12. R11 à R13 reprennent la tâche du ticket 13 (`requirementStatusTask`).
- Migration `0015_actions_suggerees.sql` : l'action garde la suggestion d'où elle est créée (`suggestion_key`, qui ne change plus) ; table `suggestion_dismissal` des écarts, avec RLS. Permission `dismissSuggestedActions` (propriétaire, contributeur).
- API : `GET /api/initiatives/:id/suggested-actions` (tout membre) ; `PUT …/suggested-actions/:clé/dismissal` (écarter). La création passe par `POST …/actions` avec `suggestionKey`, refusée (`suggestionNotOffered`) si l'encart ne propose pas cette suggestion. Après chaque écriture sur l'initiative, ses actions, parties prenantes, besoins ou exigences, les écarts dont la situation a disparu sont oubliés (G7).
- « Depuis plus de 14 jours » se compte depuis la première version de la dernière suite de versions de l'exigence à ce statut (historique du ticket 10).
- Web : encart en tête du panneau « Tableau de bord », 5 suggestions puis « Voir tout (n) » ; boutons « Créer l'action » et « Écarter » pour propriétaires et contributeurs ; masqué sur une initiative archivée.
- Section `scripts/roles/10-actions-suggerees.mjs` : lecture, écart et création par rôle, sur les deux barrières, initiative archivée.
- Termes « Action suggérée » et « Écarter une suggestion » ajoutés au glossaire `CONTEXT.md`.

Points à valider par la responsable fonctionnelle :
- R15, date de fin prévue aujourd'hui : le texte validé donne « La date de fin prévue est dans 0 jour(s). » Garder, ou un autre texte ?
- R15 : la date du jour est celle du serveur ; à minuit, le décompte peut avoir un jour d'écart avec l'heure suisse si le serveur n'est pas réglé sur ce fuseau.
- Ajouts non demandés, à garder ou retirer : le lien « Voir moins » après « Voir tout » ; le message « Aucune action suggérée. » quand l'encart est vide ; le refus d'une création depuis une suggestion qui n'est plus proposée (« Cette suggestion n'est plus proposée : l'encart a été actualisé. »).
