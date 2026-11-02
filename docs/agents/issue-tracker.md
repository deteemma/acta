# Suivi des tickets : markdown local

Les tickets et les spécifications de ce dépôt sont des fichiers markdown dans `.scratch/`.
GitHub Issues n'est pas utilisé.

## Conventions

- Un sujet par dossier : `.scratch/<sujet>/` (ex. `.scratch/phase-1/`, `.scratch/refonte-design/`).
- La spécification est `.scratch/<sujet>/spec.md`.
- Un fichier par ticket : `.scratch/<sujet>/issues/<NN>-<slug>.md`, numéroté à partir de `01` ; jamais un fichier unique regroupant plusieurs tickets.
- Le contenu des tickets est en français (voir `CLAUDE.md`).
- L'état du ticket est une ligne `**Status:**` en haut du fichier : un des statuts de `triage-labels.md`, ou `done` une fois le ticket validé par la responsable fonctionnelle (ex. `**Status:** done (validé par la responsable fonctionnelle le 31.10.2026)`).
- Les dépendances sont une ligne `**Blocked by:** NN — <titre>` en haut du fichier.
- Les échanges s'ajoutent en bas du fichier, sous un titre `## Commentaires`.

## Quand un skill dit « publier dans le suivi des tickets »

Créer un nouveau fichier sous `.scratch/<sujet>/` (en créant le dossier si besoin).

## Quand un skill dit « récupérer le ticket concerné »

Lire le fichier indiqué. L'utilisatrice donne normalement le chemin ou le numéro du ticket.

## Opérations de wayfinding

Utilisées par `/wayfinder`. La **carte** est un fichier, avec un fichier **enfant** par ticket.

- **Carte** : `.scratch/<sujet>/map.md` (corps : Notes / Décisions prises / Zones floues).
- **Ticket enfant** : `.scratch/<sujet>/issues/NN-<slug>.md`, numéroté à partir de `01`, la question dans le corps. Une ligne `Type:` donne le type (`research`/`prototype`/`grilling`/`task`) ; une ligne `Status:` donne `claimed`/`resolved`.
- **Blocage** : une ligne `Blocked by: NN, NN` en haut. Un ticket est débloqué quand tous les fichiers listés sont `resolved`.
- **Front** : parcourir `.scratch/<sujet>/issues/` pour trouver les fichiers ouverts, débloqués et non réclamés ; le plus petit numéro l'emporte.
- **Réclamer** : passer à `Status: claimed` et enregistrer avant tout travail.
- **Résoudre** : ajouter la réponse sous un titre `## Réponse`, passer à `Status: resolved`, puis ajouter un renvoi (résumé + lien) dans la section Décisions prises de `map.md`.
