# 07: Actions et « Mes actions »

**What to build:** Un BA crée une Action sur une initiative, toujours rattachée à une tâche BABOK, et la suit jusqu'à son terme. L'écran d'accueil « Mes actions » regroupe toutes ses actions, toutes initiatives confondues ; le bouton flottant « + Action » permet une création rapide depuis n'importe quel écran.

**Blocked by:** 03 — Fiche Initiative complète ; 06 — Référentiel BABOK

**Status:** à valider par la responsable fonctionnelle

- [x] Une Action porte : titre, description (texte mis en forme, qui accueille aussi les comptes rendus d'élicitation), tâche BABOK (obligatoire), technique (facultative, parmi les 50), responsable (un membre de l'initiative), échéance (facultative), statut.
- [x] Statuts : À faire, En cours, Terminée, Annulée.
- [x] Une Action peut être supprimée tant qu'elle n'est liée à rien ; sinon, on utilise le statut Annulée.
- [x] « Mes actions » est l'écran d'accueil : toutes les actions dont je suis responsable, toutes initiatives confondues, filtrables par statut et par initiative, triées par échéance.
- [x] Le bouton flottant « + Action » ouvre une création rapide (initiative, titre, tâche BABOK) depuis tout écran.
- [x] Une Action s'ouvre dans un panneau latéral ; sa tâche et sa technique s'affichent avec un aperçu au survol.
- [x] La date de création et la date de dernière modification sont conservées, avec leur auteur.
- [x] Toute nouvelle table partagée a ses politiques RLS (migration SQL) et ses guards NestJS ; `scripts/tester-roles.mjs` couvre les deux barrières pour propriétaire, contributeur, lecteur et non-membre.
- [x] Tous les libellés existent en français et en anglais (ADR-0013).

Réalisation :
- Migration `0010_actions.sql` : table `action`, RLS (tout membre consulte ; propriétaires et contributeurs écrivent ; archivée : lecture seule), déclencheur qui impose auteurs et dates et vérifie le responsable à chaque attribution.
- API : `GET /api/actions/mine` ; `GET|POST /api/initiatives/:id/actions` ; `GET|PATCH|DELETE /api/initiatives/:id/actions/:actionId` (guards `view` / `editActions`).
- Règles dans shared : `actions.ts` (schémas, responsable possible, techniques proposées, filtre et tri de « Mes actions », refus) et `rich-text.ts` (mise en forme), avec tests.
- Web : « Mes actions » en accueil (filtres statuts et initiative), « Mes initiatives » en dessous avec le bouton « Nouvelle initiative » ; bouton flottant « + Action » repris dans chaque panneau latéral ; fiche d'une action en panneau latéral ; section « Actions » dans la fiche Initiative ; aperçu au survol (et au focus clavier) des tâches et techniques.
- `scripts/tester-roles.mjs` étendu aux deux barrières pour propriétaire, contributeur, lectrice et non-membre : tous les contrôles passent.

Précisions de la responsable fonctionnelle (30.10.2026) :
- Créer, modifier, supprimer une action : propriétaire et contributeurs ; lecteurs : consultation ; initiative archivée : lecture seule.
- Responsable : un membre propriétaire ou contributeur ; à la création rapide, la personne qui crée l'action.
- Technique : les 50, celles que le BABOK associe à la tâche en tête de liste.
- « Mes actions » : par défaut À faire et En cours ; tri par échéance la plus proche, sans échéance en dernier.
- Description : mise en forme simple (gras, italique, titres, listes à puces et numérotées, liens) par une barre d'outils ; 20 000 caractères au plus ; ni tableau ni image.
- Responsable qui quitte l'initiative, en est retiré ou passe lecteur : l'action garde son responsable, signalé ; un propriétaire ou contributeur peut la réattribuer.
- Initiative archivée : ses actions n'apparaissent dans « Mes actions » que si l'on filtre sur elle.
- Statuts libres (une action terminée ou annulée peut être rouverte) ; échéance quelconque, même passée.

Points à valider :
- Titre d'une action : 200 caractères au plus (limite non précisée, choisie par analogie avec les autres champs).
- À échéance égale, la plus ancienne créée apparaît d'abord.
- Un responsable passé **lecteur** reste membre : il voit encore l'action dans « Mes actions » (en lecture seule). Un membre qui a quitté l'initiative ne la voit plus.
- Mise en forme : la description est enregistrée en Markdown simplifié ; la barre d'outils insère les marques (`**gras**`, `## titre`…) et un bouton « Aperçu » montre le rendu. Les liens sont limités à http, https et mailto.
- Suppression « tant qu'elle n'est liée à rien » : aucun objet ne se lie encore à une action ; le refus (« passez-la au statut Annulée ») est prêt pour les tickets qui ajouteront ces liens.
- Mobile : non traité (ticket 17).
