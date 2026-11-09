# 23: Enregistrements et versions

**What to build:** Chaque enregistrement d'une page est conservé. On déclare des versions, on compare, on restaure et on supprime depuis un historique en volet.

**Blocked by:** 22 — Pages : arborescence et écriture

**Status:** done (validé par la responsable fonctionnelle le 09.11.2026)

Règles : décisions [07](07-modele-de-la-page.md) (points 4 et 5) et [08](08-editeur-de-page.md) (points 6 et 8).

- [x] Enregistrement conservé si le titre ou le contenu change ; déplacer ou réordonner n'en crée pas.
- [x] Case « Enregistrer comme version N » et note de 500 caractères ; déclaration après coup, seulement après la dernière version ; numéros jamais réattribués ; note corrigeable.
- [x] La page affiche sa dernière version et signale les modifications depuis. Aucune version à la création.
- [x] Historique en volet : versions mises en évidence, filtre « versions seulement », ouverture d'un enregistrement ; tout membre le consulte.
- [x] Comparaison de deux enregistrements dans un seul texte, sur le texte extrait du JSON, sans fausse différence d'espaces.
- [x] Restauration : nouvel enregistrement, sans version. Suppression sauf le dernier, avec confirmation et ligne de trace.
- [x] Le JSON des anciens enregistrements reste lisible après une montée de version de Tiptap (ADR-0019) : un test le garantit.
- [x] Règles dans `shared/`, avec tests ; deux barrières dans `scripts/roles/` ; libellés dans les deux langues.

## Réalisation

**À trancher par la responsable fonctionnelle : choix que les décisions 07 et 08 ne fixent pas.** Ils sont réalisés ainsi en attendant, et faciles à changer :
1. **Version supprimée et déclaration après coup.** Une version supprimée compte encore comme « dernière version » : un enregistrement plus ancien qu'elle ne peut plus être déclaré. Ainsi, les numéros restent dans l'ordre chronologique de tout l'historique, traces comprises. Exemple : versions 1 et 2, puis la version 2 est supprimée ; un enregistrement placé entre les deux ne devient pas la version 3.
2. **Version supprimée et affichage.** La page affiche sa dernière version *encore présente*. Dans l'exemple du choix 1, elle affiche « Version 1 · Modifiée depuis la version 1 », alors que la prochaine version portera le numéro 3. Les choix 1 et 2 vont dans des sens différents : à trancher ensemble.
3. **Trace d'une version supprimée.** La ligne de trace garde l'étiquette « Version N », pour que le trou dans la numérotation (1, 3, 4) s'explique.
4. **Case cochée sans modification.** Cocher « Enregistrer comme version N » sans rien changer déclare l'enregistrement actuel comme version. S'il en est déjà une, l'enregistrement est refusé avec le message « Cet enregistrement est déjà une version ».
5. **Restaurer.** Le bouton n'apparaît pas sur l'enregistrement actuel ; l'API refuse aussi cette restauration. Restaurer un enregistrement dont le titre et le contenu sont identiques à l'état actuel (une page passée par A, B, puis de nouveau A) ne crée aucun enregistrement, puisque rien ne change (décision 07, point 4) ; un message le dit. Cela s'écarte de « restaurer crée un nouvel enregistrement » (même point) : à trancher.
6. **Restaurer ou supprimer** se fait depuis l'enregistrement ouvert. La restauration ne demande pas de confirmation, la suppression si. Le bouton « Supprimer » n'apparaît pas sur le dernier enregistrement.
7. **Comparaison.**
   - On coche deux enregistrements dans l'historique, puis « Comparer les deux » ; en cocher un troisième remplace le plus ancien coché. Un enregistrement ouvert propose aussi « Comparer avec l'état actuel ». La comparaison va toujours du plus ancien au plus récent.
   - Le titre est comparé au-dessus du contenu, et seulement s'il a changé.
   - Une liste ou un titre s'y lit comme du texte, sans puce ni numéro. Les paragraphes vides ne comptent pas : en ajouter ou en retirer n'est pas une différence.
   - Au-delà de 1 000 différences dans un même passage, celui-ci s'affiche entièrement supprimé puis entièrement ajouté, pour que la comparaison reste immédiate.
8. **Note de version.** Une note vide ou faite seulement d'espaces est retirée. La note se corrige depuis l'enregistrement ouvert.
9. **Pages existantes.** À la mise à jour, l'état actuel de chaque page devient son premier enregistrement, avec l'auteur et la date de sa dernière modification, sans version.
10. **Place de l'historique.** Le bouton « Historique » ouvre le volet à droite pour tout membre. Sur un écran de moins de 1 024 pixels de large, le volet passe sous la page. Le volet est masqué pendant l'écriture et revient après « Enregistrer » ou « Annuler ».

**Vérifié.**
- Règles dans `shared/src/page-revisions.ts` : 15 tests, numérotation, déclaration, suppression, état affiché, texte comparé, comparaison mot à mot sans différence d'espaces, temps de comparaison de deux textes de 30 000 mots entièrement différents.
- Les deux barrières, avec les comptes de test (`scripts/roles/16-enregistrements-de-page.mjs`), pour chaque rôle et pour l'initiative archivée. Le contrôle couvre :
  - l'enregistrement créé par la base, même pour une modification faite en SQL, mais pas pour un déplacement ;
  - la version à l'enregistrement et après coup ;
  - le refus avant la dernière version, et le refus d'un numéro faux ;
  - la note de 500 caractères au plus, et la note refusée sur un simple enregistrement ;
  - la restauration sans version, et le refus de restaurer l'état actuel ;
  - la suppression avec trace (titre et contenu retirés), le refus de supprimer le dernier enregistrement, une trace qui ne change plus ;
  - le contenu d'un enregistrement figé ;
  - les enregistrements emportés avec la page.
- JSON de Tiptap : `web/src/page-content-tiptap-3.32.0.json` est figé ; c'est ce qu'écrit Tiptap 3.32.0 pour chaque élément de mise en forme admis. Le test `web/src/page-content-compat.test.ts` vérifie que l'éditeur actuel le relit sans rien perdre. Lancé par `pnpm --filter web test`, en CI et avant chaque commit. S'il échoue après une montée de version, les enregistrements doivent être migrés (ADR-0019) ; il ne faut pas régénérer le fichier. Les images y seront ajoutées avec le ticket 26.
- Ticket validé par la responsable fonctionnelle le 09.11.2026, avec les choix 1 à 10 tels que réalisés. L'essai à l'écran est le sien : l'extension Chrome n'était pas disponible pendant la session de réalisation.

**Technique.**
- La migration `0021` crée la table `page_revision`. Une version est un enregistrement qui porte un numéro, d'où une seule table (le glossaire nomme la notion `page_version`). Un déclencheur sur `page` écrit l'enregistrement ; un autre, sur `page_revision`, n'y laisse changer que le numéro de version, la note et la suppression.
- Supprimer un enregistrement retire son titre, son contenu et sa note, et garde la ligne, avec qui l'a supprimé, quand, et son numéro de version.
- Concurrence : les numéros et les suppressions d'une même page passent l'un après l'autre (verrou). Le refus d'enregistrer une page modifiée entre-temps relève du ticket 24.
