-- Fiche Initiative complète (ticket 03) : description, approche d'analyse,
-- dates facultatives, archivage. Règles dans @app/shared (roles.ts, schemas.ts),
-- reproduites ici comme seconde barrière (ADR-0006).

-- Approche d'analyse (tâche BABOK 3.1), même liste que ANALYSIS_APPROACHES.
CREATE TYPE analysis_approach AS ENUM ('predictive', 'adaptive');

ALTER TABLE initiative
  ADD COLUMN description       text CHECK (char_length(description) <= 4000),
  ADD COLUMN analysis_approach analysis_approach,
  ADD COLUMN start_date        date,
  ADD COLUMN planned_end_date  date,
  -- Archivage : l'auteur est enregistré, pas encore affiché.
  ADD COLUMN archived_at       timestamptz,
  ADD COLUMN archived_by       text REFERENCES app_user (id),
  ADD CONSTRAINT initiative_dates_order CHECK (planned_end_date >= start_date);

-- SECURITY DEFINER : utilisable dans les politiques des tables rattachées à
-- l'initiative sans dépendre de la RLS de initiative.
CREATE FUNCTION initiative_is_archived(p_initiative_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT archived_at IS NOT NULL FROM initiative WHERE id = p_initiative_id), false)
$$;

-- Les politiques UPDATE ne voient pas l'ancienne ligne : les règles qui
-- comparent avant et après sont vérifiées par ce déclencheur.
CREATE FUNCTION enforce_initiative_update_rules() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Changer le code, archiver ou désarchiver : propriétaire seulement.
  IF (NEW.code IS DISTINCT FROM OLD.code
      OR NEW.archived_at IS DISTINCT FROM OLD.archived_at
      OR NEW.archived_by IS DISTINCT FROM OLD.archived_by)
     AND NOT has_initiative_role(OLD.id, 'owner') THEN
    RAISE EXCEPTION 'réservé au propriétaire de l’initiative' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- Initiative archivée : lecture seule, sauf pour la désarchiver.
  IF OLD.archived_at IS NOT NULL AND NEW.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'initiative archivée : lecture seule' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- Archiver ou désarchiver ne modifie rien d'autre dans la même requête.
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at
     AND to_jsonb(NEW) - '{archived_at,archived_by,updated_at}'::text[]
         IS DISTINCT FROM to_jsonb(OLD) - '{archived_at,archived_by,updated_at}'::text[] THEN
    RAISE EXCEPTION 'archiver ou désarchiver sans autre modification' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER initiative_enforce_update_rules
  BEFORE UPDATE ON initiative FOR EACH ROW EXECUTE FUNCTION enforce_initiative_update_rules();

-- Membres d'une initiative archivée : plus aucune modification.
DROP POLICY initiative_member_insert ON initiative_member;
DROP POLICY initiative_member_update ON initiative_member;
DROP POLICY initiative_member_delete ON initiative_member;
CREATE POLICY initiative_member_insert ON initiative_member FOR INSERT
  WITH CHECK (has_initiative_role(initiative_id, 'owner') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY initiative_member_update ON initiative_member FOR UPDATE
  USING (has_initiative_role(initiative_id, 'owner') AND NOT initiative_is_archived(initiative_id))
  WITH CHECK (has_initiative_role(initiative_id, 'owner') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY initiative_member_delete ON initiative_member FOR DELETE
  USING (has_initiative_role(initiative_id, 'owner') AND NOT initiative_is_archived(initiative_id));
