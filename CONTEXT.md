# Contexte et glossaire métier

Glossaire français ↔ anglais : la documentation et les tickets sont en français,
les identifiants de code en anglais. Ce fichier est amorcé par le dépôt modèle et
complété au démarrage de chaque application (étape 2 du skill `nouvelle-application`).

## L'application

- **Nom** : _à compléter_
- **Objectif** : _à compléter_
- **Utilisateurs visés** : _à compléter_
- **Entité partagée** : _à compléter_ (exemple du modèle : « projet » / `project`)
- **Hors ligne sur mobile** : _OUI / NON_
- **Données présentes sur le téléphone** : _à compléter si OUI_

## Glossaire

| Français | Code (anglais) | Définition |
|---|---|---|
| Projet | `project` | Entité partagée d'exemple du modèle, à renommer. |
| Membre | `project_member` | Lien entre un utilisateur et un projet, avec un rôle. |
| Propriétaire | `owner` | Peut tout faire sur le projet, y compris gérer les membres et le supprimer. |
| Contributeur | `contributor` | Peut consulter et modifier le projet. |
| Lecteur | `reader` | Peut seulement consulter le projet. |
| Administrateur | `administrateur` (rôle Keycloak) | Rôle global de l'application : gestion des comptes. |
| Utilisateur | `app_user` | Personne connectée au moins une fois ; identifiant = `sub` du jeton Keycloak. |
