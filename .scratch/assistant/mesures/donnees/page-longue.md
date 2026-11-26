# DNF-PA-004 — Spécification des exigences de la solution

Dernière modification : 12.11.2026 par Claire Dumont.

## 1. Objet et portée

Cette page décrit les exigences de la future solution de gestion des notes de frais de la Coopérative Les Vergers du Lac. Elle complète la vision de la solution (DNF-PA-003) et la description de l'état actuel (DNF-PA-002). Elle est destinée aux personnes qui choisiront ou construiront la solution, ainsi qu'aux parties prenantes qui la valideront.

Sont dans la portée :

- la saisie des notes de frais par les collaborateurs, depuis un ordinateur ou un téléphone ;
- la validation des notes par les responsables d'équipe et, au-delà d'un seuil, par la direction ;
- le contrôle automatique des plafonds ;
- l'export vers le logiciel comptable ;
- l'archivage des justificatifs.

Sont hors de la portée :

- les avances sur frais ;
- les cartes de crédit d'entreprise ;
- la refacturation des frais aux clients.

## 2. Glossaire

- **Note de frais** : demande de remboursement d'une ou plusieurs dépenses engagées par un collaborateur pour le compte de la coopérative.
- **Ligne de dépense** : une dépense d'une note, avec sa date, sa catégorie, son montant et son justificatif.
- **Justificatif** : photo ou fichier PDF d'un ticket de caisse ou d'une facture.
- **Responsable d'équipe** : personne qui encadre directement le collaborateur et valide ses notes.
- **Plafond** : montant maximal remboursable pour une catégorie de dépense, sans justification complémentaire.

## 3. Acteurs

| Acteur | Description |
|---|---|
| Collaborateur | Toute personne employée par la coopérative qui engage des frais. |
| Responsable d'équipe | Valide ou refuse les notes de son équipe. |
| Directrice administrative et financière | Valide en second les notes de montant élevé ; signe les paiements. |
| Comptable | Contrôle les notes validées, traite les exports et les anomalies. |
| Chef comptable | Arbitre les litiges ; paramètre les catégories et les plafonds. |
| Administrateur | Gère les comptes et les rattachements aux équipes. |

## 4. Exigences fonctionnelles

### 4.1 Saisie d'une note

**EF-01 — Création d'une note.** Le collaborateur crée une note de frais et y ajoute une ou plusieurs lignes de dépense. Pour chaque ligne, il renseigne la date, la catégorie, le montant TTC, la devise et un commentaire facultatif.

**EF-02 — Justificatif obligatoire.** Chaque ligne porte au moins un justificatif, sauf pour la catégorie « kilomètres », pour laquelle le collaborateur indique le lieu de départ, le lieu d'arrivée et la distance.

**EF-03 — Photo depuis le téléphone.** Le collaborateur photographie un justificatif avec l'application mobile. La photo est rattachée à la ligne en cours de saisie.

**EF-04 — Lecture automatique du justificatif.** La solution propose la date et le montant lus sur la photo du justificatif. Le collaborateur les confirme ou les corrige.

**EF-05 — Brouillon.** Une note peut être enregistrée en brouillon et complétée plus tard. Un brouillon n'est visible que de son auteur.

**EF-06 — Soumission.** Le collaborateur soumet la note complète. La note passe à l'état « Soumise » et n'est plus modifiable par son auteur.

**EF-07 — Devises.** Les dépenses en devise étrangère sont converties en francs suisses au taux du jour de la dépense publié par la Banque nationale suisse.

### 4.2 Contrôle des plafonds

**EF-08 — Plafonds par catégorie.** Les plafonds sont les suivants :

| Catégorie | Plafond |
|---|---|
| Repas | 30 CHF par personne |
| Nuitée | 180 CHF |
| Kilomètres | 0,70 CHF par kilomètre |
| Transport public | Aucun plafond |
| Divers | 100 CHF |

**EF-09 — Dépassement.** Si une ligne dépasse le plafond de sa catégorie, la solution l'indique au collaborateur, qui peut saisir une justification. Une ligne en dépassement sans justification ne peut pas être soumise.

**EF-10 — Paramétrage.** Le chef comptable modifie les catégories et les plafonds. Une modification s'applique aux notes créées après la modification.

### 4.3 Validation

**EF-11 — Validation simple.** Le responsable d'équipe du collaborateur valide ou refuse chaque note soumise. Un refus porte un motif obligatoire.

**EF-12 — Double validation.** Une note dont le total dépasse 500 CHF est validée par le responsable d'équipe, puis par la directrice administrative et financière.

**EF-13 — Remplaçant.** Pendant l'absence d'un responsable d'équipe, un remplaçant désigné valide à sa place.

**EF-14 — Notification.** Le collaborateur est informé de chaque décision et de son motif, par courriel et dans l'application.

**EF-15 — Relance.** Une note soumise qui n'a pas été validée après un certain temps fait l'objet d'une relance automatique auprès du valideur. La durée avant relance est à définir.

