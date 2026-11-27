-- Annulation d'une demande à l'assistant par son auteur (ticket 13 ; spécification
-- AS6, AS40 ; ADR-0006). Règle dans @app/shared (roles.ts : cancelAssistantRequest ;
-- assistant-requests.ts : canCancel), reproduite ici comme seconde barrière.
--
-- L'auteur, encore membre de l'initiative (lecteur compris, archivée comprise),
-- passe sa demande non terminée à Annulée « annulée par vous », et rien d'autre :
-- seul le traitement de fond écrit la lecture, le délai, le travail Hermes et l'avis.
-- Un autre membre et l'administrateur ne la voient pas, donc ne l'annulent pas (AS9).

CREATE POLICY assistant_request_cancel_by_author ON assistant_request FOR UPDATE
  USING (author_id = current_app_user_id() AND has_initiative_role(initiative_id, 'reader'))
  WITH CHECK (
    author_id = current_app_user_id()
    AND has_initiative_role(initiative_id, 'reader')
    AND status = 'cancelled'
    AND cancellation_reason = 'byAuthor'
  );

-- Mêmes règles qu'en migration 0038, plus : hors du traitement de fond, seuls le
-- statut et la raison d'annulation changent.
CREATE OR REPLACE FUNCTION enforce_assistant_request() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.initiative_id <> OLD.initiative_id OR NEW.author_id <> OLD.author_id
     OR NEW.usage <> OLD.usage OR NEW.element_ids <> OLD.element_ids
     OR NEW.question IS DISTINCT FROM OLD.question OR NEW.mode <> OLD.mode OR NEW.locale <> OLD.locale
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'une demande à l’assistant ne se modifie pas'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'assistant_request_frozen';
  END IF;
  IF NOT current_user_is_assistant_worker() AND (
       NEW.read_at IS DISTINCT FROM OLD.read_at
       OR NEW.timeout_minutes IS DISTINCT FROM OLD.timeout_minutes
       OR NEW.hermes_run_id IS DISTINCT FROM OLD.hermes_run_id
       OR NEW.advice IS DISTINCT FROM OLD.advice
       OR NEW.failure_reason IS DISTINCT FROM OLD.failure_reason) THEN
    RAISE EXCEPTION 'seul le traitement de fond fait avancer une demande à l’assistant'
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
