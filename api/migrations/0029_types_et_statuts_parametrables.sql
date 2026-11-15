-- Types de ticket et statuts paramétrables (phase 2, ticket 29, décisions 03 et
-- 14) : les six types livrés et leurs statuts, fixes, complétés par
-- l'administration ; liste valable pour toute l'application. Règles dans
-- @app/shared (ticket-type-catalog.ts), reproduites ici comme seconde barrière
-- (ADR-0006).

-- ── Types ──────────────────────────────────────────────────────────────────

CREATE TABLE ticket_type (
  -- Code d'un type livré (TICKET_TYPES), ou identifiant d'un type ajouté.
  code       text PRIMARY KEY,
  delivered  boolean NOT NULL DEFAULT false,
  -- Libellés d'un type ajouté (TICKET_LABEL_MAX_LENGTH) ; ceux d'un type livré
  -- sont ceux de l'interface (shared/src/i18n.ts).
  label_fr   text CHECK (char_length(label_fr) BETWEEN 1 AND 50 AND label_fr = btrim(label_fr)),
  label_en   text CHECK (char_length(label_en) BETWEEN 1 AND 50 AND label_en = btrim(label_en)),
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz,
  -- Un ticket de ce type a déjà été créé : le type ne se supprime plus.
  used       boolean NOT NULL DEFAULT false,
  CONSTRAINT ticket_type_added_fields
    CHECK (delivered = (label_fr IS NULL) AND delivered = (label_en IS NULL) AND delivered = (created_at IS NULL)),
  CONSTRAINT ticket_type_delivered_active CHECK (active OR NOT delivered)
);
INSERT INTO ticket_type (code, delivered) VALUES
  ('action', true), ('question', true), ('decision', true), ('risk', true), ('change_request', true), ('epic', true);
UPDATE ticket_type SET used = true WHERE code IN (SELECT type FROM ticket);

-- Deux ajouts simultanés du même libellé : le second est refusé. La règle
-- complète (accents ignorés, types livrés compris) est checkTicketTypeCreation.
CREATE UNIQUE INDEX ticket_type_label_fr_key ON ticket_type (lower(label_fr));
CREATE UNIQUE INDEX ticket_type_label_en_key ON ticket_type (lower(label_en));

-- ── Statuts ────────────────────────────────────────────────────────────────

CREATE TABLE ticket_status (
  type      text NOT NULL REFERENCES ticket_type (code) ON DELETE CASCADE,
  -- Code d'un statut livré (TICKET_STATUSES), ou identifiant d'un statut ajouté.
  code      text NOT NULL,
  -- Ordre dans le type : livrés, puis ajoutés dans l'ordre d'ajout. Le premier
  -- est le statut initial.
  position  integer NOT NULL,
  delivered boolean NOT NULL DEFAULT false,
  label_fr  text CHECK (char_length(label_fr) BETWEEN 1 AND 50 AND label_fr = btrim(label_fr)),
  label_en  text CHECK (char_length(label_en) BETWEEN 1 AND 50 AND label_en = btrim(label_en)),
  -- Même liste que STATUS_TONES ; « neutre atténué » reste aux statuts livrés.
  tone      text NOT NULL CHECK (tone IN ('neutral', 'muted', 'progress', 'positive', 'attention', 'negative')),
  closed    boolean NOT NULL,
  active    boolean NOT NULL DEFAULT true,
  -- Déjà porté par un ticket : le statut ne se supprime plus.
  used      boolean NOT NULL DEFAULT false,
  PRIMARY KEY (type, code),
  UNIQUE (type, position),
  CONSTRAINT ticket_status_added_fields CHECK (delivered = (label_fr IS NULL) AND delivered = (label_en IS NULL)),
  CONSTRAINT ticket_status_delivered_active CHECK (active OR NOT delivered),
  CONSTRAINT ticket_status_added_tone CHECK (delivered OR tone <> 'muted')
);

