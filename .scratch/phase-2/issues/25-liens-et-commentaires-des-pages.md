# 25: Liens et commentaires des pages

**What to build:** Une page se lie à des tickets, des besoins et des exigences, et reçoit des commentaires, en bas du document.

**Blocked by:** 19 — Liens ; 20 — Commentaires ; 22 — Pages : arborescence et écriture

**Status:** ready-for-agent

Règles : décisions [04](04-liens.md) (point 5) et [05](05-commentaires.md).

- [x] Liens sans nature, pas entre deux pages ni entre initiatives ; visibles sur la page et sur l'autre objet, hors historique.
- [x] Une page liée ne se supprime pas, un objet lié à une page non plus.
- [x] Commentaires sur la page entière, sans rattachement à un passage ni à un enregistrement ; ils restent après un nouvel enregistrement et disparaissent avec la page.
- [x] Mêmes droits et même trace qu'au ticket 20 ; deux barrières dans `scripts/roles/`.

## Réalisation

**À trancher par la responsable fonctionnelle : choix que les décisions 04 et 05 ne fixent pas.** Ils sont réalisés ainsi en attendant, et faciles à changer :
1. **Sur la page**, sous les auteurs et dates du document : la section « Liens » (tickets liés, besoins liés, exigences liées, chacun par référence), puis la section « Commentaires », puis les boutons « Déplacer » et « Supprimer la page ».
2. **Ajout depuis la page** : une liste « Lien » (Ticket, Besoin, Exigence ; « Ticket » par défaut), une liste « Avec », un bouton « Lier ». Aucune page n'est proposée, ni un objet déjà lié.
3. **Sur la fiche d'un ticket**, tout type : un groupe « Pages liées » dans la section « Liens » ; « Page » s'ajoute aux choix de la liste « Lien ».
4. **Sur les fiches de besoin et d'exigence** : une liste « Pages liées » sous « Tickets liés », avec son propre formulaire « Lier une page ».
5. **Retirer un lien** se fait d'un clic, sans confirmation, comme au ticket 19.
6. **Ouvrir une page liée** depuis un ticket, un besoin ou une exigence : l'écran Pages s'ouvre sur elle et les panneaux se ferment (ticket 22, choix 6).
7. **Page liée** : « Supprimer la page » affiche aussitôt le refus, sans demander de confirmation, comme pour une page qui a des sous-pages.
8. **Commentaires d'une page** : affichés sur la page ouverte, pas pendant l'écriture ni sur un ancien enregistrement ou une comparaison. Le petit texte sous la saisie dit que les commentaires portent sur la page entière, restent après un nouvel enregistrement et ne figurent pas dans l'historique de la page.

**Vérifié.**
- Règles dans `shared/src/links.ts` (`linksOfPage`, `pagesLinkedTo`, `linkCandidates`) et `shared/src/pages.ts` (`checkPageDelete`, refus `pageLinked`) : 5 tests de plus ; la suite complète passe (333 tests).
- `scripts/roles/22-liens-et-commentaires-des-pages.mjs`, API et base, chaque rôle et l'initiative archivée : liens vers un ticket, une action, un besoin, une exigence, créés depuis l'un ou l'autre objet ; doublon refusé ; lien entre deux pages impossible ; objets d'une autre initiative refusés ; aucun enregistrement de page, aucune entrée d'historique du ticket ni de l'exigence ; refus de supprimer la page et chacun des objets liés ; commentaires de page avec les droits du ticket 20, auteur devenu lecteur refusé par l'API et par la base ; fil intact après un nouvel enregistrement ; commentaires partis avec la page. L'ensemble de `scripts/tester-roles.sh` passe.
- Écrans non vérifiés dans le navigateur par l'agent : l'extension Chrome s'est déconnectée pendant la réalisation.
- Une initiative d'essai « Liens des pages » (code se terminant par `PL`) est restée dans la base locale, après un premier passage des tests de rôles interrompu.

**Technique.**
- Migration `0027` : tables `page_ticket`, `page_need` et `page_requirement`, une paire au plus (clé primaire), clés composites qui interdisent les liens entre initiatives et la suppression d'un objet lié ; RLS comme `ticket_link`. Aucune table pour un lien entre deux pages. Tables hors de la publication PowerSync.
- Routes : `POST /initiatives/<id>/links/pages` (page et objet `{ kind, id }`), `DELETE /initiatives/<id>/links/pages/<page>/<ticket|need|requirement>/<objet>`, permission `editLinks` ; `GET`/`POST /initiatives/<id>/pages/<page>/comments`, permissions `view` et `comment`. Modification et suppression d'un commentaire : routes du ticket 20, inchangées.
- `GET /initiatives/<id>/links` renvoie en plus `pageLinks`.
- Les refus de suppression d'un besoin, d'une exigence et d'une action citent désormais les pages.
