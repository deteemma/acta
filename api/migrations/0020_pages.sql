-- Pages : arborescence et écriture (phase 2, ticket 22). Règles dans @app/shared
-- (pages.ts, references.ts, roles.ts), reproduites ici comme seconde barrière
-- (ADR-0006). Le contenu est le JSON de Tiptap (ADR-0019) ; l'API vérifie la mise
-- en forme admise (PAGE_NODE_TYPES), la base sa racine et la longueur du texte.

-- ── Référence ──────────────────────────────────────────────────────────────

-- Aucune règle ne prévoit un autre acronyme : si l'administration a donné PA à
-- une autre catégorie, la migration s'arrête et la responsable fonctionnelle tranche.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM reference_acronym WHERE acronym = 'PA') THEN
    RAISE EXCEPTION 'acronyme PA déjà porté par une autre catégorie ; à trancher avant les pages';
  END IF;
END
$$;

ALTER TABLE reference_acronym DROP CONSTRAINT reference_acronym_category_check;
ALTER TABLE reference_acronym ADD CONSTRAINT reference_acronym_category_check
  CHECK (category IN ('need', 'requirement', 'action', 'question', 'decision', 'risk', 'change_request', 'epic', 'page'));
ALTER TABLE reference_category DROP CONSTRAINT reference_category_category_check;
ALTER TABLE reference_category ADD CONSTRAINT reference_category_category_check
  CHECK (category IN ('need', 'requirement', 'action', 'question', 'decision', 'risk', 'change_request', 'epic', 'page'));
INSERT INTO reference_acronym VALUES ('PA', 'page');
INSERT INTO reference_category VALUES ('page', 'PA');

-- ── Page ───────────────────────────────────────────────────────────────────

-- Nombre de caractères des nœuds texte (pageTextLength) : ni le JSON ni la mise
-- en forme ne comptent. Les éléments qui ne sont pas des objets sont ignorés (silent).
CREATE FUNCTION page_text_length(p_content jsonb) RETURNS integer
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(char_length(t #>> '{}')), 0)::integer
  FROM jsonb_path_query(p_content, 'strict $.** ? (@.type == "text").text', '{}', true) t
$$;

CREATE TABLE page (
  id            uuid PRIMARY KEY,
  initiative_id uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  -- Attribuée par le déclencheur ci-dessous au premier enregistrement, ne change plus.
  reference     text NOT NULL UNIQUE,
  title         text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  -- JSON de Tiptap (ADR-0019) ; même limite que PAGE_TEXT_MAX_LENGTH.
  content       jsonb CONSTRAINT page_content_doc CHECK (content IS NULL OR content ->> 'type' = 'doc'),
  -- Page parente de la même initiative ; null au premier niveau.
  parent_id     uuid,
  -- Rang parmi les pages sœurs, réglé à la main ; l'API renumérote 0, 1, 2…
  position      integer NOT NULL CHECK (position >= 0),
  created_by    text NOT NULL REFERENCES app_user (id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text NOT NULL REFERENCES app_user (id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT page_text_length CHECK (page_text_length(content) <= 200000),
  -- Cible des liens à venir (ticket 25), qui imposent la même initiative.
  UNIQUE (initiative_id, id),
  -- Une page qui a des sous-pages ne se supprime pas (l'API traduit le refus en
  -- `pageHasSubpages`). Vérifié en fin d'instruction et non en RESTRICT : supprimer
  -- l'initiative emporte en une fois toutes ses pages.
  CONSTRAINT page_parent_fkey FOREIGN KEY (initiative_id, parent_id) REFERENCES page (initiative_id, id)
);
CREATE INDEX page_parent_id_idx ON page (parent_id);

-- Référence, auteurs et dates ; la page ne change pas d'initiative et ne se range
-- pas sous elle-même ni sous l'une de ses sous-pages. Déplacer ou réordonner ne
-- change ni l'auteur ni la date de la dernière modification, qui suivent le titre
-- et le contenu. SECURITY DEFINER : tient le compteur, inaccessible directement.
CREATE FUNCTION enforce_page_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.reference := next_reference(NEW.initiative_id, 'page');
    NEW.created_by := current_app_user_id();
    NEW.created_at := now();
    NEW.updated_by := NEW.created_by;
    NEW.updated_at := NEW.created_at;
  ELSE
    IF NEW.initiative_id IS DISTINCT FROM OLD.initiative_id THEN
      RAISE EXCEPTION 'une page ne change pas d’initiative' USING ERRCODE = 'insufficient_privilege';
    END IF;
    NEW.reference := OLD.reference;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    IF NEW.title IS DISTINCT FROM OLD.title OR NEW.content IS DISTINCT FROM OLD.content THEN
      NEW.updated_by := current_app_user_id();
      NEW.updated_at := now();
    ELSE
      NEW.updated_by := OLD.updated_by;
      NEW.updated_at := OLD.updated_at;
    END IF;
  END IF;
  IF NEW.parent_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.parent_id IS DISTINCT FROM OLD.parent_id) THEN
    -- Deux déplacements simultanés ne forment pas de boucle : ils passent l'un
    -- après l'autre, et chaque requête de la fonction voit ce qui est validé.
    PERFORM pg_advisory_xact_lock(hashtextextended('page_tree:' || NEW.initiative_id::text, 0));
    IF NEW.parent_id = NEW.id OR EXISTS (
      WITH RECURSIVE ancestor AS (
        SELECT id, parent_id FROM page WHERE id = NEW.parent_id
        UNION
        SELECT p.id, p.parent_id FROM page p JOIN ancestor a ON p.id = a.parent_id
      )
      SELECT 1 FROM ancestor WHERE id = NEW.id
    ) THEN
      RAISE EXCEPTION 'une page ne se range pas sous elle-même ni sous l’une de ses sous-pages'
        USING ERRCODE = 'check_violation', CONSTRAINT = 'page_under_itself';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER page_enforce_rules
  BEFORE INSERT OR UPDATE ON page FOR EACH ROW EXECUTE FUNCTION enforce_page_rules();

-- Row Level Security : tout membre consulte ; propriétaires et contributeurs
-- créent, modifient, déplacent et suppriment ; initiative archivée : lecture seule.
ALTER TABLE page ENABLE ROW LEVEL SECURITY;

CREATE POLICY page_select ON page FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));
CREATE POLICY page_insert ON page FOR INSERT
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY page_update ON page FOR UPDATE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id))
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY page_delete ON page FOR DELETE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));

-- Les auteurs d'une page restent lisibles, même après leur départ de l'initiative.
CREATE FUNCTION appears_in_my_pages(p_user_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM page p
    JOIN initiative_member mine ON mine.initiative_id = p.initiative_id
    WHERE mine.user_id = current_app_user_id()
      AND p_user_id IN (p.created_by, p.updated_by)
  )
$$;
DROP POLICY app_user_select ON app_user;
CREATE POLICY app_user_select ON app_user FOR SELECT
  USING (id = current_app_user_id() OR shares_initiative_with(id) OR appears_in_my_owner_designations(id)
         OR appears_in_my_tickets(id) OR appears_in_my_stakeholders(id) OR appears_in_my_needs(id)
         OR appears_in_my_requirements(id) OR appears_in_my_pages(id));
