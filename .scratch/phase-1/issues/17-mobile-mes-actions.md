# 17: Mobile : Mes actions et saisie rapide

**What to build:** Sur le mobile, en mode connecté, le BA consulte ses actions et en crée une rapidement, par exemple à la sortie d'un atelier.

**Blocked by:** 07 — Actions et « Mes actions »

**Status:** à valider par la responsable fonctionnelle

- [x] L'écran d'accueil mobile est « Mes actions », avec les mêmes filtres que sur le web.
- [x] Une Action s'ouvre en plein écran, glissée depuis le bas.
- [x] Un bouton « + Action » permet la création rapide (initiative, titre, tâche BABOK).
- [x] La langue d'interface est celle choisie sur le compte.
- [x] Mode connecté uniquement : la synchronisation hors ligne reste désactivée (périmètre à définir).

Réalisation :
- Mobile : « Mes actions » est l'écran d'accueil, avec les filtres du web (statuts, À faire et En cours par défaut ; initiative, toutes par défaut) ; filtrage et tri par `selectMyActions` (shared). « Mes initiatives » reste accessible par un second onglet.
- Une action touchée s'ouvre en plein écran, glissée depuis le bas (fenêtre `Modal` de React Native), en consultation : statut, tâche, technique, responsable, échéance, parties prenantes, besoins, exigences, description mise en forme, création et modification. Le bouton retour d'Android ou « Fermer » la referme.
- Bouton flottant « + Action » : création rapide (initiative, titre, tâche BABOK) ; initiatives proposées et tâche présélectionnée selon les règles du web ; responsable : la personne qui crée ; la fiche de l'action créée s'ouvre ensuite.
- Langue : celle du compte, appliquée à la connexion (déjà en place) ; en français, le terme anglais du BABOK suit le nom entre parenthèses (ADR-0013 : le mobile n'a pas d'info-bulle).
- Mode connecté seulement : « Mes actions » et la création passent toujours par l'API, même si la synchronisation hors ligne est activée ; PowerSync n'a ni table ni écriture d'action.
- Shared : `toggleActionStatus` (filtre des statuts), `canCreateActionIn` (initiatives proposées à la création) et `memberName`, désormais utilisés aussi par le web ; avec tests.
- Aucune route ni table nouvelle : routes et guards du ticket 07, déjà couverts par `scripts/roles/`.

Points à valider (choix de présentation non demandés) :
- La fiche d'une action est en consultation seulement sur le mobile : on ne peut pas encore y changer le statut, le responsable, l'échéance ni la description (à faire depuis le web). Faut-il permettre la modification sur le mobile ?
- Pas de choix de technique à la création rapide (le ticket demande initiative, titre, tâche) ; elle s'ajoute depuis le web.
- Tâche BABOK : les tâches proposées en tête, puis toutes les tâches groupées par domaine de connaissance, à toucher.
- Onglets « Mes actions » / « Mes initiatives » en haut de l'écran ; le bouton « + Action » est visible sur les deux.
