# 12: Faire le point, de bout en bout

**What to build:** Premier fil complet : depuis l'initiative, le BA demande « Faire le point » en réponse rapide ou approfondie. ACTA met la demande dans la file, lit les données avec ses droits, l'envoie à Hermes et range l'avis dans l'onglet « Assistant » de l'initiative.

**Blocked by:** 11 — Instance Hermes d'ACTA

**Status:** ready-for-agent

Règles : [spécification](../spec.md) AS1 à AS5, AS9, AS10, AS12 à AS18, AS20, AS21, AS22, AS24 à AS28, AS29 (Faire le point), AS30, AS31, AS37, AS40. Détail dans les tickets [04](04-cycle-de-vie-demande.md), [06](06-choix-premier-lot.md), [07](07-donnees-par-usage.md) et [08](08-maquette-du-panneau.md) ; textes de l'interface au ticket 08.

### Demande et permissions
- [ ] Table des demandes à l'assistant : auteur, initiative, usage, élément choisi, mode, statut, dates (création, lecture, fin), délai applicable, identifiant de travail Hermes, avis, raison d'échec ; prévue pour les sept usages et les six raisons d'échec sans refaire la migration.
- [ ] Statuts En attente, En cours, Répondue, Échouée, Annulée ; les trois derniers définitifs (AS2).
- [ ] Une seule demande non terminée par personne, toutes initiatives confondues (AS3).
- [ ] Règles dans `shared/src/roles.ts` et RLS : créer (membre, lecteur compris, compte actif, assistant installé, initiative archivée comprise) ; lire seulement par l'auteur membre de l'initiative ; administrateur sans aucun accès aux demandes (AS1, AS9, AS40).
- [ ] L'auteur qui quitte l'initiative ne voit plus ses demandes ; elles réapparaissent s'il redevient membre ; l'initiative supprimée emporte ses demandes (AS9).
- [ ] Section de `scripts/roles/` : un autre membre et l'administrateur ne voient aucune demande d'autrui (AS40).

### Données lues
- [ ] Assemblage de la partie commune (fiche, parties prenantes, besoins, exigences, tickets, actions suggérées affichées, liste des pages) et du référentiel BABOK, avec les trois horizons si le module agile est activé (AS14) ; rien de ce qu'exclut AS15.
- [ ] Faits calculés en tête (AS16) ; libellés fixes dans la langue d'ACTA de l'auteur, textes saisis tels quels (AS18).
- [ ] Lecture au passage En cours, avec les droits de l'auteur, par les deux barrières de l'ADR 0006 (AS17).
- [ ] Estimation de la taille : fonction unique de `shared/`, caractères ÷ 3 arrondi au supérieur, avec tests (AS21). Plafond à sa valeur de départ (16 000 tokens), lu depuis un paramètre que le ticket 21 rendra modifiable : refus à la création, Échouée « données trop volumineuses » au passage En cours (AS20).

### Instructions et envoi
- [ ] Instructions générales et instruction « Faire le point », en français et en anglais, écrites dans le code ; données entre `<donnees>` et `</donnees>` (`<data>` en anglais), consigne de mise en forme en fin de message (AS26 à AS29) ; réglage de réflexion toujours explicite (AS36 bis). Traduction anglaise à relire par la responsable.
- [ ] Réponse rapide sans réflexion, approfondie avec réflexion, selon le résultat du ticket 10 (AS13).

### Traitement de fond
- [ ] File premier arrivé, premier servi, parallélisme et délais maximaux à leurs valeurs de départ (1 ; 20 et 60 minutes), lus depuis des paramètres (AS4, AS5, AS32).
- [ ] Passage En cours avec date de lecture et délai applicable ; `POST /v1/runs` avec identifiant de session propre à la demande et clé d'idempotence ; interrogation par `GET /v1/runs/{id}` bien avant l'oubli du résultat ; délai dépassé → Échouée « délai dépassé » ; avis enregistré puis session Hermes supprimée (AS37).

### Interface
- [ ] Bouton « Demander à l'assistant » dans l'en-tête de l'écran de données de l'initiative et du tableau de bord ; fenêtre de dialogue avec l'usage « Faire le point », le mode (« Réponse rapide » par défaut) et l'encadré « Ce qui sera transmis » ; puis position dans la file (AS4, AS12, AS22).
- [ ] Onglet « Assistant » de l'initiative, avec le nombre de demandes, en cartes repliables (AS22).
- [ ] Carte de l'avis : bordure en pointillés, étiquette et icône de l'assistant, en-tête de lecture et de mode, phrase de nature ajoutée par ACTA, rubrique repliable « Données lues » (AS22, AS30) ; texte de l'avis affiché en Markdown, titres et listes (AS27).
- [ ] Absent sans assistant installé (AS25). Composants maison et tokens de design ; textes en français et en anglais (AS24).
