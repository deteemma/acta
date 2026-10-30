-- Exigences (ticket 10) : types du BABOK, statuts, sources, besoins liés,
-- exigence parente, liens avec les actions, historique complet des
-- modifications. Règles dans @app/shared (requirements.ts, actions.ts,
-- roles.ts), reproduites ici comme seconde barrière (ADR-0006).

-- Mêmes listes que REQUIREMENT_TYPES et REQUIREMENT_SUBTYPES.
CREATE TYPE requirement_type AS ENUM ('business', 'stakeholder', 'solution', 'transition');
CREATE TYPE requirement_subtype AS ENUM ('functional', 'non_functional');

CREATE TABLE requirement (
  id            uuid PRIMARY KEY,
  initiative_id uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  -- Attribuée par le déclencheur ci-dessous, ne change plus.
  reference     text NOT NULL UNIQUE,
  title         text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  -- Texte mis en forme (shared/src/rich-text.ts), même limite que REQUIREMENT_STATEMENT_MAX_LENGTH.
  statement     text NOT NULL CHECK (char_length(statement) BETWEEN 1 AND 20000),
  type          requirement_type NOT NULL,
  subtype       requirement_subtype,
  -- Même liste que REQUIREMENT_STATUSES ; en texte, pour que la liste puisse
  -- être complétée par l'administration (ticket 11).
  status        text NOT NULL DEFAULT 'proposed'
                CHECK (status IN ('proposed', 'verified', 'validated', 'approved', 'deferred', 'rejected')),
  -- Exigence parente, de la même initiative ; une parente qui a des enfants ne
  -- se supprime pas (NO ACTION).
  parent_id     uuid,
  created_by    text NOT NULL REFERENCES app_user (id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text NOT NULL REFERENCES app_user (id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- Cible des liens, qui imposent la même initiative.
  UNIQUE (initiative_id, id),
  CONSTRAINT requirement_parent_fkey
    FOREIGN KEY (initiative_id, parent_id) REFERENCES requirement (initiative_id, id),
  -- Comme checkRequirementShape : sous-type pour une exigence de solution, et pour elle seule.
  CONSTRAINT requirement_subtype_matches_type CHECK ((type = 'solution') = (subtype IS NOT NULL))
);
CREATE INDEX requirement_parent_id_idx ON requirement (parent_id);

-- Référence, auteurs et dates ; l'exigence ne change pas d'initiative et ne
-- descend pas d'elle-même (createsParentCycle). SECURITY DEFINER : tient le
-- compteur, inaccessible directement.
CREATE FUNCTION enforce_requirement_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.reference := next_reference(NEW.initiative_id, 'requirement');
    NEW.created_by := current_app_user_id();
    NEW.created_at := now();
  ELSE
    IF NEW.initiative_id IS DISTINCT FROM OLD.initiative_id THEN
      RAISE EXCEPTION 'une exigence ne change pas d’initiative' USING ERRCODE = 'insufficient_privilege';
    END IF;
    NEW.reference := OLD.reference;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  IF NEW.parent_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.parent_id IS DISTINCT FROM OLD.parent_id) THEN
    -- Deux changements de parente simultanés dans l'initiative ne peuvent pas
    -- former ensemble une boucle : ils passent l'un après l'autre.
    PERFORM pg_advisory_xact_lock(hashtextextended('requirement_parent:' || NEW.initiative_id::text, 0));
    IF NEW.parent_id = NEW.id OR EXISTS (
      WITH RECURSIVE ancestor (id, parent_id) AS (
        SELECT id, parent_id FROM requirement WHERE id = NEW.parent_id
        UNION
        SELECT r.id, r.parent_id FROM requirement r JOIN ancestor a ON r.id = a.parent_id
      )
      SELECT 1 FROM ancestor WHERE id = NEW.id
    ) THEN
      RAISE EXCEPTION 'l’exigence parente descend de l’exigence elle-même'
        USING ERRCODE = 'check_violation', CONSTRAINT = 'requirement_parent_cycle';
    END IF;
  END IF;
  NEW.updated_by := current_app_user_id();
  NEW.updated_at := now();
  RETURN NEW;
END
$$;
CREATE TRIGGER requirement_enforce_rules
  BEFORE INSERT OR UPDATE ON requirement FOR EACH ROW EXECUTE FUNCTION enforce_requirement_rules();

-- Sources d'une exigence : elles partent avec l'exigence (CASCADE), mais une
-- partie prenante source d'une exigence ne se supprime pas (NO ACTION).
CREATE TABLE requirement_stakeholder (
  initiative_id  uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL,
  stakeholder_id uuid NOT NULL,
  PRIMARY KEY (requirement_id, stakeholder_id),
  CONSTRAINT requirement_stakeholder_requirement_fkey
    FOREIGN KEY (initiative_id, requirement_id) REFERENCES requirement (initiative_id, id) ON DELETE CASCADE,
  CONSTRAINT requirement_stakeholder_stakeholder_fkey
    FOREIGN KEY (initiative_id, stakeholder_id) REFERENCES stakeholder (initiative_id, id)
);
CREATE INDEX requirement_stakeholder_stakeholder_id_idx ON requirement_stakeholder (stakeholder_id);

-- Besoins auxquels répond une exigence : les liens partent avec l'exigence,
-- mais un besoin lié à une exigence ne se supprime pas.
CREATE TABLE requirement_need (
  initiative_id  uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL,
  need_id        uuid NOT NULL,
  PRIMARY KEY (requirement_id, need_id),
  CONSTRAINT requirement_need_requirement_fkey
    FOREIGN KEY (initiative_id, requirement_id) REFERENCES requirement (initiative_id, id) ON DELETE CASCADE,
  CONSTRAINT requirement_need_need_fkey
    FOREIGN KEY (initiative_id, need_id) REFERENCES need (initiative_id, id)
);
CREATE INDEX requirement_need_need_id_idx ON requirement_need (need_id);

-- Liens action ↔ exigence : ni l'action ni l'exigence liées ne se suppriment.
-- L'API traduit le refus en `linked` (action) ou `requirementLinked`.
CREATE TABLE action_requirement (
  initiative_id  uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  action_id      uuid NOT NULL,
  requirement_id uuid NOT NULL,
  PRIMARY KEY (action_id, requirement_id),
  CONSTRAINT action_requirement_action_fkey
    FOREIGN KEY (initiative_id, action_id) REFERENCES action (initiative_id, id),
  CONSTRAINT action_requirement_requirement_fkey
    FOREIGN KEY (initiative_id, requirement_id) REFERENCES requirement (initiative_id, id)
);
CREATE INDEX action_requirement_requirement_id_idx ON action_requirement (requirement_id);

-- Historique : état complet de l'exigence (RequirementSnapshot) après chaque
-- transaction qui la modifie, avec qui et quand. Écrit seulement par
-- finalize_requirement ; part avec l'exigence.
CREATE TABLE requirement_version (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  initiative_id  uuid NOT NULL,
  requirement_id uuid NOT NULL,
  changed_by     text NOT NULL REFERENCES app_user (id),
  changed_at     timestamptz NOT NULL,
  snapshot       jsonb NOT NULL,
  CONSTRAINT requirement_version_requirement_fkey
    FOREIGN KEY (initiative_id, requirement_id) REFERENCES requirement (initiative_id, id) ON DELETE CASCADE
);
CREATE INDEX requirement_version_requirement_id_idx ON requirement_version (requirement_id, id);

-- En fin de transaction (ou à SET CONSTRAINTS … IMMEDIATE), une fois tous les
-- liens écrits : l'exigence répond à au moins un besoin ou a une parente
-- (checkRequirementShape), et son nouvel état est ajouté à l'historique s'il a
-- changé. Une exigence supprimée entre-temps est ignorée.
CREATE FUNCTION finalize_requirement(p_requirement_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r          requirement;
  v_snapshot jsonb;
BEGIN
  SELECT * INTO r FROM requirement WHERE id = p_requirement_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF r.parent_id IS NULL AND NOT EXISTS (SELECT 1 FROM requirement_need WHERE requirement_id = r.id) THEN
    RAISE EXCEPTION 'une exigence répond à au moins un besoin ou dérive d’une exigence parente'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'requirement_origin_required';
  END IF;
  v_snapshot := jsonb_build_object(
    'title', r.title,
    'statement', r.statement,
    'type', r.type,
    'subtype', r.subtype,
    'status', r.status,
    'stakeholders', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) ORDER BY s.name, s.id), '[]')
      FROM requirement_stakeholder l JOIN stakeholder s ON s.id = l.stakeholder_id
      WHERE l.requirement_id = r.id
    ),
    'needs', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'reference', n.reference, 'title', n.title) ORDER BY n.reference), '[]')
      FROM requirement_need l JOIN need n ON n.id = l.need_id
      WHERE l.requirement_id = r.id
    ),
    'parent', (
      SELECT jsonb_build_object('id', p.id, 'reference', p.reference, 'title', p.title)
      FROM requirement p WHERE p.id = r.parent_id
    )
  );
  IF v_snapshot IS DISTINCT FROM (
    SELECT snapshot FROM requirement_version WHERE requirement_id = r.id ORDER BY id DESC LIMIT 1
  ) THEN
    INSERT INTO requirement_version (initiative_id, requirement_id, changed_by, changed_at, snapshot)
    VALUES (r.initiative_id, r.id, current_app_user_id(), now(), v_snapshot);
  END IF;
