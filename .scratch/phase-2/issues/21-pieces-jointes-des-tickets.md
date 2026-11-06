# 21: Pièces jointes des tickets

**What to build:** On joint des fichiers à un ticket, tout membre les ouvre ou les télécharge, et une limite par initiative protège la base.

**Blocked by:** 18 — Types de ticket livrés et Epics

**Status:** ready-for-agent

Règles : décision [10](10-pieces-jointes.md), ADR-0014.

- [ ] Stockage en base sous RLS ; 10 Mo par fichier ; liste de formats acceptés, contrôlée côté serveur, refus avec message. HTML et SVG refusés.
- [ ] Limite par initiative de 500 Mo, valeur lue dans un paramètre (réglage au ticket 31) ; occupation visible par les membres.
- [ ] Images et PDF s'ouvrent dans l'application, les autres formats se téléchargent, sans jamais exécuter le contenu d'un fichier.
- [ ] Liste : nom, format, taille, auteur, date ; renommer garde l'extension ; suppression avec confirmation et ligne de trace.
- [ ] Initiative archivée : ouvrir et télécharger seulement. Suppression avec le ticket. Rien sur le téléphone.
- [ ] Surveiller la mémoire de l'API (384 Mo par défaut, `compose.yaml`) avec plusieurs envois de 10 Mo simultanés.
- [ ] Nouvel ADR : absence d'antivirus, risque accepté par la responsable fonctionnelle (décision 10, point 3).
- [ ] Règles dans `shared/`, avec tests ; deux barrières dans `scripts/roles/` ; libellés dans les deux langues.
