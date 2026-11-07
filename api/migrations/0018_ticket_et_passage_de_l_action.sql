-- Ticket générique et passage de l'Action (phase 2, ticket 16) : la table des
-- actions devient celle des tickets, renommée plutôt que recopiée : lignes, clés,
-- liens et suggestions d'origine restent en place. Seul le type Action existe
-- pour l'instant (les autres : ticket 18). Règles dans @app/shared (actions.ts,
-- references.ts, roles.ts), reproduites ici comme seconde barrière (ADR-0006).

-- ── Renommages ─────────────────────────────────────────────────────────────

ALTER TABLE action RENAME TO ticket;
ALTER INDEX action_initiative_id_idx RENAME TO ticket_initiative_id_idx;
ALTER INDEX action_assignee_id_idx RENAME TO ticket_assignee_id_idx;
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'ticket'::regclass AND conname LIKE 'action\_%' LOOP
    EXECUTE format('ALTER TABLE ticket RENAME CONSTRAINT %I TO %I', c.conname, 'ticket_' || substr(c.conname, 8));
  END LOOP;
END
$$;
ALTER POLICY action_select ON ticket RENAME TO ticket_select;
ALTER POLICY action_insert ON ticket RENAME TO ticket_insert;
ALTER POLICY action_update ON ticket RENAME TO ticket_update;
ALTER POLICY action_delete ON ticket RENAME TO ticket_delete;
ALTER TRIGGER action_enforce_rules ON ticket RENAME TO ticket_enforce_rules;
ALTER TRIGGER action_keep_suggestion_key ON ticket RENAME TO ticket_keep_suggestion_key;
ALTER TRIGGER action_record_assignment ON ticket RENAME TO ticket_record_assignment;
ALTER FUNCTION enforce_action_rules() RENAME TO enforce_ticket_rules;
ALTER FUNCTION keep_action_suggestion_key() RENAME TO keep_ticket_suggestion_key;
ALTER FUNCTION record_action_assignment() RENAME TO record_ticket_assignment;
ALTER FUNCTION appears_in_my_actions(text) RENAME TO appears_in_my_tickets;

-- Liens avec les besoins et les exigences : ils deviennent des liens du ticket.
ALTER TABLE action_need RENAME TO ticket_need;
ALTER TABLE ticket_need RENAME COLUMN action_id TO ticket_id;
ALTER TABLE ticket_need RENAME CONSTRAINT action_need_pkey TO ticket_need_pkey;
ALTER TABLE ticket_need RENAME CONSTRAINT action_need_action_fkey TO ticket_need_ticket_fkey;
ALTER TABLE ticket_need RENAME CONSTRAINT action_need_need_fkey TO ticket_need_need_fkey;
ALTER INDEX action_need_need_id_idx RENAME TO ticket_need_need_id_idx;
ALTER POLICY action_need_select ON ticket_need RENAME TO ticket_need_select;
ALTER POLICY action_need_insert ON ticket_need RENAME TO ticket_need_insert;
ALTER POLICY action_need_delete ON ticket_need RENAME TO ticket_need_delete;

ALTER TABLE action_requirement RENAME TO ticket_requirement;
ALTER TABLE ticket_requirement RENAME COLUMN action_id TO ticket_id;
ALTER TABLE ticket_requirement RENAME CONSTRAINT action_requirement_pkey TO ticket_requirement_pkey;
ALTER TABLE ticket_requirement RENAME CONSTRAINT action_requirement_action_fkey TO ticket_requirement_ticket_fkey;
ALTER TABLE ticket_requirement RENAME CONSTRAINT action_requirement_requirement_fkey TO ticket_requirement_requirement_fkey;
ALTER INDEX action_requirement_requirement_id_idx RENAME TO ticket_requirement_requirement_id_idx;
ALTER POLICY action_requirement_select ON ticket_requirement RENAME TO ticket_requirement_select;
ALTER POLICY action_requirement_insert ON ticket_requirement RENAME TO ticket_requirement_insert;
ALTER POLICY action_requirement_delete ON ticket_requirement RENAME TO ticket_requirement_delete;

-- Parties prenantes concernées : un champ propre à l'Action, la table garde son nom.
ALTER TABLE action_stakeholder RENAME COLUMN action_id TO ticket_id;
ALTER TABLE action_stakeholder RENAME CONSTRAINT action_stakeholder_action_fkey TO action_stakeholder_ticket_fkey;

-- ── Type et statut ─────────────────────────────────────────────────────────

-- Choisi à la création, ne change plus (déclencheur ci-dessous).
ALTER TABLE ticket ADD COLUMN type text NOT NULL DEFAULT 'action' CHECK (type = 'action');
ALTER TABLE ticket ALTER COLUMN type DROP DEFAULT;

-- Même liste que ACTION_STATUSES ; en texte, pour que chaque type de ticket ait
-- ses statuts (ticket 18). En attente n'est pas un statut fermé (isOpenAction).
ALTER TABLE ticket ALTER COLUMN status DROP DEFAULT;
ALTER TABLE ticket ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE ticket ALTER COLUMN status SET DEFAULT 'todo';
ALTER TABLE ticket ADD CONSTRAINT ticket_status_check
  CHECK (status IN ('todo', 'in_progress', 'on_hold', 'done', 'cancelled'));
