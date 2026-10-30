-- Références et besoins (ticket 09) : acronymes des catégories paramétrés par
-- l'administration, numérotation par initiative et par catégorie, besoins liés
-- aux parties prenantes à leur origine et aux actions. Règles dans @app/shared
-- (references.ts, needs.ts, actions.ts, roles.ts), reproduites ici comme
-- seconde barrière (ADR-0006).

-- Acronyme actuel de chaque catégorie (REFERENCE_CATEGORIES, DEFAULT_ACRONYMS),
-- et tous les acronymes qu'elle a portés : un acronyme reste réservé à sa
-- catégorie, pour qu'aucune référence ne désigne deux objets.
CREATE TABLE reference_acronym (
  acronym  text PRIMARY KEY CHECK (acronym ~ '^[A-Z]{2,4}$'),
  category text NOT NULL CHECK (category IN ('need', 'requirement')),
  UNIQUE (acronym, category)
);
CREATE TABLE reference_category (
  category text PRIMARY KEY CHECK (category IN ('need', 'requirement')),
  acronym  text NOT NULL UNIQUE,
  CONSTRAINT reference_category_acronym_fkey
    FOREIGN KEY (acronym, category) REFERENCES reference_acronym (acronym, category)
);
INSERT INTO reference_acronym VALUES ('BE', 'need'), ('EX', 'requirement');
INSERT INTO reference_category VALUES ('need', 'BE'), ('requirement', 'EX');

-- Lisibles par tous ; modifiables seulement par admin_set_reference_acronym.
ALTER TABLE reference_acronym ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_category ENABLE ROW LEVEL SECURITY;
CREATE POLICY reference_acronym_select ON reference_acronym FOR SELECT USING (true);
CREATE POLICY reference_category_select ON reference_category FOR SELECT USING (true);

