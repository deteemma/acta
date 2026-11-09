-- Enregistrements et versions de page (phase 2, ticket 23). Règles dans
-- @app/shared (page-revisions.ts, roles.ts), reproduites ici comme seconde
-- barrière (ADR-0006). Le contenu reste le JSON de Tiptap (ADR-0019).

-- ── Enregistrement ─────────────────────────────────────────────────────────

-- Un enregistrement par changement du titre ou du contenu, écrit seulement par
-- record_page_revision. Une version est un enregistrement qui porte un numéro.
-- Supprimé, il garde une ligne sans contenu : qui l'a supprimé et quand ; son
-- numéro de version reste, pour n'être jamais réattribué. Part avec la page.
CREATE TABLE page_revision (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Ordre chronologique des enregistrements, même dans une seule transaction.
  sequence       bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  initiative_id  uuid NOT NULL,
  page_id        uuid NOT NULL,
  title          text,
  content        jsonb,
  created_by     text NOT NULL REFERENCES app_user (id),
  created_at     timestamptz NOT NULL,
  version_number integer CHECK (version_number > 0),
  -- PAGE_VERSION_NOTE_MAX_LENGTH ; une note n'existe que sur une version.
  version_note   text CHECK (char_length(version_note) <= 500),
  deleted_by     text REFERENCES app_user (id),
  deleted_at     timestamptz,
  CONSTRAINT page_revision_page_fkey
    FOREIGN KEY (initiative_id, page_id) REFERENCES page (initiative_id, id) ON DELETE CASCADE,
  CONSTRAINT page_revision_version_unique UNIQUE (page_id, version_number),
  CONSTRAINT page_revision_note_on_version CHECK (version_note IS NULL OR version_number IS NOT NULL),
  CONSTRAINT page_revision_trace CHECK (
    (deleted_at IS NULL AND deleted_by IS NULL AND title IS NOT NULL)
    OR (deleted_at IS NOT NULL AND deleted_by IS NOT NULL AND title IS NULL AND content IS NULL AND version_note IS NULL)
  )
);
CREATE INDEX page_revision_page_id_idx ON page_revision (page_id, sequence);

-- Chaque enregistrement qui change le titre ou le contenu est conservé ; déplacer
-- ou réordonner n'en crée pas (décision 07, points 3 et 4).
CREATE FUNCTION record_page_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.title IS DISTINCT FROM OLD.title OR NEW.content IS DISTINCT FROM OLD.content THEN
    INSERT INTO page_revision (initiative_id, page_id, title, content, created_by, created_at)
    VALUES (NEW.initiative_id, NEW.id, NEW.title, NEW.content, NEW.updated_by, NEW.updated_at);
  END IF;
  RETURN NULL;
END
$$;
CREATE TRIGGER page_record_revision
  AFTER INSERT OR UPDATE ON page FOR EACH ROW EXECUTE FUNCTION record_page_revision();

-- Pages existantes : leur état actuel devient leur premier enregistrement, sans version.
INSERT INTO page_revision (initiative_id, page_id, title, content, created_by, created_at)
SELECT initiative_id, id, title, content, updated_by, updated_at FROM page ORDER BY created_at;

-- Ce qui change d'un enregistrement : la déclaration comme version, la note, la
-- suppression. Le reste est figé. SECURITY DEFINER : lit tous les enregistrements
-- de la page, numéros des versions supprimées compris.
CREATE FUNCTION enforce_page_revision_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_last_version_sequence bigint;
  v_next_version          integer;
BEGIN
  IF OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'un enregistrement supprimé ne change plus'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'page_revision_deleted';
  END IF;
  NEW.id := OLD.id;
  NEW.sequence := OLD.sequence;
  NEW.initiative_id := OLD.initiative_id;
  NEW.page_id := OLD.page_id;
  NEW.created_by := OLD.created_by;
  NEW.created_at := OLD.created_at;
  -- Les numéros et les suppressions d'une page passent l'un après l'autre.
  PERFORM pg_advisory_xact_lock(hashtextextended('page_revisions:' || OLD.page_id::text, 0));

  IF NEW.deleted_at IS NOT NULL THEN
    -- Le dernier enregistrement, l'état actuel de la page, ne se supprime pas.
    IF NOT EXISTS (
      SELECT 1 FROM page_revision
      WHERE page_id = OLD.page_id AND sequence > OLD.sequence AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'le dernier enregistrement d’une page ne se supprime pas'
        USING ERRCODE = 'check_violation', CONSTRAINT = 'page_revision_last';
    END IF;
    NEW.deleted_by := current_app_user_id();
    NEW.deleted_at := now();
    NEW.title := NULL;
    NEW.content := NULL;
    NEW.version_note := NULL;
    NEW.version_number := OLD.version_number;
    RETURN NEW;
  END IF;

  NEW.deleted_by := NULL;
  NEW.title := OLD.title;
  NEW.content := OLD.content;
  IF OLD.version_number IS NOT NULL AND NEW.version_number IS DISTINCT FROM OLD.version_number THEN
    RAISE EXCEPTION 'une version ne redevient pas un simple enregistrement ni ne change de numéro'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'page_version_permanent';
  END IF;
  IF OLD.version_number IS NULL AND NEW.version_number IS NOT NULL THEN
    -- Après la dernière version, même supprimée ; numéro suivant, jamais réattribué.
    SELECT max(sequence) FILTER (WHERE version_number IS NOT NULL), coalesce(max(version_number), 0) + 1
      INTO v_last_version_sequence, v_next_version
      FROM page_revision WHERE page_id = OLD.page_id;
    IF OLD.sequence <= coalesce(v_last_version_sequence, 0) THEN
      RAISE EXCEPTION 'seul un enregistrement postérieur à la dernière version se déclare'
        USING ERRCODE = 'check_violation', CONSTRAINT = 'page_version_not_after_last';
    END IF;
    IF NEW.version_number <> v_next_version THEN
      RAISE EXCEPTION 'la prochaine version de cette page porte le numéro %', v_next_version
        USING ERRCODE = 'check_violation', CONSTRAINT = 'page_version_number';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER page_revision_enforce_rules
  BEFORE UPDATE ON page_revision FOR EACH ROW EXECUTE FUNCTION enforce_page_revision_rules();

-- Row Level Security : tout membre consulte ; propriétaires et contributeurs
-- déclarent une version, corrigent une note, suppriment un enregistrement ;
-- initiative archivée : lecture seule. Aucune écriture directe d'enregistrement,
-- aucune suppression de ligne : la trace reste.
ALTER TABLE page_revision ENABLE ROW LEVEL SECURITY;

CREATE POLICY page_revision_select ON page_revision FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));
CREATE POLICY page_revision_update ON page_revision FOR UPDATE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id))
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));

-- Les auteurs des enregistrements et ceux qui les ont supprimés restent lisibles,
-- même après leur départ de l'initiative.
CREATE OR REPLACE FUNCTION appears_in_my_pages(p_user_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM page p
    JOIN initiative_member mine ON mine.initiative_id = p.initiative_id
    WHERE mine.user_id = current_app_user_id()
      AND p_user_id IN (p.created_by, p.updated_by)
  ) OR EXISTS (
    SELECT 1 FROM page_revision r
    JOIN initiative_member mine ON mine.initiative_id = r.initiative_id
    WHERE mine.user_id = current_app_user_id()
      AND p_user_id IN (r.created_by, r.deleted_by)
  )
$$;