END
$$;
REVOKE EXECUTE ON FUNCTION finalize_requirement(uuid) FROM PUBLIC;

CREATE FUNCTION requirement_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
  ELSE
    v_row := to_jsonb(NEW);
  END IF;
  -- `id` pour l'exigence elle-même, `requirement_id` pour ses liens.
  PERFORM finalize_requirement(coalesce(v_row ->> 'requirement_id', v_row ->> 'id')::uuid);
  RETURN NULL;
END
$$;
CREATE CONSTRAINT TRIGGER requirement_finalize
  AFTER INSERT OR UPDATE ON requirement DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION requirement_changed();
CREATE CONSTRAINT TRIGGER requirement_need_finalize
  AFTER INSERT OR DELETE ON requirement_need DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION requirement_changed();
CREATE CONSTRAINT TRIGGER requirement_stakeholder_finalize
  AFTER INSERT OR DELETE ON requirement_stakeholder DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION requirement_changed();

-- Row Level Security : tout membre consulte ; propriétaires et contributeurs
-- créent, modifient et suppriment exigences et liens ; initiative archivée :
-- lecture seule. Un lien ne se modifie pas : on le retire et on en crée un autre.
ALTER TABLE requirement ENABLE ROW LEVEL SECURITY;

CREATE POLICY requirement_select ON requirement FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));
CREATE POLICY requirement_insert ON requirement FOR INSERT
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY requirement_update ON requirement FOR UPDATE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id))
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY requirement_delete ON requirement FOR DELETE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));