DROP TYPE action_status;

-- ── Références ─────────────────────────────────────────────────────────────

-- Aucune règle ne prévoit qu'un autre acronyme remplace AC : si l'administration
-- l'a donné à une autre catégorie, la migration s'arrête et la responsable
-- fonctionnelle tranche.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM reference_acronym WHERE acronym = 'AC') THEN
    RAISE EXCEPTION 'l’acronyme AC est déjà porté par une autre catégorie : à trancher avant le passage de l’Action';
  END IF;
END
$$;

ALTER TABLE reference_acronym DROP CONSTRAINT reference_acronym_category_check;
ALTER TABLE reference_acronym ADD CONSTRAINT reference_acronym_category_check
  CHECK (category IN ('need', 'requirement', 'action'));
ALTER TABLE reference_category DROP CONSTRAINT reference_category_category_check;
ALTER TABLE reference_category ADD CONSTRAINT reference_category_category_check
  CHECK (category IN ('need', 'requirement', 'action'));
INSERT INTO reference_acronym VALUES ('AC', 'action');
INSERT INTO reference_category VALUES ('action', 'AC');

-- Attribuée par le déclencheur ci-dessous, ne change plus. Actions existantes :
-- par date de création dans chaque initiative, la plus ancienne reçoit le 001 ;
-- le compteur reprend à la suite. Comme pour les besoins et les exigences, une
-- référence attribuée fige le code de l'initiative.
ALTER TABLE ticket ADD COLUMN reference text;
-- Reprise sans auteur de modification : les déclencheurs du ticket sont suspendus.
ALTER TABLE ticket DISABLE TRIGGER USER;
UPDATE ticket t
SET reference = n.code || '-AC-' || lpad(n.number::text, greatest(3, length(n.number::text)), '0')
FROM (
  SELECT a.id, i.code, row_number() OVER (PARTITION BY a.initiative_id ORDER BY a.created_at, a.id) AS number
  FROM ticket a
  JOIN initiative i ON i.id = a.initiative_id
) n
WHERE n.id = t.id;
ALTER TABLE ticket ENABLE TRIGGER USER;
INSERT INTO reference_counter (initiative_id, category, last_number)
SELECT initiative_id, 'action', count(*) FROM ticket GROUP BY initiative_id;
ALTER TABLE ticket ALTER COLUMN reference SET NOT NULL;
ALTER TABLE ticket ADD CONSTRAINT ticket_reference_key UNIQUE (reference);

-- Référence, auteurs et dates ; le ticket ne change ni d'initiative ni de type.
-- Le responsable est vérifié à chaque attribution. SECURITY DEFINER : tient le
-- compteur et lit le rôle du responsable sans repasser par la RLS.
CREATE OR REPLACE FUNCTION enforce_ticket_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.reference := next_reference(NEW.initiative_id, NEW.type);
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
  IF (TG_OP = 'INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id)
     AND NOT EXISTS (
       SELECT 1 FROM initiative_member
       WHERE initiative_id = NEW.initiative_id AND user_id = NEW.assignee_id AND role >= 'contributor'
     ) THEN
    RAISE EXCEPTION 'le responsable doit être propriétaire ou contributeur de l’initiative'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'ticket_assignee_eligible';
  END IF;
  RETURN NEW;
END
$$;

-- ── Historique ─────────────────────────────────────────────────────────────

-- Une ligne par transaction qui modifie au moins un champ : qui, quand, et l'état
-- des champs avant et après (actionHistory compare les deux). Écrite seulement
-- par record_ticket_version ; part avec le ticket.
CREATE TABLE ticket_version (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  initiative_id   uuid NOT NULL,
  ticket_id       uuid NOT NULL,
  changed_by      text NOT NULL REFERENCES app_user (id),
  changed_at      timestamptz NOT NULL,
  snapshot_before jsonb NOT NULL,
  snapshot_after  jsonb NOT NULL,
  CONSTRAINT ticket_version_ticket_fkey
    FOREIGN KEY (initiative_id, ticket_id) REFERENCES ticket (initiative_id, id) ON DELETE CASCADE
);
CREATE INDEX ticket_version_ticket_id_idx ON ticket_version (ticket_id, id);

-- Dernier état connu de chaque ticket, d'où vient l'« avant » de sa prochaine
-- modification. Sans politique, aucune ligne n'est accessible directement.
CREATE TABLE ticket_snapshot (
  ticket_id uuid PRIMARY KEY REFERENCES ticket (id) ON DELETE CASCADE,
  snapshot  jsonb NOT NULL
);
ALTER TABLE ticket_snapshot ENABLE ROW LEVEL SECURITY;

-- Champs suivis (ActionSnapshot). Les liens avec les besoins et les exigences
-- n'en font pas partie. Noms des personnes et des parties prenantes : ceux du
-- moment, qui restent lisibles même si elles disparaissent ensuite.
CREATE FUNCTION ticket_fields(p_ticket_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'title', t.title,
    'description', t.description,
    'status', t.status,
    'taskId', t.task_id,
    'techniqueId', t.technique_id,
    'dueDate', t.due_date::text,
    'assignee', jsonb_build_object('userId', u.id, 'email', u.email, 'displayName', u.display_name),
    'stakeholders', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) ORDER BY s.id), '[]')
      FROM action_stakeholder l JOIN stakeholder s ON s.id = l.stakeholder_id
      WHERE l.ticket_id = t.id
    )
  )
  FROM ticket t
  JOIN app_user u ON u.id = t.assignee_id
  WHERE t.id = p_ticket_id
