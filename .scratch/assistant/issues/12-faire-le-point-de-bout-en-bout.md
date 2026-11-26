# 12: Faire le point, de bout en bout

**What to build:** Premier fil complet : depuis l'initiative, le BA demande « Faire le point » en réponse rapide ou approfondie. ACTA met la demande dans la file, lit les données avec ses droits, l'envoie à Hermes et range l'avis dans l'onglet « Assistant » de l'initiative.

**Blocked by:** 11 — Instance Hermes d'ACTA

**Status:** ready-for-human (à valider par la responsable fonctionnelle sur acta.localhost)

Règles : [spécification](../spec.md) AS1 à AS5, AS9, AS10, AS12 à AS18, AS20, AS21, AS22, AS24 à AS28, AS29 (Faire le point), AS30, AS31, AS37, AS40. Détail dans les tickets [04](04-cycle-de-vie-demande.md), [06](06-choix-premier-lot.md), [07](07-donnees-par-usage.md) et [08](08-maquette-du-panneau.md) ; textes de l'interface au ticket 08.

### Demande et permissions
- [x] Table des demandes à l'assistant : auteur, initiative, usage, élément choisi, mode, statut, dates (création, lecture, fin), délai applicable, identifiant de travail Hermes, avis, raison d'échec ; prévue pour les sept usages et les six raisons d'échec sans refaire la migration.
- [x] Statuts En attente, En cours, Répondue, Échouée, Annulée ; les trois derniers définitifs (AS2).
- [x] Une seule demande non terminée par personne, toutes initiatives confondues (AS3).
- [x] Règles dans `shared/src/roles.ts` et RLS : créer (membre, lecteur compris, compte actif, assistant installé, initiative archivée comprise) ; lire seulement par l'auteur membre de l'initiative ; administrateur sans aucun accès aux demandes (AS1, AS9, AS40).
- [x] L'auteur qui quitte l'initiative ne voit plus ses demandes ; elles réapparaissent s'il redevient membre ; l'initiative supprimée emporte ses demandes (AS9).
- [x] Section de `scripts/roles/` : un autre membre et l'administrateur ne voient aucune demande d'autrui (AS40).

### Données lues
- [x] Assemblage de la partie commune (fiche, parties prenantes, besoins, exigences, tickets, actions suggérées affichées, liste des pages) et du référentiel BABOK, avec les trois horizons si le module agile est activé (AS14) ; rien de ce qu'exclut AS15.
- [x] Faits calculés en tête (AS16) ; libellés fixes dans la langue d'ACTA de l'auteur, textes saisis tels quels (AS18).
- [x] Lecture au passage En cours, avec les droits de l'auteur, par les deux barrières de l'ADR 0006 (AS17).
- [x] Estimation de la taille : fonction unique de `shared/`, caractères ÷ 3 arrondi au supérieur, avec tests (AS21). Plafond à sa valeur de départ (16 000 tokens), lu depuis un paramètre que le ticket 21 rendra modifiable : refus à la création, Échouée « données trop volumineuses » au passage En cours (AS20).

### Instructions et envoi
- [x] Instructions générales et instruction « Faire le point », en français et en anglais, écrites dans le code ; données entre `<donnees>` et `</donnees>` (`<data>` en anglais), consigne de mise en forme en fin de message (AS26 à AS29) ; réglage de réflexion toujours explicite (AS36 bis). Traduction anglaise à relire par la responsable.
- [x] Réponse rapide sans réflexion, approfondie avec réflexion, selon le résultat du ticket 10 (AS13).

### Traitement de fond
- [x] File premier arrivé, premier servi, parallélisme et délais maximaux à leurs valeurs de départ (1 ; 20 et 60 minutes), lus depuis des paramètres (AS4, AS5, AS32).
- [x] Passage En cours avec date de lecture et délai applicable ; `POST /v1/runs` avec identifiant de session propre à la demande et clé d'idempotence ; interrogation par `GET /v1/runs/{id}` bien avant l'oubli du résultat ; délai dépassé → Échouée « délai dépassé » ; avis enregistré puis session Hermes supprimée (AS37).

### Interface
- [x] Bouton « Demander à l'assistant » dans l'en-tête de l'écran de données de l'initiative et du tableau de bord ; fenêtre de dialogue avec l'usage « Faire le point », le mode (« Réponse rapide » par défaut) et l'encadré « Ce qui sera transmis » ; puis position dans la file (AS4, AS12, AS22).
- [x] Onglet « Assistant » de l'initiative, avec le nombre de demandes, en cartes repliables (AS22).
- [x] Carte de l'avis : bordure en pointillés, étiquette et icône de l'assistant, en-tête de lecture et de mode, phrase de nature ajoutée par ACTA, rubrique repliable « Données lues » (AS22, AS30) ; texte de l'avis affiché en Markdown, titres et listes (AS27).
- [x] Absent sans assistant installé (AS25). Composants maison et tokens de design ; textes en français et en anglais (AS24).

