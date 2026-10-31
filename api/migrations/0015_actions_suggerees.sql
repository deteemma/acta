-- Encart « Actions suggérées » (ticket 14) : l'action garde la suggestion d'où
-- elle a été créée, et l'équipe peut écarter une suggestion. Règles dans
-- @app/shared (suggested-actions.ts, roles.ts), reproduites ici comme seconde
-- barrière (ADR-0006).

-- Clé d'une suggestion : même forme que suggestionKeySchema.
CREATE DOMAIN suggestion_key AS text CHECK (VALUE ~ '^R([1-9]|1[0-35]|14:[0-9]+)$');

-- Fixée à la création, ne change plus.
ALTER TABLE action ADD COLUMN suggestion_key suggestion_key;

CREATE FUNCTION keep_action_suggestion_key() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.suggestion_key := OLD.suggestion_key;
  RETURN NEW;
END
$$;
CREATE TRIGGER action_keep_suggestion_key
  BEFORE UPDATE ON action FOR EACH ROW EXECUTE FUNCTION keep_action_suggestion_key();

-- Suggestion écartée pour toute l'équipe (G7). L'API retire l'écart dès que la
-- situation de la suggestion n'existe plus : elle revient si la situation
-- réapparaît.
CREATE TABLE suggestion_dismissal (
  initiative_id  uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  suggestion_key suggestion_key NOT NULL,
  dismissed_by   text NOT NULL DEFAULT current_app_user_id() REFERENCES app_user (id),
  dismissed_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (initiative_id, suggestion_key)
);

-- Row Level Security : tout membre consulte ; propriétaires et contributeurs
-- écartent, et retirent un écart ; initiative archivée : lecture seule.
ALTER TABLE suggestion_dismissal ENABLE ROW LEVEL SECURITY;

CREATE POLICY suggestion_dismissal_select ON suggestion_dismissal FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));
CREATE POLICY suggestion_dismissal_insert ON suggestion_dismissal FOR INSERT
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id)
              AND dismissed_by = current_app_user_id());
CREATE POLICY suggestion_dismissal_delete ON suggestion_dismissal FOR DELETE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
