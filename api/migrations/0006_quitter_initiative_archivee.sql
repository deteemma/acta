-- Initiative archivée : lecture seule, mais tout membre peut encore la quitter
-- (précision de la responsable fonctionnelle, ticket 04). Retirer un autre
-- membre reste impossible. Règle dans @app/shared (team.ts).
DROP POLICY initiative_member_delete ON initiative_member;
CREATE POLICY initiative_member_delete ON initiative_member FOR DELETE
  USING ((has_initiative_role(initiative_id, 'owner') AND NOT initiative_is_archived(initiative_id))
         OR user_id = current_app_user_id());
