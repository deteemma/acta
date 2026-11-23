# Normes de code

Lues par la revue (`/code-review`, axe « Standards »). Ce que vérifient déjà
`pnpm lint` (dont la RLS de chaque table et l'accès à la base), `pnpm typecheck`
et `pnpm test` n'est pas repris ici.

## Architecture

- **ADR** : `docs/adr/` fait foi. Un écart à un ADR est une violation, même
  si le code fonctionne ; la correction est le code, ou un nouvel ADR validé,
  jamais la modification d'un ADR existant.
- **Règles métier, rôles, schémas de validation** : écrits une seule fois dans
  `shared/`, importés par l'API, le web et le mobile. Une règle recopiée dans
  `api/` ou `web/` (une condition, une liste de valeurs, un refus) est une
  violation.
- **Socle** : le module ne le connaît que par les variables de `.env`
  (ADR-0007). Aucun nom d'hôte, de realm ni de base du socle écrit en dur.

- **Formulaire de saisie** (web et téléphone) : déclaré par `useUnsavedForm`
  (`web/src/unsaved-changes.tsx`, `mobile/src/unsaved-changes.tsx`), avec tous ses
  champs, pour que le quitter déclenche l'alerte de modification non enregistrée.
  Sur le web, une sortie passe par `useScreens().goTo` (autre élément, onglet ou
  initiative) ou par `useDialogs().close` (fenêtre de dialogue) ; jamais par un
  changement d'état local qui contournerait l'alerte.

## Permissions (ADR-0006, double barrière)

- Chaque route d'une ressource d'initiative porte son guard
  (`@RequireInitiativeRole(...)`, ou `@RequireAppRole` pour l'administration),
  avec la permission de `shared/src/roles.ts` qui correspond à l'action.
- Chaque nouvelle table a des politiques RLS qui reproduisent les mêmes droits
  que le guard : lecture par les membres, écriture par les rôles prévus,
  initiative archivée en lecture seule.
- Toute requête métier tourne dans le rappel de `DatabaseService.asUser()`
  (ou `asAdmin()`), sur son `tx` ; aucun `tx` conservé au-delà du rappel.
- `scripts/roles/` couvre la nouvelle ressource sur les deux barrières (API et
  base), pour chaque rôle et pour l'initiative archivée.
- Un contrôle de `scripts/roles/` ne porte que sur les lignes que sa section a
  créées (ses initiatives, ses tickets). La base locale contient aussi les
  données de validation de la responsable fonctionnelle : un contrôle sur toute
  une table (« aucune initiative n'a… ») échoue dès qu'elle s'en sert.

## Langues

- Identifiants de code en anglais ; commentaires, messages et libellés en
  français ; libellés affichés passés par `shared/src/i18n.ts` (blocs `fr` et `en`).
- Les termes métier suivent le glossaire `CONTEXT.md` : même mot en français
  dans les libellés, même traduction anglaise dans les identifiants.
