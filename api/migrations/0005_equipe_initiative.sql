-- Équipe de l'initiative (ticket 04, ADR-0015) : rôle et indication « BA de
-- l'équipe » gérés par les propriétaires et les BA de l'équipe, départ libre,
-- trace des désignations de propriétaire. Règles dans @app/shared (team.ts),
-- reproduites ici comme seconde barrière (ADR-0006).

-- Vrai si l'utilisateur courant est BA de l'équipe de l'initiative.
-- SECURITY DEFINER : lit initiative_member sans repasser par sa RLS.
CREATE FUNCTION current_is_team_ba(p_initiative_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT is_team_ba FROM initiative_member
     WHERE initiative_id = p_initiative_id AND user_id = current_app_user_id()),
    false)
$$;

-- Modifier un membre : propriétaire, ou BA de l'équipe (détail vérifié par le
-- déclencheur). Retirer un membre : propriétaire, ou le membre lui-même (départ).
DROP POLICY initiative_member_update ON initiative_member;
DROP POLICY initiative_member_delete ON initiative_member;
CREATE POLICY initiative_member_update ON initiative_member FOR UPDATE
  USING ((has_initiative_role(initiative_id, 'owner') OR current_is_team_ba(initiative_id))
         AND NOT initiative_is_archived(initiative_id))
  WITH CHECK ((has_initiative_role(initiative_id, 'owner') OR current_is_team_ba(initiative_id))
              AND NOT initiative_is_archived(initiative_id));
CREATE POLICY initiative_member_delete ON initiative_member FOR DELETE
  USING ((has_initiative_role(initiative_id, 'owner') OR user_id = current_app_user_id())
         AND NOT initiative_is_archived(initiative_id));

-- Les politiques UPDATE ne voient pas l'ancienne ligne : les règles qui
-- comparent avant et après sont vérifiées ici. SECURITY DEFINER pour verrouiller
-- l'initiative : les changements d'équipe d'une même initiative passent l'un
-- après l'autre, ce qui rend sûr le contrôle « au moins un propriétaire et un BA ».
CREATE FUNCTION enforce_initiative_member_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM 1 FROM initiative WHERE id = coalesce(NEW.initiative_id, OLD.initiative_id) FOR UPDATE;
  IF TG_OP <> 'UPDATE' THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  IF NEW.initiative_id IS DISTINCT FROM OLD.initiative_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'un membre ne change pas d’initiative ni d’utilisateur' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- Subsidiarité : un BA de l'équipe non propriétaire peut seulement ajouter un
  -- propriétaire, ou attribuer et retirer l'indication.
  IF NOT has_initiative_role(OLD.initiative_id, 'owner')
     AND NOT (NEW.role = 'owner' AND OLD.role <> 'owner' AND NEW.is_team_ba = OLD.is_team_ba)
     AND NOT (NEW.role = OLD.role AND NEW.is_team_ba <> OLD.is_team_ba) THEN
    RAISE EXCEPTION 'réservé au propriétaire de l’initiative' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- Sur soi-même, l'indication se retire mais ne s'attribue pas.
  IF NEW.user_id = current_app_user_id() AND NEW.is_team_ba AND NOT OLD.is_team_ba THEN
    RAISE EXCEPTION 'on ne s’attribue pas soi-même l’indication BA de l’équipe' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER initiative_member_enforce_rules
  BEFORE INSERT OR UPDATE OR DELETE ON initiative_member
  FOR EACH ROW EXECUTE FUNCTION enforce_initiative_member_rules();

-- Une initiative a toujours au moins un propriétaire et au moins un BA de l'équipe.
CREATE FUNCTION enforce_initiative_team_invariants() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Suppression de l'initiative entière (cascade) : rien à garder.
  IF NOT EXISTS (SELECT 1 FROM initiative WHERE id = OLD.initiative_id) THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM initiative_member WHERE initiative_id = OLD.initiative_id AND role = 'owner') THEN
    RAISE EXCEPTION 'l’initiative doit garder au moins un propriétaire'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'initiative_keeps_owner';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM initiative_member WHERE initiative_id = OLD.initiative_id AND is_team_ba) THEN
    RAISE EXCEPTION 'l’initiative doit garder au moins un BA de l’équipe'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'initiative_keeps_team_ba';
  END IF;
  RETURN NULL;
END
$$;
CREATE TRIGGER initiative_member_enforce_team_invariants
  AFTER UPDATE OR DELETE ON initiative_member
  FOR EACH ROW EXECUTE FUNCTION enforce_initiative_team_invariants();

-- Trace des désignations de propriétaire : tout passage au rôle de propriétaire,
-- y compris à la création de l'initiative. Écrite seulement par le déclencheur.
CREATE TABLE owner_designation (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  initiative_id  uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  user_id        text NOT NULL REFERENCES app_user (id),
  -- Null : désignation faite hors de l'application (sans utilisateur courant).
  designated_by  text REFERENCES app_user (id),
  designated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX owner_designation_initiative_id_idx ON owner_designation (initiative_id, designated_at);

CREATE FUNCTION trace_owner_designation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'owner' AND (TG_OP = 'INSERT' OR OLD.role <> 'owner') THEN
    INSERT INTO owner_designation (initiative_id, user_id, designated_by)
    VALUES (NEW.initiative_id, NEW.user_id, current_app_user_id());
  END IF;
  RETURN NULL;
END
$$;
CREATE TRIGGER initiative_member_trace_owner_designation
  AFTER INSERT OR UPDATE OF role ON initiative_member
  FOR EACH ROW EXECUTE FUNCTION trace_owner_designation();

-- Initiatives existantes : leur créateur, propriétaire à la création.
INSERT INTO owner_designation (initiative_id, user_id, designated_by, designated_at)
SELECT id, created_by, created_by, created_at FROM initiative;

-- Consultable par tous les membres ; aucune écriture directe.
ALTER TABLE owner_designation ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_designation_select ON owner_designation FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));

-- Les noms des personnes citées dans la trace restent lisibles, même après
-- leur départ de l'initiative.
CREATE FUNCTION appears_in_my_owner_designations(p_user_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM owner_designation d
    JOIN initiative_member mine ON mine.initiative_id = d.initiative_id
    WHERE mine.user_id = current_app_user_id()
      AND (d.user_id = p_user_id OR d.designated_by = p_user_id)
  )
$$;
DROP POLICY app_user_select ON app_user;
CREATE POLICY app_user_select ON app_user FOR SELECT
  USING (id = current_app_user_id() OR shares_initiative_with(id) OR appears_in_my_owner_designations(id));
