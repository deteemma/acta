# Commentaires

Type: grilling
Status: resolved
Blocked by: 01

## Question

Comment fonctionnent les commentaires ? Trancher :

- sur quoi : tickets seulement, ou tickets et pages ;
- qui peut commenter (un lecteur le peut-il ? une partie prenante invitée ?) ;
- modification et suppression d'un commentaire : par qui, avec quelle trace ;
- réponses imbriquées ou fil simple ; mention d'un membre ;
- texte simple ou mis en forme ; pièces jointes dans un commentaire ;
- comportement dans une initiative archivée.

## Réponse

Tranché avec la responsable fonctionnelle le 05.11.2026.

1. **Sur quoi** : les tickets de tous types et les pages. Sur une page, le commentaire porte sur la page entière, sans rattachement à un passage ni à un enregistrement : il reste visible après un nouvel enregistrement et disparaît avec la page. Les besoins et les exigences n'en ont pas (décision de cadrage).
2. **Qui commente** : les propriétaires et les contributeurs. Un lecteur lit les commentaires mais n'en écrit pas (ADR-0006) ; une partie prenante qui doit répondre est invitée comme contributeur.
3. **Modification** : par son auteur seul, tant qu'il est propriétaire ou contributeur de l'initiative. Le commentaire affiche « modifié le … » ; l'ancien texte n'est pas conservé.
4. **Suppression** : par son auteur, tant qu'il est propriétaire ou contributeur de l'initiative, ou par un propriétaire ; définitive, après confirmation. Une ligne sans contenu reste à sa place : « commentaire supprimé par X le … ».
5. **Fil** : simple, du plus ancien au plus récent, sans réponses imbriquées.
6. **Mention d'un membre** : pas dans cette phase, car elle supposerait d'étendre l'alerte ; à reprendre avec la zone floue « Alertes sur les autres types de ticket ».
7. **Contenu** : obligatoire, 5 000 caractères au plus, même texte mis en forme que la description d'un ticket ; les références citées sont reliées à leur objet.
8. **Pièces jointes** : aucune sur un commentaire ; on joint le fichier au ticket ou à la page, puis on le cite.
9. **Ticket fermé, initiative archivée** : un ticket fermé reste commentable. Dans une initiative archivée, on ne peut ni ajouter, ni modifier, ni supprimer de commentaire ; tout membre les lit.
10. **Téléphone** : les commentaires n'existent que sur le web dans cette phase ; ils ne sont ni affichés dans « Mes actions » ni synchronisés.

Glossaire `CONTEXT.md` mis à jour : Commentaire, Page.
