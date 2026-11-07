# Liens

Type: grilling
Status: resolved
Blocked by: 01

## Question

Quels liens un ticket peut-il porter, et comment ? Trancher :

- liens entre tickets : natures proposées (ex. « bloque / est bloqué par », « lié à », « duplique »), liste fixe ou paramétrable, sens du lien ;
- liens avec les besoins et les exigences : tout type de ticket ou certains seulement (l'Epic l'est déjà au glossaire ; l'Action a déjà `action_need`) ; reprise des liens existants ;
- liens avec les pages (le glossaire dit qu'une page « peut être rattachée à des tickets ») ;
- liens entre initiatives : interdits ?
- ce que devient un lien quand l'un des deux objets est supprimé.

## Réponse

Tranché avec la responsable fonctionnelle le 02.11.2026.

1. **Natures des liens entre tickets** : liste fixe, non paramétrable par l'administration :
   - « bloque » / « est bloqué par » : lien orienté, chaque côté affiche son libellé ;
   - « duplique » / « est dupliqué par » : lien orienté ;
   - « est lié à » : sans sens.

   Le blocage est purement informatif : il n'empêche ni de changer le statut ni de fermer un ticket bloqué.
2. **Un seul lien entre deux tickets**, quelle que soit sa nature ; un ticket ne se lie pas à lui-même. Pour changer de nature, retirer le lien puis en créer un autre. Règle retenue dans un premier temps : elle pourra être revue à l'usage.
3. **L'Epic n'est pas un lien** : l'appartenance à un Epic reste un champ du ticket (voir « Modèle commun du ticket »). Un Epic peut en plus être lié à d'autres tickets, avec les trois natures, comme tout ticket.
4. **Besoins et exigences** : tout type de ticket, y compris un type ajouté par l'administration, peut être lié à des besoins et à des exigences, sans nature de lien. Les liens actuels de l'action vers les besoins et les exigences sont repris tels quels. Le lien d'une Demande de changement vers l'exigence visée reste facultatif.
5. **Pages** : une page peut être liée à des tickets, des besoins et des exigences, sans nature de lien. Pas de lien explicite entre deux pages : l'arborescence et les liens écrits dans le texte suffisent (voir « Éditeur de page »).
6. **Entre initiatives** : interdit. Un lien relie toujours deux objets de la même initiative.
7. **Suppression** : un ticket, un besoin, une exigence ou une page qui porte au moins un lien ne se supprime pas ; il faut d'abord retirer ses liens (règle actuelle étendue). La suppression de l'initiative emporte tout.
8. **Droits et trace** : propriétaires et contributeurs créent et retirent les liens, depuis l'un ou l'autre des deux objets ; un lecteur consulte seulement ; aucun changement dans une initiative archivée. La création et le retrait d'un lien ne figurent dans aucun historique (ni celui du ticket, ni celui de l'exigence).

Glossaire `CONTEXT.md` mis à jour : Lien, Nature de lien, Besoin, Exigence, Epic, Page.
