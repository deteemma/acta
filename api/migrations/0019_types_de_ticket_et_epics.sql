-- Types de ticket livrés et Epics (phase 2, ticket 18). Règles dans @app/shared
-- (tickets.ts, references.ts), reproduites ici comme seconde barrière (ADR-0006).

-- ── Types et statuts ───────────────────────────────────────────────────────

ALTER TABLE ticket DROP CONSTRAINT ticket_type_check;
ALTER TABLE ticket ADD CONSTRAINT ticket_type_check
  CHECK (type IN ('action', 'question', 'decision', 'risk', 'change_request', 'epic'));

-- Mêmes listes que TICKET_STATUSES.
ALTER TABLE ticket DROP CONSTRAINT ticket_status_check;
ALTER TABLE ticket ADD CONSTRAINT ticket_status_check CHECK (
  CASE type
    WHEN 'action'         THEN status IN ('todo', 'in_progress', 'on_hold', 'done', 'cancelled')
    WHEN 'question'       THEN status IN ('open', 'on_hold', 'answered', 'closed', 'rejected')
    WHEN 'decision'       THEN status IN ('proposed', 'on_hold', 'agreed', 'rejected')
    WHEN 'risk'           THEN status IN ('identified', 'on_hold', 'addressed', 'closed')
    WHEN 'change_request' THEN status IN ('submitted', 'analysed', 'on_hold', 'accepted', 'rejected')
    WHEN 'epic'           THEN status IN ('todo', 'in_progress', 'on_hold', 'done', 'cancelled')
  END
);
-- Le statut initial dépend du type : posé par le déclencheur ci-dessous.
ALTER TABLE ticket ALTER COLUMN status DROP DEFAULT;

-- ── Champs communs et champs propres ───────────────────────────────────────

-- Le responsable n'est obligatoire que pour l'Action ; la tâche, la technique et
-- la suggestion d'origine lui sont propres.
ALTER TABLE ticket ALTER COLUMN assignee_id DROP NOT NULL;
ALTER TABLE ticket ALTER COLUMN task_id DROP NOT NULL;
ALTER TABLE ticket ADD CONSTRAINT ticket_action_fields CHECK (
  CASE
    WHEN type = 'action' THEN assignee_id IS NOT NULL AND task_id IS NOT NULL
    ELSE task_id IS NULL AND technique_id IS NULL AND suggestion_key IS NULL
  END
);

-- Risque : mêmes valeurs que RISK_LEVELS ; aucune criticité calculée.
ALTER TABLE ticket ADD COLUMN probability text CHECK (probability IN ('low', 'medium', 'high'));
ALTER TABLE ticket ADD COLUMN impact text CHECK (impact IN ('low', 'medium', 'high'));
ALTER TABLE ticket ADD CONSTRAINT ticket_risk_fields
  CHECK (type = 'risk' OR (probability IS NULL AND impact IS NULL));

-- ── Epic ───────────────────────────────────────────────────────────────────

-- Un Epic qui contient des tickets ne se supprime pas (l'API traduit le refus en
-- `epicHasTickets`). Vérifié en fin d'instruction et non en RESTRICT : supprimer
-- une initiative emporte en une fois l'Epic et ses tickets.
ALTER TABLE ticket ADD COLUMN epic_id uuid;
ALTER TABLE ticket ADD CONSTRAINT ticket_epic_fkey
  FOREIGN KEY (initiative_id, epic_id) REFERENCES ticket (initiative_id, id);
ALTER TABLE ticket ADD CONSTRAINT ticket_no_epic_in_epic CHECK (type <> 'epic' OR epic_id IS NULL);
CREATE INDEX ticket_epic_id_idx ON ticket (epic_id);

-- ── Parties prenantes interrogées (Question) ───────────────────────────────

-- La clé porte aussi le type : seule une Question en a. Elles partent avec la
-- question ; tant qu'elles y figurent, elles ne se suppriment pas (l'API traduit
-- le refus en `stakeholderLinked`).
ALTER TABLE ticket ADD CONSTRAINT ticket_initiative_id_id_type_key UNIQUE (initiative_id, id, type);
CREATE TABLE question_stakeholder (
  initiative_id  uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  ticket_id      uuid NOT NULL,
  ticket_type    text NOT NULL DEFAULT 'question' CHECK (ticket_type = 'question'),
  stakeholder_id uuid NOT NULL,
  PRIMARY KEY (ticket_id, stakeholder_id),
  CONSTRAINT question_stakeholder_ticket_fkey
    FOREIGN KEY (initiative_id, ticket_id, ticket_type) REFERENCES ticket (initiative_id, id, type) ON DELETE CASCADE,
  CONSTRAINT question_stakeholder_stakeholder_fkey
    FOREIGN KEY (initiative_id, stakeholder_id) REFERENCES stakeholder (initiative_id, id)
);
CREATE INDEX question_stakeholder_stakeholder_id_idx ON question_stakeholder (stakeholder_id);

ALTER TABLE question_stakeholder ENABLE ROW LEVEL SECURITY;

CREATE POLICY question_stakeholder_select ON question_stakeholder FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));
CREATE POLICY question_stakeholder_insert ON question_stakeholder FOR INSERT
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY question_stakeholder_delete ON question_stakeholder FOR DELETE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));

-- ── Références ─────────────────────────────────────────────────────────────

-- Aucune règle ne prévoit d'autres acronymes : si l'administration a donné l'un
-- d'eux à une autre catégorie, la migration s'arrête et la responsable
-- fonctionnelle tranche.
DO $$
DECLARE
  v_taken text;
