# Documentation du domaine

Comment les skills d'ingénierie lisent la documentation métier de ce dépôt.

Organisation : **un seul contexte**. Le dépôt a plusieurs paquets (`api`, `web`, `mobile`, `shared`) mais un seul domaine métier, donc un seul glossaire et un seul dossier d'ADR.

## Avant d'explorer, lire

- **`CONTEXT.md`** à la racine : c'est le glossaire du projet (français ↔ identifiants anglais). Partout où un skill parle de `GLOSSARY.md`, lire `CONTEXT.md`. Ne pas créer de `GLOSSARY.md`.
- **`docs/adr/`** : lire les ADR qui touchent la zone concernée.

Si un de ces fichiers manque, **continuer sans le signaler**. Le skill `/domain-modeling` les complète au fil de l'eau, quand un terme ou une décision est tranché.

## Structure

```
/
├── CONTEXT.md          ← glossaire
├── docs/adr/
│   ├── 0000-modele-adr.md
│   ├── 0001-topologie.md
│   └── …
├── api/  web/  mobile/  shared/
```

## Employer le vocabulaire du glossaire

Quand un livrable nomme un concept métier (titre de ticket, proposition de refactorisation, hypothèse, nom de test), employer le terme défini dans `CONTEXT.md` : en français dans la documentation et les tickets, l'identifiant anglais dans le code. Ne pas dériver vers les synonymes marqués _À éviter_.

Si le concept n'est pas encore dans le glossaire, c'est un signal : soit le langage est inventé (à reconsidérer), soit il manque réellement un terme (à noter pour `/domain-modeling`). Ne jamais inventer une règle de gestion : poser la question à la responsable fonctionnelle.

## Signaler les conflits avec un ADR

Si un livrable contredit un ADR existant, le dire explicitement plutôt que de passer outre :

> _Contredit l'ADR-0006 (permissions), mais mérite d'être rouvert parce que…_

Les ADR `0001` à `0011` sont non négociables : ne jamais les modifier ; proposer un nouvel ADR (gabarit `0000-modele-adr.md`) et attendre une validation explicite.