-- Changer l'acronyme d'une catégorie (administrateur) : les références déjà
-- attribuées ne changent pas ; une catégorie peut reprendre l'un de ses anciens.
CREATE FUNCTION admin_set_reference_acronym(p_category text, p_acronym text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM require_admin();
  IF EXISTS (SELECT 1 FROM reference_acronym WHERE acronym = p_acronym AND category <> p_category) THEN
    RAISE EXCEPTION 'acronyme déjà porté par une autre catégorie'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'reference_acronym_taken';
  END IF;
  -- Un changement concurrent au profit d'une autre catégorie est refusé par
  -- reference_category_acronym_fkey.
  INSERT INTO reference_acronym VALUES (p_acronym, p_category) ON CONFLICT (acronym) DO NOTHING;
  UPDATE reference_category SET acronym = p_acronym WHERE category = p_category;
END
$$;

-- Dernier numéro attribué, par initiative et par catégorie : jamais réutilisé,
-- même après suppression. Écrit seulement par les déclencheurs ci-dessous ; sans
-- politique, aucune ligne n'est accessible directement.
CREATE TABLE reference_counter (
  initiative_id uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  category      text NOT NULL REFERENCES reference_category (category),
  last_number   integer NOT NULL CHECK (last_number >= 1),
  PRIMARY KEY (initiative_id, category)
);
ALTER TABLE reference_counter ENABLE ROW LEVEL SECURITY;

-- Une référence a déjà été attribuée dans l'initiative : son code est figé.
CREATE FUNCTION initiative_has_references(p_initiative_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM reference_counter WHERE initiative_id = p_initiative_id)
$$;

CREATE FUNCTION enforce_initiative_code_frozen() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code AND initiative_has_references(OLD.id) THEN
    RAISE EXCEPTION 'une référence existe : le code de l’initiative ne change plus'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'initiative_code_frozen';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER initiative_code_frozen
  BEFORE UPDATE OF code ON initiative FOR EACH ROW EXECUTE FUNCTION enforce_initiative_code_frozen();

-- Prochaine référence de la catégorie dans l'initiative : CODE-ACRONYME-NUMÉRO,
-- le numéro sur 3 chiffres au moins (formatReference). Le verrou partagé sur
-- l'initiative attend un changement de code en cours, qui ne passera plus ensuite.
CREATE FUNCTION next_reference(p_initiative_id uuid, p_category text) RETURNS text
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_code    text;
  v_acronym text;
  v_number  integer;
BEGIN
  SELECT code INTO STRICT v_code FROM initiative WHERE id = p_initiative_id FOR SHARE;
  SELECT acronym INTO STRICT v_acronym FROM reference_category WHERE category = p_category;
  INSERT INTO reference_counter AS c VALUES (p_initiative_id, p_category, 1)
  ON CONFLICT (initiative_id, category) DO UPDATE SET last_number = c.last_number + 1
  RETURNING last_number INTO v_number;
  RETURN v_code || '-' || v_acronym || '-' || lpad(v_number::text, greatest(3, length(v_number::text)), '0');
END
$$;
-- Appelée seulement par les déclencheurs (SECURITY DEFINER) des objets référencés.
REVOKE EXECUTE ON FUNCTION next_reference(uuid, text) FROM PUBLIC;

-- Même liste que NEED_NATURES.
CREATE TYPE need_nature AS ENUM ('problem', 'opportunity');

CREATE TABLE need (
  id            uuid PRIMARY KEY,
  initiative_id uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  -- Attribuée par le déclencheur ci-dessous, ne change plus.
  reference     text NOT NULL UNIQUE,
  title         text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  nature        need_nature NOT NULL,
  -- Texte mis en forme (shared/src/rich-text.ts), même limite que NEED_DESCRIPTION_MAX_LENGTH.
  description   text CHECK (char_length(description) <= 20000),
  created_by    text NOT NULL REFERENCES app_user (id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text NOT NULL REFERENCES app_user (id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- Cible des liens, qui imposent la même initiative.
  UNIQUE (initiative_id, id)
);

-- Référence, auteurs et dates ; le besoin ne change pas d'initiative. SECURITY
-- DEFINER : tient le compteur, inaccessible directement.
CREATE FUNCTION enforce_need_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.reference := next_reference(NEW.initiative_id, 'need');
    NEW.created_by := current_app_user_id();
    NEW.created_at := now();
  ELSE
    IF NEW.initiative_id IS DISTINCT FROM OLD.initiative_id THEN
      RAISE EXCEPTION 'un besoin ne change pas d’initiative' USING ERRCODE = 'insufficient_privilege';
    END IF;
    NEW.reference := OLD.reference;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_by := current_app_user_id();
  NEW.updated_at := now();
  RETURN NEW;
END
$$;
CREATE TRIGGER need_enforce_rules
  BEFORE INSERT OR UPDATE ON need FOR EACH ROW EXECUTE FUNCTION enforce_need_rules();

-- Parties prenantes à l'origine d'un besoin : elles partent avec le besoin
-- (CASCADE), mais une partie prenante à l'origine d'un besoin ne se supprime
-- pas (NO ACTION, vérifiée en fin d'instruction : la suppression de
-- l'initiative emporte tout d'un même mouvement).
CREATE TABLE need_stakeholder (
  initiative_id  uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  need_id        uuid NOT NULL,
  stakeholder_id uuid NOT NULL,
  PRIMARY KEY (need_id, stakeholder_id),
  CONSTRAINT need_stakeholder_need_fkey
    FOREIGN KEY (initiative_id, need_id) REFERENCES need (initiative_id, id) ON DELETE CASCADE,
  CONSTRAINT need_stakeholder_stakeholder_fkey
    FOREIGN KEY (initiative_id, stakeholder_id) REFERENCES stakeholder (initiative_id, id)
);
CREATE INDEX need_stakeholder_stakeholder_id_idx ON need_stakeholder (stakeholder_id);

-- Liens action ↔ besoin : ni l'action ni le besoin liés ne se suppriment.
-- L'API traduit le refus en `linked` (action) ou `needLinked`.
CREATE TABLE action_need (
  initiative_id uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  action_id     uuid NOT NULL,
  need_id       uuid NOT NULL,
  PRIMARY KEY (action_id, need_id),
  CONSTRAINT action_need_action_fkey
    FOREIGN KEY (initiative_id, action_id) REFERENCES action (initiative_id, id),
  CONSTRAINT action_need_need_fkey
    FOREIGN KEY (initiative_id, need_id) REFERENCES need (initiative_id, id)
);
CREATE INDEX action_need_need_id_idx ON action_need (need_id);

-- Row Level Security : tout membre consulte ; propriétaires et contributeurs
-- créent, modifient et suppriment besoins et liens ; initiative archivée :
-- lecture seule. Un lien ne se modifie pas : on le retire et on en crée un autre.
ALTER TABLE need ENABLE ROW LEVEL SECURITY;

CREATE POLICY need_select ON need FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));
CREATE POLICY need_insert ON need FOR INSERT
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY need_update ON need FOR UPDATE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id))
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY need_delete ON need FOR DELETE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));

ALTER TABLE need_stakeholder ENABLE ROW LEVEL SECURITY;

CREATE POLICY need_stakeholder_select ON need_stakeholder FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));
CREATE POLICY need_stakeholder_insert ON need_stakeholder FOR INSERT
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY need_stakeholder_delete ON need_stakeholder FOR DELETE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));

ALTER TABLE action_need ENABLE ROW LEVEL SECURITY;

CREATE POLICY action_need_select ON action_need FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));
CREATE POLICY action_need_insert ON action_need FOR INSERT
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY action_need_delete ON action_need FOR DELETE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));

-- Les auteurs d'un besoin restent lisibles, même après leur départ de l'initiative.
CREATE FUNCTION appears_in_my_needs(p_user_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM need n
    JOIN initiative_member mine ON mine.initiative_id = n.initiative_id
    WHERE mine.user_id = current_app_user_id()
      AND p_user_id IN (n.created_by, n.updated_by)
  )
$$;
DROP POLICY app_user_select ON app_user;
CREATE POLICY app_user_select ON app_user FOR SELECT
  USING (id = current_app_user_id() OR shares_initiative_with(id) OR appears_in_my_owner_designations(id)
         OR appears_in_my_actions(id) OR appears_in_my_stakeholders(id) OR appears_in_my_needs(id));
