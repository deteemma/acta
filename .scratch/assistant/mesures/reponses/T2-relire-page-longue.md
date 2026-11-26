# T2-relire-page-longue

- Durée totale : 612 s
- Contexte lu : 4553 tokens en 111 s
- Texte produit : 2266 tokens en 501 s
- Réflexion : non

## Réponse du modèle

Voici l'analyse des incohérences, lacunes et risques identifiés dans la spécification DNF-PA-004 par rapport aux données de l'initiative DNF (Besoins, Exigences initiales, Tickets, Risques) et au sein même du document.

### 1. Incohérences entre la Spécification et les Données Initiales (Exigences & Besoins)

| Référence Problème | Description de l'incohérence / Discrepancy | Action recommandée | Références concernées |
|---|---|---|---|
| **Contradiction Plafonds (Repas)** | La spécification (EF-08) fixe le plafond repas à **30 CHF**, alors que la description textuelle de l'exigence DNF-EX-003 (section "Exigences" de l'initiative) indique un plafond de **35 CHF**. | Unifier les valeurs. Vérifier avec le sponsor (DNF-PP-001) et le chef comptable (DNF-PP-002). La cohérence doit être assurée avant développement. | DNF-EX-003, DNF-PA-004-EF-08 |
| **Exigence orpheline : Export** | L'exigence **DNF-EX-004** (« Export vers la comptabilité ») n'a **aucune source** citée dans le tableau initial de l'initiative, mais est cruciale pour le Besoin DNF-BE-002 (suppression ressaisie). Dans DNF-PA-004, c'est couvert par EF-18. | Ajouter la référence à la source manquante dans le tableau initial (si connue) ou valider que l'exigence initiale était implicite. Clarifier le lien avec DNF-QU-001. | DNF-EX-004, DNF-PA-004-EF-18, DNF-QU-001 |
| **Exigence sans besoin : Double validation** | L'exigence **DNF-EX-007** (Double validation > 500 CHF) est marquée « Brouillon » et n'a **aucune source de besoin** dans le tableau initial. Elle est couverte par EF-12 dans la spec. | Liester formellement cette exigence à un besoin stratégique ou l'intégrer dans DNF-BE-001 (délai rembours/contrôle) ou la valider comme exigence fonctionnelle transversale non liée à un besoin primaire spécifique. | DNF-EX-007, DNF-PA-004-EF-12 |
| **Contradiction Délais** | L'exigence initiale DNF-EX-005 vise un remboursement en **15 jours**. La section « Délais et engagement de service » (G7) de DNF-PA-004 promet une validation comptable en 3 jours ouvrables + paiement en 30 jours après soumission. | Clarifier si la contrainte est "délai global" ou "par étape". Si l'engagement G7 est valide, alors DNF-EX-005 doit être interprété comme un objectif moyen (cf. Critère d'acceptation), mais le texte est conflictuel. | DNF-EX-005, DNF-PA-004-G7 |
| **Risque Ignoré : Maintenance Logiciel** | Le ticket de risque **DNF-RI-002** identifie que le contrat de maintenance du logiciel comptable expire le **31.12.2026**. L'hypothèse DNF-PA-004 (Hypothèses 10) assume que le logiciel reste en service après cette date sans mécanisme d'action défini dans la spécification. | Intégrer dans DNF-PA-004 une exigence de gestion de l'interface ou un plan de secours/validation avant le 31.12.2026 pour éviter la rupture du flux EF-18. | DNF-RI-002, DNF-PA-004-Hypothèses-10, DNF-PA-004-EF-18 |

### 2. Exigences Non Vérifiables ou Mal Formées

| Référence | Problème de vérifiabilité | Proposition de correction |
|---|---|---|
| **DNF-PA-004-ENF-02** (« <3 secondes avec connexion 4G ») | La mention « 4G » est obsolète et variable (réseaux mobiles, qualité du signal). Le temps de réponse peut varier selon le type d'image. | Remplacer par : « L'enregistrement d'une ligne prend moins de 3 secondes sur un réseau mobile standard (LTE/Wi-Fi) avec une image de < 2 Mo ». Définir la taille limite de l'image si nécessaire. |
| **DNF-PA-004-RG-01** (« Un même mois civil ») | Règle de gestion implicite pour le groupe, mais non détaillée dans les exigences fonctionnelles précises (EF-xx). Est-ce une contrainte stricte ? | Garder la règle RG-01 mais s'assurer que l'interface (EF-01) empêche d'ajouter des lignes de mois différents ou ajoute une validation automatique. |
| **DNF-PA-004-EF-15** (« Relance après un certain temps ») | La durée n'est pas définie. C'est une exigence non testable sans valeur numérique. | Définir la valeur (ex: 3 jours ouvrables après validation) et l'ajouter explicitement dans EF-15 ou le créer en tant qu'exigence séparée avec un critère de test précis. |
| **DNF-PA-004-EF-02 / DNF-PA-004-EF-03** | Regroupent plusieurs fonctionnalités (saisie + photo automatique + OCR). | Si l'objectif est la modularité technique, séparer potentiellement : EF-photo (prise), EF-OCR (lecture), EF-saisie-manuelle. Sinon, garder ensemble mais s'assurer que les tests couvrent chaque cas (photo réussie / échec OCR / saisie manuelle). |

### 3. Références Erronées ou Manquantes

*   **DNF-PA-004-Hypothèses** : Référence à « DNF-QU-002 » (« Collaborateurs terrain ont un téléphone professionnel ?»).
    *   *Situation* : Ce ticket est marqué « Ouvert » dans les données initiales (aucune réponse).
    *   *Correction* : La spécification ne peut reposer sur une hypothèse non validée. Il faut soit fermer la question avant mise en service, soit prévoir des contraintes techniques alternatives (ex: compatibilité Android spécifique) si la réponse est négative.
*   **DNF-PA-004-EF-18** : « Format d'échange dépend de la réponse à DNF-QU-001 ».
    *   *Situation* : DNF-QU-001 (« Le logiciel comptable accepte-t-il un import automatique ? ») est ouverte.
    *   *Correction* : Ce n'est pas une incohérence logique, mais un point bloquant. La spécification conditionnelle est correcte tant que la question ne sera pas close. À noter comme dépendance critique.

### 4. Points laissés en suspens (Questions ouvertes)

Ces points sont répertoriés dans la section « Questions en suspens » de DNF-PA-004 et nécessitent des décisions avant validation :

1.  **Durée avant relance automatique (EF-15)** : Valeur numérique à déterminer.
2.  **Format d'export vers le logiciel comptable (EF-18, DNF-QU-001)** : Dépend de la réponse technique.
3.  **Traitement des notes des stagiaires et saisonniers** : Ne sont pas incluses dans la liste des acteurs ou règles spécifiques. Une règle RG-X doit être ajoutée pour clarifier leur statut (même plafond ? même validation ?).

### 5. Autres incohérences internes à DNF-PA-004

*   **EF-08 vs EF-10** : La table EF-08 liste « Transport public » comme ayant « Aucun plafond ». L'exigence textuelle initiale (DNF-EX-003) ne mentionnait que Repas/Nuitée/Km.
    *   *Impact* : Cohérent dans le document, mais à vérifier si les besoins DNF-BE-XX couvraient cet aspect ou s'il s'agit d'une extension non demandée.
*   **DG (G7) vs EF (EF-19)** : G7 stipule un remboursement au plus tard **30 jours** après soumission. EF-19 stipule **15 jours** après validation.
    *   *Analyse* : Il y a un délai de « validité » implicite entre la soumission et la validation. Si la validation prend trop longtemps (voir risque RI-001), les 30 jours sont atteints sans que la note ne soit validée.
    *   *Correction* : Harmoniser. Soit EF-19 devient "15 jours après validation OU X jours après soumission si non traitée", soit G7 est revu. Actuellement, si une note reste 30 jours en attente de validation, le délai de remboursement G7 sera violé car la note n'est pas « validée » (prérequis EF-19). Il faut clarifier qui porte la responsabilité du non-embarquement dans les 15 jours.

**Note importante :** Le document mentionne que la mise en service est au **01.01.2027** (MS-02), mais l'initiative DNF était prévue pour finir le **15.12.2026** selon les données initiales. Il y a un décalage de 15 jours à harmoniser entre la fin de l'initiative et le Go-live réel.
