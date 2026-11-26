# T6-coherence-deux-pages

- Durée totale : 425 s
- Contexte lu : 3230 tokens en 94 s
- Texte produit : 1594 tokens en 331 s
- Réflexion : non

## Réponse du modèle

Voici l'analyse comparative des documents **DNF-PA-003** (Vision) et **DNF-PA-004** (Spécification), selon le cadre BABOK v3 pour identifier les incohérences.

### 1. Contradiction sur la stratégie de migration
*   **DNF-PA-003 (§ Calendrier - MS-02 implicite) :** La vision évoque une "Mise en service progressive" commençant au **1er mars 2027**, avec un ordre spécifique : Siège $\rightarrow$ Entrepôts $\rightarrow$ Vergers (avant la saison).
*   **DNF-PA-004 (§ 8. Migration - MS-02) :** La spécification fixe une date unique et simultanée pour l'ensemble des collaborateurs (**1er janvier 2027**), incluant siège et terrain.
    *   *Conflit :* Les dates (Janvier vs Mars) et le mode de déploiement (Progressif vs Simultané total) sont opposés.
*   **Action :** Il faut clarifier immédiatement avec le sponsor si l'approche progressive (Vision) est maintenue ou si un lancement simultané massifié (Spécification) est décidé.

### 2. Contradiction sur la durée de remboursement cible
*   **DNF-PA-003 (§ Objectifs mesurables - point 1) :** L'objectif est de "Rembourser une note validée en **10 jours ouvrables** au plus".
*   **DNF-PA-004 (Énoncé introductif § 7) :** Le texte dit "réduire le délai", mais les engagements (§ Délais et engagement de service) fixent un remboursement au plus tard **30 jours après la soumission**.
    *   *Analyse :* Le critère d'acceptation global (ENF-12/§ 11) mentionne un délai moyen < 15 jours. Cependant, la règle de gestion implicite dans la vision (10j ouvrés validés) diffère radicalement de la règle explicite en spécification (30j après soumission). Or, une note soumise ne doit pas toujours être validée et comptabilisée immédiatement.
*   **Action :** Demander au sponsor de valider si l'objectif "10 jours ouvrables" de la vision est un KPI réel ou s'il faut aligner sur les engagements contractuels de 30 jours (soumission à paiement).

### 3. Contradiction sur le périmètre des hors-périmètre (Avances)
*   **DNF-PA-003 (§ Hors périmètre) :** Indique explicitement "Avances sur frais" comme étant hors de la portée de la solution.
*   **DNF-PA-004 (§ 1. Objet et portée - Hors de la portée) :** Réitère également que les "avances sur frais" sont hors de la portée.
    *   *Note :* Il n'y a pas de contradiction ici, les deux documents sont alignés. (Inclu à titre d'information pour la traçabilité).

### 4. Contradiction potentielle sur les règles de plafonds et validation des montants élevés
*   **DNF-PA-003 (§ Principes retenus - "Une seule validation") :** Affirme qu'"**une seule validation** (responsable direct) suffit, quel que soit le montant, et que la direction n'intervient plus dans la validation.
*   **DNF-PA-004 (EF-12 — Double validation) :** Prévient explicitement qu'une note dont le total dépasse **500 CHF** doit être validée par le responsable ET par la Directrice administrative et financière.
*   *Conflit :* Le principe de "seule validation" contradictoire avec la règle fonctionnelle de "double validation > 500 CHF".
*   **Action :** Le document de spécification (EF-12) est généralement plus fiable pour les règles métiers précises, mais la vision (DNF-PA-003) a été révisée tardivement (octobre). Il faut vérifier si le principe "une seule validation" était une tentative d'allégement des charges qui a ensuite échoué devant l'exigence de contrôle (>500 CHF), ou vice-versa. **Correction requise sur la vision** ou confirmation de la règle du seuil.

### 5. Contradiction sur les types de justificatifs (Photos)
*   **DNF-PA-004 (EF-03 et EF-04) :** La solution permet de "photographier un justificatif avec l'application mobile" et propose une "lecture automatique". Cela implique des photos comme preuves principales.
*   **DNF-PA-003 (§ Vision) :** Ne mentionne pas de restriction, mais l'objectif est de supprimer la ressaisie (EF-04 aligne là-dessus).
    *   *Analyse :* Pas de contradiction directe majeure, sauf si DNF-PA-002 (non fourni ici mais cité) imposait des scans PDF uniquement. Basé sur les données fournies, pas de contradiction flagrante.

### Synthèse et Recommandations pour le BA

1.  **Priorité 1 (Dates de mise en service) :** La date du **1er janvier** (Spécification) est incompatible avec la stratégie progressive commençant au **1er mars** (Vision). Il est probable que la spécification (plus récente, nov. 2026) reflète un nouveau changement de cap ou une erreur de saisie dans la vision. **Question au sponsor :** "Devons-nous migrer simultanément le 1er janvier comme indiqué dans la spécification, ou respecter le plan progressif visé en mars ?"
2.  **Priorité 2 (Règles de validation) :** Le texte de la Vision ("Une seule validation... quel que soit son montant") contredit directement l'exigence fonctionnelle EF-12 de la Spécification ("Double validation > 500 CHF"). La Spécification est le document contractuel, la Vision est stratégique. **Action :** Mettre à jour la section "Principes retenus" dans DNF-PA-003 pour y inclure la clause du seuil de 500 CHF, ou supprimer l'exigence EF-12 si c'est un changement majeur (ce qui est peu probable car les exigences sont plus détaillées).
3.  **Question en suspens à résoudre :** Le document DNF-PA-004 (§ 12) liste la "Durée avant relance automatique" comme question en suspens. Or, cela impacte directement l'objectif de délai de remboursement (10 jours dans la vision vs 30 jours dans la spécification).

**Conclusion :** La **Vision (DNF-PA-003)** contient des énoncés ("une seule validation", "mise en service progressive à mars") qui sont techniquement contradictoires avec les détails opérationnels de la **Spécification (DNF-PA-004)**. Il est probable que la Spécification soit le document prioritaire à suivre pour la construction, mais elle doit être harmonisée avec la Vision mise à jour.
