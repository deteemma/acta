# 21: Pièces jointes des tickets

**What to build:** On joint des fichiers à un ticket, tout membre les ouvre ou les télécharge, et une limite par initiative protège la base.

**Blocked by:** 18 — Types de ticket livrés et Epics

**Status:** done (validé par la responsable fonctionnelle le 09.11.2026)

Règles : décision [10](10-pieces-jointes.md), ADR-0014.

- [x] Stockage en base sous RLS ; 10 Mo par fichier ; liste de formats acceptés, contrôlée côté serveur, refus avec message. HTML et SVG refusés.
- [x] Limite par initiative de 500 Mo, valeur lue dans un paramètre (réglage au ticket 31) ; occupation visible par les membres.
- [x] Images et PDF s'ouvrent dans l'application, les autres formats se téléchargent, sans jamais exécuter le contenu d'un fichier.
- [x] Liste : nom, format, taille, auteur, date ; renommer garde l'extension ; suppression avec confirmation et ligne de trace.
- [x] Initiative archivée : ouvrir et télécharger seulement. Suppression avec le ticket. Rien sur le téléphone.
- [x] Surveiller la mémoire de l'API (384 Mo par défaut, `compose.yaml`) avec plusieurs envois de 10 Mo simultanés.
- [x] Nouvel ADR : absence d'antivirus, risque accepté par la responsable fonctionnelle (décision 10, point 3).
- [x] Règles dans `shared/`, avec tests ; deux barrières dans `scripts/roles/` ; libellés dans les deux langues.

## Réalisation

**Choix que la décision 10 ne fixe pas, validés par la responsable fonctionnelle le 09.11.2026** : refus des formats Office à macros, format reconnu à l'extension seule, et présentation (unités, ordre de la liste, ajout de plusieurs fichiers sans glisser-déposer, fichier vide accepté, nom de 255 caractères au plus sans « / » ni « \ »). Ticket validé dans l'application le même jour.

1. **Extensions acceptées**, pour chaque famille de la décision : PDF `.pdf` ; Word `.doc` `.docx` ; Excel `.xls` `.xlsx` ; PowerPoint `.ppt` `.pptx` ; OpenDocument `.odt` `.ods` `.odp` `.odg` ; texte `.txt` ; CSV `.csv` ; Markdown `.md` ; images `.png` `.jpg` `.jpeg` `.gif` `.webp` ; BPMN `.bpmn` ; draw.io `.drawio` ; Visio `.vsd` `.vsdx` ; courriels `.eml` `.msg`. Les formats Office **à macros** (`.docm`, `.xlsm`, `.pptm`…) sont refusés, comme des programmes. Le format est reconnu à l'extension du nom ; le contenu n'est pas examiné.
2. **Unités** : 10 Mo = 10 × 1 024 × 1 024 octets ; 500 Mo de même. Tailles affichées en o, Ko, Mo ou Go, à une décimale.
3. **Section « Pièces jointes »** sur la fiche de tout ticket, Action comprise, entre les commentaires et l'historique (décision 11, point 5). Le titre porte le nombre de fichiers, sans compter les lignes de trace. Liste du plus ancien au plus récent ; sous chaque nom : « Format · taille · Nom, le <date et heure> ».
4. **Ouvrir** : cliquer le nom d'une image ou d'un PDF l'ouvre dans une visionneuse par-dessus la fiche (« Fermer » ou Échap) ; un bouton « Télécharger » reste proposé pour ces fichiers. Cliquer le nom d'un autre fichier le télécharge.
5. **Ajouter** : bouton « Joindre des fichiers », plusieurs fichiers à la fois, envoyés l'un après l'autre ; un fichier refusé est signalé par son nom et le motif, sans bloquer les autres. Pas de glisser-déposer. Un rappel sous le bouton liste les formats acceptés et la taille maximale. Un fichier vide est accepté.
6. **Occupation** sous la liste : « Pièces jointes de l'initiative : 12,3 Mo sur 500 Mo ».
7. **Renommer** sur place : on saisit le nom sans l'extension, affichée à côté et fixe ; 255 caractères au plus en tout, sans « / » ni « \ ».
8. **Supprimer** après une confirmation qui précise que le fichier ne pourra pas être retrouvé ; ligne de trace en italique : « Fichier X supprimé par Y le <date et heure> ».
9. **Préparation des tickets 26 et 31** : la table des fichiers accepte déjà une page (colonne sans route ni écran, comme pour les commentaires au ticket 20) ; la limite est lue dans un paramètre que le ticket 31 rendra réglable.
10. **PDF** : affiché par le lecteur intégré du navigateur dans la visionneuse. Le navigateur refuse d'afficher un PDF dans un cadre totalement isolé ; c'est donc son lecteur qui isole les éventuels scripts d'un PDF de l'application (ADR-0020).

**Vérifié.** Tests de `shared/src/attachments.test.ts` et `shared/src/roles.test.ts` ; `scripts/roles/19-pieces-jointes.mjs` (API et base, chaque rôle, administrateur non membre, formats refusés, 10 Mo, limite de l'initiative atteinte puis libérée, renommage, suppression, ticket supprimé, initiative archivée) et l'ensemble de `scripts/tester-roles.sh` passent. Écrans non vérifiés dans le navigateur par l'agent : l'extension Chrome n'était pas disponible pendant la réalisation.

**Mémoire de l'API** (limite 384 Mo), fichiers de 10 Mo au contenu aléatoire, envoyés puis téléchargés en même temps :

| Transferts simultanés | Pic mesuré | Durée des envois |
|---|---|---|
| 8 | 226 Mo | 2,2 s |
| 16, sans file d'attente | 342 Mo | 3,9 s |
| 16, 4 à la fois en base | 194 Mo | 7,6 s |

L'API mène donc au plus 4 transferts de contenu à la fois avec la base ; les suivants attendent leur tour, sans refus. Le conteneur n'a jamais été arrêté par manque de mémoire.

**Technique.** Migration `0024` : table `attachment`, rattachée à un ticket ou à une page (exactement l'un des deux, de la même initiative, supprimés avec lui), prête pour le ticket 26 ; table `app_settings` (une ligne, `attachment_quota_mb` = 500, entre 10 et 1 024), lisible par tous, réglée au ticket 31. La base écrit l'auteur, les dates et la taille, refuse un format non accepté, plus de 10 Mo, un changement d'extension et le dépassement de la limite (sous un verrou propre à l'initiative, pour deux envois simultanés) ; elle ne remplace jamais le contenu. Supprimer met le contenu à null : la ligne reste, la place est libérée. Pas de déclencheur sur le ticket : rien dans l'historique. Table absente de la publication PowerSync, donc du téléphone. Contenu envoyé brut (`application/octet-stream`, refusé par Fastify au-delà de 10 Mo), servi avec `nosniff`, une CSP `sandbox` et, hors images et PDF, comme `application/octet-stream` à télécharger. Routes : `GET`/`POST /initiatives/<id>/tickets/<ticket>/attachments` (`?name=`), `GET /initiatives/<id>/attachments/<fichier>/content`, `PATCH`/`DELETE /initiatives/<id>/attachments/<fichier>` ; permission `editAttachments` (propriétaire et contributeur). ADR-0020 : absence d'antivirus.
