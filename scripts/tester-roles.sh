#!/usr/bin/env bash
# Vérifie les permissions de bout en bout (API + RLS) sur l'application démarrée.
# Usage : scripts/tester-roles.sh   (depuis la racine du dépôt, application démarrée)
set -euo pipefail
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/.."

APP_NAME="$(grep -E '^APP_NAME=' .env | cut -d= -f2-)"

# DATABASE_URL et OIDC_JWKS_URL sont déjà fournis au service « api » par .env.
docker compose run --rm --no-deps \
  -v "$(pwd)/scripts:/scripts:ro" \
  -e APP_NAME="$APP_NAME" \
  api node /scripts/tester-roles.mjs
