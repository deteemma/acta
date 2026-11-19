-- Scénarios Gherkin d'une exigence (phase 3, ticket 01). Règles dans @app/shared
-- (scenarios.ts, requirements.ts, references.ts, roles.ts), reproduites ici
-- comme seconde barrière (ADR-0006). Décisions D1 à D19 de .scratch/phase-3/spec.md.
--
-- Prévu pour la suite de la phase 3, sans reprendre cette table :
-- - le Contexte et la langue de la Fonctionnalité (ticket 02) vivront dans leur
--   propre table, une ligne au plus par exigence ;
-- - l'historique (ticket 03) sera une table de versions remplie par un
--   déclencheur, comme requirement_version : auteurs et dates sont déjà tenus ici.
-- Aucune table vers le téléphone (D19) : la publication powersync est inchangée.

-- ── Référence ──────────────────────────────────────────────────────────────

-- Premier acronyme jamais porté parmi SC, SCE, SCEN (deliveredAcronym, validé le
-- 15.11.2026). Les trois pris : arrêt, la responsable fonctionnelle tranche.
DO $$
DECLARE
  v_acronym text;
BEGIN
  SELECT candidate INTO v_acronym
  FROM unnest(ARRAY['SC', 'SCE', 'SCEN']) WITH ORDINALITY AS c (candidate, rank)
  WHERE NOT EXISTS (SELECT 1 FROM reference_acronym WHERE acronym = c.candidate)
  ORDER BY rank
  LIMIT 1;
  IF v_acronym IS NULL THEN
    RAISE EXCEPTION 'acronymes SC, SCE et SCEN déjà portés par d’autres catégories ; à trancher avant les scénarios';
  END IF;
  INSERT INTO reference_acronym VALUES (v_acronym, 'scenario');
  INSERT INTO reference_category VALUES ('scenario', v_acronym);
END
$$;

-- ── Scénario ───────────────────────────────────────────────────────────────

CREATE TABLE gherkin_scenario (
  id             uuid PRIMARY KEY,
  initiative_id  uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL,
  -- Attribuée par le déclencheur ci-dessous, ne change plus (D6).
  reference      text NOT NULL UNIQUE,
  -- Mêmes limites que SCENARIO_TITLE_MAX_LENGTH et SCENARIO_TEXT_MAX_LENGTH.
  title          text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  -- Texte Gherkin libre, jamais contrôlé ici (D11).
  text           text NOT NULL DEFAULT '' CHECK (char_length(text) <= 10000),
  -- Ordre libre dans l'exigence (D9) ; posé en dernier par le déclencheur.
  position       integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  -- État du titre et du texte, augmenté à chaque modification : la saisie dépassée
  -- est refusée (D14). Un changement d'ordre ne le change pas.
  row_version    integer NOT NULL DEFAULT 0,
  created_by     text NOT NULL REFERENCES app_user (id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     text NOT NULL REFERENCES app_user (id),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (initiative_id, id),
  -- Supprimer l'exigence supprime ses scénarios (D3).
  CONSTRAINT gherkin_scenario_requirement_fkey
    FOREIGN KEY (initiative_id, requirement_id) REFERENCES requirement (initiative_id, id) ON DELETE CASCADE
);
CREATE INDEX gherkin_scenario_requirement_idx ON gherkin_scenario (requirement_id, position);

-- Référence, place, auteurs, dates et état. Seule une exigence de solution
-- fonctionnelle a des scénarios (D1) ; un scénario ne change ni d'initiative ni
-- d'exigence (D8). SECURITY DEFINER : tient le compteur, inaccessible directement.
-- Le verrou partagé sur l'exigence attend un changement de type en cours
-- (requirement_type_locked) ; le verrou consultatif range les créations
-- simultanées et les changements d'ordre l'un après l'autre (même verrou que l'API).
CREATE FUNCTION enforce_gherkin_scenario_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_type    requirement_type;
  v_subtype requirement_subtype;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT type, subtype INTO v_type, v_subtype FROM requirement
    WHERE id = NEW.requirement_id AND initiative_id = NEW.initiative_id FOR SHARE;
    -- Exigence absente : refusée par gherkin_scenario_requirement_fkey.
    IF FOUND AND NOT (v_type = 'solution' AND v_subtype = 'functional') THEN
      RAISE EXCEPTION 'seule une exigence de solution fonctionnelle a des scénarios'
        USING ERRCODE = 'check_violation', CONSTRAINT = 'gherkin_scenario_functional_requirement';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('gherkin_scenarios:' || NEW.requirement_id, 0));
    SELECT coalesce(max(position) + 1, 0) INTO NEW.position FROM gherkin_scenario WHERE requirement_id = NEW.requirement_id;
    NEW.reference := next_reference(NEW.initiative_id, 'scenario');
    NEW.row_version := 0;
    NEW.created_by := current_app_user_id();
    NEW.created_at := now();
    NEW.updated_by := NEW.created_by;
    NEW.updated_at := NEW.created_at;
    RETURN NEW;
  END IF;
  IF NEW.initiative_id IS DISTINCT FROM OLD.initiative_id OR NEW.requirement_id IS DISTINCT FROM OLD.requirement_id THEN
    RAISE EXCEPTION 'un scénario ne change pas d’exigence' USING ERRCODE = 'insufficient_privilege';
  END IF;
  NEW.reference := OLD.reference;
  NEW.created_by := OLD.created_by;
  NEW.created_at := OLD.created_at;
  IF NEW.title IS DISTINCT FROM OLD.title OR NEW.text IS DISTINCT FROM OLD.text THEN
    NEW.row_version := OLD.row_version + 1;
    NEW.updated_by := current_app_user_id();
    NEW.updated_at := now();
  ELSE
    NEW.row_version := OLD.row_version;
    NEW.updated_by := OLD.updated_by;
    NEW.updated_at := OLD.updated_at;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER gherkin_scenario_enforce_rules
  BEFORE INSERT OR UPDATE ON gherkin_scenario FOR EACH ROW EXECUTE FUNCTION enforce_gherkin_scenario_rules();

-- Type et sous-type figés tant que l'exigence a un scénario (D2,
-- checkRequirementTypeChange). La ligne de l'exigence est verrouillée avant ce
-- déclencheur : une création de scénario en cours passe avant ou après, jamais
-- en même temps.
CREATE FUNCTION enforce_requirement_type_locked() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.type, NEW.subtype) IS DISTINCT FROM (OLD.type, OLD.subtype)
     AND EXISTS (SELECT 1 FROM gherkin_scenario WHERE requirement_id = OLD.id) THEN
    RAISE EXCEPTION 'l’exigence a des scénarios : son type ne change pas'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'requirement_type_locked_by_scenarios';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER requirement_type_locked
  BEFORE UPDATE OF type, subtype ON requirement FOR EACH ROW EXECUTE FUNCTION enforce_requirement_type_locked();

-- Row Level Security (D17) : tout membre consulte ; propriétaires et
-- contributeurs créent, modifient, ordonnent et suppriment ; initiative
-- archivée : lecture seule. La suppression d'une exigence emporte ses scénarios
-- par la clé étrangère, hors RLS, comme ses autres dépendances.
ALTER TABLE gherkin_scenario ENABLE ROW LEVEL SECURITY;

CREATE POLICY gherkin_scenario_select ON gherkin_scenario FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));
CREATE POLICY gherkin_scenario_insert ON gherkin_scenario FOR INSERT
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY gherkin_scenario_update ON gherkin_scenario FOR UPDATE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id))
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY gherkin_scenario_delete ON gherkin_scenario FOR DELETE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
