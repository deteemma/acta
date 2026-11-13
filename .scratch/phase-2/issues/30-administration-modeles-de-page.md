# 30: Administration : modèles de page

**What to build:** L'administrateur consulte les modèles, désactive ceux qui ne servent pas, et ajoute ses propres modèles.

**Blocked by:** 27 — Créer une page depuis un modèle

**Status:** ready-for-human (réalisé, à valider par la responsable fonctionnelle)

Règles : décisions [09](09-modeles-de-page.md) (point 6) et [14](14-ecrans-d-administration.md) (points 1 et 3).

- [x] Onglet « Modèles de page » : liste par domaine de connaissance, mention « livré » ou « ajouté », état actif ou désactivé.
- [x] Modèle ouvert en panneau, un onglet par langue : lecture seule si livré, éditeur de page si ajouté, sans image.
- [x] Modèle ajouté : nom et contenu dans les deux langues, tâche BABOK facultative ; modifiable, désactivable, supprimable seulement s'il n'a jamais servi.
- [x] Modèle livré : se désactive, ne se modifie pas. Modèle désactivé : plus proposé, pages existantes inchangées.
- [x] Réservé à l'administrateur ; `scripts/roles/` à jour ; libellés dans les deux langues.

## Réalisation

**Choix validés par la responsable fonctionnelle le 13.11.2026, avant la réalisation** (règles que les décisions 09 et 14 ne fixaient pas) :
1. Le nom d'un modèle ajouté est unique dans chaque langue, parmi tous les modèles, livrés compris ; majuscules et accents ignorés.
2. Le contenu est obligatoire dans chaque langue : au moins un mot.
3. Un modèle désactivé, livré ou ajouté, se réactive.
4. La tâche BABOK d'un modèle ajouté se change ; les pages déjà créées gardent la leur.

**À trancher par la responsable fonctionnelle : choix que les décisions ne fixent pas.** Ils sont réalisés ainsi en attendant, et faciles à changer :
5. **Pas de référence dans un modèle** : l'éditeur d'un modèle n'a ni le bouton « Image » (décision 14) ni le bouton « Référence », et `#` n'ouvre pas la liste des références, puisqu'un modèle ne porte aucune donnée d'une initiative (décision 09, point 3). Le texte reste libre.
6. **Ordre de la liste** : celui de « Nouvelle page » (domaines dans l'ordre du référentiel, puis tâches, puis noms) ; les modèles sans tâche à la fin, sous « Autres modèles ». Les désactivés restent à leur place, avec la mention « Désactivé ».
7. **Mention « a servi »** sur un modèle ajouté depuis lequel une page a été créée, même supprimée depuis : il ne se supprime plus. Le bouton « Supprimer » n'apparaît que pour un modèle ajouté qui n'a jamais servi, sans demande de confirmation (comme pour les types de ticket).
8. **Boutons du panneau** : « Désactiver » / « Réactiver » pour tout modèle ; « Enregistrer » et « Supprimer » pour un modèle ajouté. Après « Ajouter le modèle », le panneau s'ouvre sur le modèle ajouté.
9. **Panneau d'un modèle livré** : la tâche BABOK, puis, dans chaque onglet de langue, le nom et le contenu tels que la page les reprendra.

**Vérifié.**
- Règles dans `shared/src/page-template-admin.ts` (ajout, modification, désactivation, suppression, contenu sans image et d'au moins un mot, noms uniques) et `page-templates.ts` (liste de l'administration, désactivés compris) : 6 nouveaux tests ; la suite complète passe (363 tests partagés, 2 web).
- `scripts/roles/25-administration-des-modeles-de-page.mjs`, API et base : administration refusée à alice, bruno et chloé ; schéma (nom vide, contenu vide ou sans mot, image, nom trop long, tâche manquante) ; nom d'un modèle livré refusé, accents et majuscules ignorés ; tâche inconnue ; ajout, modification (nom, contenu, tâche), désactivation et réactivation d'un modèle ajouté ; modèle désactivé refusé à la création d'une page ; modèle livré ni modifié ni supprimé, mais désactivé puis réactivé, sans changer la page créée avec lui ; suppression d'un modèle ajouté jamais utilisé ; en base, modèle « utilisé » non supprimable même après la suppression de la page, et page inchangée quand le modèle change. Ce qui ferait servir un modèle ajouté n'est fait que dans une transaction annulée : rien ne reste dans la base de développement. L'ensemble de `scripts/tester-roles.sh` passe.
- Écran vérifié dans Chrome avec le compte de test `admin` : onglet « Modèles de page », modèle livré ouvert (onglets Français / English, lecture seule), ajout d'un modèle (refus quand l'anglais manque, puis ajout), suppression de ce modèle.

**Technique.**
- Migration `0030` : indicateur `used` sur `page_template` (posé par le déclencheur à la création d'une page), contrôles du contenu (au moins un mot, sans image) et des noms, fonctions `admin_*` (seconde barrière). Le compte applicatif n'écrit toujours pas directement dans la table.
- Routes : `GET`/`POST /admin/page-templates`, `PATCH`/`DELETE /admin/page-templates/<modèle>`.

**Limites connues.**
- La base refuse deux noms qui ne diffèrent que par les majuscules, mais pas par les seuls accents (« Etat » et « État » ajoutés au même instant par deux administrateurs) ; l'API, elle, les refuse. Même limite qu'au ticket 29.
