-- Administration des comptes (ticket 05, ADR-0005). Les comptes vivent dans
-- Keycloak ; la base garde la désactivation en miroir pour reconnaître les
-- initiatives sans propriétaire actif. Règles dans @app/shared (admin.ts),
-- reproduites ici comme seconde barrière (ADR-0006).
--
-- L'administrateur n'a aucun accès au contenu des initiatives : aucune politique
-- RLS ne lui est ouverte. Il passe seulement par les fonctions admin_* ci-dessous,
-- qui ne renvoient que le nom, le code et les membres.

-- Compte désactivé dans Keycloak ; NULL = actif. Un compte n'est jamais supprimé.
ALTER TABLE app_user ADD COLUMN deactivated_at timestamptz;

-- Vrai si la transaction est menée par un administrateur. Positionné par l'API
-- (DatabaseService.asAdmin) sur les seules routes réservées au rôle administrateur.
CREATE FUNCTION current_user_is_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.is_admin', true), '') = 'true'
$$;

CREATE FUNCTION require_admin() RETURNS void
LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF NOT current_user_is_admin() THEN
    RAISE EXCEPTION 'réservé à l’administrateur' USING ERRCODE = 'insufficient_privilege';
  END IF;
END
$$;

-- Désactiver ou réactiver un compte (miroir de Keycloak). On ne se désactive pas soi-même.
CREATE FUNCTION admin_set_user_deactivated(p_user_id text, p_deactivated boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM require_admin();
  IF p_deactivated AND p_user_id = current_app_user_id() THEN
    RAISE EXCEPTION 'on ne désactive pas son propre compte' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE app_user
  SET deactivated_at = CASE WHEN p_deactivated THEN coalesce(deactivated_at, now()) END,
      updated_at = now()
  WHERE id = p_user_id;
END
$$;

-- Au moins un propriétaire de l'initiative a un compte actif. Sans SECURITY
-- DEFINER : appelée directement, elle reste soumise à la RLS ; les fonctions
-- admin_* ci-dessous l'appellent avec leurs propres droits.
CREATE FUNCTION initiative_has_active_owner(p_initiative_id uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM initiative_member m JOIN app_user u ON u.id = m.user_id
    WHERE m.initiative_id = p_initiative_id AND m.role = 'owner' AND u.deactivated_at IS NULL
  )
$$;

-- Initiatives sans propriétaire actif : nom, code et membres, rien d'autre.
CREATE FUNCTION admin_orphan_initiative_members()
RETURNS TABLE (initiative_id uuid, code text, name text, user_id text, email text,
               display_name text, role initiative_role, active boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM require_admin();
  RETURN QUERY
    SELECT i.id, i.code, i.name, m.user_id, u.email, u.display_name, m.role, u.deactivated_at IS NULL
    FROM initiative i
    JOIN initiative_member m ON m.initiative_id = i.id
    JOIN app_user u ON u.id = m.user_id
    WHERE NOT initiative_has_active_owner(i.id)
    ORDER BY i.code, m.created_at;
END
$$;

-- Désignation d'un propriétaire par l'administrateur (ADR-0015), même sur une
-- initiative archivée : seulement sans propriétaire actif, au profit d'un membre
-- au compte actif. Le déclencheur de la migration 0005 la trace.
CREATE FUNCTION admin_designate_owner(p_initiative_id uuid, p_user_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM require_admin();
  -- Même verrou que les changements de l'équipe (migration 0005).
  PERFORM 1 FROM initiative WHERE id = p_initiative_id FOR UPDATE;
  IF initiative_has_active_owner(p_initiative_id) THEN
    RAISE EXCEPTION 'l’initiative a un propriétaire actif'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'admin_designation_has_active_owner';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM initiative_member m JOIN app_user u ON u.id = m.user_id
    WHERE m.initiative_id = p_initiative_id AND m.user_id = p_user_id AND u.deactivated_at IS NULL
  ) THEN
    RAISE EXCEPTION 'le nouveau propriétaire doit être un membre au compte actif'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'admin_designation_active_member';
  END IF;
  UPDATE initiative_member SET role = 'owner'
  WHERE initiative_id = p_initiative_id AND user_id = p_user_id;
END
$$;
