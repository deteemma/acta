#!/usr/bin/env bash
# Lecture de la base locale, pour un diagnostic : scripts/sql.sh "SELECT …"
# (outil Bash, application démarrée). La base est dans le socle : ni `psql` ni
# service « db » ici. La requête passe par le conteneur de l'API, avec le compte
# des migrations (propriétaire des tables, donc toutes les lignes, sans RLS),
# dans une transaction READ ONLY annulée à la fin. Une ligne JSON par résultat.
set -euo pipefail
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/.."

if [ $# -ne 1 ]; then
  echo 'Usage : scripts/sql.sh "SELECT …"' >&2
  exit 2
fi

OWNER_URL="$(grep -E '^MIGRATIONS_DATABASE_URL=' .env | cut -d= -f2-)"

docker compose run --rm --no-deps -T -e OWNER_URL="$OWNER_URL" -e SQL="$1" api node -e '
const pg = require("node:module").createRequire("/app/api/package.json")("pg");
(async () => {
  const client = new pg.Client({ connectionString: process.env.OWNER_URL });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const { rows } = await client.query(process.env.SQL);
    for (const row of rows) console.log(JSON.stringify(row));
    console.log(`(${rows.length} ligne(s))`);
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
})().catch((error) => { console.error(error.message); process.exit(1); });
' 2>&1 | grep -v -E '^ *Container .*(Creating|Created|Starting|Started) *$' || true
