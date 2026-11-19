-- Contexte et langue de la Fonctionnalité d'une exigence (phase 3, ticket 02).
-- Règles dans @app/shared (scenarios.ts, requirements.ts, roles.ts), reproduites
-- ici comme seconde barrière (ADR-0006). Décisions D2, D3, D5, D12, D14 et D17 de
-- .scratch/phase-3/spec.md.
--
-- - gherkin_feature : une ligne par exigence qui a eu un scénario ou un Contexte ;
--   elle porte la langue, fixée à la création du premier d'entre eux (D5), et
--   reste ensuite, même si tous sont supprimés.
-- - gherkin_background : le Contexte, une ligne au plus par exigence (D12). Son
--   historique (ticket 03) sera une table de versions remplie par un déclencheur,
--   comme pour les scénarios.
-- Aucune table vers le téléphone (D19) : la publication powersync est inchangée.

-- ── Fonctionnalité ─────────────────────────────────────────────────────────

CREATE TABLE gherkin_feature (
  requirement_id uuid PRIMARY KEY,
  initiative_id  uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  -- Langue commune au Contexte et aux scénarios (LOCALES) ; la changer ne traduit rien.
  language       text NOT NULL CHECK (language IN ('fr', 'en')),
  created_by     text NOT NULL REFERENCES app_user (id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (initiative_id, requirement_id),
  -- Supprimer l'exigence supprime sa Fonctionnalité (D3).
  CONSTRAINT gherkin_feature_requirement_fkey
    FOREIGN KEY (initiative_id, requirement_id) REFERENCES requirement (initiative_id, id) ON DELETE CASCADE
);

-- Les exigences qui ont déjà des scénarios (ticket 01) : la langue enregistrée de
-- l'auteur du premier, sinon le français (newFeatureLanguage). Avant les
-- déclencheurs, qui posent l'auteur d'après la session.
INSERT INTO gherkin_feature (requirement_id, initiative_id, language, created_by, created_at)
SELECT DISTINCT ON (s.requirement_id)
  s.requirement_id, s.initiative_id, coalesce(u.locale, 'fr'), s.created_by, s.created_at
FROM gherkin_scenario s
JOIN app_user u ON u.id = s.created_by
ORDER BY s.requirement_id, s.created_at, s.position;

-- Un scénario appartient à une Fonctionnalité, qui a donc toujours une langue.
ALTER TABLE gherkin_scenario
  ADD CONSTRAINT gherkin_scenario_feature_fkey
  FOREIGN KEY (requirement_id) REFERENCES gherkin_feature (requirement_id) ON DELETE CASCADE;

-- Auteur et date posés par la base ; seule une exigence de solution fonctionnelle
-- a une Fonctionnalité (D1) ; seule la langue change ensuite.
CREATE FUNCTION enforce_gherkin_feature_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_type    requirement_type;
  v_subtype requirement_subtype;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT type, subtype INTO v_type, v_subtype FROM requirement
    WHERE id = NEW.requirement_id AND initiative_id = NEW.initiative_id;
    -- Exigence absente : refusée par gherkin_feature_requirement_fkey.
    IF FOUND AND NOT (v_type = 'solution' AND v_subtype = 'functional') THEN
      RAISE EXCEPTION 'seule une exigence de solution fonctionnelle a des scénarios'
        USING ERRCODE = 'check_violation', CONSTRAINT = 'gherkin_scenario_functional_requirement';
    END IF;
    NEW.created_by := current_app_user_id();
    NEW.created_at := now();
    RETURN NEW;
  END IF;
  IF NEW.initiative_id IS DISTINCT FROM OLD.initiative_id OR NEW.requirement_id IS DISTINCT FROM OLD.requirement_id THEN
    RAISE EXCEPTION 'une fonctionnalité ne change pas d’exigence' USING ERRCODE = 'insufficient_privilege';
  END IF;
  NEW.created_by := OLD.created_by;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END
$$;
CREATE TRIGGER gherkin_feature_enforce_rules
  BEFORE INSERT OR UPDATE ON gherkin_feature FOR EACH ROW EXECUTE FUNCTION enforce_gherkin_feature_rules();

-- ── Contexte ───────────────────────────────────────────────────────────────

CREATE TABLE gherkin_background (
  requirement_id uuid PRIMARY KEY,
  initiative_id  uuid NOT NULL,
  -- Même limite que BACKGROUND_TEXT_MAX_LENGTH ; jamais vide (saveBackgroundSchema),
  -- le Gherkin n'est pas contrôlé (D11).
  text           text NOT NULL CHECK (char_length(text) <= 10000 AND text ~ '\S'),
  -- État du Contexte, augmenté à chaque modification du texte : la saisie
  -- dépassée est refusée (D14).
  row_version    integer NOT NULL DEFAULT 0,
  created_by     text NOT NULL REFERENCES app_user (id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     text NOT NULL REFERENCES app_user (id),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- Un Contexte appartient à une Fonctionnalité, qui a donc une langue ; supprimer
  -- l'exigence supprime son Contexte (D3).
  CONSTRAINT gherkin_background_feature_fkey
    FOREIGN KEY (initiative_id, requirement_id) REFERENCES gherkin_feature (initiative_id, requirement_id) ON DELETE CASCADE
);

-- Auteurs, dates et état. Seule une exigence de solution fonctionnelle a un
-- Contexte (D1). Le verrou partagé sur l'exigence attend un changement de type en
-- cours (requirement_type_locked), comme pour un scénario.
CREATE FUNCTION enforce_gherkin_background_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_type    requirement_type;
  v_subtype requirement_subtype;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT type, subtype INTO v_type, v_subtype FROM requirement
    WHERE id = NEW.requirement_id AND initiative_id = NEW.initiative_id FOR SHARE;
    IF FOUND AND NOT (v_type = 'solution' AND v_subtype = 'functional') THEN
      RAISE EXCEPTION 'seule une exigence de solution fonctionnelle a un Contexte'
        USING ERRCODE = 'check_violation', CONSTRAINT = 'gherkin_scenario_functional_requirement';
    END IF;
    NEW.row_version := 0;
    NEW.created_by := current_app_user_id();
    NEW.created_at := now();
    NEW.updated_by := NEW.created_by;
    NEW.updated_at := NEW.created_at;
    RETURN NEW;
  END IF;
  IF NEW.initiative_id IS DISTINCT FROM OLD.initiative_id OR NEW.requirement_id IS DISTINCT FROM OLD.requirement_id THEN
    RAISE EXCEPTION 'un Contexte ne change pas d’exigence' USING ERRCODE = 'insufficient_privilege';
  END IF;
  NEW.created_by := OLD.created_by;
  NEW.created_at := OLD.created_at;
  IF NEW.text IS DISTINCT FROM OLD.text THEN
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
CREATE TRIGGER gherkin_background_enforce_rules
  BEFORE INSERT OR UPDATE ON gherkin_background FOR EACH ROW EXECUTE FUNCTION enforce_gherkin_background_rules();

-- ── Type de l'exigence ─────────────────────────────────────────────────────

-- Type et sous-type figés tant que l'exigence a un scénario ou un Contexte, même
-- sans scénario (D2, isRequirementTypeLocked). Même contrainte nommée qu'au ticket 01.
CREATE OR REPLACE FUNCTION enforce_requirement_type_locked() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.type, NEW.subtype) IS DISTINCT FROM (OLD.type, OLD.subtype)
     AND (EXISTS (SELECT 1 FROM gherkin_scenario WHERE requirement_id = OLD.id)
          OR EXISTS (SELECT 1 FROM gherkin_background WHERE requirement_id = OLD.id)) THEN
    RAISE EXCEPTION 'l’exigence a des scénarios ou un Contexte : son type ne change pas'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'requirement_type_locked_by_scenarios';
  END IF;
  RETURN NEW;
END
$$;

-- ── Row Level Security (D17) ───────────────────────────────────────────────
-- Tout membre consulte ; propriétaires et contributeurs écrivent le Contexte et
-- changent la langue ; initiative archivée : lecture seule. Une Fonctionnalité ne
-- se supprime qu'avec son exigence (clé étrangère, hors RLS).

ALTER TABLE gherkin_feature ENABLE ROW LEVEL SECURITY;

CREATE POLICY gherkin_feature_select ON gherkin_feature FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));
CREATE POLICY gherkin_feature_insert ON gherkin_feature FOR INSERT
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY gherkin_feature_update ON gherkin_feature FOR UPDATE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id))
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));

ALTER TABLE gherkin_background ENABLE ROW LEVEL SECURITY;

CREATE POLICY gherkin_background_select ON gherkin_background FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));
CREATE POLICY gherkin_background_insert ON gherkin_background FOR INSERT
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY gherkin_background_update ON gherkin_background FOR UPDATE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id))
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY gherkin_background_delete ON gherkin_background FOR DELETE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
