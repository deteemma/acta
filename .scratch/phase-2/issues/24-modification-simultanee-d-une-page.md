# 24: Modification simultanée d'une page

**What to build:** Si la page a changé depuis son ouverture, l'enregistrement est refusé sans rien perdre, et la personne choisit quoi faire.

**Blocked by:** 23 — Enregistrements et versions

**Status:** ready-for-agent

Règles : décisions [07](07-modele-de-la-page.md) (point 6) et [08](08-editeur-de-page.md) (point 9).

- [ ] Refus décidé côté serveur, à partir de l'enregistrement sur lequel la saisie est basée, sans verrou, y compris quand deux enregistrements arrivent en même temps.
- [ ] Bandeau au-dessus de la saisie : qui a modifié et à quelle heure. Saisie intacte.
- [ ] Boutons « Comparer avec ma saisie », « Enregistrer ma saisie à la suite », « Abandonner ma saisie et prendre la sienne ».
- [ ] L'enregistrement de l'autre personne reste dans l'historique dans tous les cas.
- [ ] Le même refus s'applique depuis « Enregistrer » de l'alerte du ticket 15 : la sortie est annulée, le panneau reste ouvert.
- [ ] Test de bout en bout avec deux sessions ; libellés dans les deux langues.
