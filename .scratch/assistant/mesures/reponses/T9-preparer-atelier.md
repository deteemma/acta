# T9-preparer-atelier

- Durée totale : 317 s
- Contexte lu : 2000 tokens en 22 s
- Texte produit : 1467 tokens en 294 s
- Réflexion : non

## Réponse du modèle

Voici la proposition structurée pour l'atelier **DNF-AC-004**, basée exclusivement sur les données fournies et le cadre BABOK v3.

### 1. Objectifs du workshop (BABOK Tâche 7.x : Élaboration des exigences)
*   Valider ou ajuster les exigences liées aux validations d'équipe (**DNF-EX-002**, **DNF-EX-007**) afin de répondre au besoin de réduction du délai de remboursement (**DNF-BE-001**) et d'alignement sur les plafonds budgétaires.
*   Recueillir le retour des responsables d'équipe sur la faisabilité opérationnelle des nouvelles procédures (photo justificatif, refus avec motif) pour anticiper les risques de rejet (**DNF-RI-001**).
*   Définir comment gérant les exceptions (montant > 500 CHF ou justification hors plafond) en concertation avec l'équipe.

### 2. Participants (Parties prenantes - BABOK Tâche 4.3 : Identifier les parties prenantes)
Conformément à la liste des membres de l'initiative et aux rôles définis :
*   **Claire Dumont** (Propriétaire, BA) - Animatrice / Facilitatrice.
*   **Responsables d'équipe** (12 personnes) - Groupes de travail distincts (selon le besoin de validation). Rôle : Valider les notes de leur équipe (**DNF-PP-005**).
*   *Optionnel mais conseillé :* Inviter un représentant des équipes terrain (ex: chef d'entrepôt ou agent de livraison) pour évaluer la pertinence technique de l'exigence **DNF-EX-001** (prise de photo via smartphone professionnel ? cf. question ouverte **DNF-QU-002**), même si ce n'est pas explicitement dans la liste des membres, cela touche au besoin d'acceptation du changement.

### 3. Ordre du jour (Demi-journée)
| Temps | Thème | Lien vers les données / Règles fixes |
| :--- | :--- | :--- |
| **15 min** | Contexte et Objectifs | Rappel de l'initiative DNF, des besoins (**DNF-BE-001**) et du projet de changement. |
| **45 min** | Revue des Exigences de Workflow | Analyse détaillée de la chaîne : Soumission -> Photo -> Validation simple/refus -> Exception >500 CHF. |
| **30 min** | Gestion des Exceptions & Plafonds | Discussion autour de **DNF-EX-003** (plafonds) et **DNF-EX-007** (>500 CHF). Qui valide quoi ? |
| **45 min** | Feuille de route et Acceptation | Définition des points de blocage, planification des ateliers ultérieurs si besoin. Conclusion sur la gestion du risque (**DNF-RI-001**). |

### 4. Questions à poser (Sources : Données des exigences et parties prenantes)
Ces questions visent à tracer les exigences vers les besoins réels et à identifier les imprévus :

**Sur l'expérience utilisateur et la technologie :**
*   "Le personnel sur le terrain dispose-t-il de téléphones capables d'enregistrer une photo claire des justificatifs (cf. **DNF-QU-002**, lié à l'exigence **DNF-EX-001**) ?"
*   "Comment gérez-vous les cas où un collaborateur ne peut pas prendre de photo immédiate ? L'exigence **DNF-EX-001** impose-t-elle une soumission en temps réel strictement ou une tolérance ?"

**Sur la validation et les exceptions :**
*   "Face au risque de refus (**DNF-RI-001**), quelle est la procédure pour expliquer le motif de refus aux équipes sans engendrer du conflit ? Comment nous assurer que l'exigence **DNF-EX-002** (refus obligatoire avec motif) sera appliquée par tous les responsables d'équipe ?"
*   "Pour les notes > 500 CHF (**DNF-EX-007**), ce délai de double validation ajoute-t-il trop de charge administrative ou est-ce un garde-fou essentiel pour la directrice **DNF-PP-001** ?"

**Sur les plafonds budgétaires :**
*   "Le système doit-il bloquer l'envoi dès dépassement du plafond (**DNF-EX-003**) ou pouvons-nous pré-calculer ces montants pour éviter les erreurs de saisie des utilisateurs ?"

### 5. Points de vigilance (Risques et Règles fixes)
*   **Risque de rejet du changement (DNF-RI-001)** : Les responsables d'équipe pourraient percevoir la validation obligatoire avec motif comme une ingérence ou une source de conflit. Il est crucial de clarifier que cela protège aussi leur équipe contre les erreurs de saisie qui pourraient être refusées plus tard par la comptabilité.
*   **Exigence orpheline (Règle R10 appliquée à DNF-EX-004)** : Notez que l'exigence **DNF-EX-004** (Export vers comptabilité) n'a pas de source directe listée dans le tableau des exigences, bien qu'elle semble liée au besoin de suppression de ressaisie (**DNF-BE-002**). À vérifier lors de l'atelier si elle a une implication sur les équipes terrain.
*   **Risque d'externalité technique (DNF-RI-002)** : Le contrat de maintenance du logiciel comptable expire le 31.12.2026. L'exigence **DNF-EX-004** (export) dépend de la compatibilité avec ce logiciel dont le support finit par prendre fin dans 1 mois de la fin de projet prévue.
*   **Traçabilité incomplète (Règle R10)** : Vérifier si les sources listées pour chaque exigence sont exhaustives. Par exemple, **DNF-EX-007** n'a aucune source citée dans le tableau ("—"), alors qu'elle semble découlant d'un besoin de contrôle (**DNF-BE-003**) ou du sponsor.
*   **Calendrier serré (Règle R15)** : L'atelier doit être traité rapidement car la fin du projet est proche (20 jours), ce qui laisse peu de marge pour les itérations si les responsables d'équipe demandent des modifications majeures.
