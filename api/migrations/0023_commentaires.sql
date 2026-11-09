-- Commentaires (phase 2, ticket 20, décision 05). Règles dans @app/shared
-- (comments.ts, roles.ts), reproduites ici comme seconde barrière (ADR-0006).
--
-- Un commentaire porte sur un ticket, de tout type, ou sur une page entière : la
-- colonne des pages sert au ticket 25, sans nouvelle migration. Aucun déclencheur
-- ne touche le ticket ni la page : un commentaire ne figure dans aucun historique.
-- Les commentaires ne sont pas synchronisés vers le téléphone (hors de la
-- publication PowerSync).
CREATE TABLE comment (
  id            uuid PRIMARY KEY,
  initiative_id uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  -- Exactement l'un des deux, de la même initiative ; supprimer le ticket ou la
  -- page emporte ses commentaires.
  ticket_id     uuid,
  page_id       uuid,
  -- Texte mis en forme (rich-text.ts), COMMENT_MAX_LENGTH ; null une fois supprimé.
  body          text CONSTRAINT comment_body_length CHECK (char_length(btrim(body)) BETWEEN 1 AND 5000),
  created_by    text NOT NULL REFERENCES app_user (id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Dernière modification du texte ; l'ancien texte n'est pas gardé.
  edited_at     timestamptz,
  -- Suppression définitive du texte : la ligne reste, comme trace, à sa place.
  deleted_by    text REFERENCES app_user (id),
  deleted_at    timestamptz,
  CONSTRAINT comment_one_subject CHECK (num_nonnulls(ticket_id, page_id) = 1),
  CONSTRAINT comment_deleted_trace CHECK (
    (body IS NULL) = (deleted_at IS NOT NULL) AND (deleted_at IS NULL) = (deleted_by IS NULL)
  ),
  CONSTRAINT comment_ticket_fkey
    FOREIGN KEY (initiative_id, ticket_id) REFERENCES ticket (initiative_id, id) ON DELETE CASCADE,
  CONSTRAINT comment_page_fkey
    FOREIGN KEY (initiative_id, page_id) REFERENCES page (initiative_id, id) ON DELETE CASCADE
);
CREATE INDEX comment_ticket_id_idx ON comment (ticket_id, created_at) WHERE ticket_id IS NOT NULL;
CREATE INDEX comment_page_id_idx ON comment (page_id, created_at) WHERE page_id IS NOT NULL;

-- Auteur et dates écrits par la base. Modifier le texte : son auteur seul ; le
-- supprimer (texte à null) : son auteur ou un propriétaire. Une ligne de trace ne
-- change plus. Le rôle de propriétaire ou de contributeur et l'archivage sont
-- vérifiés par la RLS ci-dessous.
CREATE FUNCTION enforce_comment_rules() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.body IS NULL THEN
      RAISE EXCEPTION 'un commentaire a un texte' USING ERRCODE = 'check_violation', CONSTRAINT = 'comment_body_length';
    END IF;
    NEW.created_by := current_app_user_id();
    NEW.created_at := now();
    NEW.edited_at := NULL;
    NEW.deleted_by := NULL;
    NEW.deleted_at := NULL;
    RETURN NEW;
  END IF;
  IF OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'ce commentaire a été supprimé' USING ERRCODE = 'check_violation', CONSTRAINT = 'comment_deleted';
  END IF;
  NEW.id := OLD.id;
  NEW.initiative_id := OLD.initiative_id;
  NEW.ticket_id := OLD.ticket_id;
  NEW.page_id := OLD.page_id;
  NEW.created_by := OLD.created_by;
  NEW.created_at := OLD.created_at;
  IF NEW.body IS NULL THEN
    IF OLD.created_by IS DISTINCT FROM current_app_user_id() AND NOT has_initiative_role(OLD.initiative_id, 'owner') THEN
      RAISE EXCEPTION 'seuls son auteur ou un propriétaire suppriment un commentaire'
        USING ERRCODE = 'insufficient_privilege', CONSTRAINT = 'comment_delete_allowed';
    END IF;
    NEW.edited_at := OLD.edited_at;
    NEW.deleted_by := current_app_user_id();
    NEW.deleted_at := now();
  ELSE
    IF OLD.created_by IS DISTINCT FROM current_app_user_id() THEN
      RAISE EXCEPTION 'seul son auteur modifie un commentaire'
        USING ERRCODE = 'insufficient_privilege', CONSTRAINT = 'comment_edit_allowed';
    END IF;
    NEW.edited_at := CASE WHEN NEW.body IS DISTINCT FROM OLD.body THEN now() ELSE OLD.edited_at END;
    NEW.deleted_by := NULL;
    NEW.deleted_at := NULL;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER comment_enforce_rules
  BEFORE INSERT OR UPDATE ON comment FOR EACH ROW EXECUTE FUNCTION enforce_comment_rules();

-- Row Level Security : tout membre lit ; propriétaires et contributeurs ajoutent ;
-- l'auteur, ou un propriétaire, met à jour (modification ou suppression, détaillées
-- par le déclencheur) ; initiative archivée : lecture seule. Aucune suppression
-- de ligne : seule la disparition du ticket ou de la page les emporte.
ALTER TABLE comment ENABLE ROW LEVEL SECURITY;

CREATE POLICY comment_select ON comment FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));
CREATE POLICY comment_insert ON comment FOR INSERT
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY comment_update ON comment FOR UPDATE
  USING (
    has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id)
    AND (created_by = current_app_user_id() OR has_initiative_role(initiative_id, 'owner'))
  )
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));

-- Auteurs et auteurs des suppressions restent lisibles, même après leur départ.
CREATE FUNCTION appears_in_my_comments(p_user_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM comment c
    JOIN initiative_member mine ON mine.initiative_id = c.initiative_id
    WHERE mine.user_id = current_app_user_id()
      AND p_user_id IN (c.created_by, c.deleted_by)
  )
$$;
DROP POLICY app_user_select ON app_user;
CREATE POLICY app_user_select ON app_user FOR SELECT
  USING (id = current_app_user_id() OR shares_initiative_with(id) OR appears_in_my_owner_designations(id)
         OR appears_in_my_tickets(id) OR appears_in_my_stakeholders(id) OR appears_in_my_needs(id)
         OR appears_in_my_requirements(id) OR appears_in_my_pages(id) OR appears_in_my_comments(id));
