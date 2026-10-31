-- Statuts d'exigence paramétrables (ticket 11) : les 6 du BABOK, complétés par
-- l'administration ; liste valable pour toute l'application. Règles dans
-- @app/shared (requirement-statuses.ts), reproduites ici comme seconde barrière
-- (ADR-0006).

CREATE TABLE requirement_status (
  -- Code du BABOK (BABOK_REQUIREMENT_STATUSES), ou identifiant d'un statut ajouté.
  code       text PRIMARY KEY,
  babok      boolean NOT NULL DEFAULT false,
  -- Libellés d'un statut ajouté (REQUIREMENT_STATUS_LABEL_MAX_LENGTH) ; ceux du
  -- BABOK sont ceux de l'interface (shared/src/i18n.ts).
  label_fr   text CHECK (char_length(label_fr) BETWEEN 1 AND 50 AND label_fr = btrim(label_fr)),
  label_en   text CHECK (char_length(label_en) BETWEEN 1 AND 50 AND label_en = btrim(label_en)),
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz,
  -- Un statut ajouté a ses deux libellés et sa date d'ajout ; un statut du BABOK
  -- n'en a pas et reste actif.
  CONSTRAINT requirement_status_added_fields
    CHECK (babok = (label_fr IS NULL) AND babok = (label_en IS NULL) AND babok = (created_at IS NULL)),
  CONSTRAINT requirement_status_babok_active CHECK (active OR NOT babok)
);
INSERT INTO requirement_status (code, babok) VALUES
  ('proposed', true), ('verified', true), ('validated', true),
  ('approved', true), ('deferred', true), ('rejected', true);

-- Deux ajouts simultanés du même libellé : le second est refusé. La règle
-- complète (accents ignorés, libellés du BABOK compris) est checkStatusLabels.
CREATE UNIQUE INDEX requirement_status_label_fr_key ON requirement_status (lower(label_fr));
CREATE UNIQUE INDEX requirement_status_label_en_key ON requirement_status (lower(label_en));

-- Le statut d'une exigence est l'un de la liste : un statut porté ne se supprime pas.
ALTER TABLE requirement DROP CONSTRAINT requirement_status_check;
ALTER TABLE requirement
  ADD CONSTRAINT requirement_status_fkey FOREIGN KEY (status) REFERENCES requirement_status (code);
CREATE INDEX requirement_status_idx ON requirement (status);

-- Un statut désactivé n'est plus attribué, mais l'exigence qui le porte le garde
-- (checkRequirementStatus) ; un statut inconnu est refusé par requirement_status_fkey.
-- SECURITY DEFINER : verrouille la ligne du statut, pour qu'une désactivation
-- simultanée passe avant ou après.
CREATE FUNCTION enforce_requirement_status_active() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_active boolean;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT active INTO v_active FROM requirement_status WHERE code = NEW.status FOR SHARE;
    IF v_active IS FALSE THEN
      RAISE EXCEPTION 'statut d’exigence désactivé'
        USING ERRCODE = 'check_violation', CONSTRAINT = 'requirement_status_inactive';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER requirement_status_active
  BEFORE INSERT OR UPDATE OF status ON requirement FOR EACH ROW EXECUTE FUNCTION enforce_requirement_status_active();

-- Lisibles par tous ; modifiables seulement par les fonctions admin_* ci-dessous.
ALTER TABLE requirement_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY requirement_status_select ON requirement_status FOR SELECT USING (true);

CREATE FUNCTION require_added_requirement_status(p_code text) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM requirement_status WHERE code = p_code) THEN
    RAISE EXCEPTION 'statut d’exigence inconnu' USING ERRCODE = 'no_data_found';
  END IF;
  IF (SELECT babok FROM requirement_status WHERE code = p_code) THEN
    RAISE EXCEPTION 'un statut du BABOK n’est ni renommé, ni désactivé, ni supprimé'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'requirement_status_babok_locked';
  END IF;
END
$$;
REVOKE EXECUTE ON FUNCTION require_added_requirement_status(text) FROM PUBLIC;

-- Ajouter un statut (administrateur) : actif dès sa création.
CREATE FUNCTION admin_add_requirement_status(p_code text, p_label_fr text, p_label_en text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM require_admin();
  INSERT INTO requirement_status (code, label_fr, label_en, created_at) VALUES (p_code, p_label_fr, p_label_en, now());
END
$$;

-- Renommer, désactiver ou réactiver un statut ajouté (administrateur) ; NULL : inchangé.
CREATE FUNCTION admin_update_requirement_status(p_code text, p_label_fr text, p_label_en text, p_active boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM require_admin();
  PERFORM require_added_requirement_status(p_code);
  UPDATE requirement_status
  SET label_fr = coalesce(p_label_fr, label_fr),
      label_en = coalesce(p_label_en, label_en),
      active = coalesce(p_active, active)
  WHERE code = p_code;
END
$$;

-- Codes des statuts portés par une exigence ou présents dans l'historique d'une
-- exigence, toutes initiatives confondues : rien d'autre de leur contenu.
CREATE FUNCTION admin_used_requirement_statuses() RETURNS SETOF text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM require_admin();
  RETURN QUERY
    SELECT status FROM requirement
    UNION
    SELECT snapshot ->> 'status' FROM requirement_version;
END
$$;

-- Supprimer un statut ajouté jamais utilisé (administrateur). Le verrou attend
-- la fin d'une transaction qui donne ce statut à une exigence.
CREATE FUNCTION admin_delete_requirement_status(p_code text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM require_admin();
  PERFORM require_added_requirement_status(p_code);
  PERFORM 1 FROM requirement_status WHERE code = p_code FOR UPDATE;
  IF EXISTS (SELECT 1 FROM requirement WHERE status = p_code)
     OR EXISTS (SELECT 1 FROM requirement_version WHERE snapshot ->> 'status' = p_code) THEN
    RAISE EXCEPTION 'statut d’exigence déjà utilisé'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'requirement_status_used';
  END IF;
  DELETE FROM requirement_status WHERE code = p_code;
END
$$;
