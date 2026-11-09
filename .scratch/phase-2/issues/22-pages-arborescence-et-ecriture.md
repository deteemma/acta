# 22: Pages : arborescence et écriture

**What to build:** Sous l'initiative, une entrée « Pages » affiche l'arborescence et le document en pleine page. On y crée une page vide, on l'écrit avec Tiptap, on la déplace et on la supprime.

**Blocked by:** 17 — Navigation et écran Tickets

**Status:** done (validé par la responsable fonctionnelle le 09.11.2026)

Règles : décisions [07](07-modele-de-la-page.md) (points 1 à 3, 7, 8), [08](08-editeur-de-page.md) (points 1 à 4, 6, 7), [13](13-coexistence-de-la-navigation.md), ADR-0019. Le prototype de l'éditeur a été supprimé le 07.11.2026 : plus de référence visuelle, les règles ci-dessus font foi.

- [x] Tiptap déclaré en dépendance, en version fixée et sortie depuis au moins deux semaines ; code chargé à la demande ; barre d'outils sur les tokens de design.
- [x] Contenu enregistré en JSON : vérifier en priorité l'affichage en lecture seule, jamais prototypé, et le retour à « non modifié » après une annulation (alerte du ticket 15). Refaire les essais de fidélité : `# Budget 2027`, `2026. Une année`, `a < b & c`. *Vérifié hors navigateur, voir ci-dessous ; reste à voir à l'écran.*
- [x] Référence `CODE-PA-NNN` ; catégorie visible dans l'onglet des références. La page n'existe, avec sa référence, qu'au premier enregistrement.
- [x] Limite de 200 000 caractères comptée sur le texte. Références : saisie par `#` et par le bouton, restent du texte, reliées à leur objet.
- [x] Arborescence : profondeur illimitée, ordre libre, déplacement avec les sous-pages par glissement, avec une solution au clavier ; pas sous soi-même. Glissement non vérifié dans le prototype. *Proposition pour le clavier ci-dessous.*
- [x] Suppression refusée si la page a des sous-pages ou des liens. *Sous-pages : fait. Liens : les liens d'une page n'existent pas encore, le refus est reporté au ticket 25.*
- [x] Adresse : suit l'écran Pages et la page ouverte ; lien partageable, refus pour un non-membre. Panneau d'initiative : ligne « Pages ». Palette : pages par référence et titre.
- [x] Petit écran : arborescence au-dessus du document. Lecteur et initiative archivée : lecture seule.
- [x] Règles dans `shared/`, avec tests ; deux barrières dans `scripts/roles/` ; libellés dans les deux langues.

## Réalisation

**Proposition pour le clavier (à valider).** Dans l'arborescence, les flèches haut et bas parcourent les pages, Entrée ouvre la page. Alt + flèche haut ou bas la fait monter ou descendre parmi ses sœurs ; Alt + flèche droite la range sous la page sœur précédente, en dernier ; Alt + flèche gauche la remonte d'un niveau, juste après sa parente. Les mêmes quatre déplacements sont aussi des boutons « Déplacer » en bas de la page ouverte : ils servent au doigt sur téléphone, où l'on ne peut pas glisser.

**À trancher par la responsable fonctionnelle : choix que les décisions 07, 08 et 13 ne fixent pas.** Ils sont réalisés ainsi en attendant, et faciles à changer :
1. Glissement : le haut de la ligne correspond au premier tiers de sa hauteur. Une page déposée sur le reste devient la dernière sous-page. Aucune zone ne permet de déposer une page en dernier au premier niveau : on y arrive avec « Descendre » ou Alt + flèche bas.
2. Déplacer ou réordonner une page ne change ni l'auteur ni la date de sa dernière modification, qui suivent le titre et le contenu.
3. « Annuler », dans la barre d'enregistrement, passe par l'alerte habituelle si la saisie a changé ; sinon, la page revient aussitôt en lecture. Après « Enregistrer », la page revient aussi en lecture.
4. Une nouvelle page s'ouvre après son premier enregistrement. Une page supprimée laisse l'écran Pages sans page ouverte.
5. `#` propose les références de toutes mes initiatives, huit au plus : celles de l'initiative de la page d'abord, la page elle-même exclue.
6. Une référence de page, dans la palette ou citée dans un texte, ouvre l'écran Pages sur elle et ferme les panneaux, même si elle appartient à une autre initiative. Une page n'a pas de fiche en panneau.
7. Une adresse web tapée dans le texte devient un lien ; un lien n'accepte que les adresses http, https et mailto. Maj + Entrée fait un retour à la ligne sans changer de paragraphe.
8. L'arborescence est toujours entièrement dépliée.
9. Une page dont on a tout effacé est enregistrée sans contenu. Elle affiche « Cette page n'a pas encore de contenu ».

