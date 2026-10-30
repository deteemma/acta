# 08: Parties prenantes

**What to build:** Le BA tient la liste des parties prenantes d'une initiative et les positionne sur la matrice influence × intérêt. Une fiche peut être reliée au compte de l'utilisateur correspondant ; une Action peut être liée à des parties prenantes.

**Blocked by:** 07 — Actions et « Mes actions »

**Status:** à valider par la responsable fonctionnelle

- [x] Une fiche porte : nom, nature (personne, groupe, organisation), un ou plusieurs rôles BABOK parmi les 11 (§2.4), influence et intérêt (faible, moyen, fort), coordonnées (texte libre), notes.
- [x] Une fiche peut être reliée à un compte utilisateur ; un utilisateur est relié à au plus une fiche par initiative, et peut l'être dans plusieurs initiatives.
- [x] La liste des parties prenantes et la matrice influence × intérêt sont consultables ; un clic sur une partie prenante ouvre sa fiche en panneau.
- [x] Une Action peut être liée à une ou plusieurs parties prenantes ; la fiche d'une partie prenante affiche ses actions liées.
- [x] Une partie prenante ne peut être supprimée que si elle n'est liée à rien.
- [x] Toute nouvelle table partagée a ses politiques RLS (migration SQL) et ses guards NestJS ; `scripts/tester-roles.mjs` couvre les deux barrières pour propriétaire, contributeur, lecteur et non-membre.
- [x] Tous les libellés existent en français et en anglais (ADR-0013).

Réalisation :
- Migration `0011_parties_prenantes.sql` : table `stakeholder` (nature, rôles BABOK en tableau, influence, intérêt, coordonnées, notes, compte relié, unique par initiative) et table de liens `action_stakeholder` ; RLS (tout membre consulte ; propriétaires et contributeurs écrivent ; archivée : lecture seule) ; déclencheur qui impose auteurs et dates et vérifie le compte relié à chaque liaison. Liens en clés étrangères NO ACTION : une partie prenante ou une action liée ne se supprime pas, la suppression de l'initiative emporte tout.
- API : `GET|POST /api/initiatives/:id/stakeholders` ; `GET|PATCH|DELETE /api/initiatives/:id/stakeholders/:stakeholderId` (guards `view` / `editStakeholders`) ; `stakeholderIds` à la création et à la modification d'une action, `stakeholders` dans chaque action renvoyée.
- Règles dans shared : `stakeholders.ts` (schémas, 11 rôles, matrice, comptes reliables, refus), `stakeholderIds` dans `actions.ts`, permission `editStakeholders` dans `roles.ts`, avec tests.
- Web : section « Parties prenantes » dans la fiche Initiative, panneau « Liste et matrice » (liste ; matrice 3 × 3, influence forte en haut, intérêt fort à droite ; « À positionner » dessous) ; fiche en panneau (création, modification, actions liées, auteurs, suppression) ; cases « Parties prenantes » dans la fiche d'une action. En français, nom anglais des rôles BABOK en info-bulle.
- `scripts/tester-roles.mjs` étendu aux deux barrières pour propriétaire, contributeur, lectrice et non-membre : tous les contrôles passent.

Précisions de la responsable fonctionnelle (30.10.2026) :
- Créer, modifier, supprimer une partie prenante et la lier à une action : propriétaire et contributeurs ; lecteurs : consultation ; initiative archivée : lecture seule.
- Compte relié : un membre de l'initiative, quel que soit son rôle. S'il quitte l'initiative ou en est retiré, le lien reste, signalé.
- Influence et intérêt facultatifs : les parties prenantes non positionnées figurent à part, sous la matrice.
- Une action liée à des parties prenantes ne se supprime pas (statut Annulée, ou retirer les liens).
- Le compte relié ne bloque pas la suppression d'une fiche ; seules les actions liées (et plus tard les autres objets).
- Nom non unique dans l'initiative, 200 caractères au plus.
- Coordonnées : texte libre, 1 000 caractères ; notes : mises en forme comme la description d'une action, 20 000 caractères.
- Dates de création et de modification conservées avec leur auteur.
- Noms français des 11 rôles (§2.4) : Analyste métier, Client, Expert métier du domaine, Utilisateur final, Expert de la mise en œuvre, Support opérationnel, Chef de projet, Régulateur, Sponsor, Fournisseur, Testeur.

Points à valider :
- Modifier les parties prenantes liées à une action compte comme une modification de l'action (auteur et date de dernière modification mis à jour).
- Matrice : une partie prenante n'y figure que si influence **et** intérêt sont renseignés.
- Mobile : non traité.
