# 24: Modification simultanée d'une page

**What to build:** Si la page a changé depuis son ouverture, l'enregistrement est refusé sans rien perdre, et la personne choisit quoi faire.

**Blocked by:** 23 — Enregistrements et versions

**Status:** ready-for-agent

Règles : décisions [07](07-modele-de-la-page.md) (point 6) et [08](08-editeur-de-page.md) (point 9).

- [x] Refus décidé côté serveur, à partir de l'enregistrement sur lequel la saisie est basée, sans verrou, y compris quand deux enregistrements arrivent en même temps.
- [x] Bandeau au-dessus de la saisie : qui a modifié et à quelle heure. Saisie intacte.
- [x] Boutons « Comparer avec ma saisie », « Enregistrer ma saisie à la suite », « Abandonner ma saisie et prendre la sienne ».
- [x] L'enregistrement de l'autre personne reste dans l'historique dans tous les cas.
- [x] Le même refus s'applique depuis « Enregistrer » de l'alerte du ticket 15 : la sortie est annulée, le panneau reste ouvert.
- [x] Test de bout en bout avec deux sessions ; libellés dans les deux langues.

## Réalisation

**À trancher par la responsable fonctionnelle : choix que les décisions 07 et 08 ne fixent pas.** Ils sont réalisés ainsi en attendant, et faciles à changer :
1. **Même personne.** La décision 07 dit « enregistrée par quelqu'un d'autre » ; le ticket dit « si la page a changé ». Le refus s'applique quel que soit l'auteur de l'enregistrement intervenu entre-temps : une personne qui a la page ouverte dans deux onglets, ou qui restaure un enregistrement pendant sa saisie, voit le bandeau « modifiée par [elle-même] ». Sinon, l'un de ses deux onglets effacerait l'autre sans rien dire.
2. **Ce qui compte comme un changement.** Tout nouvel enregistrement : modification du titre ou du contenu, restauration. Un déplacement, un réordonnancement, une déclaration de version après coup, une note corrigée ou un enregistrement supprimé ne refusent rien.
3. **Case « Enregistrer comme version N » seule**, sans changement du titre ni du contenu : refusée elle aussi si la page a changé, pour ne pas déclarer comme version un état que la personne n'a pas vu.
4. **« Enregistrer ma saisie à la suite »** enregistre la saisie entière, titre et contenu, même si la personne n'a changé que le titre : « ses ajouts disparaissent de la page » (décision 08, point 9). Si un nouvel enregistrement arrive encore entre-temps, le bandeau se met à jour et le choix se repose.
5. **« Abandonner ma saisie et prendre la sienne »** quitte l'écriture et affiche la page dans son état actuel, sans demande de confirmation ; « Modifier » repart de cet état.
6. **« Comparer avec ma saisie »** ouvre la comparaison dans le bandeau, sous les boutons, de son enregistrement vers la saisie (ajouts surlignés, suppressions barrées, mêmes règles que la comparaison du ticket 23). Le même bouton devient « Masquer la comparaison ».
7. **Qui et quand.** Le bandeau donne le dernier enregistrement intervenu (si plusieurs, le plus récent), avec sa date et son heure : « modifiée par Bruno Contributeur le 12 novembre 2026 à 10:12 ».
8. **Sans verrou.** Personne ne bloque la page pendant sa saisie. Côté serveur, deux enregistrements de la même page passent l'un après l'autre, le temps d'une écriture (moins d'une seconde), pour que le second soit refusé à coup sûr.

**Vérifié.**
- Règle dans `shared/src/page-revisions.ts` (`checkPageSaveBase`) : 3 tests. La modification d'une page exige désormais l'enregistrement sur lequel la saisie est basée (`baseRevisionId`).
- Test de bout en bout à deux sessions, alice et bruno (`scripts/roles/21-modification-simultanee.mjs`, 8 contrôles) : refus 409 avec qui et quand ; aucun enregistrement écrit par le refus ; « à la suite » accepté, l'enregistrement de l'autre reste dans l'historique avec son contenu ; version refusée sur une saisie dépassée ; restauration qui refuse, déplacement qui ne refuse pas ; cinq fois deux enregistrements envoyés en même temps sur la même base : toujours un accepté, un refusé, un seul enregistrement de plus.
- À l'écran (Chrome, une seule personne avec deux onglets) : le bandeau et ses trois boutons, la comparaison, l'historique, et le refus depuis « Enregistrer » de l'alerte du ticket 15 (sortie annulée, saisie intacte). Une page « Essai ticket 24 » est restée dans l'initiative ISSUE14 de la base locale. Libellés anglais non essayés à l'écran.

**Technique.**
- L'API prend le verrou de transaction déjà utilisé pour les enregistrements de la page (`page_revisions:<page>`), puis compare l'enregistrement actuel à la base envoyée ; le refus renvoie la page dans son état actuel (`PageChangedSinceBody`).
- Pas de seconde barrière en base : il ne s'agit pas d'un droit (ADR-0006), et une modification faite directement en SQL ne passe pas par une saisie.
- ADR-0004 (synchronisation hors-ligne, « le dernier qui écrit gagne ») : les pages suivent désormais une autre règle. À reprendre avant le hors-ligne mobile, qui n'écrit pas encore de pages.
