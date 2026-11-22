# Spécification — Extension Agile : module activable par initiative

Validée décision par décision avec la responsable fonctionnelle le 22.11.2026, en un seul entretien (questions Q1 à Q24). Fondement : [ADR-0012](../../docs/adr/0012-referentiel-babok.md), qui annonce l'Extension Agile v2 comme module activable par initiative ; pas de nouvel ADR (Q22). Vocabulaire : [`CONTEXT.md`](../../CONTEXT.md) (Extension Agile, Principe agile, Horizon, Technique agile).

Chantier construit dans la navigation par arborescence ([ADR-0021](../../docs/adr/0021-navigation-par-arborescence.md), [spec](../navigation-arborescence/spec.md)).

## Objectif

Une équipe qui travaille en mode agile active l'Extension Agile sur son initiative. Elle consulte ensuite les principes, horizons et techniques de l'Extension Agile au Guide BABOK v2, et rattache ses actions à une technique agile, en plus de leur tâche BABOK.

## Périmètre

Compris : les décisions ci-dessous.

Non compris :
- l'« agilité outillée » : type de ticket User story, backlog, itérations, actions suggérées agiles. C'est un chantier futur distinct (Q1) ;
- tout changement du tableau de bord, de la tâche couverte, des règles R1 à R15 et des filtres de l'écran Tickets (Q13) ;
- la correspondance entre techniques agiles et tâches BABOK (Q9) ;
- la consultation du référentiel agile et la saisie de la technique agile sur le téléphone (Q14).

## Décisions

Chaque ticket de réalisation renvoie à ces décisions : **les lire avant de coder**. En cas de doute ou de contradiction, s'arrêter et poser la question à la responsable fonctionnelle (`CLAUDE.md`).

### Référentiel agile

- **D1** — Le référentiel agile est livré avec l'application, identique pour toutes les initiatives, en lecture seule pour tous, administrateur compris. Il suit les règles de l'ADR-0012 : pour chaque élément, un identifiant stable, le nom en anglais et en français, un résumé rédigé pour ACTA dans les deux langues, et le renvoi de section. Aucun extrait du texte de l'IIBA. (Q2)
- **D2** — Il contient :
  - les 7 **principes agiles** (ch. 4) ;
  - les 3 **horizons** (ch. 5) : horizon Stratégie, horizon Initiative, horizon Livraison ;
  - les **techniques agiles** (ch. 7) ;
  - pour chaque technique agile, les horizons où elle s'applique, seulement si l'ouvrage l'énonce explicitement.

  Pas de correspondance avec les tâches BABOK. (Q2, Q9)
- **D3** — Les noms français sont traduits pour ACTA, à partir du glossaire IIBA en français et de l'Agile Practice Guide du PMI ; le terme anglais est visible en info-bulle. L'horizon *Initiative* est toujours nommé avec le mot « horizon », pour ne pas le confondre avec l'Initiative d'ACTA. (Q3, Q7)
- **D4** — Avant la migration, les noms, les résumés et les relations technique ↔ horizon sont livrés dans un fichier de relecture. Chaque nom y cite la source de sa traduction, et les choix incertains y sont signalés. Chaque relation est marquée « à confirmer » tant que la responsable fonctionnelle ne l'a pas vérifiée contre son exemplaire. Rien n'est livré sans sa validation. (Q15, Q21)
- **D5** — Les éléments agiles sont affichés avec un préfixe devant leur numéro de section : « EA 7.17 » en français, « AE 7.17 » en anglais. Les éléments BABOK restent sans préfixe. L'identifiant stable ne dépend pas de la langue. (Q19)

### Consultation

- **D6** — Le référentiel agile est consultable partout, même hors d'une initiative où le module est activé. Il n'est utilisable (rattachement d'une action) que dans une initiative où le module est activé. (Q6)
- **D7** — Il prend place dans l'écran du référentiel existant (en bas de la colonne de gauche, N3), sous la forme de trois onglets supplémentaires. Ordre des onglets : Domaines et tâches, Techniques, Principes agiles, Horizons, Techniques agiles. Chaque onglet et chaque élément a son adresse (N12). (Q11, Q18)
- **D8** — Fiches, sur le modèle des fiches BABOK (Q18) :
  - **principe agile** : numéro, nom, résumé, renvoi de section ;
  - **horizon** : idem, plus les techniques agiles qui s'y appliquent, en pastilles cliquables ;
  - **technique agile** : idem, plus les horizons où elle s'applique, en pastilles cliquables.
- **D9** — La palette de recherche trouve les éléments agiles partout, comme ceux du BABOK. (Q20)

### Activation

- **D10** — Le module est désactivé à la création d'une initiative, y compris pour les initiatives existantes. Il ne figure pas dans le formulaire de création. (Q24)
- **D11** — Seul le propriétaire l'active ou le désactive, avec un champ « Extension Agile : activée / désactivée » sur la fiche de l'initiative. C'est impossible sur une initiative archivée. Pas d'autre signal dans l'arborescence, pas de trace dédiée de qui l'a activé ou désactivé. (Q4, Q12)
- **D12** — Le module est indépendant de l'approche d'analyse : il s'active aussi sur une initiative prédictive, et choisir « adaptative » ne l'active pas. (Q5)
- **D13** — La désactivation est refusée tant qu'au moins une action de l'initiative porte une technique agile, quel que soit son statut (Terminée et Annulée comprises). Le message de refus donne le nombre d'actions concernées. (Q10, Q16)

### Technique agile d'une action

- **D14** — Une action porte un champ « Technique agile », distinct du champ « Technique » (BABOK). Il est facultatif, admet une technique agile au plus, et se remplit avec ou sans technique BABOK. Il n'apparaît que si le module est activé sur l'initiative. (Q8)
- **D15** — Les choix sont présentés en une liste simple, triée par numéro de section, avec « Aucune » en tête. (Q17)
- **D16** — Le champ est rempli par un propriétaire ou un contributeur, à la création comme en modification. Toute modification figure dans l'historique du ticket. Une action créée depuis une action suggérée n'a pas de technique agile. (Q23)
- **D17** — Sur le téléphone, la fiche d'une action affiche sa technique agile en lecture seule, comme la technique BABOK. (Q14)
