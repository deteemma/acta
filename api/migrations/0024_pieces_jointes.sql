-- Pièces jointes (phase 2, ticket 21, décision 10, ADR-0014). Règles dans
-- @app/shared (attachments.ts, roles.ts), reproduites ici comme seconde barrière
-- (ADR-0006).
--
-- Un fichier est rattaché à un ticket, de tout type, ou à une page : la colonne
-- des pages sert au ticket 26, sans nouvelle migration. Aucun déclencheur ne
-- touche le ticket ni la page : une pièce jointe ne figure dans aucun historique.
-- Les fichiers ne sont pas synchronisés vers le téléphone (hors de la
-- publication PowerSync).

-- Paramètres valables pour toute l'application : une seule ligne. La limite de
-- pièces jointes d'une initiative (ATTACHMENT_QUOTA_*_MB) se règle dans
-- l'administration au ticket 31 ; d'ici là, sa valeur par défaut s'applique.
CREATE TABLE app_settings (
  id                  boolean PRIMARY KEY DEFAULT true CONSTRAINT app_settings_single_row CHECK (id),
  attachment_quota_mb integer NOT NULL DEFAULT 500
    CONSTRAINT app_settings_attachment_quota CHECK (attachment_quota_mb BETWEEN 10 AND 1024)
);
INSERT INTO app_settings DEFAULT VALUES;

