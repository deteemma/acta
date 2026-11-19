-- Historique des scénarios et du Contexte (phase 3, ticket 03). Règles dans
-- @app/shared (scenarios.ts : scenarioHistory, backgroundHistory), reproduites ici
-- comme seconde barrière (ADR-0006). Décisions D3, D13 et D17 de .scratch/phase-3/spec.md.
--
-- Une ligne par modification du titre ou du texte d'un scénario, du texte du
-- Contexte : qui, quand, et l'état avant et après. La création n'y figure pas :
-- son auteur et sa date sont sur le scénario ou le Contexte. Un changement d'ordre
-- (position) ou de langue (gherkin_feature) n'y entre jamais (D13). Rien n'est
-- écrit dans requirement_version (D13). Chaque historique part avec son scénario,
-- son Contexte ou leur exigence (D3).
-- Scénarios et Contextes existants : l'historique commence à leur création, les
-- modifications antérieures à cette migration ne sont pas reconstituées.
-- Aucune table vers le téléphone (D19).

-- ── Scénario ───────────────────────────────────────────────────────────────

CREATE TABLE gherkin_scenario_version (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  initiative_id   uuid NOT NULL,
  scenario_id     uuid NOT NULL,
  changed_by      text NOT NULL REFERENCES app_user (id),
  changed_at      timestamptz NOT NULL,
  -- ScenarioSnapshot : { title, text }.
  snapshot_before jsonb NOT NULL,
  snapshot_after  jsonb NOT NULL,
  CONSTRAINT gherkin_scenario_version_scenario_fkey
    FOREIGN KEY (initiative_id, scenario_id) REFERENCES gherkin_scenario (initiative_id, id) ON DELETE CASCADE
);
CREATE INDEX gherkin_scenario_version_scenario_idx ON gherkin_scenario_version (scenario_id, id);

-- Auteur et date : ceux que enforce_gherkin_scenario_rules vient de poser.
CREATE FUNCTION record_gherkin_scenario_version() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO gherkin_scenario_version (initiative_id, scenario_id, changed_by, changed_at, snapshot_before, snapshot_after)
  VALUES (
    NEW.initiative_id, NEW.id, NEW.updated_by, NEW.updated_at,
    jsonb_build_object('title', OLD.title, 'text', OLD.text),
    jsonb_build_object('title', NEW.title, 'text', NEW.text)
  );
  RETURN NULL;
END
$$;
CREATE TRIGGER gherkin_scenario_record_version
  AFTER UPDATE OF title, text ON gherkin_scenario FOR EACH ROW
  WHEN (OLD.title IS DISTINCT FROM NEW.title OR OLD.text IS DISTINCT FROM NEW.text)
  EXECUTE FUNCTION record_gherkin_scenario_version();

-- ── Contexte ───────────────────────────────────────────────────────────────

-- L'initiative de l'historique est celle du Contexte, garantie par la clé étrangère.
ALTER TABLE gherkin_background
  ADD CONSTRAINT gherkin_background_initiative_requirement_key UNIQUE (initiative_id, requirement_id);

CREATE TABLE gherkin_background_version (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  initiative_id   uuid NOT NULL,
  requirement_id  uuid NOT NULL,
  changed_by      text NOT NULL REFERENCES app_user (id),
  changed_at      timestamptz NOT NULL,
  -- BackgroundSnapshot : { text }.
  snapshot_before jsonb NOT NULL,
  snapshot_after  jsonb NOT NULL,
  CONSTRAINT gherkin_background_version_background_fkey
    FOREIGN KEY (initiative_id, requirement_id) REFERENCES gherkin_background (initiative_id, requirement_id) ON DELETE CASCADE
);
CREATE INDEX gherkin_background_version_requirement_idx ON gherkin_background_version (requirement_id, id);

CREATE FUNCTION record_gherkin_background_version() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO gherkin_background_version (initiative_id, requirement_id, changed_by, changed_at, snapshot_before, snapshot_after)
  VALUES (
    NEW.initiative_id, NEW.requirement_id, NEW.updated_by, NEW.updated_at,
    jsonb_build_object('text', OLD.text),
    jsonb_build_object('text', NEW.text)
  );
  RETURN NULL;
END
$$;
CREATE TRIGGER gherkin_background_record_version
  AFTER UPDATE OF text ON gherkin_background FOR EACH ROW
  WHEN (OLD.text IS DISTINCT FROM NEW.text)
  EXECUTE FUNCTION record_gherkin_background_version();

-- ── Row Level Security (D13, D17) ──────────────────────────────────────────
-- Consultable par tout membre, initiative archivée comprise ; aucune écriture
-- directe : seuls les déclencheurs ci-dessus écrivent.

ALTER TABLE gherkin_scenario_version ENABLE ROW LEVEL SECURITY;

CREATE POLICY gherkin_scenario_version_select ON gherkin_scenario_version FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));

ALTER TABLE gherkin_background_version ENABLE ROW LEVEL SECURITY;

CREATE POLICY gherkin_background_version_select ON gherkin_background_version FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));

-- Les auteurs des scénarios, du Contexte et de leurs modifications restent
-- lisibles, même après leur départ de l'initiative.
CREATE FUNCTION appears_in_my_scenarios(p_user_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM gherkin_scenario s
    JOIN initiative_member mine ON mine.initiative_id = s.initiative_id
    WHERE mine.user_id = current_app_user_id() AND p_user_id IN (s.created_by, s.updated_by)
  ) OR EXISTS (
    SELECT 1 FROM gherkin_background b
    JOIN initiative_member mine ON mine.initiative_id = b.initiative_id
    WHERE mine.user_id = current_app_user_id() AND p_user_id IN (b.created_by, b.updated_by)
  ) OR EXISTS (
    SELECT 1 FROM gherkin_scenario_version v
    JOIN initiative_member mine ON mine.initiative_id = v.initiative_id
    WHERE mine.user_id = current_app_user_id() AND v.changed_by = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM gherkin_background_version v
    JOIN initiative_member mine ON mine.initiative_id = v.initiative_id
    WHERE mine.user_id = current_app_user_id() AND v.changed_by = p_user_id
  )
$$;
DROP POLICY app_user_select ON app_user;
CREATE POLICY app_user_select ON app_user FOR SELECT
  USING (id = current_app_user_id() OR shares_initiative_with(id) OR appears_in_my_owner_designations(id)
         OR appears_in_my_tickets(id) OR appears_in_my_stakeholders(id) OR appears_in_my_needs(id)
         OR appears_in_my_requirements(id) OR appears_in_my_pages(id) OR appears_in_my_comments(id)
         OR appears_in_my_attachments(id) OR appears_in_my_scenarios(id));
