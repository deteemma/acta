-- Technique agile d'une action (Extension Agile, ticket 04 ; spécification D13
-- à D16). Règles dans @app/shared (actions.ts : createActionSchema,
-- updateActionSchema, offersAgileTechnique), appliquées par l'API (refus
-- agileExtensionDisabled, agileTechniquesInUse) et reproduites ici comme
-- seconde barrière (ADR-0006).

-- ── Champ « Technique agile » ──────────────────────────────────────────────

-- Distinct de la technique BABOK, facultatif, une technique agile au plus (D14).
ALTER TABLE ticket ADD COLUMN agile_technique_id text REFERENCES agile_technique (id);
CREATE INDEX ticket_agile_technique_id_idx ON ticket (initiative_id) WHERE agile_technique_id IS NOT NULL;

-- Propre à l'Action, comme la tâche et la technique BABOK (migration 0019).
ALTER TABLE ticket DROP CONSTRAINT ticket_action_fields;
ALTER TABLE ticket ADD CONSTRAINT ticket_action_fields CHECK (
  CASE
    WHEN type = 'action' THEN assignee_id IS NOT NULL AND task_id IS NOT NULL
    ELSE task_id IS NULL AND technique_id IS NULL AND agile_technique_id IS NULL AND suggestion_key IS NULL
  END
);

-- Une technique agile ne se pose que dans une initiative où le module est
-- activé (D6, D14), et jamais à la création depuis une action suggérée (D16).
-- La ligne de l'initiative est verrouillée en partage : une désactivation
-- simultanée attend la fin de cette écriture, puis la voit (D13).
CREATE FUNCTION enforce_ticket_agile_technique() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_enabled boolean;
BEGIN
  IF NEW.agile_technique_id IS NULL
     OR (TG_OP = 'UPDATE' AND NEW.agile_technique_id IS NOT DISTINCT FROM OLD.agile_technique_id) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.suggestion_key IS NOT NULL THEN
    RAISE EXCEPTION 'une action créée depuis une action suggérée n’a pas de technique agile'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'ticket_agile_technique_suggested';
  END IF;
  SELECT agile_extension_enabled INTO v_enabled FROM initiative WHERE id = NEW.initiative_id FOR SHARE;
  IF NOT coalesce(v_enabled, false) THEN
    RAISE EXCEPTION 'Extension Agile désactivée sur l’initiative'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'ticket_agile_extension_enabled';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER ticket_enforce_agile_technique
  BEFORE INSERT OR UPDATE OF agile_technique_id ON ticket
  FOR EACH ROW EXECUTE FUNCTION enforce_ticket_agile_technique();

-- ── Désactivation du module ────────────────────────────────────────────────

-- Refusée tant qu'au moins une action de l'initiative porte une technique
-- agile, quel que soit son statut, Terminée et Annulée comprises (D13). Compte
-- toutes les actions, sans dépendre de ce que la RLS laisse voir.
CREATE FUNCTION enforce_agile_extension_disable() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM ticket
  WHERE initiative_id = NEW.id AND type = 'action' AND agile_technique_id IS NOT NULL;
  -- Le nombre d'actions, en détail : l'API le reprend dans son message (D13).
  IF v_count > 0 THEN
    RAISE EXCEPTION 'des actions portent une technique agile'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'initiative_agile_techniques_in_use', DETAIL = v_count::text;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER initiative_enforce_agile_extension_disable
  BEFORE UPDATE OF agile_extension_enabled ON initiative
  FOR EACH ROW WHEN (OLD.agile_extension_enabled AND NOT NEW.agile_extension_enabled)
  EXECUTE FUNCTION enforce_agile_extension_disable();

-- ── Historique ─────────────────────────────────────────────────────────────

-- Même fonction que la migration 0019, avec la technique agile parmi les
-- champs suivis (D16).
CREATE OR REPLACE FUNCTION ticket_fields(p_ticket_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'title', t.title,
    'description', t.description,
    'status', t.status,
    'taskId', t.task_id,
    'techniqueId', t.technique_id,
    'agileTechniqueId', t.agile_technique_id,
    'dueDate', t.due_date::text,
    'probability', t.probability,
    'impact', t.impact,
    'assignee', CASE WHEN u.id IS NULL THEN NULL
      ELSE jsonb_build_object('userId', u.id, 'email', u.email, 'displayName', u.display_name) END,
    'epic', CASE WHEN e.id IS NULL THEN NULL
      ELSE jsonb_build_object('id', e.id, 'reference', e.reference, 'title', e.title) END,
    'stakeholders', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) ORDER BY s.id), '[]')
      FROM action_stakeholder l JOIN stakeholder s ON s.id = l.stakeholder_id
      WHERE l.ticket_id = t.id
    ),
    'questionedStakeholders', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) ORDER BY s.id), '[]')
      FROM question_stakeholder l JOIN stakeholder s ON s.id = l.stakeholder_id
      WHERE l.ticket_id = t.id
    )
  )
  FROM ticket t
  LEFT JOIN app_user u ON u.id = t.assignee_id
  LEFT JOIN ticket e ON e.id = t.epic_id
  WHERE t.id = p_ticket_id
$$;

-- Tickets existants : le nouveau champ, vide, complète l'état connu et
-- l'historique, sans quoi la prochaine écriture passerait pour une modification.
UPDATE ticket_snapshot SET snapshot = ticket_fields(ticket_id);
UPDATE ticket_version SET
  snapshot_before = snapshot_before || '{"agileTechniqueId": null}',
  snapshot_after = snapshot_after || '{"agileTechniqueId": null}';
