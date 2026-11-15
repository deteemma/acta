-- Images et pièces jointes des pages (phase 2, ticket 26, décision 10 points 7 à
-- 9). Règles dans @app/shared (page-images.ts), reproduites ici comme seconde
-- barrière (ADR-0006).
--
-- La table attachment accepte déjà une page (migration 0024) : mêmes formats,
-- taille, limite de l'initiative, droits et archivage que pour un ticket. Une
-- image du texte est un nœud `image` du JSON de Tiptap qui désigne sa pièce
-- jointe par `attrs.attachmentId`. Un fichier appartient à la page, pas à un
-- enregistrement : supprimer un enregistrement ne supprime aucun fichier (aucun
-- lien entre page_revision et attachment).

-- Pièces jointes désignées par les images d'un contenu de page, chacune une fois
-- (pageImageIds). Les éléments qui ne sont pas des objets sont ignorés (silent).
CREATE FUNCTION page_image_ids(p_content jsonb) RETURNS SETOF text
LANGUAGE sql IMMUTABLE AS $$
  SELECT DISTINCT t #>> '{}'
  FROM jsonb_path_query(p_content, 'strict $.** ? (@.type == "image").attrs.attachmentId', '{}', true) t
$$;

-- Le texte n'affiche que des images de la page elle-même (checkPageImages), même
-- supprimées : un ancien enregistrement restauré affiche « image supprimée ».
-- Vérifié en fin de transaction (ou à SET CONSTRAINTS … IMMEDIATE) : à
-- l'enregistrement d'une saisie, la page est écrite avant les fichiers de ses
-- images insérées. SECURITY DEFINER : lit les pièces jointes, traces comprises.
CREATE FUNCTION enforce_page_images() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_content jsonb;
BEGIN
  SELECT content INTO v_content FROM page WHERE id = NEW.id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM page_image_ids(v_content) i
    WHERE NOT EXISTS (
      SELECT 1 FROM attachment a
      WHERE a.page_id = NEW.id AND a.id::text = i
        AND attachment_extension(a.name) IN ('png', 'jpg', 'jpeg', 'gif', 'webp')
    )
  ) THEN
    RAISE EXCEPTION 'le texte d’une page n’affiche que ses propres images'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'page_image_not_on_page';
  END IF;
  RETURN NULL;
END
$$;
CREATE CONSTRAINT TRIGGER page_images_on_page
  AFTER INSERT OR UPDATE OF content ON page DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_page_images();

-- Supprimer une image du dernier enregistrement est refusé (checkPageAttachmentDelete) :
-- la retirer du texte et enregistrer d'abord. Le reste des règles de la migration
-- 0024 est inchangé.
CREATE OR REPLACE FUNCTION enforce_attachment_rules() RETURNS trigger
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
    IF OLD.page_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM page p, page_image_ids(p.content) i WHERE p.id = OLD.page_id AND i = OLD.id::text
    ) THEN
      RAISE EXCEPTION 'cette image figure dans le dernier enregistrement de la page'
        USING ERRCODE = 'check_violation', CONSTRAINT = 'attachment_image_in_last_revision';
    END IF;
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
