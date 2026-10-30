-- Langue d'interface choisie par l'utilisateur (ADR-0013). NULL tant qu'il n'a
-- pas choisi : le client propose alors la langue du navigateur ou du téléphone.
-- Les politiques RLS existantes de app_user s'appliquent : chacun ne modifie
-- que sa propre ligne.
ALTER TABLE app_user ADD COLUMN locale text CHECK (locale IN ('fr', 'en'));
