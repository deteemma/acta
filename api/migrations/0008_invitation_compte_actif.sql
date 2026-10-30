-- Un compte désactivé ne peut pas être invité dans une initiative (précision de
-- la responsable fonctionnelle, ticket 05). Règle dans @app/shared (team.ts :
-- checkInvitee), reproduite ici comme seconde barrière (ADR-0006).

-- Remplace find_user_id_by_email : indique aussi si le compte est actif, sans
-- permettre de parcourir la liste des utilisateurs.
DROP FUNCTION find_user_id_by_email(text);
CREATE FUNCTION find_user_by_email(p_email text) RETURNS TABLE (id text, active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, deactivated_at IS NULL FROM app_user WHERE lower(email) = lower(p_email)
$$;

CREATE FUNCTION enforce_member_active_account() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM app_user WHERE id = NEW.user_id AND deactivated_at IS NOT NULL) THEN
    RAISE EXCEPTION 'un compte désactivé ne peut pas être invité'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'initiative_member_active_account';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER initiative_member_enforce_active_account
  BEFORE INSERT ON initiative_member
  FOR EACH ROW EXECUTE FUNCTION enforce_member_active_account();