-- Statuts livrés (décision 03, points 2, 3 et 6) : mêmes listes que
-- TICKET_STATUSES, DELIVERED_TICKET_TONES et CLOSED_TICKET_STATUSES.
INSERT INTO ticket_status (type, code, position, delivered, tone, closed) VALUES
  ('action', 'todo', 1, true, 'neutral', false),
  ('action', 'in_progress', 2, true, 'progress', false),
  ('action', 'on_hold', 3, true, 'attention', false),
  ('action', 'done', 4, true, 'positive', true),
  ('action', 'cancelled', 5, true, 'muted', true),
  ('question', 'open', 1, true, 'neutral', false),
  ('question', 'on_hold', 2, true, 'attention', false),
  ('question', 'answered', 3, true, 'progress', false),
  ('question', 'closed', 4, true, 'positive', true),
  ('question', 'rejected', 5, true, 'negative', true),
  ('decision', 'proposed', 1, true, 'neutral', false),
  ('decision', 'on_hold', 2, true, 'attention', false),
  ('decision', 'agreed', 3, true, 'positive', true),
  ('decision', 'rejected', 4, true, 'negative', true),
  ('risk', 'identified', 1, true, 'attention', false),
  ('risk', 'on_hold', 2, true, 'attention', false),
  ('risk', 'addressed', 3, true, 'progress', false),
  ('risk', 'closed', 4, true, 'positive', true),
  ('change_request', 'submitted', 1, true, 'neutral', false),
  ('change_request', 'analysed', 2, true, 'progress', false),
  ('change_request', 'on_hold', 3, true, 'attention', false),
  ('change_request', 'accepted', 4, true, 'positive', true),
  ('change_request', 'rejected', 5, true, 'negative', true),
  ('epic', 'todo', 1, true, 'neutral', false),
  ('epic', 'in_progress', 2, true, 'progress', false),
  ('epic', 'on_hold', 3, true, 'attention', false),
  ('epic', 'done', 4, true, 'positive', true),
  ('epic', 'cancelled', 5, true, 'muted', true);
UPDATE ticket_status s SET used = true
WHERE EXISTS (SELECT 1 FROM ticket t WHERE t.type = s.type AND t.status = s.code);

-- Libellés distincts au sein d'un type (choix validé le 13.11.2026) ; règle
-- complète, statuts livrés compris : checkTicketStatusCreation.
CREATE UNIQUE INDEX ticket_status_label_fr_key ON ticket_status (type, lower(label_fr));
CREATE UNIQUE INDEX ticket_status_label_en_key ON ticket_status (type, lower(label_en));

-- Lisibles par tous ; modifiables seulement par les fonctions admin_* ci-dessous.
ALTER TABLE ticket_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY ticket_type_select ON ticket_type FOR SELECT USING (true);
CREATE POLICY ticket_status_select ON ticket_status FOR SELECT USING (true);

-- ── Ticket : type et statut lus dans les listes ────────────────────────────

ALTER TABLE ticket DROP CONSTRAINT ticket_type_check;
ALTER TABLE ticket DROP CONSTRAINT ticket_status_check;
ALTER TABLE ticket ADD CONSTRAINT ticket_type_fkey FOREIGN KEY (type) REFERENCES ticket_type (code);
ALTER TABLE ticket ADD CONSTRAINT ticket_status_fkey FOREIGN KEY (type, status) REFERENCES ticket_status (type, code);
CREATE INDEX ticket_type_status_idx ON ticket (type, status);

-- Un type ajouté est une catégorie de référence de plus, qui porte son code.
ALTER TABLE reference_acronym DROP CONSTRAINT reference_acronym_category_check;
ALTER TABLE reference_category DROP CONSTRAINT reference_category_category_check;

-- Référence, statut initial, auteurs et dates ; le ticket ne change ni
-- d'initiative ni de type. Un type désactivé n'est plus proposé à la création ;
-- un statut désactivé n'est plus attribué, mais le ticket qui le porte le garde.
-- Le type et le statut attribués sont marqués « utilisés » : ils ne se
-- suppriment plus. Le marquage précède la lecture verrouillée, pour que deux
-- premières utilisations simultanées ne s'interbloquent pas.
CREATE OR REPLACE FUNCTION enforce_ticket_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_active boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE ticket_type SET used = true WHERE code = NEW.type AND NOT used;
    SELECT active INTO v_active FROM ticket_type WHERE code = NEW.type FOR SHARE;
    IF v_active IS NULL THEN
      RAISE EXCEPTION 'type de ticket inconnu'
        USING ERRCODE = 'foreign_key_violation', CONSTRAINT = 'ticket_type_fkey';
    ELSIF NOT v_active THEN
      RAISE EXCEPTION 'type de ticket désactivé'
        USING ERRCODE = 'check_violation', CONSTRAINT = 'ticket_type_inactive';
    END IF;
    NEW.reference := next_reference(NEW.initiative_id, NEW.type);
    NEW.status := (SELECT code FROM ticket_status WHERE type = NEW.type ORDER BY position LIMIT 1);
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
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE ticket_status SET used = true WHERE type = NEW.type AND code = NEW.status AND NOT used;
    SELECT active INTO v_active FROM ticket_status WHERE type = NEW.type AND code = NEW.status FOR SHARE;
    -- Statut inconnu : refusé par ticket_status_fkey.
    IF v_active IS FALSE THEN
      RAISE EXCEPTION 'statut de ticket désactivé'
        USING ERRCODE = 'check_violation', CONSTRAINT = 'ticket_status_inactive';
    END IF;
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

