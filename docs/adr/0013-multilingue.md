# ADR-0013 — Multilingue : interface et référentiel en français et en anglais

- **Statut** : accepté
- **Date** : 2026-10-25

## Contexte

ACTA s'adresse à des business analysts sans orientation sectorielle ni géographique. La langue de référence du BABOK est l'anglais ; la traduction française officielle existe. Options envisagées : français seul ; interface traduite seule ; traduction de tout le contenu, y compris le contenu saisi.

## Décision

Deux langues disponibles : français et anglais. Chaque utilisateur choisit sa langue d'interface. L'interface et le référentiel BABOK (ADR-0012) existent dans les deux langues. En français, le terme anglais du BABOK est visible en info-bulle. Le contenu saisi par les utilisateurs (exigences, comptes rendus, etc.) reste dans la langue où il a été écrit et n'est jamais traduit.

## Conséquences

- Tout libellé de l'interface et toute donnée de référence (référentiel BABOK, listes de valeurs) doit exister dans les deux langues avant livraison.
- Les valeurs ajoutées par l'administration (par exemple de nouveaux statuts d'exigence) doivent être saisies dans les deux langues.
- Une même initiative peut contenir du contenu en plusieurs langues.
