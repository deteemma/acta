-- Demandes à l'assistant (carte « assistant », ticket 12 ; spécification AS1 à
-- AS9, AS20, AS32, AS37, AS40 ; ADR-0006, ADR-0022). Règles dans @app/shared
-- (assistant-requests.ts, roles.ts : askAssistant, viewAssistantRequests),
-- reproduites ici comme seconde barrière.
--
-- Une demande est privée à son auteur (AS9) : aucune politique ne l'ouvre à un
-- autre membre ni à l'administrateur. Le traitement de fond de l'API (ADR-0022,
-- point 3) passe par DatabaseService.asAssistantWorker, qui positionne
-- app.is_assistant_worker : lui seul fait avancer une demande.

-- Paramètres de l'assistant (AS32), à leur valeur de départ ; l'administration
-- les rendra modifiables (ticket 21). Mêmes bornes que la spécification.
ALTER TABLE app_settings
  ADD COLUMN assistant_concurrency integer NOT NULL DEFAULT 1
    CONSTRAINT app_settings_assistant_concurrency CHECK (assistant_concurrency BETWEEN 1 AND 10),
  ADD COLUMN assistant_quick_timeout_minutes integer NOT NULL DEFAULT 20
    CONSTRAINT app_settings_assistant_quick_timeout CHECK (assistant_quick_timeout_minutes BETWEEN 5 AND 60),
  ADD COLUMN assistant_thorough_timeout_minutes integer NOT NULL DEFAULT 60
    CONSTRAINT app_settings_assistant_thorough_timeout CHECK (assistant_thorough_timeout_minutes BETWEEN 10 AND 180),
  ADD COLUMN assistant_max_data_tokens integer NOT NULL DEFAULT 16000
    CONSTRAINT app_settings_assistant_max_data_tokens CHECK (assistant_max_data_tokens BETWEEN 2000 AND 32000),
  ADD CONSTRAINT app_settings_assistant_timeouts
    CHECK (assistant_thorough_timeout_minutes >= assistant_quick_timeout_minutes);

-- Vrai dans une transaction du traitement de fond (DatabaseService.asAssistantWorker).
CREATE FUNCTION current_user_is_assistant_worker() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.is_assistant_worker', true), '') = 'true'
$$;

