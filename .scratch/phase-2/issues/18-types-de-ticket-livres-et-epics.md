# 18: Types de ticket livrés et Epics

**What to build:** On crée et suit des Questions, Décisions, Risques, Demandes de changement et Epics, chacun avec ses champs et ses statuts. Un ticket appartient à un Epic ; la liste peut se regrouper par Epic.

**Blocked by:** 17 — Navigation et écran Tickets

**Status:** done (validé par la responsable fonctionnelle le 08.11.2026)

Règles : décisions [01](01-modele-commun-du-ticket.md), [03](03-types-de-ticket-et-statuts-parametrables.md) et [11](11-ecrans-des-tickets.md) (points 4 à 7).

- [x] Types, statuts, familles, statuts fermés et acronymes livrés ; catégories visibles dans l'onglet des références. Le type ne change plus après la création.
- [x] Champs propres : parties prenantes interrogées (Question), probabilité et impact (Risque). Une partie prenante interrogée ne se supprime plus.
- [x] « Nouveau ticket » en panneau, type en premier champ, champs selon le type. Création rapide type et titre, pas pour l'Action.
- [x] Fiche en panneau, sur une colonne, dans l'ordre du point 5 ; historique pour tous les types.
- [x] Epic : un ticket y entre, en change ou en sort ; pas d'Epic dans un Epic ; fiche avec ses tickets et le nombre de fermés ; suppression refusée s'il contient des tickets.
- [x] Option d'affichage « regrouper par Epic » : en-têtes avec progression et « + Ticket », groupe « Sans Epic ». Jamais montrée avec le tableau dans le prototype : à faire vérifier en priorité.
- [x] Suppression définitive d'un ticket sans lien, référence jamais réutilisée. Les suggestions, la couverture, le tableau de bord, les alertes et « Mes actions » ne voient toujours que les Actions.
- [x] Règles dans `shared/`, avec tests ; `scripts/roles/` à jour ; libellés dans les deux langues.

## Réalisation

**Choix que les décisions 01, 03 et 11 ne fixent pas, validés avec le ticket le 08.11.2026 :**
1. Regroupement et filtres : un Epic écarté par les filtres reste en en-tête tant qu'un de ses tickets est montré ; sinon il disparaît, donc avec le filtre par défaut (« ouverts ») un Epic fermé et vide n'apparaît pas. Un Epic ouvert et vide reste visible, pour pouvoir y ajouter un ticket.
2. La progression d'un en-tête compte tous les tickets de l'Epic, sans tenir compte des filtres.
3. Les Epics sont rangés par référence, quel que soit le tri choisi ; le tri s'applique aux tickets de chaque groupe.
4. Le filtre « Sans Epic » ne montre pas les Epics eux-mêmes, qui ne peuvent pas en avoir.
5. Type présélectionné : Action dans « Nouveau ticket », Question dans la création rapide.
6. Un ticket peut rejoindre un Epic fermé : aucune règle ne l'interdit.

**Vérifié dans l'application** (Chrome, compte de test, 07.11.2026) : regroupement avec le tableau, avec et sans fiche ouverte, à 1700, 1100, 850 et 420 px de large. La vérification a révélé un défaut, corrigé : l'en-tête de groupe s'étendait sur les colonnes effacées et écrasait le titre ; il s'étend maintenant sur les colonnes visibles. Vérifié ensuite par la responsable fonctionnelle, qui a validé le ticket le 08.11.2026.

**Limites connues.**
- Fiche d'une Action : besoins et exigences liés restent dans le formulaire, avant la description, et non après les auteurs et dates comme le veut le point 5. Le ticket 19 (Liens) les déplace.
- « + Action » et « Nouvelle action » d'une fiche gardent leur panneau de création rapide, sans champ Epic (ticket 17 : « + Action » reste partout) ; l'Action rejoint alors un Epic depuis sa fiche.
- La création rapide est au-dessus de l'écran, hors des panneaux : un titre saisi n'y déclenche pas l'alerte de modification non enregistrée.
- Une Action liée à une partie prenante concernée reste non supprimable (décision 02, point 2 : la partie prenante ne se supprime pas, et le refus existant vaut aussi pour l'Action). À l'inverse, les parties prenantes interrogées partent avec la Question supprimée (décision 01, point 6, qui ne les compte pas parmi les liens).
- Le téléphone ne change pas : il continue d'utiliser les adresses `/actions` et ne voit que les Actions.

**Technique.** Migration `0019` : mêmes tables, type et statut contrôlés par la base, responsable et tâche facultatifs hors Action, `epic_id` et `question_stakeholder`. Les états d'historique existants sont complétés, pour qu'aucune modification fictive n'apparaisse à la prochaine écriture. L'Action garde ses adresses ; les autres types passent par `/initiatives/<id>/tickets`. Sur la copie de développement, les acronymes QU, DE, RI, DC et EP étaient libres ; s'ils sont pris ailleurs, la migration s'arrête pour que la responsable fonctionnelle tranche.
