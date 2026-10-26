-- Entité partagée « initiative » (Initiative, voir CONTEXT.md) et ses membres, protégées par la RLS
-- (ADR-0003, ADR-0006). Exécuté par le compte propriétaire de la base ; l'API
-- se connecte avec le compte applicatif, soumis à la RLS.
--
-- L'API transmet l'utilisateur courant à chaque transaction :
--   SELECT set_config('app.user_id', '<sub du jeton>', true);

-- Ordre de déclaration = ordre de comparaison : reader < contributor < owner.
CREATE TYPE initiative_role AS ENUM ('reader', 'contributor', 'owner');

CREATE FUNCTION current_app_user_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')
$$;

CREATE TABLE app_user (
  id           text PRIMARY KEY,          -- « sub » du jeton Keycloak
  email        text,
  display_name text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX app_user_email_key ON app_user (lower(email));

CREATE TABLE initiative (
  id         uuid PRIMARY KEY,
  -- Code d'initiative (CONTEXT.md), même règle que INITIATIVE_CODE_PATTERN.
  code       text NOT NULL UNIQUE CHECK (code ~ '^[A-Z][A-Z0-9]{1,9}$'),
  name       text NOT NULL,
  created_by text NOT NULL REFERENCES app_user (id) DEFAULT current_app_user_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE initiative_member (
  initiative_id uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  user_id    text NOT NULL REFERENCES app_user (id),
  role       initiative_role NOT NULL,
  -- Membre de l'équipe BA (ADR-0015) : réservé aux propriétaires et contributeurs.
  is_team_ba boolean NOT NULL DEFAULT false CHECK (NOT is_team_ba OR role <> 'reader'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (initiative_id, user_id)
);
CREATE INDEX initiative_member_user_id_idx ON initiative_member (user_id);

-- Fonctions d'aide. SECURITY DEFINER : elles lisent initiative_member sans
-- repasser par sa propre RLS (évite la récursion des politiques).
CREATE FUNCTION current_initiative_role(p_initiative_id uuid) RETURNS initiative_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM initiative_member
  WHERE initiative_id = p_initiative_id AND user_id = current_app_user_id()
$$;

CREATE FUNCTION has_initiative_role(p_initiative_id uuid, p_required initiative_role) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_initiative_role(p_initiative_id) >= p_required, false)
$$;

CREATE FUNCTION shares_initiative_with(p_user_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM initiative_member mine
    JOIN initiative_member theirs ON theirs.initiative_id = mine.initiative_id
    WHERE mine.user_id = current_app_user_id() AND theirs.user_id = p_user_id
  )
$$;

-- Permet au propriétaire d'une initiative d'inviter un utilisateur par son e-mail
-- sans pouvoir parcourir la liste des utilisateurs.
CREATE FUNCTION find_user_id_by_email(p_email text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM app_user WHERE lower(email) = lower(p_email)
$$;

-- Le créateur d'une initiative en devient automatiquement propriétaire et BA de l'équipe.
CREATE FUNCTION add_creator_as_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO initiative_member (initiative_id, user_id, role, is_team_ba)
  VALUES (NEW.id, NEW.created_by, 'owner', true);
  RETURN NEW;
END
$$;
CREATE TRIGGER initiative_add_creator_as_owner
  AFTER INSERT ON initiative FOR EACH ROW EXECUTE FUNCTION add_creator_as_owner();

-- Row Level Security -----------------------------------------------------------
ALTER TABLE app_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE initiative ENABLE ROW LEVEL SECURITY;
ALTER TABLE initiative_member ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_user_select ON app_user FOR SELECT
  USING (id = current_app_user_id() OR shares_initiative_with(id));
CREATE POLICY app_user_insert ON app_user FOR INSERT
  WITH CHECK (id = current_app_user_id());
CREATE POLICY app_user_update ON app_user FOR UPDATE
  USING (id = current_app_user_id()) WITH CHECK (id = current_app_user_id());

CREATE POLICY initiative_select ON initiative FOR SELECT
  USING (has_initiative_role(id, 'reader'));
CREATE POLICY initiative_insert ON initiative FOR INSERT
  WITH CHECK (created_by = current_app_user_id());
CREATE POLICY initiative_update ON initiative FOR UPDATE
  USING (has_initiative_role(id, 'contributor')) WITH CHECK (has_initiative_role(id, 'contributor'));
CREATE POLICY initiative_delete ON initiative FOR DELETE
  USING (has_initiative_role(id, 'owner'));

CREATE POLICY initiative_member_select ON initiative_member FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));
CREATE POLICY initiative_member_insert ON initiative_member FOR INSERT
  WITH CHECK (has_initiative_role(initiative_id, 'owner'));
CREATE POLICY initiative_member_update ON initiative_member FOR UPDATE
  USING (has_initiative_role(initiative_id, 'owner')) WITH CHECK (has_initiative_role(initiative_id, 'owner'));
CREATE POLICY initiative_member_delete ON initiative_member FOR DELETE
  USING (has_initiative_role(initiative_id, 'owner'));
