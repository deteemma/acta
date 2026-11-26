# Initiative : Dématérialisation des notes de frais (DNF)

Organisation fictive : Coopérative Les Vergers du Lac (380 collaborateurs, dont 210 sur le terrain : vergers, entrepôts, livraisons).

- Référence : DNF
- Statut : active
- Approche d'analyse : prédictive
- Date de début : 01.09.2026
- Date de fin prévue : 15.12.2026
- Propriétaire : Claire Dumont (BA)
- Membres : Claire Dumont (propriétaire), Marc Favre (contributeur), Sophie Rey (lectrice)

## Parties prenantes

| Référence | Nom | Rôle | Influence | Intérêt |
|---|---|---|---|---|
| DNF-PP-001 | Hélène Martin | Directrice administrative et financière, sponsor | Forte | Fort |
| DNF-PP-002 | Paul Girard | Chef comptable | Forte | Fort |
| DNF-PP-003 | Équipe comptabilité (4 personnes) | Saisie et contrôle des notes | Moyenne | Fort |
| DNF-PP-004 | Nadia Roux | Responsable des ressources humaines | Moyenne | Moyen |
| DNF-PP-005 | Responsables d'équipe (12 personnes) | Validation des notes de leur équipe | Moyenne | Moyen |

## Besoins

- DNF-BE-001 — Réduire le délai de remboursement des frais aux collaborateurs. Sources : DNF-PP-001, DNF-PP-004.
- DNF-BE-002 — Supprimer la ressaisie manuelle des notes par la comptabilité. Sources : DNF-PP-002, DNF-PP-003.
- DNF-BE-003 — Disposer de justificatifs conformes pour la révision des comptes. Source : DNF-PP-002.

## Exigences

| Référence | Titre | Statut | Depuis | Besoins | Sources |
|---|---|---|---|---|---|
| DNF-EX-001 | Saisie d'une note de frais avec photo du justificatif | Validée | 02.10.2026 | DNF-BE-002 | DNF-PP-003 |
| DNF-EX-002 | Validation par le responsable d'équipe | Validée | 02.10.2026 | DNF-BE-001 | DNF-PP-005 |
| DNF-EX-003 | Contrôle des plafonds par catégorie de dépense | Proposée | 06.10.2026 | DNF-BE-002 | DNF-PP-002 |
| DNF-EX-004 | Export des notes validées vers la comptabilité | Proposée | 06.10.2026 | DNF-BE-002 | — |
| DNF-EX-005 | Remboursement dans un délai garanti | Proposée | 08.10.2026 | DNF-BE-001 | DNF-PP-001 |
| DNF-EX-006 | Archivage des justificatifs pendant dix ans | Brouillon | 20.10.2026 | DNF-BE-003 | DNF-PP-002 |
| DNF-EX-007 | Double validation au-delà de 500 CHF | Brouillon | 22.10.2026 | — | DNF-PP-001 |

Texte des exigences :

- **DNF-EX-001** : Le collaborateur saisit une note de frais (date, catégorie, montant TTC, commentaire) et joint la photo du justificatif. La note est enregistrée à l'état « Soumise ».
- **DNF-EX-002** : Le responsable d'équipe du collaborateur valide ou refuse chaque note soumise. Un refus porte obligatoirement un motif. Le collaborateur est informé de la décision.
- **DNF-EX-003** : Le système refuse la soumission d'une note dont le montant dépasse le plafond de sa catégorie (repas : 35 CHF par personne ; nuitée : 180 CHF ; kilomètre : 0,70 CHF), sauf si le collaborateur saisit une justification.
- **DNF-EX-004** : Chaque nuit, les notes validées sont exportées vers le logiciel comptable.
- **DNF-EX-005** : Une note validée est remboursée dans un délai de 15 jours calendaires.
- **DNF-EX-006** : Les justificatifs sont conservés pendant dix ans et restent consultables par la comptabilité.
- **DNF-EX-007** : Une note de plus de 500 CHF est validée par le responsable d'équipe puis par la directrice administrative et financière.

## Tickets

| Référence | Type | Titre | Statut | Échéance | Assigné à | Technique |
|---|---|---|---|---|---|---|
| DNF-AC-001 | Action | Planifier l'approche de l'analyse | Terminée | 15.09.2026 | Claire Dumont | — |
| DNF-AC-002 | Action | Identifier les parties prenantes | Terminée | 22.09.2026 | Claire Dumont | Liste, carte ou personas des parties prenantes |
| DNF-AC-003 | Action | Entretiens avec la comptabilité | Terminée | 30.09.2026 | Marc Favre | Entretiens |
| DNF-AC-004 | Action | Atelier avec les responsables d'équipe | À faire | 10.10.2026 | Claire Dumont | Ateliers |
| DNF-AC-005 | Action | Observer le traitement des notes au service comptable | En cours | 31.10.2026 | Marc Favre | Observation |
| DNF-QU-001 | Question | Le logiciel comptable accepte-t-il un import automatique ? | Ouverte | 15.10.2026 | Marc Favre | — |
| DNF-QU-002 | Question | Les collaborateurs du terrain ont-ils un téléphone professionnel ? | Ouverte | — | — | — |
| DNF-RI-001 | Risque | Refus du changement par les responsables d'équipe | Identifié | — | Claire Dumont | — |
| DNF-RI-002 | Risque | Fin du contrat de maintenance du logiciel comptable au 31.12.2026 | Identifié | — | — | — |

## Actions suggérées par les règles fixes (affichées à ce jour, 25.11.2026)

- R12 : 3 exigences sont « Proposée » depuis plus de 14 jours (DNF-EX-003, DNF-EX-004, DNF-EX-005). Tâche BABOK 7.3 « Vérifier les exigences », technique 10.37 « Revues ».
- R10 : 1 exigence n'a aucune source (DNF-EX-004). Tâche BABOK 5.1 « Tracer les exigences ».
- R10 : 1 exigence n'est liée à aucun besoin (DNF-EX-007).
- R15 : la date de fin prévue est dans 20 jours (15.12.2026).
