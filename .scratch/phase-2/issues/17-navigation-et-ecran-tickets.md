# 17: Navigation et écran Tickets

**What to build:** Sous l'initiative, une entrée « Tickets » affiche en pleine page un tableau filtrable et triable de ses tickets. La fiche s'ouvre en panneau à côté. L'adresse du navigateur suit l'écran.

**Blocked by:** 16 — Ticket générique et passage de l'Action

**Status:** ready-for-human (réalisé, à valider par la responsable fonctionnelle)

Règles : décisions [11](11-ecrans-des-tickets.md) (points 1 à 3, 5, 8) et [13](13-coexistence-de-la-navigation.md). Référence visuelle : variante B de la branche `prototype/ecrans-des-tickets`.

- [x] Clic sur une initiative : fiche en panneau et entrée dépliée, une seule initiative à la fois. « Mes actions » et « Tickets » remplacent l'écran principal et ferment les panneaux, avec l'alerte du ticket 15 si besoin.
- [x] Tableau : colonnes, tri par défaut et sur chaque colonne, filtres et état « ouverts » par défaut ; responsable qui n'est plus membre et échéance dépassée signalés ; ligne du ticket ouvert mise en évidence.
- [x] Le panneau ouvert ne doit pas rendre le tableau illisible : les captures du prototype montrent des titres écrasés. Solution à proposer à la validation. *Proposition ci-dessous, à valider.*
- [x] Adresse : recharger reste sur l'écran ; non-membre : refus. Le bouton « Précédent » du navigateur revient à l'écran d'avant, avec l'alerte du ticket 15 s'il y a une saisie non enregistrée.
- [x] Panneau d'initiative : section « Actions » inchangée ; ligne « Tickets » avec son nombre et un bouton vers l'écran. « + Action » reste partout.
- [x] Palette : trouve les tickets par référence et par titre ; une référence de ticket citée dans un texte mène à sa fiche.
- [x] Petit écran : liste compacte sur deux lignes, fiche pleine largeur. Lecteur et initiative archivée : lecture seule.
- [x] Filtrage et tri dans `shared/`, avec tests. Libellés en français et en anglais.

## Réalisation

**Proposition pour le tableau à côté du panneau (à valider).** Le titre reste toujours sur une ligne, entier dans son info-bulle et dans la fiche. Quand la largeur manque, les colonnes s'effacent une à une, dans cet ordre : Epic, Type, Responsable, Échéance. Référence, Titre et Statut restent, sauf si le panneau est très élargi à la main : Statut puis Référence cèdent alors la place, seul le titre reste toujours. La règle suit la largeur réellement disponible : elle vaut aussi sans panneau, et élargir ou replier la barre latérale ou le panneau fait revenir les colonnes. Conséquence : une colonne effacée emporte son signalement (échéance dépassée, responsable), que la fiche ouverte montre.

**Choix à confirmer, non tranchés par les décisions 11 et 13** :
- un ticket sans valeur (sans échéance, sans responsable) reste en dernier dans les deux sens de tri. Le prototype n'était pas homogène sur ce point ;
- Statut et Type se trient sur leur libellé affiché, comme dans le prototype, donc par ordre alphabétique et non dans l'ordre du cycle de vie ;
- sur l'écran Tickets, sans panneau ouvert, « + Action » propose l'initiative de l'écran ;
- ouvrir une fiche d'initiative par la palette déplie aussi son entrée ;
- cliquer l'entrée de l'écran déjà affiché ferme les panneaux, sans ajouter d'étape à « Précédent » ;
- une adresse inconnue mène à « Mes actions », tout comme l'écran Tickets d'une initiative que l'on vient de supprimer ou de quitter ;
- entre 40 et 80rem de large (tablette, petite fenêtre), la fiche s'ouvre par-dessus le tableau et non à côté, comme tous les panneaux depuis la refonte : la place manque pour les deux ;
- le filtre Responsable ne propose que les responsables présents dans la liste, anciens membres compris ; le prototype listait tous les membres, dont le choix aurait donné une liste vide.

**En attendant le ticket 18.** Seul le type Action existe : le filtre Type n'a qu'une valeur, la colonne Epic reste vide et le filtre Epic ne propose que « Sans Epic ». « Sans responsable » ne trouve rien, car une Action a toujours un responsable. Le nombre de la ligne « Tickets » égale donc celui de la section « Actions ». « Nouveau ticket », la création rapide et le regroupement par Epic relèvent du ticket 18.

**Technique.** L'adresse est `/initiatives/<identifiant>/tickets`, sans bibliothèque de routage : l'écran est lu dans l'adresse (`shared/src/screens.ts`) et l'historique du navigateur est suivi par `web/src/screens.tsx`. Après une connexion, on revient à l'écran demandé. Les références de tickets sont renvoyées par `/references`. Pas de migration.
