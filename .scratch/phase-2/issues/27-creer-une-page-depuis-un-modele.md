# 27: Créer une page depuis un modèle

**What to build:** « Nouvelle page » propose une page vide ou un modèle par domaine de connaissance. La page reprend le plan du modèle, dans la langue de son auteur, et affiche sa tâche BABOK.

**Blocked by:** 22 — Pages : arborescence et écriture

**Status:** done (validé par la responsable fonctionnelle le 12.11.2026)

Règles : décision [09](09-modeles-de-page.md) (points 3, 4, 7, 8, 9).

- [x] Modèles en base, valables pour toute l'application : nom et contenu en français et en anglais, tâche BABOK, mention « livré » ou « ajouté », état actif. Livrés avec deux modèles d'essai ; le contenu réel arrive au ticket 28.
- [x] Titre prérempli et modifiable, page ouverte en écriture, créée au premier enregistrement ; un modèle sert autant de fois qu'on veut.
- [x] Contenu copié une fois pour toutes, dans la langue d'interface de l'auteur ; modifier le modèle ne touche aucune page.
- [x] La page garde la mention de son modèle d'origine, sous le nom qu'il portait, et affiche sa tâche BABOK. La fiche de la tâche retrouve ces pages.
- [x] La page ne rend pas la tâche couverte et ne change pas les suggestions : un test le garantit.
- [x] Réservé aux propriétaires et aux contributeurs ; `scripts/roles/` à jour ; libellés dans les deux langues.

## Réalisation

**Choix que la décision 09 ne fixe pas, validés par la responsable fonctionnelle le 12.11.2026 :**
1. « Nouvelle page », comme « Sous-page » et le bouton + de l'arborescence, ouvre d'abord un écran de choix : « Page vide » en premier, puis les modèles actifs sous le nom de leur domaine de connaissance. Chaque modèle affiche aussi sa tâche.
2. Ordre : les domaines dans l'ordre du référentiel, puis les tâches, puis le nom du modèle par ordre alphabétique dans la langue de l'interface.
3. Un modèle sans tâche (possible seulement pour un modèle ajouté, ticket 30) est rangé à la fin, sous « Autres modèles ».
4. Les deux modèles d'essai s'appellent « Approche de l'analyse métier (essai) » (tâche 3.1) et « Description de l'état actuel (essai) » (tâche 6.1). Leurs textes sont provisoires et non relus : ils servent à essayer, le ticket 28 les remplace.
5. La mention s'affiche sous le titre de la page : « Modèle : … · Tâche BABOK : 3.1 … ». Un clic sur la tâche ouvre sa fiche.
6. La fiche de la tâche liste, sous « Pages créées depuis un modèle de cette tâche », les pages de toutes mes initiatives, archivées comprises, par référence. Une ligne rappelle qu'une page ne rend pas la tâche couverte. Un clic ouvre l'écran Pages sur la page.
7. La langue de la page est celle de l'interface au moment où l'on choisit le modèle. Changer de langue pendant la saisie ne la change pas.

**Vérifié.**
- Règles dans `shared/` (`page-templates.ts`), avec tests : regroupement, ordre, modèles désactivés absents, choix du modèle à la création, modèle et tâche non modifiables ensuite.
- Les deux barrières, avec les comptes de test (`scripts/roles/20-modeles-de-page.mjs`) :
  - tout utilisateur lit les modèles ; contributeur et propriétaire créent une page depuis un modèle, en français puis en anglais, avec le même modèle ; lectrice refusée ; non-membre refusé ; initiative archivée refusée ;
  - le nom et la tâche sont posés et figés par la base, quoi que demande la requête ; modèle inconnu refusé ;
  - la fiche de la tâche retrouve les pages, sans celles des initiatives dont on n'est pas membre ;
  - après création de pages des tâches 3.1 et 6.1, aucune tâche n'est couverte au calcul du tableau de bord, et les suggestions sont identiques (R1, sur la tâche 3.1, reste proposée) ;
  - le compte applicatif ne modifie ni ne supprime aucun modèle, administrateur compris.
- Claude n'a pas pu ouvrir https://acta.localhost dans Chrome (page d'erreur, probablement le certificat local). Ticket validé dans l'application par la responsable fonctionnelle le 12.11.2026.

**Limites connues.**
- Le contenu est copié par le web, puisqu'on peut le modifier avant le premier enregistrement. Un appel direct à l'API pourrait envoyer un autre contenu que celui du modèle ; la base vérifie seulement que le nom repris est l'un de ceux du modèle.
- Désactiver un modèle et en ajouter : ticket 30. Les 22 modèles : ticket 28.

**Technique.**
- La migration `0025` crée la table `page_template`, en lecture seule pour le compte applicatif, et ajoute à `page` le modèle d'origine, son nom et la tâche. Un modèle qui a servi ne se supprime pas (clé étrangère).
- Adresses de l'API : `GET /page-templates` et `GET /babok/tasks/<tâche>/pages`.
