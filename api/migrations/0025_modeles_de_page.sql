-- Modèles de page (phase 2, ticket 27, décision 09). Règles dans @app/shared
-- (page-templates.ts, pages.ts), reproduites ici comme seconde barrière (ADR-0006).
--
-- Un modèle vaut pour toute l'application : nom et contenu en français et en
-- anglais, tâche BABOK, mention « livré » ou « ajouté », état actif. Son contenu
-- est copié dans la page à sa création, dans la langue d'interface de l'auteur :
-- modifier le modèle ne touche aucune page. La page garde la mention du modèle,
-- sous le nom qu'il portait, et sa tâche, figées ; cette tâche ne la rend pas
-- couverte (seules les actions couvrent une tâche, migration 0015).

CREATE TABLE page_template (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_fr    text NOT NULL CHECK (char_length(btrim(name_fr)) BETWEEN 1 AND 200),
  name_en    text NOT NULL CHECK (char_length(btrim(name_en)) BETWEEN 1 AND 200),
  -- JSON de Tiptap (ADR-0019), même limite de texte qu'une page.
  content_fr jsonb NOT NULL CHECK (content_fr ->> 'type' = 'doc' AND page_text_length(content_fr) <= 200000),
  content_en jsonb NOT NULL CHECK (content_en ->> 'type' = 'doc' AND page_text_length(content_en) <= 200000),
  -- Facultative pour un modèle ajouté (ticket 30) ; un modèle livré correspond au livrable d'une tâche.
  task_id    text REFERENCES babok_task (id),
  origin     text NOT NULL CHECK (origin IN ('delivered', 'added')),
  -- Désactivé : plus proposé ; les pages créées avec lui ne changent pas.
  active     boolean NOT NULL DEFAULT true,
  CONSTRAINT page_template_delivered_task CHECK (origin = 'added' OR task_id IS NOT NULL)
);

-- Row Level Security : lecture par tout utilisateur connecté ; aucune écriture par
-- le compte applicatif avant l'administration des modèles (ticket 30).
ALTER TABLE page_template ENABLE ROW LEVEL SECURITY;
CREATE POLICY page_template_select ON page_template FOR SELECT
  USING (current_app_user_id() IS NOT NULL);

-- Deux modèles d'essai ; les 22 modèles rédigés les remplacent au ticket 28.
INSERT INTO page_template (id, task_id, name_fr, name_en, content_fr, content_en, origin) VALUES
  ('5f1e2d3c-0027-4a00-8000-000000000301', '3.1', 'Approche de l’analyse métier (essai)', 'Business Analysis Approach (trial)', '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Contexte"}]},{"type":"paragraph","content":[{"type":"text","text":"Résumez le changement visé et ce qui rend l’analyse nécessaire. Remplacez ce texte d’aide.","marks":[{"type":"italic"}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Démarche retenue"}]},{"type":"paragraph","content":[{"type":"text","text":"Indiquez si l’analyse sera menée de façon prédictive, adaptative ou mixte, et pourquoi.","marks":[{"type":"italic"}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Activités prévues"}]},{"type":"paragraph","content":[{"type":"text","text":"Listez les principales activités d’analyse, qui les mène et pour quand.","marks":[{"type":"italic"}]}]},{"type":"table","content":[{"type":"tableRow","content":[{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Activité"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Responsable"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Échéance"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","content":[{"type":"paragraph"}]},{"type":"tableCell","content":[{"type":"paragraph"}]},{"type":"tableCell","content":[{"type":"paragraph"}]}]}]}]}'::jsonb, '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Context"}]},{"type":"paragraph","content":[{"type":"text","text":"Summarise the intended change and why analysis is needed. Replace this help text.","marks":[{"type":"italic"}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Chosen approach"}]},{"type":"paragraph","content":[{"type":"text","text":"State whether the analysis will be predictive, adaptive or mixed, and why.","marks":[{"type":"italic"}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Planned activities"}]},{"type":"paragraph","content":[{"type":"text","text":"List the main analysis activities, who leads them and by when.","marks":[{"type":"italic"}]}]},{"type":"table","content":[{"type":"tableRow","content":[{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Activity"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Owner"}]}]},{"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Due date"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","content":[{"type":"paragraph"}]},{"type":"tableCell","content":[{"type":"paragraph"}]},{"type":"tableCell","content":[{"type":"paragraph"}]}]}]}]}'::jsonb, 'delivered'),
  ('5f1e2d3c-0027-4a00-8000-000000000601', '6.1', 'Description de l’état actuel (essai)', 'Current State Description (trial)', '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Périmètre observé"}]},{"type":"paragraph","content":[{"type":"text","text":"Précisez les équipes, processus et outils décrits ici. Remplacez ce texte d’aide.","marks":[{"type":"italic"}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Fonctionnement actuel"}]},{"type":"paragraph","content":[{"type":"text","text":"Décrivez comment le travail se fait aujourd’hui, étape par étape.","marks":[{"type":"italic"}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Difficultés constatées"}]},{"type":"paragraph","content":[{"type":"text","text":"Notez les problèmes observés et leurs effets.","marks":[{"type":"italic"}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Points forts à conserver"}]},{"type":"paragraph","content":[{"type":"text","text":"Notez ce qui fonctionne bien et doit survivre au changement.","marks":[{"type":"italic"}]}]}]}'::jsonb, '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Scope observed"}]},{"type":"paragraph","content":[{"type":"text","text":"Specify the teams, processes and tools described here. Replace this help text.","marks":[{"type":"italic"}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"How things work today"}]},{"type":"paragraph","content":[{"type":"text","text":"Describe how the work is done today, step by step.","marks":[{"type":"italic"}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Issues observed"}]},{"type":"paragraph","content":[{"type":"text","text":"Note the problems observed and their effects.","marks":[{"type":"italic"}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Strengths to keep"}]},{"type":"paragraph","content":[{"type":"text","text":"Note what works well and should survive the change.","marks":[{"type":"italic"}]}]}]}'::jsonb, 'delivered');

-- ── Page : modèle d'origine et tâche ────────────────────────────────────────

-- Un modèle qui a servi ne se supprime pas (décision 09, point 6) : pas de ON DELETE.
ALTER TABLE page
  ADD COLUMN template_id   uuid REFERENCES page_template (id),
  -- Nom du modèle à la création, dans la langue de la page.
  ADD COLUMN template_name text,
  -- Tâche du modèle à la création ; une page vide n'a pas de tâche.
  ADD COLUMN task_id       text REFERENCES babok_task (id),
  ADD CONSTRAINT page_template_mention CHECK (
    (template_id IS NULL) = (template_name IS NULL) AND (template_id IS NOT NULL OR task_id IS NULL)
  );
CREATE INDEX page_template_id_idx ON page (template_id);
CREATE INDEX page_task_id_idx ON page (task_id);

-- À la création, le modèle doit être actif, le nom repris est l'un des siens, et
-- la tâche est la sienne ; ensuite, rien de cela ne change. SECURITY DEFINER :
-- lit le modèle quel que soit son état.
CREATE FUNCTION enforce_page_template() RETURNS trigger
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
  SELECT * INTO t FROM page_template WHERE id = NEW.template_id;
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
CREATE TRIGGER page_enforce_template
  BEFORE INSERT OR UPDATE ON page FOR EACH ROW EXECUTE FUNCTION enforce_page_template();
