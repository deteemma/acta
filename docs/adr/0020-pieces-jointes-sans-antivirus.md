# ADR-0020 — Pièces jointes sans analyse antivirus

- **Statut** : accepté
- **Date** : 2026-11-05

## Contexte

Depuis la phase 2, les membres d'une initiative partagent des pièces jointes,
stockées dans la base (ADR-0014). Le socle ne fournit que Caddy, PostgreSQL et
Keycloak (ADR-0007) : aucun service d'analyse antivirus. Options envisagées :
ajouter un antivirus au socle (type ClamAV, avec ses mises à jour de signatures) ;
analyser les fichiers dans l'API ; ne rien analyser et réduire le risque par
d'autres moyens.

## Décision

Aucun fichier n'est analysé par un antivirus, ni à l'envoi ni au
téléchargement. Risque accepté pour la phase 2 par la responsable fonctionnelle
(décision « Pièces jointes », point 3, du 05.11.2026).

Le risque est réduit, sans être supprimé, par :

- une liste fixe de formats acceptés (décision « Pièces jointes », point 2),
  contrôlée par l'API et par la base ; programmes, archives, HTML et SVG refusés ;
- 10 Mo au plus par fichier, et une limite par initiative ;
- un contenu jamais exécuté par l'application : seuls les images et le PDF
  s'ouvrent dans l'application, sous le type de leur format, jamais celui que
  déclare le fichier ; tout autre format se télécharge comme une suite d'octets.
  L'API sert le contenu avec `nosniff` et une CSP `sandbox`. Le PDF est affiché
  par le lecteur intégré du navigateur, qui isole ses éventuels scripts de
  l'application ;
- des fichiers visibles des seuls membres de l'initiative (ADR-0006).

## Conséquences

- Un fichier infecté d'un format accepté (un document Word piégé, par exemple)
  peut être partagé entre membres ; la protection repose alors sur le poste de
  chacun.
- Aucun service ni aucune mise à jour de signatures à maintenir dans le socle.
- À réexaminer si l'application s'ouvre à des personnes hors de l'équipe, ou si
  la liste des formats s'élargit : proposer alors un nouvel ADR.
