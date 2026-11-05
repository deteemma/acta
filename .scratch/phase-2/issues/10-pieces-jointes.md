# Pièces jointes

Type: grilling
Status: resolved
Blocked by: 01, 07

## Question

Comment fonctionnent les pièces jointes (stockées en base, 10 Mo par fichier — ADR-0014) ? Trancher :

- sur quoi : tickets et pages (pas sur les commentaires, voir « Commentaires ») : tous les types de ticket ?
- formats acceptés ou refusés ; aperçu des images et des PDF ;
- limite par initiative en plus de la limite par fichier ;
- qui peut ajouter, renommer, supprimer ; trace de la suppression ;
- images affichées dans le texte d'une page (bouton, collage, dépôt ; voir « Éditeur de page ») : sont-elles aussi listées parmi les pièces jointes, que devient une image retirée du texte ;
- lien avec les enregistrements et versions de page (voir « Modèle de la page ») : un ancien enregistrement garde-t-il ses pièces jointes ; une pièce jointe retirée du contenu reste-t-elle visible dans les anciens enregistrements ;
- comportement dans une initiative archivée.

## Réponse

Tranché avec la responsable fonctionnelle le 05.11.2026.

1. **Sur quoi** : tous les types de ticket, y compris ceux ajoutés par l'administration, et toutes les pages. Une description de ticket n'affiche pas d'image dans son texte : ses fichiers sont seulement listés sur la fiche. Pour citer un fichier dans un texte ou un commentaire, on écrit son nom, sans lien automatique.
2. **Formats** : liste fixe de formats acceptés, tout le reste est refusé avec un message.
   - Documents : PDF, Word, Excel, PowerPoint, OpenDocument, texte, CSV, Markdown.
   - Images : PNG, JPEG, GIF, WebP.
   - Schémas : BPMN, draw.io, Visio.
   - Courriels : EML, MSG.
   - Exclus : programmes, archives ZIP, HTML et SVG.
3. **Antivirus** : aucun, le socle n'en a pas (ADR-0007). Rien n'est analysé à l'envoi ; un fichier infecté d'un format accepté pourrait être partagé entre membres. Risque accepté pour cette phase par la responsable fonctionnelle, à noter dans un ADR à la réalisation.
4. **Aperçu** : images et PDF s'ouvrent dans l'application, les autres formats se téléchargent. Tout membre, lecteur compris, ouvre et télécharge.
5. **Limite par initiative** : 500 Mo par défaut, en plus des 10 Mo par fichier ; valeur réglée dans l'administration, pour toute l'application. Chaque fichier compte tant qu'il existe, même s'il n'est plus affiché que dans d'anciens enregistrements. Limite atteinte : ajout refusé avec un message ; l'occupation reste visible par les membres.
6. **Ajouter, renommer, supprimer** : par un propriétaire ou un contributeur, sur n'importe quel fichier du ticket ou de la page.
   - La liste montre le nom, le format, la taille, l'auteur et la date ; deux fichiers peuvent porter le même nom.
   - Pas de remplacement : une nouvelle version d'un fichier est un nouveau fichier.
   - Renommer garde l'extension et ne laisse aucune trace.
   - Supprimer est définitif, après confirmation, et laisse une ligne « fichier X supprimé par Y le … ».
7. **Images dans le texte d'une page** : une image insérée (bouton, collage, dépôt) est une pièce jointe comme une autre, listée avec la mention « affichée dans le texte ». Elle n'est rattachée à la page qu'à l'enregistrement de la saisie ; abandonner ne laisse rien. Les modèles de page ne contiennent pas d'image.
8. **Fichiers et enregistrements** : un fichier appartient à la page, pas à un enregistrement ; la liste n'est pas versionnée. Une image retirée du texte reste dans la liste et s'affiche toujours dans les anciens enregistrements, jusqu'à sa suppression, qui libère la place. Supprimer un enregistrement ne supprime aucun fichier.
9. **Supprimer une image utilisée** : refusé si elle figure dans le dernier enregistrement (la retirer du texte et enregistrer d'abord). Permis si elle ne figure que dans d'anciens, après un avertissement qui les signale ; ces enregistrements, et ceux qu'on restaure ensuite, affichent alors « image supprimée » à sa place.
10. **Archivage, administrateur, téléphone** : dans une initiative archivée, ni ajout, ni renommage, ni suppression ; ouvrir et télécharger restent possibles. L'administrateur n'a pas accès aux fichiers. Web seulement dans cette phase, pas de synchronisation vers le téléphone.

Glossaire `CONTEXT.md` mis à jour : Pièce jointe, Limite de pièces jointes, Administrateur.
