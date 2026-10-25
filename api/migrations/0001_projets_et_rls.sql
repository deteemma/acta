-- Entité partagée d'exemple « project » et ses membres, protégées par la RLS
-- (ADR-0003, ADR-0006). Exécuté par le compte propriétaire de la base ; l'API
-- se connecte avec le compte applicatif, soumis à la RLS.
--
-- L'API transmet l'utilisateur courant à chaque transaction :
--   SELECT set_config('app.user_id', '<sub du jeton>', true);

-- Ordre de déclaration = ordre de comparaison : reader < contributor < owner.
CREATE TYPE project_role AS ENUM ('reader', 'contributor', 'owner');

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

CREATE TABLE project (
  id         uuid PRIMARY KEY,
  name       text NOT NULL,
  created_by text NOT NULL REFERENCES app_user (id) DEFAULT current_app_user_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE project_member (
  project_id uuid NOT NULL REFERENCES project (id) ON DELETE CASCADE,
  user_id    text NOT NULL REFERENCES app_user (id),
  role       project_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX project_member_user_id_idx ON project_member (user_id);

-- Fonctions d'aide. SECURITY DEFINER : elles lisent project_member sans
-- repasser par sa propre RLS (évite la récursion des politiques).
CREATE FUNCTION current_project_role(p_project_id uuid) RETURNS project_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM project_member
  WHERE project_id = p_project_id AND user_id = current_app_user_id()
$$;

CREATE FUNCTION has_project_role(p_project_id uuid, p_required project_role) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_project_role(p_project_id) >= p_required, false)
$$;

CREATE FUNCTION shares_project_with(p_user_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_member mine
    JOIN project_member theirs ON theirs.project_id = mine.project_id
    WHERE mine.user_id = current_app_user_id() AND theirs.user_id = p_user_id
  )
$$;

-- Permet au propriétaire d'un projet d'inviter un utilisateur par son e-mail
-- sans pouvoir parcourir la liste des utilisateurs.
CREATE FUNCTION find_user_id_by_email(p_email text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM app_user WHERE lower(email) = lower(p_email)
$$;

-- Le créateur d'un projet en devient automatiquement propriétaire.
CREATE FUNCTION add_creator_as_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO project_member (project_id, user_id, role) VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END
$$;
CREATE TRIGGER project_add_creator_as_owner
  AFTER INSERT ON project FOR EACH ROW EXECUTE FUNCTION add_creator_as_owner();

-- Row Level Security -----------------------------------------------------------
ALTER TABLE app_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE project ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_member ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_user_select ON app_user FOR SELECT
  USING (id = current_app_user_id() OR shares_project_with(id));
CREATE POLICY app_user_insert ON app_user FOR INSERT
  WITH CHECK (id = current_app_user_id());
CREATE POLICY app_user_update ON app_user FOR UPDATE
  USING (id = current_app_user_id()) WITH CHECK (id = current_app_user_id());

CREATE POLICY project_select ON project FOR SELECT
  USING (has_project_role(id, 'reader'));
CREATE POLICY project_insert ON project FOR INSERT
  WITH CHECK (created_by = current_app_user_id());
CREATE POLICY project_update ON project FOR UPDATE
  USING (has_project_role(id, 'contributor')) WITH CHECK (has_project_role(id, 'contributor'));
CREATE POLICY project_delete ON project FOR DELETE
  USING (has_project_role(id, 'owner'));

CREATE POLICY project_member_select ON project_member FOR SELECT
  USING (has_project_role(project_id, 'reader'));
CREATE POLICY project_member_insert ON project_member FOR INSERT
  WITH CHECK (has_project_role(project_id, 'owner'));
CREATE POLICY project_member_update ON project_member FOR UPDATE
  USING (has_project_role(project_id, 'owner')) WITH CHECK (has_project_role(project_id, 'owner'));
CREATE POLICY project_member_delete ON project_member FOR DELETE
  USING (has_project_role(project_id, 'owner'));
