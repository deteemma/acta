# ADR-0022 — Assistant : ACTA assemble le contexte, Hermes n'accède pas à ACTA

- **Statut** : accepté (validé par la responsable fonctionnelle le 25.11.2026)
- **Date** : 2026-11-25

## Contexte

L'**assistant** d'ACTA conseille le BA sur une initiative. Il ne modifie jamais
ACTA et répond en différé à une **demande à l'assistant** (`CONTEXT.md`, section
« Aide à la décision »). Il fonctionne avec Hermes Agent et un modèle local
servi par Ollama (`qwen3.5:9b`, sans carte graphique). L'utilisateur ne voit
jamais Hermes.

Contraintes :

- l'assistant ne voit jamais plus que l'utilisateur qui l'interroge (ADR 0006) ;
- une demande est privée à son auteur, administrateur compris, et son
  effacement est définitif et sans trace (ticket 04 de la carte « assistant »,
  règles 11 et 12) ;
- le module ne connaît son environnement que par des variables d'environnement
  (ADR 0007).

Faits établis par la recherche du 25.11.2026 (Hermes Agent v0.23.4, branche
`research/capacites-hermes`) :

- Hermes ne sait pas transmettre un jeton propre à l'utilisateur, demande par
  demande, à ses outils ou à un serveur MCP. Sa documentation précise qu'un
  identifiant de session n'est pas une barrière d'autorisation.
- Hermes est conçu pour une seule personne. Mémoire, recherche dans
  l'historique et skills générés sont communs à toutes les demandes d'une même
  instance.
- Sur l'API, les outils dangereux sont actifs par défaut : terminal, fichiers,
  exécution de code, navigateur, web, délégation, cron.
- Le traitement en différé se fait en interrogeant Hermes (`POST /v1/runs`, puis
  `GET /v1/runs/{id}`). Hermes ne rappelle pas ACTA, garde le résultat une heure
  et accepte au plus 10 travaux en même temps.
- L'API de Hermes ne démarre pas sans clé d'au moins 16 caractères.

Options envisagées :

- **(a) Hermes interroge l'API d'ACTA** par MCP ou par un outil. Écartée : il
  faudrait un plugin Python dans Hermes qui relie une session à un utilisateur,
  soit un nouveau langage (ADR 0002), du code fragile à chaque mise à jour de
  Hermes, et une liaison session ↔ utilisateur que Hermes ne garantit pas. Les
  appels d'outils d'un petit modèle sans carte graphique sont aussi lents et peu
  fiables. L'effort a été estimé à deux à trois fois celui de (b).
- **(b) ACTA assemble le contexte** déjà filtré par les droits et le transmet
  avec la demande. Retenue.
- **ACTA appelle Ollama directement, sans Hermes.** Écartée pour l'instant.
  Hermes apporte le traitement en différé, des skills écrits par l'équipe, les
  essais par hermes-webui, et une base pour une exploration future où
  l'assistant agirait sur ACTA. À rouvrir si Hermes coûte trop cher à maintenir.

## Décision

1. **Lecture par ACTA.** ACTA lit l'initiative avec l'identité de l'auteur de
   la demande, par les deux barrières de l'ADR 0006 (règles de
   `shared/src/roles.ts` et RLS). Elle transmet le résultat à Hermes avec la
   question. Hermes n'a aucun accès à ACTA : ni réseau vers l'API, ni outil, ni
   serveur MCP.
2. **Droits vérifiés deux fois** : au passage En cours, avant la lecture, et
   avant d'enregistrer l'avis.
   - Si l'auteur a perdu l'accès, la demande devient Annulée avec la mention
     « vous n'avez plus accès à cette initiative ». Un avis déjà produit est
     jeté.
   - Si le compte de l'auteur est désactivé, la demande devient Annulée avec la
     mention « compte désactivé ».
   - Une initiative archivée reste lisible.
3. **File dans ACTA.** Les demandes, leur statut, l'identifiant du travail
   Hermes et l'avis sont enregistrés dans la base d'ACTA. Un traitement de fond
   du conteneur `api` envoie les demandes à Hermes, l'interroge jusqu'à la fin
   du travail, applique le délai maximal et l'annulation. Les envois portent une
   clé d'idempotence.
4. **Parallélisme réglable.** Le nombre de demandes traitées en même temps est
   un paramètre de l'administration : 1 au départ, de 1 à 10. Une modification
   s'applique aux demandes suivantes. La limite d'une demande non terminée par
   personne ne change pas.
