#!/usr/bin/env bash
# Ticket 16 : rejoue la migration 0018 sur une COPIE de la base et compare les
# comptes avant et après. La base d'origine n'est jamais modifiée.
# Usage : scripts/verifier-passage-action.sh <conteneur_postgres> [base]
# À lancer avant que la migration 0018 ne soit appliquée à la base d'origine.
set -euo pipefail
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/.."

# Le conteneur du socle n'est connu que de la personne qui lance l'outil (ADR-0007).
CONTAINER="${1:?Indiquer le conteneur PostgreSQL du socle}"
SOURCE="${2:-$(grep -E '^APP_NAME=' .env | cut -d= -f2-)}"
COPY="${SOURCE}_copie_ticket16"
psql_in() { docker exec -i "$CONTAINER" sh -c 'psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$0" -At' "$1"; }

OWNER="$(psql_in postgres <<< "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = '$SOURCE';")"
echo "Copie de $SOURCE vers $COPY"
psql_in postgres <<< "DROP DATABASE IF EXISTS $COPY; CREATE DATABASE $COPY OWNER $OWNER;" 2>/dev/null
trap 'psql_in postgres <<< "DROP DATABASE IF EXISTS $COPY;"' EXIT
docker exec "$CONTAINER" sh -c "pg_dump -U \"\$POSTGRES_USER\" $SOURCE | psql -q -U \"\$POSTGRES_USER\" -d $COPY -v ON_ERROR_STOP=1" > /dev/null

counts() { # $1 : table des tickets, $2 : table des liens besoins, $3 : table des liens exigences
  psql_in "$COPY" <<< "
  SELECT 'actions', count(*) FROM $1
  UNION ALL SELECT 'liens besoins', count(*) FROM $2
  UNION ALL SELECT 'liens exigences', count(*) FROM $3
  UNION ALL SELECT 'parties prenantes concernées', count(*) FROM action_stakeholder
  UNION ALL SELECT 'suggestions d''origine', count(suggestion_key) FROM $1
  UNION ALL SELECT 'statut À faire', count(*) FILTER (WHERE status::text = 'todo') FROM $1
  UNION ALL SELECT 'statut En cours', count(*) FILTER (WHERE status::text = 'in_progress') FROM $1
  UNION ALL SELECT 'statut Terminée', count(*) FILTER (WHERE status::text = 'done') FROM $1
  UNION ALL SELECT 'statut Annulée', count(*) FILTER (WHERE status::text = 'cancelled') FROM $1
  ORDER BY 1"
}
# Empreinte du contenu des lignes, hors colonnes ajoutées.
fingerprint() {
  psql_in "$COPY" <<< "SELECT md5(string_agg(concat_ws('|', id, initiative_id, title, description, task_id, technique_id,
    assignee_id, assigned_by, assigned_at, due_date, status::text, suggestion_key, created_by, created_at, updated_by, updated_at),
    E'\n' ORDER BY id)) FROM $1;"
}

BEFORE="$(counts action action_need action_requirement)"
ROWS_BEFORE="$(fingerprint action)"

# Comme l'exécuteur de migrations : une transaction, avec le compte propriétaire.
{ echo "BEGIN; SET LOCAL ROLE $OWNER;"; cat api/migrations/0018_ticket_et_passage_de_l_action.sql; echo "COMMIT;"; } | psql_in "$COPY"

AFTER="$(counts ticket ticket_need ticket_requirement)"
ROWS_AFTER="$(fingerprint ticket)"

echo; echo "Avant :"; echo "$BEFORE"
echo; echo "Après :"; echo "$AFTER"
[ "$BEFORE" = "$AFTER" ] || { echo "ÉCHEC : les comptes diffèrent."; exit 1; }
[ "$ROWS_BEFORE" = "$ROWS_AFTER" ] || { echo "ÉCHEC : le contenu des lignes diffère."; exit 1; }

# Références, compteurs et historique.
CHECKS="$(psql_in "$COPY" <<'SQL'
SELECT 'références mal formées', count(*) FROM ticket t JOIN initiative i ON i.id = t.initiative_id
  WHERE t.reference !~ ('^' || i.code || '-AC-[0-9]{3,}$')
UNION ALL SELECT 'références hors de l''ordre de création', count(*) FROM (
  SELECT substring(reference from '[0-9]+$')::int AS number,
         row_number() OVER (PARTITION BY initiative_id ORDER BY created_at, id) AS expected FROM ticket) n
  WHERE number <> expected
UNION ALL SELECT 'compteurs qui ne reprennent pas à la suite', count(*) FROM (
  SELECT t.initiative_id FROM ticket t LEFT JOIN reference_counter c
    ON c.initiative_id = t.initiative_id AND c.category = 'action'
  GROUP BY t.initiative_id, c.last_number HAVING count(*) IS DISTINCT FROM c.last_number::bigint) w
UNION ALL SELECT 'entrées d''historique', count(*) FROM ticket_version
UNION ALL SELECT 'tickets sans état de départ', count(*) FROM ticket t
  WHERE NOT EXISTS (SELECT 1 FROM ticket_snapshot s WHERE s.ticket_id = t.id);
SQL
)"
echo; echo "Contrôles (tous attendus à 0) :"; echo "$CHECKS"
if echo "$CHECKS" | grep -qv '|0$'; then echo "ÉCHEC."; exit 1; fi
echo; echo "Passage vérifié : mêmes comptes, mêmes contenus, références et compteurs corrects, historique vide."
