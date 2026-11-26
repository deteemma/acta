# T7-gherkin

- Durée totale : 393 s
- Contexte lu : 2049 tokens en 24 s
- Texte produit : 1826 tokens en 369 s
- Réflexion : non

## Réponse du modèle

Voici une proposition de scénarios Gherkin couvrant les exigences **DNF-EX-002**, **DNF-EX-003** et **DNF-EX-007**, ainsi qu'une analyse des lacunes identifiées.

### Analyse préliminaire des lacunes (Signalement)
Avant de rédiger les scénarios, voici les informations manquantes empêchant la création de tests complets basés uniquement sur les données fournies :
*   **DNF-EX-002** : Il manque le détail de la forme du « motif » requis lors d'un refus (liste déroulante ? champ libre ?) et le format exact de l'information envoyée au collaborateur.
*   **DNF-EX-003** : Le texte précise les plafonds en CHF, mais ne définit pas les règles pour une note soumise *exactement* à la limite du plafond (est-ce validable ?) ni le comportement spécifique de la saisie d'une justification (comment est-elle stockée ?).
*   **DNF-EX-007** : Le texte indique une « double validation », mais ne précise pas l'ordre chronologique (équipe puis DAF ou inversement ?) et si ces validations s'enchaînent séquentiellement ou en parallèle. De plus, il n'est pas précisé ce qui se passe si le deuxième validateur refuse la note après avoir validé une première étape.

---

### Scénarios Gherkin : Fonctionnalité de Soumission de Notes de Frais

#### Pour l'exigence DNF-EX-002 (Validation par le responsable d'équipe)

```gherkin
Fonctionnalité: Validation des notes de frais par le responsable d'équipe
    Scénario: Le responsable valide une note soumise
        Soit un collaborateur A a soumis une note N1 avec justificatif photo.
        Et que la note est dans l'état « Soumise ».
        Quand le responsable d'équipe R ouvre la note N1 et clique sur « Valider ».
        Alors la note N1 change d'état à « Validée par équipe ».
        Et un historique affiche la date et l'action du responsable.

    Scénario: Le responsable refuse une note sans motif explicite
        Soit un collaborateur B a soumis une note N2.
        Quand le responsable d'équipe R clique sur « Refuser » pour la note N2 sans saisir de texte dans le champ motif.
        Alors le système affiche une erreur demandant de remplir un motif obligatoire.
        Et l'état de la note N2 reste « Soumise ».

    Scénario: Le responsable refuse une note et ajoute un motif explicite
        Soit une note N3 soumise pour remboursement d'un matériel non autorisé.
        Quand le responsable d'équipe R clique sur « Refuser » et saisit « Matériel non dans la politique de frais ».
        Alors l'état de la note N3 reste « Soumise ».
        Et un historique enregistre le motif « Matériel non dans la politique de frais ».
        Et le collaborateur reçoit une notification avec ce motif.
```

#### Pour l'exigence DNF-EX-003 (Contrôle des plafonds)

```gherkin
Fonctionnalité: Contrôle automatique des montants et justificatifs exceptionnels
    Scénario: Soumission d'une note dans le plafond de la catégorie (Cas Nominal)
        Soit un collaborateur C soumet une note repas pour 30 CHF.
        Le montant est inférieur au plafond de 35 CHF par personne.
        Quand le collaborateur clique sur « Soumettre ».
        Alors la note N4 est enregistrée avec l'état « Soumise » sans alerte bloquante.

    Scénario: Soumission d'une note dépassant le plafond sans justification (Cas Limite)
        Soit un collaborateur D soumet une note repas pour 40 CHF.
        Le montant dépasse le plafond de 35 CHF par personne.
        Et aucun champ ou bouton « Ajouter justification » n'est sélectionné avant la soumission.
        Quand le collaborateur tente de valider la soumission.
        Alors le système bloque l'action et affiche un message d'erreur indiquant que le montant dépasse le plafond autorisé.

    Scénario: Soumission d'une note dépassant le plafond avec justification (Cas de validité exceptionnelle)
        Soit un collaborateur E a organisé une réunion client hors politique standard pour 60 CHF.
        Le montant dépasse le plafond de 35 CHF par personne.
        Quand le collaborateur saisit un commentaire justifiant la dépense (« Réunion client exceptionnelle signée MDR »).
        Et valide la note.
        Alors la note N5 est enregistrée avec l'état « Soumise » (ou « En attente de validation supérieure selon EX-007 », à préciser).
```

#### Pour l'exigence DNF-EX-007 (Double validation pour montants > 500 CHF)

```gherkin
Fonctionnalité: Processus de validation hiérarchique pour les grandes dépenses
    Scénario: Soumission d'une note inférieure à 500 CHF
        Soit une note N6 pour 400 CHF.
        Quand le responsable d'équipe valide la note.
        Alors la note passe directement à l'état « Validée par équipe » et attend l'export ou la validation finale standard.

    Scénario: Flux de double validation (Première étape)
        Soit une note N7 pour 600 CHF soumise par un collaborateur F.
        Quand le responsable d'équipe valide la note N7.
        Alors la note change d'état à « Validée par équipe, attente DAF ».
        Et la liste des validations nécessaires indique que l'autorisation de Claire Dumont (DAF) est requise.

    Scénario: Rejet lors de la seconde validation par le DAF
        Soit une note N8 pour 600 CHF validée par le responsable d'équipe.
        Quand Claire Dumont (DAF) consulte la note et clique sur « Refuser » avec un motif (« Dépense non pertinente »).
        Alors l'état de la note passe à « Rejeté par DAF ».
        Et le collaborateur est notifié du refus avec le motif.

    Scénario: Fin du flux de validation après seconde approbation
        Soit une note N9 pour 600 CHF validée par le responsable d'équipe.
        Quand Claire Dumont (DAF) clique sur « Valider ».
        Alors la note passe à l'état « Validée (Finalisée) » et est mise en attente de l'export nocturne.
```

---

### Synthèse des éléments manquants pour une traçabilité complète

Pour finaliser les scénarios et assurer une couverture de test robuste, il est nécessaire d'obtenir les clarifications suivantes du propriétaire de l'exigence (Claire Dumont) ou du chef de produit :

1.  **Concernant DNF-EX-003** : Le texte mentionne « sauf si le collaborateur saisit une justification ».
    *   *Question* : Cette justification doit-elle être validée par quelqu'un avant d'être acceptée ? Ou est-ce que la seule présence du texte suffit pour contourner la vérification de plafond ?
2.  **Concernant DNF-EX-007** :
    *   *Question* : Quelle est l'ordre strict des validations ? (Équipe -> DAF ou DAF -> Équipe ?) Le scénario actuel suppose Équipe puis DAF, mais les données ne le confirment pas explicitement.
    *   *Question* : Que se passe-t-il en cas de conflit d'avis entre la première et la seconde validation ? (Le scénario ci-dessus gère le refus, mais comment l'état est-il mis à jour si le responsable d'équipe valide puis le DAF refuse ?)
3.  **Concernant tous les scénarios** : Les textes des exigences utilisent des termes vagues comme « motif obligatoire » ou « notification ». Une spécification fonctionnelle plus détaillée (format du champ, destinataires de l'email/SMS) est nécessaire pour écrire des critères d'acceptation précis dans un outil de test automatisé.
