-- Suggestions à la création d'une action (ticket 13) : les techniques d'une
-- tâche sont classées par usage dans l'initiative, puis dans toute
-- l'application. Ce comptage porte aussi sur les initiatives dont l'utilisateur
-- n'est pas membre : SECURITY DEFINER pour passer la RLS de `action`, en ne
-- renvoyant qu'un nombre par technique, jamais une action ni son initiative.
-- Sans utilisateur courant, rien.
CREATE FUNCTION technique_usage_counts()
RETURNS TABLE (technique_id text, action_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.technique_id, count(*)
  FROM action a
  WHERE a.technique_id IS NOT NULL AND current_app_user_id() IS NOT NULL
  GROUP BY a.technique_id
$$;
