#!/usr/bin/env bash
# Déploiement manuel d'une version (ADR-0009) :
#   1. sauvegarde de la base, 2. migrations, 3. démarrage des conteneurs.
#
# Usage : ./deployer.sh <application> <version>
#   <application> : dossier de l'application dans $APPLICATIONS_DIR
#                   (par défaut /opt/applications), contenant compose.yaml et .env
#   <version>     : version publiée sur GHCR (ex. 1.2.0), ou « local » pour
#                   l'image construite sur ce poste.
#
# Prérequis (une fois) : docker login ghcr.io (jeton GitHub « read:packages »).
set -euo pipefail
export MSYS_NO_PATHCONV=1

[ $# -eq 2 ] || { sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }
APPLICATION="$1"
VERSION="$2"
DOSSIER="${APPLICATIONS_DIR:-/opt/applications}/$APPLICATION"

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ || "$VERSION" == "local" ]]; then
  echo "Version invalide : attendu X.Y.Z (ex. 1.2.0) ou « local »." >&2
  exit 1
fi
[ -f "$DOSSIER/compose.yaml" ] && [ -f "$DOSSIER/.env" ] || {
  echo "Introuvable : $DOSSIER/compose.yaml et $DOSSIER/.env" >&2
  exit 1
}
cd "$DOSSIER"

lire_var() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2- || true; }
etape() { echo; echo "== $*"; }

# Fichiers de déploiement (compose.yaml, powersync, realm) alignés sur la version.
if [ "$VERSION" != "local" ] && [ -d .git ]; then
  etape "Alignement des fichiers sur l'étiquette v$VERSION"
  git fetch --tags --quiet
  git checkout --quiet "v$VERSION"
fi

etape "Version $VERSION"
if grep -qE '^VERSION=' .env; then
  sed -i "s|^VERSION=.*|VERSION=$VERSION|" .env
else
  echo "VERSION=$VERSION" >> .env
fi
if [ "$VERSION" != "local" ]; then
  docker compose pull migrations api
fi

etape "1/3 Sauvegarde de la base avant déploiement"
mkdir -p sauvegardes
FICHIER="sauvegardes/$(lire_var APP_NAME)-avant-$VERSION-$(date +%Y%m%d-%H%M%S).dump"
# Client PostgreSQL éphémère sur le réseau du socle, avec le compte propriétaire.
docker run --rm --network socle -e URL="$(lire_var MIGRATIONS_DATABASE_URL)" \
  postgres:17.11-alpine sh -c 'pg_dump --format=custom "$URL"' > "$FICHIER"
[ -s "$FICHIER" ] || { echo "Sauvegarde vide : déploiement interrompu." >&2; exit 1; }
echo "• $FICHIER ($(du -h "$FICHIER" | cut -f1))"

etape "2/3 Migrations"
if ! docker compose run --rm migrations; then
  echo "Échec des migrations : rien n'a été redémarré." >&2
  echo "Sauvegarde disponible : $FICHIER (README.md, « Restaurer la sauvegarde d'avant déploiement »)." >&2
  exit 1
fi

etape "3/3 Démarrage"
docker compose up -d --remove-orphans
for _ in $(seq 1 30); do
  ETAT="$(docker inspect --format '{{.State.Health.Status}}' "$(docker compose ps -q api)" 2>/dev/null || true)"
  [ "$ETAT" = "healthy" ] && break
  sleep 2
done
if [ "$ETAT" != "healthy" ]; then
  echo "L'API ne répond pas (état : ${ETAT:-inconnu}). Journal : docker compose logs api" >&2
  exit 1
fi
echo "• $(lire_var PUBLIC_URL) — version $VERSION en service"
