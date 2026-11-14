# 31: Administration : limite de pièces jointes

**What to build:** L'administrateur règle le volume total de pièces jointes par initiative, sans jamais dépasser le plafond.

**Blocked by:** 21 — Pièces jointes des tickets

**Status:** done (validé par la responsable fonctionnelle le 14.11.2026)

Règles : décision [14](14-ecrans-d-administration.md) (points 1 et 4).

- [x] Onglet « Pièces jointes » : champ en Mo, 500 par défaut, entre 10 et 1 024 ; refus en dehors, contrôlé côté serveur.
- [x] Limite valable pour toute l'application. La taille maximale d'un fichier (10 Mo) n'est pas réglable.
- [x] Baisser la limite ne supprime aucun fichier : seuls les ajouts sont refusés.
- [x] L'administrateur ne voit pas l'occupation de chaque initiative.
- [x] Réservé à l'administrateur ; `scripts/roles/` à jour ; libellés dans les deux langues.

## Réalisation

**À trancher par la responsable fonctionnelle : choix que les décisions 10 et 14 ne fixent pas.** Ils sont réalisés ainsi en attendant, et faciles à changer :
1. **Nombre entier de Mo** : 12,5 est refusé comme 9 ou 1 025, avec le message « Saisissez un nombre entier de Mo, entre 10 et 1 024. » (la base gardait déjà un entier depuis le ticket 21).
2. **Présentation de l'onglet** : une phrase d'explication, le champ « Limite par initiative (Mo) », le rappel des bornes et de la valeur par défaut, le rappel « Taille maximale d'un fichier : 10 Mo, non réglable », et un bouton « Enregistrer », inactif tant que la valeur n'a pas changé. Après l'enregistrement : « Limite réglée à 300 Mo par initiative. » Pas de confirmation avant de baisser la limite.
3. **Effet immédiat** : la nouvelle limite vaut dès l'envoi suivant, dans toutes les initiatives ; l'occupation affichée aux membres (« … sur 300 Mo ») suit. Une initiative au-dessus de la nouvelle limite garde tous ses fichiers, qu'on ouvre, renomme et supprime comme avant ; seul un ajout est refusé, avec le message du ticket 21.

**Vérifié.** Test de `shared/src/attachments.test.ts` (bornes, entier) ; `scripts/roles/26-limite-de-pieces-jointes.mjs` (API et base : non-administrateurs refusés, 500 Mo par défaut, valeurs hors bornes refusées sans rien changer, bornes 10 et 1 024 acceptées et vues dans deux initiatives, 10 Mo par fichier inchangés, limite baissée sous l'occupation sans fichier supprimé puis remontée, écriture en base réservée à la fonction de l'administrateur ; limite remise à 500 Mo à la fin) et l'ensemble de `scripts/tester-roles.sh` passent. Écran non vérifié dans le navigateur par l'agent : l'extension Chrome n'était pas disponible.

**Technique.** Migration `0031` : fonction `admin_set_attachment_quota` (administrateur seulement) ; la contrainte de la migration `0024` borne la valeur (seconde barrière), la RLS de `app_settings` est inchangée (aucune écriture directe). Règle `attachmentQuotaInputSchema` dans `shared/`. Routes `GET`/`PUT /admin/attachment-quota`, réservées à l'administrateur, qui ne renvoient que la limite, jamais l'occupation d'une initiative. Onglet web `admin-attachment-quota.tsx`, formulaire suivi par l'alerte de modification non enregistrée.

- Ticket validé par la responsable fonctionnelle le 14.11.2026, avec les choix 1 à 3 tels que réalisés.
