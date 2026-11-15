# 04: Validation de syntaxe Gherkin

**What to build:** Tout membre demande la validation du texte d'un scénario ou du Contexte et voit « Syntaxe correcte » ou les erreurs avec leur ligne ; une bulle d'aide présente les règles.

**Blocked by:** 02 — Contexte et langue de la fonctionnalité

**Status:** ready-for-agent

Règles : [spécification](../spec.md), décisions D7, D11, D15, D17.

- [ ] Contrôles : grammaire Gherkin ; mots-clés de la seule langue de la fonctionnalité ; pour un scénario, au moins un « Quand » et un « Alors » ; pour un plan de scénario, chaque `<paramètre>` présent dans les Exemples (D15). Les éléments exclus par D7 sont des erreurs.
- [ ] Résultat : « Syntaxe correcte », ou chaque erreur avec son numéro de ligne et un message dans la langue de l'utilisateur ; rien n'est conservé (D15).
- [ ] La validation n'empêche jamais d'enregistrer (D11). Elle porte sur le texte affiché, même non enregistré.
- [ ] Bulle d'aide qui énonce ces règles, dans les deux langues (D15).
- [ ] Disponible pour tout membre, y compris lecteur et sur une initiative archivée (D17).
- [ ] Règles dans `shared/`, avec tests (un cas par règle, en français et en anglais). Si une bibliothèque d'analyse Gherkin est retenue, le dire dans la réalisation.