BEGIN
  SELECT string_agg(acronym, ', ') INTO v_taken
  FROM reference_acronym WHERE acronym IN ('QU', 'DE', 'RI', 'DC', 'EP');
  IF v_taken IS NOT NULL THEN
    RAISE EXCEPTION 'acronymes déjà portés par une autre catégorie : % ; à trancher avant les types de ticket', v_taken;
  END IF;
END
$$;

ALTER TABLE reference_acronym DROP CONSTRAINT reference_acronym_category_check;
ALTER TABLE reference_acronym ADD CONSTRAINT reference_acronym_category_check
  CHECK (category IN ('need', 'requirement', 'action', 'question', 'decision', 'risk', 'change_request', 'epic'));
ALTER TABLE reference_category DROP CONSTRAINT reference_category_category_check;
ALTER TABLE reference_category ADD CONSTRAINT reference_category_category_check
  CHECK (category IN ('need', 'requirement', 'action', 'question', 'decision', 'risk', 'change_request', 'epic'));
INSERT INTO reference_acronym VALUES ('QU', 'question'), ('DE', 'decision'), ('RI', 'risk'), ('DC', 'change_request'), ('EP', 'epic');
INSERT INTO reference_category VALUES ('question', 'QU'), ('decision', 'DE'), ('risk', 'RI'), ('change_request', 'DC'), ('epic', 'EP');

-- ── Règles écrites par le déclencheur ──────────────────────────────────────

-- Référence, statut initial, auteurs et dates ; le ticket ne change ni
-- d'initiative ni de type. Le responsable et l'Epic sont vérifiés quand ils
-- changent : ils le restent si le responsable quitte l'initiative.
CREATE OR REPLACE FUNCTION enforce_ticket_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.reference := next_reference(NEW.initiative_id, NEW.type);
    NEW.status := CASE NEW.type
      WHEN 'question' THEN 'open'
      WHEN 'decision' THEN 'proposed'
      WHEN 'risk' THEN 'identified'
      WHEN 'change_request' THEN 'submitted'
      ELSE 'todo'
    END;
    NEW.created_by := current_app_user_id();
    NEW.created_at := now();
  ELSE
    IF NEW.initiative_id IS DISTINCT FROM OLD.initiative_id THEN
      RAISE EXCEPTION 'un ticket ne change pas d’initiative' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.type IS DISTINCT FROM OLD.type THEN
      RAISE EXCEPTION 'un ticket ne change pas de type' USING ERRCODE = 'insufficient_privilege';
    END IF;
    NEW.reference := OLD.reference;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_by := current_app_user_id();
  NEW.updated_at := now();
  IF NEW.assignee_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id)
     AND NOT EXISTS (
       SELECT 1 FROM initiative_member
       WHERE initiative_id = NEW.initiative_id AND user_id = NEW.assignee_id AND role >= 'contributor'
     ) THEN
    RAISE EXCEPTION 'le responsable doit être propriétaire ou contributeur de l’initiative'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'ticket_assignee_eligible';
  END IF;
  IF NEW.epic_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.epic_id IS DISTINCT FROM OLD.epic_id)
     AND NOT EXISTS (
       SELECT 1 FROM ticket
       WHERE id = NEW.epic_id AND initiative_id = NEW.initiative_id AND type = 'epic'
     ) THEN
    RAISE EXCEPTION 'un ticket ne rejoint qu’un Epic de la même initiative'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'ticket_epic_valid';
  END IF;
  RETURN NEW;
END
$$;

-- ── Historique ─────────────────────────────────────────────────────────────

-- Champs suivis (TicketSnapshot), pour tous les types. Les liens n'en font pas
-- partie. Noms et titres : ceux du moment, qui restent lisibles ensuite.
CREATE OR REPLACE FUNCTION ticket_fields(p_ticket_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'title', t.title,
    'description', t.description,
    'status', t.status,
    'taskId', t.task_id,
    'techniqueId', t.technique_id,
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

-- Renommer une personne, une partie prenante ou un Epic ne modifie pas le ticket
-- (même règle que ticketHistory).
CREATE OR REPLACE FUNCTION ticket_fields_identity(p_fields jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT p_fields - 'assignee' - 'epic' - 'stakeholders' - 'questionedStakeholders' || jsonb_build_object(
    'assignee', p_fields #> '{assignee,userId}',
    'epic', p_fields #> '{epic,id}',
    'stakeholders', (
      SELECT coalesce(jsonb_agg(s -> 'id' ORDER BY s ->> 'id'), '[]')
      FROM jsonb_array_elements(p_fields -> 'stakeholders') s
    ),
    'questionedStakeholders', (
      SELECT coalesce(jsonb_agg(s -> 'id' ORDER BY s ->> 'id'), '[]')
      FROM jsonb_array_elements(p_fields -> 'questionedStakeholders') s
    )
  )
$$;

CREATE CONSTRAINT TRIGGER question_stakeholder_record_version
  AFTER INSERT OR DELETE ON question_stakeholder DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ticket_changed();

-- Actions existantes : les nouveaux champs, vides, complètent l'état connu et
-- l'historique, sans quoi la prochaine écriture passerait pour une modification.
UPDATE ticket_snapshot SET snapshot = ticket_fields(ticket_id);
UPDATE ticket_version SET
  snapshot_before = snapshot_before || '{"probability": null, "impact": null, "epic": null, "questionedStakeholders": []}',
  snapshot_after = snapshot_after || '{"probability": null, "impact": null, "epic": null, "questionedStakeholders": []}';
