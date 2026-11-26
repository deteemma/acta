# ADR-0023 — Données de l'instance Hermes d'ACTA en mémoire vive

- **Statut** : accepté (validé par la responsable fonctionnelle le 26.11.2026)
- **Date** : 2026-11-26

## Contexte

L'effacement d'une demande à l'assistant est définitif et sans trace. Rien de
durable ne doit rester chez Hermes (ADR 0022, point 8).

Vérifications du 26.11.2026 sur Hermes Agent v0.23.4 (ticket 10 de la carte
« assistant ») :

- `DELETE /api/sessions/{id}` retire la demande, l'avis et le titre de toutes
  les tables de la base de Hermes (`state.db`).
- Le texte reste pourtant **physiquement** dans le fichier : dans les pages
  libérées par SQLite, qui ne les efface pas, et dans son journal d'écriture
  (`state.db-wal`). Il reste lisible avec un outil adapté, par quiconque accède
  au volume, jusqu'à ce que ces pages soient réécrites.

Options envisagées :

- **(a) Données de Hermes en mémoire vive** (`tmpfs`). Retenue par la
  responsable fonctionnelle.
- (b) Compactage régulier de la base de Hermes (`VACUUM`). Écartée : il faut une
  tâche planifiée qui touche aux fichiers internes de Hermes, et le texte reste
  sur disque entre deux compactages.
- (c) Accepter le résidu, puisque le volume n'est ni sauvegardé ni accessible
  hors du serveur. Écartée.

## Décision

1. Le dossier de données de l'instance Hermes d'ACTA (`/opt/data`) est un
   `tmpfs` du service `assistant`, d'une taille fixée dans `compose.yaml`.
   Aucun volume Docker ni dossier du serveur ne garde les données de Hermes.
2. La configuration de Hermes, versionnée dans le dépôt (ADR 0022, point 11),
   est fournie au conteneur à chaque démarrage.
3. Un redémarrage de Hermes efface toutes ses données. Les demandes envoyées
   et non terminées suivent la règle déjà fixée par l'ADR 0022, point 5 :
   Échouée, « assistant indisponible », sans nouvelle tentative automatique.

## Conséquences

- **Positif.**
  - Rien de ce que Hermes reçoit ou produit n'est écrit sur disque, pas même
    dans les pages libérées de sa base.
  - L'exclusion des sauvegardes (ADR 0010) est garantie par construction.
- **Négatif.**
  - Le `tmpfs` compte dans la mémoire du conteneur : la taille du `tmpfs` et le
    `mem_limit` du service `assistant` se règlent ensemble.
  - Les journaux de Hermes disparaissent aussi au redémarrage, ce qui gêne un
    diagnostic après coup.
  - Hermes tente de réécrire sa configuration au démarrage (`config-migrate`).
    Si la configuration est montée en lecture seule, cette tentative échoue et
    un message d'erreur est consigné (constaté le 26.11.2026, sans effet sur les
    réglages).
- **À surveiller.**
  - À chaque mise à jour de Hermes : vérifier qu'il n'écrit rien hors de
    `/opt/data`, par exemple dans `/tmp` ou `/opt/hermes`, et que ses réglages
    s'appliquent toujours.

> Rappel : un ADR accepté n'est jamais modifié de sa propre initiative. Pour le
> faire évoluer, on propose un nouvel ADR et on attend une validation explicite.
