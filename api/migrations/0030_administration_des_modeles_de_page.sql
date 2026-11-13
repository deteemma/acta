-- Administration des modèles de page (phase 2, ticket 30, décisions 09 point 6 et
-- 14 point 3). Règles dans @app/shared (page-template-admin.ts), reproduites ici
-- comme seconde barrière (ADR-0006).
--
-- Un modèle livré ne se modifie pas, mais se désactive et se réactive. Un modèle
-- ajouté a un nom et un contenu dans les deux langues, une tâche BABOK
-- facultative ; il se modifie, se désactive, et ne se supprime que s'il n'a
-- jamais servi. Un modèle désactivé n'est plus proposé ; les pages créées avec
-- lui ne changent pas (leur contenu, leur mention et leur tâche sont copiés).

-- Le document contient au moins un mot (choix validé le 13.11.2026).
CREATE FUNCTION page_doc_has_words(p_content jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM jsonb_path_query(p_content, 'strict $.** ? (@.type == "text").text', '{}', true) t
    WHERE btrim(t #>> '{}') <> ''
  )
$$;

ALTER TABLE page_template
  -- Une page a déjà été créée depuis ce modèle, même supprimée depuis : il ne se supprime plus.
  ADD COLUMN used       boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT page_template_name_trimmed CHECK (name_fr = btrim(name_fr) AND name_en = btrim(name_en)),
  ADD CONSTRAINT page_template_content_words CHECK (page_doc_has_words(content_fr) AND page_doc_has_words(content_en)),
  -- Un modèle n'a pas d'image (décision 14, point 3).
  ADD CONSTRAINT page_template_no_image CHECK (
    NOT jsonb_path_exists(content_fr, 'strict $.** ? (@.type == "image")')
    AND NOT jsonb_path_exists(content_en, 'strict $.** ? (@.type == "image")')
  );
UPDATE page_template t SET used = true WHERE EXISTS (SELECT 1 FROM page p WHERE p.template_id = t.id);

-- Deux ajouts simultanés du même nom : le second est refusé. La règle complète
-- (accents ignorés) est checkPageTemplateCreation.
CREATE UNIQUE INDEX page_template_name_fr_key ON page_template (lower(name_fr));
CREATE UNIQUE INDEX page_template_name_en_key ON page_template (lower(name_en));

-- La RLS reste celle de la migration 0025 : lecture par tout utilisateur connecté ;
-- aucune écriture directe par le compte applicatif, seulement par les fonctions
-- admin_* ci-dessous.

-- À la création d'une page, le modèle est marqué « utilisé » avant d'être lu
-- verrouillé : une suppression simultanée attend, puis est refusée.
CREATE OR REPLACE FUNCTION enforce_page_template() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t page_template%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.template_id := OLD.template_id;
    NEW.template_name := OLD.template_name;
    NEW.task_id := OLD.task_id;
    RETURN NEW;
  END IF;
  IF NEW.template_id IS NULL THEN
    NEW.template_name := NULL;
    NEW.task_id := NULL;
    RETURN NEW;
  END IF;
  UPDATE page_template SET used = true WHERE id = NEW.template_id AND NOT used;
  SELECT * INTO t FROM page_template WHERE id = NEW.template_id FOR SHARE;
  IF NOT FOUND OR NOT t.active THEN
    RAISE EXCEPTION 'modèle de page inconnu ou désactivé'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'page_template_active';
  END IF;
  IF NEW.template_name IS DISTINCT FROM t.name_fr AND NEW.template_name IS DISTINCT FROM t.name_en THEN
    RAISE EXCEPTION 'la page reprend le nom du modèle'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'page_template_name';
  END IF;
  NEW.task_id := t.task_id;
  RETURN NEW;
END
$$;

-- Le modèle p_id, verrouillé jusqu'à la fin de la transaction ; vrai s'il est livré.
CREATE FUNCTION lock_page_template(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_origin text;
BEGIN
  SELECT origin INTO v_origin FROM page_template WHERE id = p_id FOR UPDATE;
  IF v_origin IS NULL THEN
    RAISE EXCEPTION 'modèle de page inconnu' USING ERRCODE = 'no_data_found';
  END IF;
  RETURN v_origin = 'delivered';
END
$$;
REVOKE EXECUTE ON FUNCTION lock_page_template(uuid) FROM PUBLIC;

-- Ajouter un modèle (administrateur) : actif dès son ajout.
CREATE FUNCTION admin_add_page_template(
  p_id uuid, p_name_fr text, p_name_en text, p_content_fr jsonb, p_content_en jsonb, p_task_id text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM require_admin();
  INSERT INTO page_template (id, name_fr, name_en, content_fr, content_en, task_id, origin)
  VALUES (p_id, p_name_fr, p_name_en, p_content_fr, p_content_en, p_task_id, 'added');
END
$$;

-- Modifier un modèle ajouté : nom, contenu et tâche (administrateur). Les pages
-- déjà créées ne changent pas.
CREATE FUNCTION admin_update_page_template(
  p_id uuid, p_name_fr text, p_name_en text, p_content_fr jsonb, p_content_en jsonb, p_task_id text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM require_admin();
  IF lock_page_template(p_id) THEN
    RAISE EXCEPTION 'un modèle livré ne se modifie pas'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'page_template_delivered_locked';
  END IF;
  UPDATE page_template
  SET name_fr = p_name_fr, name_en = p_name_en, content_fr = p_content_fr, content_en = p_content_en, task_id = p_task_id
  WHERE id = p_id;
END
$$;

-- Désactiver ou réactiver un modèle, livré ou ajouté (administrateur).
CREATE FUNCTION admin_set_page_template_active(p_id uuid, p_active boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM require_admin();
  PERFORM lock_page_template(p_id);
  UPDATE page_template SET active = p_active WHERE id = p_id;
END
$$;

-- Supprimer un modèle ajouté qui n'a jamais servi (administrateur). Le verrou
-- attend la fin d'une transaction qui crée une page depuis ce modèle.
CREATE FUNCTION admin_delete_page_template(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM require_admin();
  IF lock_page_template(p_id) THEN
    RAISE EXCEPTION 'un modèle livré ne se supprime pas'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'page_template_delivered_locked';
  END IF;
  IF (SELECT used FROM page_template WHERE id = p_id) THEN
    RAISE EXCEPTION 'une page a déjà été créée depuis ce modèle'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'page_template_used';
  END IF;
  DELETE FROM page_template WHERE id = p_id;
END
$$;
