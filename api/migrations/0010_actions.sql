-- Actions (ticket 07) : unité de travail d'un BA sur une initiative, toujours
-- rattachée à une tâche BABOK. Règles dans @app/shared (actions.ts, roles.ts),
-- reproduites ici comme seconde barrière (ADR-0006).

-- Même liste que ACTION_STATUSES ; tout statut peut passer à tout autre.
CREATE TYPE action_status AS ENUM ('todo', 'in_progress', 'done', 'cancelled');

CREATE TABLE action (
  id            uuid PRIMARY KEY,
  initiative_id uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  title         text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  -- Texte mis en forme (shared/src/rich-text.ts), même limite que ACTION_DESCRIPTION_MAX_LENGTH.
  description   text CHECK (char_length(description) <= 20000),
  task_id       text NOT NULL REFERENCES babok_task (id),
  technique_id  text REFERENCES babok_technique (id),
  -- Responsable : propriétaire ou contributeur à l'attribution ; il le reste
  -- s'il quitte ensuite l'initiative ou devient lecteur.
  assignee_id   text NOT NULL REFERENCES app_user (id),
  due_date      date,
  status        action_status NOT NULL DEFAULT 'todo',
  -- Auteurs et dates : écrits par le déclencheur ci-dessous.
  created_by    text NOT NULL REFERENCES app_user (id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text NOT NULL REFERENCES app_user (id),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX action_initiative_id_idx ON action (initiative_id);
CREATE INDEX action_assignee_id_idx ON action (assignee_id);
-- Une action se supprime tant qu'elle n'est liée à rien : les tables qui la
-- référenceront (tickets suivants) le feront en ON DELETE RESTRICT, et l'API
-- traduit le refus en `linked`.

-- Création et dernière modification, avec leur auteur ; l'action ne change pas
-- d'initiative. Le responsable est vérifié à chaque attribution. SECURITY
-- DEFINER : lit le rôle du responsable dans initiative_member sans repasser par
-- sa RLS, sans exposer de fonction qui donnerait le rôle de n'importe qui.
CREATE FUNCTION enforce_action_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := current_app_user_id();
    NEW.created_at := now();
  ELSE
    IF NEW.initiative_id IS DISTINCT FROM OLD.initiative_id THEN
      RAISE EXCEPTION 'une action ne change pas d’initiative' USING ERRCODE = 'insufficient_privilege';
    END IF;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_by := current_app_user_id();
  NEW.updated_at := now();
  IF (TG_OP = 'INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id)
     AND NOT EXISTS (
       SELECT 1 FROM initiative_member
       WHERE initiative_id = NEW.initiative_id AND user_id = NEW.assignee_id AND role >= 'contributor'
     ) THEN
    RAISE EXCEPTION 'le responsable doit être propriétaire ou contributeur de l’initiative'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'action_assignee_eligible';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER action_enforce_rules
  BEFORE INSERT OR UPDATE ON action FOR EACH ROW EXECUTE FUNCTION enforce_action_rules();

-- Row Level Security : tout membre consulte ; propriétaires et contributeurs
-- créent, modifient et suppriment ; initiative archivée : lecture seule.
ALTER TABLE action ENABLE ROW LEVEL SECURITY;

CREATE POLICY action_select ON action FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));
CREATE POLICY action_insert ON action FOR INSERT
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY action_update ON action FOR UPDATE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id))
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY action_delete ON action FOR DELETE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));

-- Les noms du responsable et des auteurs restent lisibles, même après leur
-- départ de l'initiative.
CREATE FUNCTION appears_in_my_actions(p_user_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM action a
    JOIN initiative_member mine ON mine.initiative_id = a.initiative_id
    WHERE mine.user_id = current_app_user_id()
      AND p_user_id IN (a.assignee_id, a.created_by, a.updated_by)
  )
$$;
DROP POLICY app_user_select ON app_user;
CREATE POLICY app_user_select ON app_user FOR SELECT
  USING (id = current_app_user_id() OR shares_initiative_with(id) OR appears_in_my_owner_designations(id)
         OR appears_in_my_actions(id));
