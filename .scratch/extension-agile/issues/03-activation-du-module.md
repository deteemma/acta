# 03: Activation du module sur une initiative

**What to build:** Le propriétaire d'une initiative active ou désactive l'Extension Agile depuis la fiche de l'initiative.

**Status:** done (validé par la responsable fonctionnelle le 22.11.2026)

Règles : [spécification](../spec.md), décisions D10 à D12.

- [x] Champ « Extension Agile : activée / désactivée » sur la fiche de l'initiative, modifiable par le propriétaire seul ; visible par tout membre (D11).
- [x] Désactivé à la création, absent du formulaire de création ; les initiatives existantes sont désactivées (D10).
- [x] Impossible de le changer sur une initiative archivée (D11).
- [x] Indépendant de l'approche d'analyse (D12).
- [x] Permissions vérifiées dans `scripts/roles/` (propriétaire, contributeur, lecteur, initiative archivée).

## Commentaires

**22.11.2026, Claude** : réalisé, à valider sur acta.localhost (image reconstruite).

- Migration `0036_activation_extension_agile.sql` : colonne « Extension Agile » sur l'initiative, désactivée par défaut, donc aussi pour toutes les initiatives existantes (D10). La base refuse le changement à tout autre que le propriétaire, et sur une initiative archivée (D11).
- Fiche de l'initiative, onglet Aperçu, sous les dates : le propriétaire choisit « Activée » ou « Désactivée » ; le contributeur et le lecteur voient la valeur sans pouvoir la changer. Sur une initiative archivée, la fiche est en lecture seule pour tous, la valeur comprise.
- Formulaire de création inchangé ; une demande de création qui contiendrait le champ l'ignore (D10).
- Aucun lien avec l'approche d'analyse, dans un sens comme dans l'autre (D12).
- Permissions vérifiées sur les deux barrières : `scripts/roles/32-activation-extension-agile.mjs` (propriétaire, contributeur, lectrice, initiative archivée).
- Le refus de désactivation quand des actions portent une technique agile (D13) viendra avec le ticket 04, qui crée le champ « Technique agile ».

Deux points ne sont pas dans la spécification. Merci de les confirmer ou de les corriger :

1. **Enregistrement.** Le choix s'enregistre avec le bouton « Enregistrer » de la fiche, comme les autres champs, et non dès le clic. Quitter la fiche sans enregistrer déclenche l'alerte habituelle.
2. **Téléphone.** Le champ n'apparaît pas sur le téléphone, ni en lecture ni en modification (la spécification ne prévoit sur le téléphone que la technique agile d'une action, D17).

**22.11.2026, responsable fonctionnelle** : enregistrement par le bouton « Enregistrer » et absence du champ sur le téléphone confirmés.

**22.11.2026, responsable fonctionnelle** : ticket validé.