**EF-16 — Correction après refus.** Une note refusée revient à son auteur, qui peut la corriger et la soumettre à nouveau. L'historique des refus est conservé.

### 4.4 Comptabilité et paiement

**EF-17 — Contrôle comptable.** Le comptable consulte les notes validées, avec leurs justificatifs, et peut les rejeter avec un motif s'il constate une anomalie.

**EF-18 — Export.** Chaque nuit, les notes validées et contrôlées sont exportées vers le logiciel comptable, dans un format que celui-ci accepte, et les écritures sont générées automatiquement et les notes passent à l'état « Comptabilisée ».

**EF-19 — Délai de remboursement.** Une note validée est remboursée dans un délai de 15 jours calendaires après sa validation.

**EF-20 — Suivi.** Le collaborateur voit à tout moment l'état de chacune de ses notes : Brouillon, Soumise, Validée, Refusée, Comptabilisée, Remboursée.

### 4.5 Archivage

**EF-21 — Conservation.** Les justificatifs et les notes sont conservés pendant dix ans, sans altération possible.

**EF-22 — Consultation.** La comptabilité et la fiduciaire consultent les notes archivées et leurs justificatifs. La fiduciaire n'a accès qu'en lecture.

## 5. Exigences non fonctionnelles

**ENF-01 — Ergonomie.** L'interface doit être intuitive et agréable à utiliser.

**ENF-02 — Performance.** L'enregistrement d'une ligne de dépense avec sa photo prend moins de 3 secondes avec une connexion 4G.

**ENF-03 — Disponibilité.** La solution est disponible 99,5 % du temps, hors maintenance planifiée annoncée.

**ENF-04 — Hors connexion.** L'application mobile permet de saisir une note sans connexion ; la note est envoyée à la reconnexion.

**ENF-05 — Sécurité.** L'accès se fait par le compte de l'annuaire de la coopérative. Un collaborateur ne voit que ses propres notes ; un responsable d'équipe, en plus, celles de son équipe.

**ENF-06 — Protection des données.** Les données personnelles sont hébergées en Suisse et traitées conformément à la loi fédérale sur la protection des données.

**ENF-07 — Langues.** L'interface est disponible en français et en allemand.

## 6. Règles de gestion

**RG-01.** Une note ne contient que des dépenses d'un même mois civil.

**RG-02.** Une dépense est soumise au plus tard 60 jours après la date de la dépense. Au-delà, elle n'est plus remboursée, sauf accord du chef comptable.

**RG-03.** Une même photo de justificatif ne peut pas être utilisée sur deux lignes différentes.

**RG-04.** Un collaborateur ne peut pas valider ses propres notes, même s'il est responsable d'équipe.

**RG-05.** Les repas pris avec des clients sont remboursés au réel, dans la limite de 80 CHF par personne, sur présentation de la liste des convives.

## 7. Délais et engagement de service

L'objectif principal de l'initiative est de réduire le délai de remboursement. Les engagements suivants s'appliquent une fois la solution en service :

- la validation par le responsable d'équipe intervient en principe dans les 5 jours ouvrables ;
- le contrôle comptable intervient dans les 3 jours ouvrables suivant la validation ;
- le remboursement est effectué au plus tard 30 jours après la soumission de la note.

## 8. Migration et mise en service

**MS-01.** Les notes papier en cours au moment de la mise en service sont traitées selon l'ancien processus jusqu'à leur remboursement.

**MS-02.** La mise en service a lieu le 1er janvier 2027 pour l'ensemble des collaborateurs, siège et terrain en même temps.

**MS-03.** Une formation d'une heure est proposée à chaque responsable d'équipe avant la mise en service. Les collaborateurs reçoivent un guide d'utilisation.

## 9. Interfaces

**IF-01 — Annuaire.** La solution récupère chaque nuit la liste des collaborateurs, leur équipe et leur responsable depuis l'annuaire de la coopérative.

**IF-02 — Logiciel comptable.** Voir EF-18. Le format d'échange dépend de la réponse à la question DNF-QU-001.

**IF-03 — Banque.** Les remboursements sont payés par le fichier de paiement groupé existant, deux fois par mois.

## 10. Hypothèses et dépendances

- Les collaborateurs du terrain disposent d'un téléphone capable de faire tourner l'application (voir DNF-QU-002).
- Le logiciel comptable reste en service après le 31.12.2026 (voir DNF-RI-001).
- L'annuaire contient le rattachement de chaque collaborateur à son responsable.

## 11. Critères d'acceptation globaux

- 95 % des notes du mois de février 2027 sont saisies dans la nouvelle solution.
- Le délai moyen de remboursement est inférieur à 15 jours sur le premier trimestre 2027.
- La comptabilité ne ressaisit plus aucune ligne de dépense.

## 12. Questions en suspens

- Durée avant relance automatique (EF-15).
- Format d'export vers le logiciel comptable (EF-18, DNF-QU-001).
- Traitement des notes de frais des stagiaires et des saisonniers.