## Commentaires

### 26.11.2026 — Réalisation

**Ce qui a été construit.**
- `shared/` : règles de la demande (`assistant-requests.ts`), données lues et message envoyé à Hermes (`assistant-context.ts`), permissions `askAssistant` et `viewAssistantRequests` (`roles.ts`), textes en français et en anglais (`i18n.ts`). 41 tests.
- Base : migration 0038. Elle crée :
  - la table des demandes, avec les sept usages, les six raisons d'échec et les trois raisons d'annulation ;
  - les statuts, avec un déclencheur qui rend les trois derniers définitifs ;
  - l'index « une seule demande non terminée » ;
  - la RLS (auteur membre seulement, administrateur exclu) ;
  - les quatre paramètres à leur valeur de départ.
- API :
  - `GET` et `POST /api/initiatives/:id/assistant-requests` ;
  - le traitement de fond (toutes les 10 s), qui suit Hermes, applique le délai, puis fait partir les demandes En attente dans l'ordre d'arrivée ;
  - le client Hermes (`POST /v1/runs` avec clé d'idempotence, `GET /v1/runs/{id}`, arrêt, suppression de session).
- Web :
  - le bouton « Demander à l'assistant » sur l'initiative et le tableau de bord ;
  - la fenêtre de la demande ;
  - l'onglet « Assistant » avec le nombre de demandes, la carte de l'avis en Markdown et la rubrique « Données lues ».
- `scripts/roles/34-demandes-a-l-assistant.mjs` : les deux barrières. Aucune demande n'y est créée par l'API, pour ne rien envoyer à Hermes ; les créations se font en base, dans des transactions annulées.

**Vérifications.**
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (469 tests) et `scripts/tester-roles.sh` passent.
- Essai de bout en bout sur l'instance Hermes du serveur, par le tunnel, sur une initiative fictive créée puis supprimée par un compte de test :
  - demande En cours en 5 s, avis en 2 min 15 s, en Markdown ;
  - les faits calculés sont repris (47 jours de retard, 19 jours restants) ;
  - une seconde demande est refusée (« demande non terminée ») ;
  - la session Hermes est supprimée ensuite (404).

**Choix de réalisation, à connaître.**
- **Langue de la demande** : celle de l'interface au moment de la demande, enregistrée avec elle. Un utilisateur qui n'a pas choisi de langue suit celle de son navigateur, que la base ne connaît pas.
- **Ordre d'envoi** : ACTA envoie le travail à Hermes, puis passe la demande En cours avec la date de lecture (prise avant l'envoi). Si l'API s'arrête entre les deux, la demande repart au passage suivant avec la même clé d'idempotence : Hermes rend le même travail, sans en lancer un second.
- **Déjà fait, avec les tests restant au ticket 13** : la revérification des droits (Annulée « vous n'avez plus accès… », « compte désactivé »), Hermes injoignable avant l'envoi (la demande attend), travail perdu ou réponse vide (Échouée).
- **Onglet « Assistant »** : cartes de la plus récente à la plus ancienne ; la plus récente est ouverte.

**Questions à la responsable fonctionnelle.**
1. **Référence des parties prenantes** (ticket 07, point 2) : une partie prenante n'a pas de référence dans ACTA. Les données lues donnent son nom, ses rôles, son influence et son intérêt. Est-ce suffisant ?
2. **[ADR-0024](../../../docs/adr/0024-file-de-l-assistant-hors-appartenance.md), proposé** : la position dans la file compte les demandes de toute l'application, et le refus « demande non terminée » nomme une demande peut-être posée sur une initiative quittée. L'ADR 0016 demande un nouvel ADR pour un tel comptage. À valider.
3. **Traduction anglaise** des textes et des instructions (`shared/src/i18n.ts`, bloc `en`, clés `assistant…`) : à relire (AS28).

**À savoir pour la suite.** Une initiative supprimée pendant qu'une de ses demandes est En cours emporte la demande, mais la session Hermes n'est pas supprimée : elle disparaît au prochain redémarrage de Hermes (données en mémoire vive, ADR 0023). À traiter avec le ticket 13 ou 19.
