# 23: Enregistrements et versions

**What to build:** Chaque enregistrement d'une page est conservé. On déclare des versions, on compare, on restaure et on supprime depuis un historique en volet.

**Blocked by:** 22 — Pages : arborescence et écriture

**Status:** ready-for-agent

Règles : décisions [07](07-modele-de-la-page.md) (points 4 et 5) et [08](08-editeur-de-page.md) (points 6 et 8).

- [ ] Enregistrement conservé si le titre ou le contenu change ; déplacer ou réordonner n'en crée pas.
- [ ] Case « Enregistrer comme version N » et note de 500 caractères ; déclaration après coup, seulement après la dernière version ; numéros jamais réattribués ; note corrigeable.
- [ ] La page affiche sa dernière version et signale les modifications depuis. Aucune version à la création.
- [ ] Historique en volet : versions mises en évidence, filtre « versions seulement », ouverture d'un enregistrement ; tout membre le consulte.
- [ ] Comparaison de deux enregistrements dans un seul texte, sur le texte extrait du JSON, sans fausse différence d'espaces.
- [ ] Restauration : nouvel enregistrement, sans version. Suppression sauf le dernier, avec confirmation et ligne de trace.
- [ ] Le JSON des anciens enregistrements reste lisible après une montée de version de Tiptap (ADR-0019) : un test le garantit.
- [ ] Règles dans `shared/`, avec tests ; deux barrières dans `scripts/roles/` ; libellés dans les deux langues.