-- Lisibles par tous (l'occupation affichée aux membres rappelle la limite) ;
-- aucune écriture par le compte applicatif avant le ticket 31.
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_settings_select ON app_settings FOR SELECT USING (true);

-- Extension d'un nom de fichier, en minuscules, comme attachmentExtension
-- (shared) : après le dernier point, avec au moins un caractère avant ; sinon null.
CREATE FUNCTION attachment_extension(p_name text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(substring(btrim(p_name) FROM '^.*[^.].*\.([^.]+)$'))
$$;

CREATE TABLE attachment (
  id            uuid PRIMARY KEY,
  initiative_id uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  -- Exactement l'un des deux, de la même initiative ; supprimer le ticket ou la
  -- page emporte ses fichiers et leurs lignes de trace.
  ticket_id     uuid,
  page_id       uuid,
  -- Nom affiché, extension comprise (attachmentNameSchema) ; deux fichiers peuvent
  -- porter le même. L'extension est l'une des formats acceptés
  -- (ATTACHMENT_EXTENSIONS) et ne change pas au renommage.
  name          text NOT NULL
    CONSTRAINT attachment_name_valid CHECK (
      char_length(name) BETWEEN 1 AND 255 AND name = btrim(name) AND name !~ '[/\\[:cntrl:]]'
    )
    CONSTRAINT attachment_format CHECK (
      -- Sans extension : null, refusé aussi.
      coalesce(attachment_extension(name), '') IN (
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'odg',
        'txt', 'csv', 'md', 'png', 'jpg', 'jpeg', 'gif', 'webp',
        'bpmn', 'drawio', 'vsd', 'vsdx', 'eml', 'msg'
      )
    ),
  -- Taille du contenu, écrite par la base ; 10 Mo au plus (ATTACHMENT_MAX_BYTES).
  size_bytes    integer NOT NULL CONSTRAINT attachment_size CHECK (size_bytes BETWEEN 0 AND 10485760),
  -- Contenu du fichier ; null une fois supprimé : la place est libérée.
  content       bytea,
  created_by    text NOT NULL REFERENCES app_user (id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Suppression définitive : la ligne reste, comme trace, avec le nom.
  deleted_by    text REFERENCES app_user (id),
  deleted_at    timestamptz,
  CONSTRAINT attachment_one_subject CHECK (num_nonnulls(ticket_id, page_id) = 1),
  CONSTRAINT attachment_deleted_trace CHECK (
    (content IS NULL) = (deleted_at IS NOT NULL) AND (deleted_at IS NULL) = (deleted_by IS NULL)
  ),
  CONSTRAINT attachment_ticket_fkey
    FOREIGN KEY (initiative_id, ticket_id) REFERENCES ticket (initiative_id, id) ON DELETE CASCADE,
  CONSTRAINT attachment_page_fkey
    FOREIGN KEY (initiative_id, page_id) REFERENCES page (initiative_id, id) ON DELETE CASCADE
);
CREATE INDEX attachment_ticket_id_idx ON attachment (ticket_id, created_at) WHERE ticket_id IS NOT NULL;
CREATE INDEX attachment_page_id_idx ON attachment (page_id, created_at) WHERE page_id IS NOT NULL;
CREATE INDEX attachment_initiative_id_idx ON attachment (initiative_id) WHERE deleted_at IS NULL;

-- Volume des fichiers non supprimés d'une initiative (occupation).
CREATE FUNCTION attachment_usage_bytes(p_initiative_id uuid) RETURNS bigint
LANGUAGE sql STABLE AS $$
  SELECT coalesce(sum(size_bytes), 0)::bigint FROM attachment
  WHERE initiative_id = p_initiative_id AND deleted_at IS NULL
$$;

-- Auteur, dates et taille écrits par la base. À l'ajout : la limite de
-- l'initiative, sous un verrou propre à l'initiative, pour que deux envois
-- simultanés ne la dépassent pas ensemble. Ensuite : renommer en gardant
-- l'extension, ou supprimer (contenu à null) ; jamais remplacer le contenu. Une
-- ligne de trace ne change plus. Le rôle de propriétaire ou de contributeur et
-- l'archivage sont vérifiés par la RLS ci-dessous.
CREATE FUNCTION enforce_attachment_rules() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_quota_bytes bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.content IS NULL THEN
      RAISE EXCEPTION 'une pièce jointe a un contenu' USING ERRCODE = 'check_violation', CONSTRAINT = 'attachment_deleted_trace';
    END IF;
    NEW.size_bytes := octet_length(NEW.content);
    NEW.created_by := current_app_user_id();
    NEW.created_at := now();
    NEW.deleted_by := NULL;
    NEW.deleted_at := NULL;
    PERFORM pg_advisory_xact_lock(hashtextextended('attachment:' || NEW.initiative_id::text, 0));
    SELECT attachment_quota_mb::bigint * 1024 * 1024 INTO v_quota_bytes FROM app_settings;
    IF attachment_usage_bytes(NEW.initiative_id) + NEW.size_bytes > v_quota_bytes THEN
      RAISE EXCEPTION 'limite de pièces jointes de l’initiative atteinte'
        USING ERRCODE = 'check_violation', CONSTRAINT = 'attachment_quota';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'cette pièce jointe a été supprimée' USING ERRCODE = 'check_violation', CONSTRAINT = 'attachment_deleted';
  END IF;
  NEW.id := OLD.id;
  NEW.initiative_id := OLD.initiative_id;
  NEW.ticket_id := OLD.ticket_id;
  NEW.page_id := OLD.page_id;
  NEW.size_bytes := OLD.size_bytes;
  NEW.created_by := OLD.created_by;
  NEW.created_at := OLD.created_at;
  IF NEW.content IS NULL THEN
    NEW.name := OLD.name;
    NEW.deleted_by := current_app_user_id();
    NEW.deleted_at := now();
  ELSE
    -- Pas de remplacement : une nouvelle version d'un fichier est un nouveau fichier.
    NEW.content := OLD.content;
    IF attachment_extension(NEW.name) IS DISTINCT FROM attachment_extension(OLD.name) THEN
      RAISE EXCEPTION 'renommer garde l’extension' USING ERRCODE = 'check_violation', CONSTRAINT = 'attachment_extension_kept';
    END IF;
    NEW.deleted_by := NULL;
    NEW.deleted_at := NULL;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER attachment_enforce_rules
  BEFORE INSERT OR UPDATE ON attachment FOR EACH ROW EXECUTE FUNCTION enforce_attachment_rules();

-- Row Level Security : tout membre lit (ouvre et télécharge) ; propriétaires et
-- contributeurs ajoutent, renomment et suppriment tout fichier ; initiative
-- archivée : lecture seule. Aucune suppression de ligne : seule la disparition du
-- ticket ou de la page les emporte. L'administrateur non membre ne voit rien.
ALTER TABLE attachment ENABLE ROW LEVEL SECURITY;

CREATE POLICY attachment_select ON attachment FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));
CREATE POLICY attachment_insert ON attachment FOR INSERT
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY attachment_update ON attachment FOR UPDATE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id))
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));

-- Auteurs et auteurs des suppressions restent lisibles, même après leur départ.
CREATE FUNCTION appears_in_my_attachments(p_user_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM attachment a
    JOIN initiative_member mine ON mine.initiative_id = a.initiative_id
    WHERE mine.user_id = current_app_user_id()
      AND p_user_id IN (a.created_by, a.deleted_by)
  )
$$;
DROP POLICY app_user_select ON app_user;
CREATE POLICY app_user_select ON app_user FOR SELECT
  USING (id = current_app_user_id() OR shares_initiative_with(id) OR appears_in_my_owner_designations(id)
         OR appears_in_my_tickets(id) OR appears_in_my_stakeholders(id) OR appears_in_my_needs(id)
         OR appears_in_my_requirements(id) OR appears_in_my_pages(id) OR appears_in_my_comments(id)
         OR appears_in_my_attachments(id));
