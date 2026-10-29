# 05: Écrans d'administration des comptes (ADR-0005)

**What to build:** L'administrateur gère les comptes depuis l'application, qui pilote Keycloak. Lorsqu'une initiative n'a plus de propriétaire actif, il y désigne un nouveau propriétaire parmi les membres, sans accéder à son contenu.

**Blocked by:** 02 — Coque de navigation

**Status:** done (à valider par la responsable fonctionnelle)

- [x] Seul un utilisateur ayant le rôle administrateur accède aux écrans d'administration.
- [x] L'administrateur liste les comptes, en crée un, le désactive et le réactive ; un compte n'est jamais supprimé, pour garder la trace des auteurs.
- [x] L'administrateur voit les initiatives sans propriétaire actif (nom, code, membres), et rien d'autre de leur contenu.
- [x] Sur une initiative sans propriétaire actif, l'administrateur désigne un nouveau propriétaire parmi les membres ; la désignation est tracée comme au ticket 04.
- [x] L'administrateur n'a accès au contenu d'aucune initiative dont il n'est pas membre (vérifié sur les deux barrières).
- [x] Tous les libellés existent en français et en anglais (ADR-0013).

Précisions de la responsable fonctionnelle (29.10.2026) :
- « Propriétaire actif » : propriétaire dont le compte n'est pas désactivé. Une initiative est sans propriétaire actif quand tous ses propriétaires ont un compte désactivé.
- L'administrateur peut désigner un propriétaire même sur une initiative archivée (sinon elle resterait orpheline).
- Création d'un compte : identifiant, e-mail, prénom, nom et un mot de passe temporaire, que l'administrateur communique à la personne ; elle le change à sa première connexion. Aucun envoi d'e-mail.
- L'administrateur donne ou retire le rôle administrateur à un autre compte ; il ne peut ni se désactiver lui-même, ni se retirer le rôle.
- Nouveau propriétaire désigné par l'administrateur : tout membre au compte actif (contributeur ou lecteur).
- ACTA pilote Keycloak par un compte technique (client `api-admin`) : l'administrateur n'a pas de droits dans la console Keycloak, la suppression d'un compte n'est donc possible nulle part.

Précisions de la responsable fonctionnelle (29.10.2026, après revue) :
- L'application garde toujours au moins un administrateur actif. L'auteur d'un changement doit être encore administrateur actif dans Keycloak, même si son jeton est plus ancien.
- Un compte désactivé ne peut pas être invité dans une initiative.
- Le mot de passe temporaire fait au moins 6 caractères.
- Acceptés tels quels : délai de 5 minutes au plus pour la désactivation et le changement de rôle ; droit `manage-users` du compte technique `api-admin`.

Points en suspens :
- Le socle génère le secret du compte technique (`socle/scripts/appliquer-realm.sh`) : modification à reporter dans le dépôt du socle (et dans `modele-application` si utile).
