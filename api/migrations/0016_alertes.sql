-- Alertes dans l'application (ticket 15) : déduites des actions par
-- @app/shared (alerts.ts). La base garde qui a attribué chaque action, et quand,
-- et le moment où chacun a ouvert pour la dernière fois ses alertes.

-- Dernière attribution d'une action : écrite par le déclencheur ci-dessous,
-- jamais par le client. Actions existantes : leur création.
ALTER TABLE action ADD COLUMN assigned_by text REFERENCES app_user (id);
ALTER TABLE action ADD COLUMN assigned_at timestamptz;
-- Reprise sans auteur de modification : le déclencheur des actions est suspendu.
ALTER TABLE action DISABLE TRIGGER action_enforce_rules;
UPDATE action SET assigned_by = created_by, assigned_at = created_at;
ALTER TABLE action ENABLE TRIGGER action_enforce_rules;
ALTER TABLE action ALTER COLUMN assigned_by SET NOT NULL;
ALTER TABLE action ALTER COLUMN assigned_at SET NOT NULL;

CREATE FUNCTION record_action_assignment() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    NEW.assigned_by := current_app_user_id();
    NEW.assigned_at := now();
  ELSE
    NEW.assigned_by := OLD.assigned_by;
    NEW.assigned_at := OLD.assigned_at;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER action_record_assignment
  BEFORE INSERT OR UPDATE ON action FOR EACH ROW EXECUTE FUNCTION record_action_assignment();

-- Dernière ouverture du panneau des alertes et alertes alors listées (alertKey).
-- Avant la première ouverture, la liste est NULL et la date sert de référence :
-- le déploiement pour les comptes existants (les alertes déjà présentes ne
-- sont pas nouvelles), la création du compte sinon. Les politiques RLS
-- existantes de app_user s'appliquent : chacun ne modifie que sa propre ligne.
ALTER TABLE app_user ADD COLUMN alerts_seen_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE app_user ADD COLUMN alerts_seen_keys text[];

-- L'auteur d'une attribution reste lisible, même après son départ de l'initiative.
CREATE OR REPLACE FUNCTION appears_in_my_actions(p_user_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM action a
    JOIN initiative_member mine ON mine.initiative_id = a.initiative_id
    WHERE mine.user_id = current_app_user_id()
      AND p_user_id IN (a.assignee_id, a.assigned_by, a.created_by, a.updated_by)
  )
$$;
