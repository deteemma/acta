# 29: Administration : types et statuts

**What to build:** L'administrateur ajoute des types de ticket et des statuts, sans toucher à ceux qui sont livrés.

**Blocked by:** 18 — Types de ticket livrés et Epics

**Status:** ready-for-agent

Règles : décisions [03](03-types-de-ticket-et-statuts-parametrables.md) (points 3, 6 à 10) et [14](14-ecrans-d-administration.md) (points 1 et 2).

- [x] Onglet « Types de ticket », sur le modèle de celui des statuts d'exigence : types avec leur acronyme ; déplier montre les statuts, leur famille et « fermé » ; formulaires d'ajout.
- [x] Type ajouté : libellés dans les deux langues, acronyme réservé à vie, au moins deux statuts dont un fermé ; il n'a que les champs communs et se lie comme tout ticket.
- [x] Renommer, désactiver et supprimer selon les règles ; refus du dernier statut fermé actif et du statut initial.
- [x] Types et statuts ajoutés proposés partout : création, création rapide, filtres, palette, références.
- [x] Réservé à l'administrateur, sans accès au contenu des initiatives ; `scripts/roles/` à jour ; libellés dans les deux langues.

## Réalisation

**Choix validés par la responsable fonctionnelle le 13.11.2026, avant la réalisation** (règles que les décisions 03 et 14 ne fixaient pas) :
1. Les libellés d'un statut ajouté sont uniques au sein de son type, dans chaque langue, accents et majuscules ignorés ; deux types différents peuvent avoir chacun un statut « Validé ».
2. L'acronyme d'un type ajouté se change ensuite dans l'onglet « Acronymes des références », comme celui des autres catégories ; l'ancien reste réservé à vie.
3. Un statut ajouté jamais porté ne se supprime pas s'il est le statut initial du type ou son dernier statut fermé actif (mêmes refus que pour la désactivation).

**À trancher par la responsable fonctionnelle : choix que les décisions ne fixent pas.** Ils sont réalisés ainsi en attendant, et faciles à changer :
4. **Premier statut fermé** : rien n'interdit qu'un type ajouté ait pour premier statut (statut initial) un statut fermé ; ses tickets naîtraient alors déjà fermés. Faut-il l'interdire ?
5. **Place du formulaire « Ajouter un type »** : sous la liste des types, et non dans un type déplié (la décision 14, point 2, les cite ensemble) ; « Ajouter un statut à … » est, lui, dans chaque type déplié.
6. **Familles proposées** pour un statut ajouté : neutre (par défaut), en cours, positif, attention, négatif ; « neutre atténué » reste réservé aux statuts livrés Annulée et Annulé.
7. **Boutons** : « Supprimer » n'apparaît que pour un type ou un statut jamais utilisé ; « Désactiver » reste visible sur le statut initial et le dernier fermé actif, et le refus s'affiche au clic.
8. **Filtres de l'écran Tickets** : le filtre « Type » propose tous les types, désactivés compris (leurs tickets restent dans la liste) ; le filtre « Statut » propose tous les statuts du type, désactivés compris. La création, la création rapide et le changement de statut ne proposent que les actifs (plus le statut actuel du ticket).
9. **« Mes actions »** (web et téléphone) : un statut ajouté à l'Action y apparaît comme bouton de filtre ; coché par défaut s'il n'est pas fermé. Le tableau de bord compte aussi les actions à ces statuts.

**Vérifié.**
- Règles dans `shared/src/ticket-type-catalog.ts` (types et statuts livrés, ajout, renommage, désactivation, suppression, ordre, libellés), et `tickets.ts`, `actions.ts`, `alerts.ts`, `dashboard.ts`, `suggested-actions.ts` qui lisent désormais la liste des types : 17 nouveaux tests ; la suite complète passe (357 tests partagés, 2 web).
- `scripts/roles/24-types-et-statuts-parametrables.mjs`, API et base : lecture par tout utilisateur connecté, administration refusée à alice, bruno et chloé ; schémas et refus (libellé pris, acronyme pris ou ancien, aucun statut fermé, libellé de statut en double) ; types et statuts livrés verrouillés ; statut ajouté à un type livré ; statut initial et dernier fermé actif ni désactivés ni supprimés ; type désactivé refusé à la création ; statut désactivé refusé, mais gardé par le ticket qui le porte ; type « utilisé » dès qu'un ticket en a été créé, même supprimé ensuite ; statut porté une fois non supprimable ; référence et statut initial d'un ticket de type ajouté ; initiative archivée ; acronyme changé dans l'onglet des références ; acronymes réservés après suppression. Les tickets d'un type ajouté ne sont créés qu'en base, dans une transaction annulée, pour ne rien laisser dans la base de développement. L'ensemble de `scripts/tester-roles.sh` passe.
- Écran vérifié dans Chrome avec le compte de test `admin` : onglet « Types de ticket », types livrés avec acronyme et mention « livré », Risque déplié (familles, « initial », « fermé »), formulaires d'ajout. Aucun type n'a été ajouté depuis l'écran (l'acronyme resterait réservé à vie dans la base de développement).

**Technique.**
- Migration `0029` : tables `ticket_type` et `ticket_status` (livrés et ajoutés, famille, « fermé », ordre, indicateur `used`), clés étrangères `ticket_type_fkey` et `ticket_status_fkey` sur `ticket` à la place des contrôles fixes ; le déclencheur pose le statut initial (premier du type), refuse un type ou un statut désactivé, et marque type et statut « utilisés ». Fonctions `admin_*` (seconde barrière). Un type ajouté est une catégorie de référence de plus, qui porte son code.
- Routes : `GET /ticket-types` (tout utilisateur connecté) ; `GET`/`POST /admin/ticket-types`, `PATCH`/`DELETE /admin/ticket-types/<type>`, `POST /admin/ticket-types/<type>/statuses`, `PATCH`/`DELETE …/statuses/<statut>`.
- Une catégorie de référence inconnue renvoie désormais 404 (au lieu de 400), puisque les catégories ne forment plus une liste fixe.

**Limites connues.**
- Le téléphone lit la liste des types en mode connecté. Sans réponse, il retombe sur les types livrés : un statut ajouté à l'Action s'afficherait alors par son code et serait traité comme ouvert. Le hors-ligne reste le dernier chantier.
- Sur le web, entre l'ouverture de l'application et la première lecture de la liste (un instant), un statut ajouté s'affiche par son code.