**Réponses de la responsable fonctionnelle (09.11.2026).**
- Choix 2 à 9 : validés tels que réalisés.
- Choix 8 (arborescence toujours dépliée) : validé pour ce ticket. Pouvoir replier une branche est un besoin à reprendre plus tard, hors de la phase 2.
- Choix 1 et clavier : **Alt + flèche bas ne fonctionne pas** à l'essai.
  - Cause, reproduite dans Chrome : dans l'arborescence d'essai, « Page 1 » est seule au premier niveau et « Page 1.1 » est sa seule sous-page. Chaque page y était déjà la dernière parmi ses sœurs : la règle « descendre parmi ses sœurs » ne faisait rien, et le clavier ne le disait pas.
  - Décision : une sous-page déjà dernière de son niveau sort avec Alt + flèche bas et se place juste après sa parente ; déjà première, elle sort avec Alt + flèche haut et se place juste avant sa parente. Les boutons « Monter » et « Descendre » suivent la même règle.
  - Un déplacement impossible au clavier affiche un message sous l'arborescence, par exemple « « Page 1.1 » est déjà la dernière page du premier niveau ». Le message s'efface à la touche suivante.
- Raccourcis de frappe (écart vu à l'écran le 09.11.2026) : en tapant `# Budget 2027`, la ligne devenait un titre, et `2026. Une année` une liste. Décision : la frappe ne transforme jamais le texte ; la mise en forme passe par la barre d'outils et Ctrl+B, Ctrl+I. Une adresse web tapée ou collée devient toujours un lien.

**Vérifié.**
- Les deux barrières, avec les comptes de test (`scripts/roles/15-pages.mjs`), pour chaque rôle et pour l'initiative archivée : création au premier enregistrement avec la référence PA, contenu JSON relu à l'identique, limite de 200 000 caractères, mise en forme non prévue refusée, déplacement avec les sous-pages, refus sous soi-même ou vers une autre initiative, refus de supprimer une page qui a des sous-pages, palette, non-membre refusé.
- Le schéma de l'éditeur, hors navigateur, avec un script ponctuel. Il compte exactement les éléments de mise en forme admis par `shared/`. Les trois textes d'essai traversent l'éditeur sans changer : `# Budget 2027` reste du texte et ne devient pas un titre, `2026. Une année` ne devient pas une liste, et `a < b & c` est gardé sans entité HTML. Une frappe suivie d'une annulation revient au JSON de départ, donc la page compte comme « non modifiée ».
- **À l'écran, dans Chrome (09.11.2026)**, avec le compte de test propriétaire :
  - Lecture seule : `a < b & c` est affiché tel quel ; les références sont reliées à leur objet. L'initiative archivée affiche le bandeau, sans « Nouvelle page ».
  - Les trois textes d'essai restent intacts tapés et collés, après la correction des raccourcis de frappe.
  - « Annuler » après une saisie ouvre l'alerte. Une frappe annulée par Ctrl+Z, puis « Annuler » : retour en lecture sans alerte.
  - Alt + flèches : les quatre déplacements, la sortie d'une sous-page par le haut et par le bas, et le message quand le déplacement est impossible. La page déplacée garde le focus.
  - Suppression : refusée avec le message quand la page a une sous-page ; acceptée après confirmation sinon.
  - Petit écran, 390 pixels de large : arborescence au-dessus du document, sans défilement horizontal. Boutons « Déplacer » utilisables.
  - Glissement : vérifié en rejouant les événements du navigateur par script, car l'extension ne sait pas faire un vrai glisser-déposer. Le haut de la ligne place avant, le reste fait une sous-page, les sous-pages suivent, le dépôt sous soi-même est refusé.
- Ticket validé par la responsable fonctionnelle le 09.11.2026, avec les corrections ci-dessus.

**Limites connues.**
- Bouton « Image » : ticket 26. Case « Enregistrer comme version N » et historique : ticket 23. Modification simultanée : ticket 24. Liens et refus de suppression d'une page liée : ticket 25.
- L'application mobile n'affiche pas les pages : seul le navigateur du téléphone le fait (décision 13, point 7).

**Technique.**
- La migration `0020` crée la table `page`, avec la référence PA. La base vérifie la même initiative pour la page parente, l'absence de boucle dans l'arborescence et la limite de texte.
- Tiptap 3.32.0 est fixé exactement, toutes ses dépendances `@tiptap` comprises.
- L'éditeur forme un fichier à part (153 Ko compressés), chargé à la première écriture. La lecture affiche le JSON sans charger Tiptap.
- Les adresses de l'écran sont `/initiatives/<id>/pages` et `/initiatives/<id>/pages/<page>`.
- La page en écriture est gardée par l'alerte comme un panneau : changer de page, d'écran, faire « Précédent » ou se déconnecter la déclenche.
- L'API accepte maintenant des requêtes de 8 Mo au plus, pour qu'une page de 200 000 caractères mise en forme puisse passer.
