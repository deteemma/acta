# ADR-0004 — Synchronisation mobile hors ligne : PowerSync

- **Statut** : accepté
- **Date** : 2026-10-24

## Décision

Seulement si hors ligne = OUI : PowerSync Open Edition auto-hébergé, stockage interne sur PostgreSQL. Les écritures du mobile remontent par l'API NestJS. Résolution des conflits : le dernier qui écrit gagne, champ par champ, et le serveur valide les règles métier (rejet des écritures invalides, signalé à l'utilisateur sur le mobile).

## Mise en œuvre dans le modèle

- Service `powersync` sous le profil Compose `mobile-hors-ligne` ; configuration et règles de synchronisation dans `powersync/powersync.yaml`.
- Compte de réplication `<app>_powersync` (REPLICATION, BYPASSRLS) : le filtrage par utilisateur est assuré par les règles de synchronisation.
- Mobile : `EXPO_PUBLIC_HORS_LIGNE=true` active la réplique SQLite locale ; les écritures refusées par l'API (4xx) sont abandonnées et signalées à l'utilisateur.
- PowerSync utilise un module natif : le mode hors ligne exige un *development build* et ne fonctionne pas dans Expo Go.