-- ── Administration ─────────────────────────────────────────────────────────

-- Le type ajouté p_code, verrouillé jusqu'à la fin de la transaction : les
-- changements de ses statuts passent l'un après l'autre.
CREATE FUNCTION lock_added_ticket_type(p_code text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_delivered boolean;
BEGIN
  SELECT delivered INTO v_delivered FROM ticket_type WHERE code = p_code FOR UPDATE;
  IF v_delivered IS NULL THEN
    RAISE EXCEPTION 'type de ticket inconnu' USING ERRCODE = 'no_data_found';
  ELSIF v_delivered THEN
    RAISE EXCEPTION 'un type livré n’est ni renommé, ni désactivé, ni supprimé'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'ticket_type_delivered_locked';
  END IF;
END
$$;
REVOKE EXECUTE ON FUNCTION lock_added_ticket_type(text) FROM PUBLIC;

-- Un type garde un statut fermé actif.
CREATE FUNCTION require_closed_ticket_status(p_type text) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ticket_status WHERE type = p_type AND closed AND active) THEN
    RAISE EXCEPTION 'un type garde au moins un statut fermé actif'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'ticket_status_last_closed';
  END IF;
END
$$;
REVOKE EXECUTE ON FUNCTION require_closed_ticket_status(text) FROM PUBLIC;

-- Ajouter un type (administrateur) : actif dès sa création, ses statuts dans
-- l'ordre donné (le premier est l'initial), au moins deux dont un fermé ; son
-- acronyme lui est réservé à vie, comme ceux des autres catégories.
-- p_statuses : [{ "code", "labelFr", "labelEn", "tone", "closed" }, …].
CREATE FUNCTION admin_add_ticket_type(
  p_code text, p_label_fr text, p_label_en text, p_acronym text, p_statuses jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM require_admin();
  IF jsonb_array_length(p_statuses) < 2 THEN
    RAISE EXCEPTION 'un type a au moins deux statuts' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM reference_acronym WHERE acronym = p_acronym) THEN
    RAISE EXCEPTION 'acronyme déjà porté par une autre catégorie'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'reference_acronym_taken';
  END IF;
  INSERT INTO ticket_type (code, label_fr, label_en, created_at) VALUES (p_code, p_label_fr, p_label_en, now());
  INSERT INTO ticket_status (type, code, position, label_fr, label_en, tone, closed)
  SELECT p_code, s ->> 'code', n, s ->> 'labelFr', s ->> 'labelEn', s ->> 'tone', (s ->> 'closed')::boolean
  FROM jsonb_array_elements(p_statuses) WITH ORDINALITY AS e (s, n);
  PERFORM require_closed_ticket_status(p_code);
  -- Un ajout simultané du même acronyme est refusé par la clé de reference_acronym.
  INSERT INTO reference_acronym VALUES (p_acronym, p_code);
  INSERT INTO reference_category VALUES (p_code, p_acronym);
END
$$;