$$;
REVOKE EXECUTE ON FUNCTION ticket_fields(uuid) FROM PUBLIC;

-- Ce qui compte pour dire qu'un champ a changé : renommer une personne ou une
-- partie prenante ne modifie pas le ticket (même règle que actionHistory).
CREATE FUNCTION ticket_fields_identity(p_fields jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT p_fields - 'assignee' - 'stakeholders' || jsonb_build_object(
    'assignee', p_fields #> '{assignee,userId}',
    'stakeholders', (
      SELECT coalesce(jsonb_agg(s -> 'id' ORDER BY s ->> 'id'), '[]')
      FROM jsonb_array_elements(p_fields -> 'stakeholders') s
    )
  )
$$;

-- En fin de transaction, une fois les parties prenantes écrites. À la création,
-- seul l'état de départ est retenu : l'auteur et la date de création sont sur le
-- ticket. Un ticket supprimé entre-temps est ignoré. Le verrou fait passer l'une
-- après l'autre deux modifications simultanées du même ticket.
CREATE FUNCTION record_ticket_version(p_ticket_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_initiative_id uuid;
  v_before        jsonb;
  v_after         jsonb;
BEGIN
  SELECT snapshot INTO v_before FROM ticket_snapshot WHERE ticket_id = p_ticket_id FOR UPDATE;
  SELECT initiative_id INTO v_initiative_id FROM ticket WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  v_after := ticket_fields(p_ticket_id);
  IF v_before IS NULL THEN
    INSERT INTO ticket_snapshot (ticket_id, snapshot) VALUES (p_ticket_id, v_after);
  ELSIF ticket_fields_identity(v_before) IS DISTINCT FROM ticket_fields_identity(v_after) THEN
    INSERT INTO ticket_version (initiative_id, ticket_id, changed_by, changed_at, snapshot_before, snapshot_after)
    VALUES (v_initiative_id, p_ticket_id, current_app_user_id(), now(), v_before, v_after);
    UPDATE ticket_snapshot SET snapshot = v_after WHERE ticket_id = p_ticket_id;
  END IF;
END
$$;
REVOKE EXECUTE ON FUNCTION record_ticket_version(uuid) FROM PUBLIC;

-- Actions existantes : leur état actuel sert de départ, l'historique reste vide.
INSERT INTO ticket_snapshot (ticket_id, snapshot) SELECT id, ticket_fields(id) FROM ticket;

CREATE FUNCTION ticket_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
  ELSE
    v_row := to_jsonb(NEW);
  END IF;
  -- `id` pour le ticket lui-même, `ticket_id` pour ses parties prenantes.
  PERFORM record_ticket_version(coalesce(v_row ->> 'ticket_id', v_row ->> 'id')::uuid);
  RETURN NULL;
END
$$;
CREATE CONSTRAINT TRIGGER ticket_record_version
  AFTER INSERT OR UPDATE ON ticket DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ticket_changed();
CREATE CONSTRAINT TRIGGER action_stakeholder_record_version
  AFTER INSERT OR DELETE ON action_stakeholder DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ticket_changed();

-- Historique : consultable par tout membre ; aucune écriture directe.
ALTER TABLE ticket_version ENABLE ROW LEVEL SECURITY;

CREATE POLICY ticket_version_select ON ticket_version FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));

-- ── Fonctions qui lisaient la table `action` ───────────────────────────────

-- Le responsable, les auteurs et ceux qui ont modifié un ticket restent lisibles,
-- même après leur départ de l'initiative.
CREATE OR REPLACE FUNCTION appears_in_my_tickets(p_user_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM ticket t
    JOIN initiative_member mine ON mine.initiative_id = t.initiative_id
    WHERE mine.user_id = current_app_user_id()
      AND p_user_id IN (t.assignee_id, t.assigned_by, t.created_by, t.updated_by)
  ) OR EXISTS (
    SELECT 1 FROM ticket_version v
    JOIN initiative_member mine ON mine.initiative_id = v.initiative_id
    WHERE mine.user_id = current_app_user_id()
      AND v.changed_by = p_user_id
  )
$$;

-- Les techniques ne sont portées que par les Actions.
CREATE OR REPLACE FUNCTION technique_usage_counts()
RETURNS TABLE (technique_id text, action_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.technique_id, count(*)
  FROM ticket t
  WHERE t.type = 'action' AND t.technique_id IS NOT NULL AND current_app_user_id() IS NOT NULL
  GROUP BY t.technique_id
$$;
