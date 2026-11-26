# Corrigé : défauts placés dans l'initiative fictive DNF

## T1 — Page moyenne (DNF-PA-002)
- M1 : 800 notes par mois ≠ « près de 20 000 par an » (9 600).
- M2 : sigle « NDF-R » jamais défini.
- M3 : « traitées rapidement » : vague, non mesuré.
- M4 : la fiduciaire apparaît (§ 6) mais n'est pas une partie prenante.
- M5 : la « refacturation au client » figure sur le formulaire, sans suite dans la page.
- M6 : « une note sur cinq » est une estimation de l'équipe, non mesurée ; l'observation (DNF-AC-005) est encore en cours.

## T2 — Page longue (DNF-PA-004)
- L1 : plafond repas 30 CHF (EF-08) ≠ 35 CHF (DNF-EX-003).
- L2 : remboursement 15 jours après validation (EF-19) ≠ 30 jours après soumission (§ 7).
- L3 : ENF-01 « intuitive et agréable » : non vérifiable.
- L4 : EF-18 regroupe trois exigences (export, écritures, changement d'état).
- L5 : EF-15 « à définir ».
- L6 : EF-13 : qui désigne le remplaçant ? non dit.
- L7 : § 10 renvoie à DNF-RI-001 pour le logiciel comptable : c'est DNF-RI-002.
- L8 : mise en service le 01.01.2027, juste après la fin du contrat de maintenance du logiciel comptable (31.12.2026), alors que l'export en dépend.
- L9 : EX-004 (export) n'a pas de source ; EX-007 (double validation) n'a pas de besoin.

## T3 — Faire le point
- Points exacts attendus : AC-001 à AC-003 terminées ; AC-004 en retard (échéance 10.10) ; AC-005 en retard (31.10) ; QU-001 en retard (15.10) ; QU-002 sans échéance ni assigné ; RI-002 sans responsable ; 3 exigences Proposée depuis plus de 14 jours ; fin dans 20 jours.

## T4 — Prochaines étapes
- Attendues : revue des exigences Proposée (R12, 7.3, Revues) ; tenir l'atelier AC-004 en retard ; obtenir la réponse à QU-001 (bloque EX-004 et l'export) ; traiter RI-002 (sans responsable) ; date de fin à revoir.

## T5 — Technique BABOK
- Attendues : 10.33 Priorisation, menée en 10.50 Ateliers de travail ; alternatives : 10.10 Jeux collaboratifs, 10.16 Analyse des décisions, 10.25 Entretiens ; prise en compte des trois sites et de la réticence.
- Faute grave : technique inexistante dans le référentiel.

## T6 — Cohérence vision / spécification
- C1 : une seule validation (vision) ≠ double validation au-delà de 500 CHF (EF-12).
- C2 : navigateur seul, application mobile hors périmètre (vision) ≠ EF-03, ENF-04 (application mobile).
- C3 : mise en service progressive dès le 01.03.2027 (vision) ≠ tous en même temps le 01.01.2027 (MS-02).
- C4 : plafond repas 35 CHF (vision) ≠ 30 CHF (EF-08).
- C5 : 10 jours ouvrables (vision) ≠ 15 jours calendaires (EF-19) ≠ 30 jours (§ 7).
- La vision est validée par la sponsor : la spécification est probablement à corriger, ou la sponsor à consulter.

## T7 — Gherkin
- Attendus : mots-clés français ; EX-002 : validation, refus avec motif, refus sans motif impossible ; EX-003 : sous, égal, au-dessus du plafond, avec justification ; EX-007 : 500 CHF exactement (« plus de » : 500 = simple), au-delà.
- Manques à signaler : seuil 500 CHF inclus ou non ; repas « par personne » ; que se passe-t-il au refus de la DAF ; notification (moyen).

## T8 — Parties prenantes
- Manquent : les collaborateurs eux-mêmes (utilisateurs principaux, 210 sur le terrain) ; l'informatique (annuaire, téléphone, intégration) ; la fiduciaire ; le fournisseur ou mainteneur du logiciel comptable (RI-002) ; protection des données.
- Mal évalué : responsables d'équipe à influence « moyenne » alors que leur refus est un risque identifié (RI-001) ; intérêt RH « moyen » alors que les RH jugent le délai « irritant majeur ».

## T9 — Préparer l'atelier
- Attendus : l'atelier est en retard (échéance 10.10) ; objectifs liés aux exigences EX-002, EX-007, aux règles de contrôle hétérogènes ; tenir compte de RI-001 ; trois sites (format, déplacement) ; question des téléphones (QU-002).