-- Renommer, désactiver ou réactiver un type ajouté (administrateur) ; NULL : inchangé.
CREATE FUNCTION admin_update_ticket_type(p_code text, p_label_fr text, p_label_en text, p_active boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM require_admin();
  PERFORM lock_added_ticket_type(p_code);
  UPDATE ticket_type
  SET label_fr = coalesce(p_label_fr, label_fr),
      label_en = coalesce(p_label_en, label_en),
      active = coalesce(p_active, active)
  WHERE code = p_code;
END
$$;

-- Supprimer un type ajouté dont aucun ticket n'a jamais été créé (administrateur).
-- Son acronyme reste réservé (reference_acronym) : aucune référence ne désignera
-- deux objets. Le verrou attend la fin d'une transaction qui crée un ticket de ce type.
CREATE FUNCTION admin_delete_ticket_type(p_code text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM require_admin();
  PERFORM lock_added_ticket_type(p_code);
  IF (SELECT used FROM ticket_type WHERE code = p_code) THEN
    RAISE EXCEPTION 'un ticket de ce type a déjà été créé'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'ticket_type_used';
  END IF;
  DELETE FROM reference_category WHERE category = p_code;
  DELETE FROM ticket_type WHERE code = p_code;
END
$$;

-- Ajouter un statut à un type, livré ou ajouté (administrateur) : actif, après
-- les statuts existants du type.
CREATE FUNCTION admin_add_ticket_status(
  p_type text, p_code text, p_label_fr text, p_label_en text, p_tone text, p_closed boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM require_admin();
  -- Verrou du type : deux ajouts simultanés prennent deux positions distinctes.
  PERFORM 1 FROM ticket_type WHERE code = p_type FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'type de ticket inconnu' USING ERRCODE = 'no_data_found';
  END IF;
  INSERT INTO ticket_status (type, code, position, label_fr, label_en, tone, closed)
  SELECT p_type, p_code, max(position) + 1, p_label_fr, p_label_en, p_tone, p_closed
  FROM ticket_status WHERE type = p_type;
END
$$;

-- Le statut ajouté p_code du type p_type ; le type est verrouillé.
CREATE FUNCTION lock_added_ticket_status(p_type text, p_code text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_delivered boolean;
BEGIN
  PERFORM 1 FROM ticket_type WHERE code = p_type FOR UPDATE;
  SELECT delivered INTO v_delivered FROM ticket_status WHERE type = p_type AND code = p_code FOR UPDATE;
  IF v_delivered IS NULL THEN
    RAISE EXCEPTION 'statut de ticket inconnu' USING ERRCODE = 'no_data_found';
  ELSIF v_delivered THEN
    RAISE EXCEPTION 'un statut livré n’est ni renommé, ni désactivé, ni supprimé'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'ticket_status_delivered_locked';
  END IF;
END
$$;
REVOKE EXECUTE ON FUNCTION lock_added_ticket_status(text, text) FROM PUBLIC;

-- Le statut initial d'un type ne se désactive ni ne se supprime.
CREATE FUNCTION require_not_initial_ticket_status(p_type text, p_code text) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_code = (SELECT code FROM ticket_status WHERE type = p_type ORDER BY position LIMIT 1) THEN
    RAISE EXCEPTION 'le statut initial d’un type ne se désactive ni ne se supprime'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'ticket_status_initial';
  END IF;
END
$$;
REVOKE EXECUTE ON FUNCTION require_not_initial_ticket_status(text, text) FROM PUBLIC;

-- Renommer, désactiver ou réactiver un statut ajouté (administrateur) ; NULL : inchangé.
CREATE FUNCTION admin_update_ticket_status(
  p_type text, p_code text, p_label_fr text, p_label_en text, p_active boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM require_admin();
  PERFORM lock_added_ticket_status(p_type, p_code);
  IF p_active IS FALSE THEN
    PERFORM require_not_initial_ticket_status(p_type, p_code);
  END IF;
  UPDATE ticket_status
  SET label_fr = coalesce(p_label_fr, label_fr),
      label_en = coalesce(p_label_en, label_en),
      active = coalesce(p_active, active)
  WHERE type = p_type AND code = p_code;
  PERFORM require_closed_ticket_status(p_type);
END
$$;

-- Supprimer un statut ajouté jamais porté (administrateur), sauf le statut
-- initial et le dernier statut fermé actif (choix validé le 13.11.2026). Le
-- verrou attend la fin d'une transaction qui donne ce statut à un ticket.
CREATE FUNCTION admin_delete_ticket_status(p_type text, p_code text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM require_admin();
  PERFORM lock_added_ticket_status(p_type, p_code);
  IF (SELECT used FROM ticket_status WHERE type = p_type AND code = p_code) THEN
    RAISE EXCEPTION 'statut de ticket déjà porté'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'ticket_status_used';
  END IF;
  PERFORM require_not_initial_ticket_status(p_type, p_code);
  DELETE FROM ticket_status WHERE type = p_type AND code = p_code;
  PERFORM require_closed_ticket_status(p_type);
END
$$;