5. **Indisponibilité.**
   - Hermes injoignable au moment d'envoyer une demande En attente : la demande
     reste En attente, avec la mention « assistant momentanément indisponible ».
   - Travail perdu après l'envoi (arrêt ou redémarrage de Hermes) : la demande
     devient Échouée, avec la raison « assistant indisponible ». Il n'y a pas de
     nouvelle tentative automatique.
6. **Instance réservée.** ACTA utilise sa propre instance Hermes, avec son
   propre dossier de données, jamais partagé avec hermes-webui. Le modèle Ollama
   est partagé, car il ne garde rien entre deux appels.
7. **Outils.**
   - Les seuls outils autorisés sont la lecture de skills écrits par l'équipe et
     versionnés dans le dépôt (`skills_list`, `skill_view`). Ils sont fixés par
     une liste explicite des outils autorisés, et non par une liste d'outils
     interdits.
   - Tout le reste est coupé : terminal, fichiers, exécution de code,
     navigateur, web, délégation, cron, mémoire, recherche dans l'historique,
     écriture de skills, révision automatique.
   - Les instructions présentent le contenu de l'initiative comme des données à
     analyser, jamais comme des consignes.
8. **Rien de durable chez Hermes.**
   - ACTA supprime la session Hermes d'une demande dès que l'avis est récupéré,
     que la demande échoue ou qu'elle est annulée. Effacer une demande non
     terminée l'annule d'abord.
   - Les journaux de Hermes ne contiennent pas le texte des demandes. À défaut,
     ils ont une rotation courte.
   - Les données de Hermes sont exclues des sauvegardes (ADR 0010).
   - L'avis n'existe que dans ACTA.
9. **Réseau.**
   - Un réseau Docker dédié relie l'API d'ACTA et l'instance Hermes d'ACTA, et
     rien d'autre.
   - Un réseau **interne**, sans accès à Internet, relie Hermes et Ollama.
   - Hermes ne rejoint pas le réseau `socle`.
   - Aucun port de Hermes n'est publié, et il n'a ni nom de domaine ni route
     Caddy.
10. **Protection de l'API.** La clé est aléatoire, d'au moins 32 caractères.
    ACTA reçoit l'adresse de Hermes et la clé par des variables
    d'environnement, comme le veut l'ADR 0007.
11. **Installation.**
    - L'instance Hermes d'ACTA est un service `assistant` de `compose.yaml`, sous
      le profil Compose `assistant`, avec un `mem_limit`.
    - Sa configuration et ses skills sont versionnés dans le dépôt et déployés
      par `deployer.sh`.
    - Ollama reste hors d'ACTA. Il rejoint le réseau interne déclaré par ACTA, et
      ACTA ne connaît son adresse que par une variable d'environnement.
12. **Assistant facultatif.** Sans adresse ou sans clé de Hermes, ACTA ne
    propose pas l'assistant (ni bouton, ni panneau, ni file) et tout le reste
    fonctionne normalement.

## Conséquences

- **Positif.**
  - La règle « jamais plus que l'utilisateur » est garantie par construction :
    Hermes ne peut lire que ce qu'ACTA lui donne.
  - Les permissions restent écrites à un seul endroit et testées par
    `scripts/tester-roles.sh`.
  - Si Hermes est trompé par le contenu d'une page, le pire résultat possible
    est un avis trompeur : rien ne peut être exécuté ni sortir vers Internet.
  - L'effacement dans ACTA suffit à faire disparaître une demande.
- **Négatif.**
  - ACTA doit choisir elle-même les données à transmettre pour chaque usage
    (zone floue « Données fournies à l'assistant » de la carte).
  - La taille du contexte limite ce qui peut être transmis.
  - La question libre, qui gagnerait à laisser l'assistant choisir quoi lire,
    est desservie.
  - ACTA doit construire une file, un traitement de fond et l'interrogation
    régulière de Hermes.
- **À surveiller.**
  - La version de Hermes : relire la liste des outils et les réglages de
    mémoire à chaque mise à jour.
  - Les journaux de Hermes, pour vérifier qu'ils ne gardent pas le texte des
    demandes.
  - La taille de contexte d'Ollama : au moins 64 000 tokens exigés par Hermes.
- **Évolution possible.** Un accès de Hermes à ACTA par MCP, pour la question
  libre, ferait l'objet d'un nouvel ADR.

> Rappel : un ADR accepté n'est jamais modifié de sa propre initiative. Pour le
> faire évoluer, on propose un nouvel ADR et on attend une validation explicite.