ALTER TABLE requirement_stakeholder ENABLE ROW LEVEL SECURITY;

CREATE POLICY requirement_stakeholder_select ON requirement_stakeholder FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));
CREATE POLICY requirement_stakeholder_insert ON requirement_stakeholder FOR INSERT
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY requirement_stakeholder_delete ON requirement_stakeholder FOR DELETE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));

ALTER TABLE requirement_need ENABLE ROW LEVEL SECURITY;

CREATE POLICY requirement_need_select ON requirement_need FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));
CREATE POLICY requirement_need_insert ON requirement_need FOR INSERT
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY requirement_need_delete ON requirement_need FOR DELETE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));

ALTER TABLE action_requirement ENABLE ROW LEVEL SECURITY;

CREATE POLICY action_requirement_select ON action_requirement FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));
CREATE POLICY action_requirement_insert ON action_requirement FOR INSERT
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY action_requirement_delete ON action_requirement FOR DELETE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));

-- Historique : consultable par tout membre ; aucune écriture directe.
ALTER TABLE requirement_version ENABLE ROW LEVEL SECURITY;

CREATE POLICY requirement_version_select ON requirement_version FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));

-- Les auteurs d'une exigence et de ses modifications restent lisibles, même
-- après leur départ de l'initiative.
CREATE FUNCTION appears_in_my_requirements(p_user_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM requirement r
    JOIN initiative_member mine ON mine.initiative_id = r.initiative_id
    WHERE mine.user_id = current_app_user_id()
      AND p_user_id IN (r.created_by, r.updated_by)
  ) OR EXISTS (
    SELECT 1 FROM requirement_version v
    JOIN initiative_member mine ON mine.initiative_id = v.initiative_id
    WHERE mine.user_id = current_app_user_id()
      AND v.changed_by = p_user_id
  )
$$;
DROP POLICY app_user_select ON app_user;
CREATE POLICY app_user_select ON app_user FOR SELECT
  USING (id = current_app_user_id() OR shares_initiative_with(id) OR appears_in_my_owner_designations(id)
         OR appears_in_my_actions(id) OR appears_in_my_stakeholders(id) OR appears_in_my_needs(id)
         OR appears_in_my_requirements(id));
