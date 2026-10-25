# ADR-0005 — Identité : Keycloak du socle, un realm par application

- **Statut** : accepté
- **Date** : 2026-10-24

## Décision

Keycloak du socle, un realm dédié à cette application (base d'utilisateurs cloisonnée). Connexion par identifiant et mot de passe, Google et Microsoft. Un rôle « administrateur » au niveau de l'application ; les écrans d'administration des comptes sont dans l'application et pilotent Keycloak par son API d'administration. NestJS et PowerSync vérifient le même jeton OIDC (JWKS). La configuration du realm est livrée sous forme de fichier d'import JSON versionné : rien n'est configuré à la main.

## Mise en œuvre dans le modèle

- `keycloak/realm.json` : clients `web` et `mobile` (publics, PKCE), audience `api`, rôle `administrateur`, fournisseurs Google et Microsoft désactivés tant que leurs identifiants sont vides.
- `keycloak/comptes-test.json` : comptes alice, bruno, chloe, admin et client `tests`. **Importé uniquement en local** (option `--comptes-test`).
- Le realm est appliqué par le socle (`appliquer-realm.sh`, outil keycloak-config-cli, idempotent).
- Les écrans d'administration des comptes ne sont pas dans le modèle : ils seront réalisés par ticket dans chaque application (le décorateur `@RequireAppRole('administrateur')` est prêt).
