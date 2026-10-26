# 02: Coque de navigation

**What to build:** L'utilisateur passe rapidement d'une information à l'autre sans quitter l'écran en cours : un clic sur une initiative ouvre sa fiche dans un panneau latéral ; un objet lié s'ouvre dans un panneau superposé ; la palette de commandes (Ctrl+K) donne un accès direct à tout objet ; un bouton flottant permet une création rapide. Sur mobile, les panneaux s'ouvrent en plein écran, glissés depuis le bas.

**Blocked by:** 01 — Interface bilingue

**Status:** done (validé par la responsable fonctionnelle le 26.10.2026)

- [x] Un clic sur une initiative de la liste ouvre sa fiche dans un panneau à droite, la liste restant visible.
- [x] Un clic sur un objet lié dans un panneau ouvre un second panneau par-dessus ; Échap referme le dernier panneau ouvert.
- [x] Ctrl+K (Cmd+K sur Mac) ouvre la palette : recherche parmi les initiatives de l'utilisateur et accès direct à leur fiche.
- [x] Un bouton flottant « + » reste visible ; dans ce ticket, il crée une initiative (il deviendra « + Action » au ticket 07).
- [x] Sur mobile, la fiche s'ouvre en plein écran, glissée depuis le bas, et se referme par glissement.
- [x] Navigation au clavier et lecteurs d'écran pris en charge : focus maintenu dans le panneau ouvert, rendu à l'élément d'origine à la fermeture.

Précisions de la responsable fonctionnelle :
- « Sur mobile » : le web sur petit écran ; l'application Expo relève du ticket 17.
- Objet lié : les membres. La fiche affiche code, nom, mon rôle et les membres ; un clic sur un membre ouvre un second panneau.
- Le « + » remplace le formulaire de création en haut de liste ; après création, la fiche de la nouvelle initiative s'ouvre.
- Recherche de la palette : chaque mot saisi figure dans le code ou le nom, sans tenir compte des majuscules ni des accents ; saisie vide = toutes les initiatives.