-- Prévue pour les sept usages (AS10), les six raisons d'échec (AS7) et les
-- raisons d'annulation (AS6, AS8) : les tickets suivants n'y reviennent pas.
CREATE TABLE assistant_request (
  id            uuid PRIMARY KEY,
  -- Initiative supprimée : ses demandes avec elle (AS9).
  initiative_id uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  author_id     text NOT NULL REFERENCES app_user (id) DEFAULT current_app_user_id(),
  usage         text NOT NULL CONSTRAINT assistant_request_usage CHECK (usage IN (
    'review_page', 'next_steps', 'prepare_workshop', 'check_traceability',
    'draft_gherkin', 'status_review', 'free_question')),
  -- Élément choisi selon l'usage (pages, action ou exigences) ; vide sans élément.
  element_ids   uuid[] NOT NULL DEFAULT '{}' CONSTRAINT assistant_request_elements CHECK (cardinality(element_ids) <= 3),
  -- Question libre, 2 000 caractères au plus (AS10).
  question      text CONSTRAINT assistant_request_question CHECK (char_length(question) BETWEEN 1 AND 2000),
  mode          text NOT NULL CONSTRAINT assistant_request_mode CHECK (mode IN ('quick', 'thorough')),
  -- Langue d'ACTA de l'auteur au moment de la demande (celle de son navigateur
  -- s'il n'en a pas choisi) : libellés des données et instructions (AS18, AS28).
  locale        text NOT NULL CONSTRAINT assistant_request_locale CHECK (locale IN ('fr', 'en')),
  status        text NOT NULL DEFAULT 'pending' CONSTRAINT assistant_request_status CHECK (status IN (
    'pending', 'running', 'answered', 'failed', 'cancelled')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Date de lecture des données, au passage En cours (AS17).
  read_at       timestamptz,
  -- Fin : posée par la base au passage à un statut définitif.
  finished_at   timestamptz,
  -- Délai applicable, celui en vigueur au passage En cours (AS5).
  timeout_minutes integer,
  hermes_run_id text,
  -- Avis, en Markdown (AS27).
  advice        text,
  failure_reason text CONSTRAINT assistant_request_failure_reason CHECK (failure_reason IN (
    'timeout', 'unavailable', 'noAnswer', 'dataTooLarge', 'elementGone', 'elementUnsuitable')),
  cancellation_reason text CONSTRAINT assistant_request_cancellation_reason CHECK (cancellation_reason IN (
    'byAuthor', 'accessLost', 'accountDeactivated')),
  -- Ce que chaque statut porte (AS2).
  CONSTRAINT assistant_request_state CHECK (
    CASE status
      WHEN 'pending' THEN read_at IS NULL AND finished_at IS NULL AND timeout_minutes IS NULL
        AND hermes_run_id IS NULL AND advice IS NULL AND failure_reason IS NULL AND cancellation_reason IS NULL
      WHEN 'running' THEN read_at IS NOT NULL AND finished_at IS NULL AND timeout_minutes IS NOT NULL
        AND hermes_run_id IS NOT NULL AND advice IS NULL AND failure_reason IS NULL AND cancellation_reason IS NULL
      WHEN 'answered' THEN read_at IS NOT NULL AND finished_at IS NOT NULL
        AND advice IS NOT NULL AND failure_reason IS NULL AND cancellation_reason IS NULL
      WHEN 'failed' THEN finished_at IS NOT NULL
        AND advice IS NULL AND failure_reason IS NOT NULL AND cancellation_reason IS NULL
      WHEN 'cancelled' THEN finished_at IS NOT NULL
        AND advice IS NULL AND failure_reason IS NULL AND cancellation_reason IS NOT NULL
    END
  )
);

-- Une seule demande non terminée par personne, toutes initiatives confondues (AS3).
CREATE UNIQUE INDEX assistant_request_one_unfinished ON assistant_request (author_id)
  WHERE status IN ('pending', 'running');
-- File, premier arrivé, premier servi (AS4).
CREATE INDEX assistant_request_queue_idx ON assistant_request (created_at, id) WHERE status = 'pending';
CREATE INDEX assistant_request_author_idx ON assistant_request (author_id, initiative_id);
CREATE INDEX assistant_request_initiative_idx ON assistant_request (initiative_id);

-- Statuts définitifs, colonnes de la demande figées, fin posée par la base (AS2).
CREATE FUNCTION enforce_assistant_request() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.initiative_id <> OLD.initiative_id OR NEW.author_id <> OLD.author_id
     OR NEW.usage <> OLD.usage OR NEW.element_ids <> OLD.element_ids
     OR NEW.question IS DISTINCT FROM OLD.question OR NEW.mode <> OLD.mode OR NEW.locale <> OLD.locale
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'une demande à l’assistant ne se modifie pas'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'assistant_request_frozen';
  END IF;
  IF NOT (
    (OLD.status = 'pending' AND NEW.status IN ('running', 'failed', 'cancelled'))
    OR (OLD.status = 'running' AND NEW.status IN ('answered', 'failed', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'passage de statut refusé : % vers %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation', CONSTRAINT = 'assistant_request_transition';
  END IF;
  IF NEW.status IN ('answered', 'failed', 'cancelled') THEN
    NEW.finished_at := now();
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER assistant_request_enforce
  BEFORE UPDATE ON assistant_request FOR EACH ROW EXECUTE FUNCTION enforce_assistant_request();

-- Compte actif de l'utilisateur courant (AS40).
CREATE FUNCTION current_user_is_active() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM app_user WHERE id = current_app_user_id() AND deactivated_at IS NULL)
$$;

ALTER TABLE assistant_request ENABLE ROW LEVEL SECURITY;

-- L'auteur, encore membre de l'initiative (AS9) : quitter l'initiative masque ses
-- demandes, y revenir les montre. Le traitement de fond lit la file.
CREATE POLICY assistant_request_select ON assistant_request FOR SELECT
  USING (
    (author_id = current_app_user_id() AND has_initiative_role(initiative_id, 'reader'))
    OR current_user_is_assistant_worker()
  );
-- Tout membre, lecteur compris, initiative archivée comprise, compte actif (AS1, AS40) ;
-- la demande naît En attente.
CREATE POLICY assistant_request_insert ON assistant_request FOR INSERT
  WITH CHECK (
    author_id = current_app_user_id()
    AND has_initiative_role(initiative_id, 'reader')
    AND current_user_is_active()
    AND status = 'pending'
  );
-- Seul le traitement de fond fait avancer une demande (AS37) ; l'annulation par
-- l'auteur et l'effacement viendront avec les tickets 13 et 19.
CREATE POLICY assistant_request_update ON assistant_request FOR UPDATE
  USING (current_user_is_assistant_worker()) WITH CHECK (current_user_is_assistant_worker());

-- Position dans la file (AS4) : nombre de demandes En attente arrivées avant la
-- sienne, toutes initiatives confondues. Un seul nombre, pour l'auteur seul et
-- tant que sa demande attend ; null sinon. Aucune ligne d'une autre demande.
CREATE FUNCTION assistant_queue_ahead(p_request_id uuid) RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  mine assistant_request%ROWTYPE;
BEGIN
  SELECT * INTO mine FROM assistant_request
  WHERE id = p_request_id AND author_id = current_app_user_id() AND status = 'pending'
    AND has_initiative_role(initiative_id, 'reader');
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN (SELECT count(*)::integer FROM assistant_request
          WHERE status = 'pending' AND (created_at, id) < (mine.created_at, mine.id));
END
$$;

-- Demande non terminée de l'utilisateur courant, pour la nommer dans le refus
-- (AS3, ticket 08) : son usage et son statut seulement, quelle que soit l'initiative.
CREATE FUNCTION my_unfinished_assistant_request() RETURNS TABLE (usage text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT usage, status FROM assistant_request
  WHERE author_id = current_app_user_id() AND status IN ('pending', 'running')
$$;
