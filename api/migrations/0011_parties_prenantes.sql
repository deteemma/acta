-- Parties prenantes (ticket 08) : objet d'analyse d'une initiative, positionné
-- sur la matrice influence × intérêt, éventuellement relié au compte d'un
-- membre, et lié aux actions. Règles dans @app/shared (stakeholders.ts,
-- actions.ts, roles.ts), reproduites ici comme seconde barrière (ADR-0006).

-- Mêmes listes que STAKEHOLDER_KINDS, STAKEHOLDER_ROLES (BABOK v3 §2.4) et STAKEHOLDER_LEVELS.
CREATE TYPE stakeholder_kind AS ENUM ('person', 'group', 'organization');
CREATE TYPE stakeholder_role AS ENUM (
  'business_analyst', 'customer', 'domain_sme', 'end_user', 'implementation_sme', 'operational_support',
  'project_manager', 'regulator', 'sponsor', 'supplier', 'tester'
);
CREATE TYPE stakeholder_level AS ENUM ('low', 'medium', 'high');

CREATE TABLE stakeholder (
  id            uuid PRIMARY KEY,
  initiative_id uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  kind          stakeholder_kind NOT NULL,
  -- Un ou plusieurs rôles du BABOK ; les doublons sont écartés par l'API.
  roles         stakeholder_role[] NOT NULL CHECK (cardinality(roles) >= 1),
  -- Facultatifs : une fiche non évaluée figure à part, sous la matrice.
  influence     stakeholder_level,
  interest      stakeholder_level,
  contact       text CHECK (char_length(contact) <= 1000),
  -- Texte mis en forme (shared/src/rich-text.ts), même limite que STAKEHOLDER_NOTES_MAX_LENGTH.
  notes         text CHECK (char_length(notes) <= 20000),
  -- Compte relié : un membre à la liaison ; le lien reste s'il quitte ensuite l'initiative.
  user_id       text REFERENCES app_user (id),
  -- Auteurs et dates : écrits par le déclencheur ci-dessous.
  created_by    text NOT NULL REFERENCES app_user (id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text NOT NULL REFERENCES app_user (id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- Cible des liens action ↔ partie prenante, qui imposent la même initiative.
  UNIQUE (initiative_id, id),
  -- Un utilisateur est relié à au plus une fiche par initiative.
  CONSTRAINT stakeholder_user_unique UNIQUE (initiative_id, user_id)
);

-- Création et dernière modification, avec leur auteur ; la fiche ne change pas
-- d'initiative. Le compte relié est vérifié à chaque liaison. SECURITY
-- DEFINER : lit initiative_member sans repasser par sa RLS (comme pour le
-- responsable d'une action).
CREATE FUNCTION enforce_stakeholder_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := current_app_user_id();
    NEW.created_at := now();
  ELSE
    IF NEW.initiative_id IS DISTINCT FROM OLD.initiative_id THEN
      RAISE EXCEPTION 'une partie prenante ne change pas d’initiative' USING ERRCODE = 'insufficient_privilege';
    END IF;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_by := current_app_user_id();
  NEW.updated_at := now();
  IF NEW.user_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.user_id IS DISTINCT FROM OLD.user_id)
     AND NOT EXISTS (
       SELECT 1 FROM initiative_member WHERE initiative_id = NEW.initiative_id AND user_id = NEW.user_id
     ) THEN
    RAISE EXCEPTION 'le compte relié doit être celui d’un membre de l’initiative'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'stakeholder_user_member';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER stakeholder_enforce_rules
  BEFORE INSERT OR UPDATE ON stakeholder FOR EACH ROW EXECUTE FUNCTION enforce_stakeholder_rules();

-- Liens action ↔ partie prenante, de la même initiative. Une action ou une
-- partie prenante liée ne se supprime pas : ces clés sont en NO ACTION (et non
-- RESTRICT), vérifiées en fin d'instruction, pour que la suppression de
-- l'initiative emporte d'un même mouvement actions, parties prenantes et liens.
-- L'API traduit le refus en `linked` (action) ou `stakeholderLinked`.
ALTER TABLE action ADD UNIQUE (initiative_id, id);
CREATE TABLE action_stakeholder (
  initiative_id  uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  action_id      uuid NOT NULL,
  stakeholder_id uuid NOT NULL,
  PRIMARY KEY (action_id, stakeholder_id),
  CONSTRAINT action_stakeholder_action_fkey
    FOREIGN KEY (initiative_id, action_id) REFERENCES action (initiative_id, id),
  CONSTRAINT action_stakeholder_stakeholder_fkey
    FOREIGN KEY (initiative_id, stakeholder_id) REFERENCES stakeholder (initiative_id, id)
);
CREATE INDEX action_stakeholder_stakeholder_id_idx ON action_stakeholder (stakeholder_id);

-- Row Level Security : tout membre consulte ; propriétaires et contributeurs
-- créent, modifient et suppriment fiches et liens ; initiative archivée :
-- lecture seule. Un lien ne se modifie pas : on le retire et on en crée un autre.
ALTER TABLE stakeholder ENABLE ROW LEVEL SECURITY;

CREATE POLICY stakeholder_select ON stakeholder FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));
CREATE POLICY stakeholder_insert ON stakeholder FOR INSERT
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY stakeholder_update ON stakeholder FOR UPDATE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id))
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY stakeholder_delete ON stakeholder FOR DELETE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));

ALTER TABLE action_stakeholder ENABLE ROW LEVEL SECURITY;

CREATE POLICY action_stakeholder_select ON action_stakeholder FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));
CREATE POLICY action_stakeholder_insert ON action_stakeholder FOR INSERT
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY action_stakeholder_delete ON action_stakeholder FOR DELETE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));

-- Le compte relié et les auteurs restent lisibles, même après leur départ de l'initiative.
CREATE FUNCTION appears_in_my_stakeholders(p_user_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM stakeholder s
    JOIN initiative_member mine ON mine.initiative_id = s.initiative_id
    WHERE mine.user_id = current_app_user_id()
      AND p_user_id IN (s.user_id, s.created_by, s.updated_by)
  )
$$;
DROP POLICY app_user_select ON app_user;
CREATE POLICY app_user_select ON app_user FOR SELECT
  USING (id = current_app_user_id() OR shares_initiative_with(id) OR appears_in_my_owner_designations(id)
         OR appears_in_my_actions(id) OR appears_in_my_stakeholders(id));
