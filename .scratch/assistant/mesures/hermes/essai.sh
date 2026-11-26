#!/usr/bin/env bash
# Essai du ticket 10, sur le serveur, dans /tmp/acta-essai.
# Usage : bash essai.sh installer | lancer | etat | supprimer | nettoyer
# Instance Hermes d'essai séparée de hermes-webui : son volume, un réseau interne
# sans Internet partagé avec Ollama et le relais, aucun port publié.
set -eu
D=/tmp/acta-essai
cd "$D"
IMAGE=nousresearch/hermes-agent:latest

api() { # api MÉTHODE CHEMIN [fichier-corps]
  if [ $# -ge 3 ]; then
    docker exec -i acta-essai-hermes curl -s -X "$1" -H "Authorization: Bearer $(cat cle)" \
      -H 'Content-Type: application/json' --data-binary @- "http://localhost:8642$2" < "$3"
  else
    docker exec acta-essai-hermes curl -s -X "$1" -H "Authorization: Bearer $(cat cle)" "http://localhost:8642$2"
  fi
}

case "$1" in
installer)
  docker network create --internal acta-essai-interne
  docker network connect acta-essai-interne ollama
  docker volume create acta-essai-hermes
  mkdir -p journal resultats && chmod 777 journal
  head -c 60 /dev/urandom | base64 | tr -dc A-Za-z0-9 | head -c 40 > cle && chmod 600 cle
  docker run -d --name acta-essai-relais --network acta-essai-interne --memory 256m \
    -v "$D/relais.py:/relais.py:ro" -v "$D/journal:/journal" \
    --entrypoint /opt/hermes/.venv/bin/python "$IMAGE" /relais.py
  if [ "${MEMOIRE_VIVE:-0}" = 1 ]; then
    # Données de Hermes en mémoire vive ; configuration montée en lecture seule.
    docker run -d --name acta-essai-hermes --network acta-essai-interne --memory 2g \
      -e API_SERVER_ENABLED=true -e API_SERVER_HOST=0.0.0.0 -e "API_SERVER_KEY=$(cat cle)" \
      --tmpfs /opt/data:rw,size=512m -v "$D/config.yaml:/opt/data/config.yaml:ro" "$IMAGE" gateway run
  else
    docker create --name acta-essai-hermes --network acta-essai-interne --memory 2g \
      -e API_SERVER_ENABLED=true -e API_SERVER_HOST=0.0.0.0 -e "API_SERVER_KEY=$(cat cle)" \
      -v acta-essai-hermes:/opt/data "$IMAGE" gateway run
    docker cp config.yaml acta-essai-hermes:/opt/data/config.yaml
    docker start acta-essai-hermes
  fi
  for i in $(seq 1 60); do
    if docker exec acta-essai-hermes curl -sf http://localhost:8642/health > /dev/null 2>&1; then echo "prêt après ${i}0 s"; break; fi
    sleep 10
  done
  ;;
lancer) # lance les essais l'un après l'autre, détaché de SSH
  nohup bash "$D/essai.sh" boucle > "$D/boucle.log" 2>&1 < /dev/null &
  echo lancé
  ;;
boucle)
  for f in payloads/*.json; do
    n=$(basename "$f" .json)
    debut=$(date +%s)
    api POST /v1/runs "$f" > "resultats/$n-creation.json"
    id=$(sed -n 's/.*"run_id": *"\([^"]*\)".*/\1/p' "resultats/$n-creation.json")
    [ -z "$id" ] && id=$(sed -n 's/.*"id": *"\(run_[^"]*\)".*/\1/p' "resultats/$n-creation.json")
    while :; do
      sleep 5
      api GET "/v1/runs/$id" > "resultats/$n-run.json"
      grep -q -E '"status": *"(queued|running|stopping)"' "resultats/$n-run.json" || break
      [ $(( $(date +%s) - debut )) -gt 3600 ] && break
    done
    echo "$n $id $(( $(date +%s) - debut )) s" >> resultats/journal.txt
  done
  echo fin >> resultats/journal.txt
  ;;
etat)
  cat resultats/journal.txt 2>/dev/null || true
  cat journal/index.txt 2>/dev/null || true
  ;;
supprimer) # supprime chaque session d'essai et vérifie qu'elle a disparu
  for s in essai-t10-r1 essai-t10-r2 essai-t10-r3 essai-t10-r4; do
    echo "== $s avant : $(api GET "/api/sessions/$s" | head -c 200)"
    echo "== DELETE : $(api DELETE "/api/sessions/$s")"
    echo "== après : $(api GET "/api/sessions/$s" | head -c 200)"
  done
  ;;
nettoyer)
  docker rm -f acta-essai-hermes acta-essai-relais || true
  docker network disconnect acta-essai-interne ollama || true
  docker network rm acta-essai-interne || true
  docker volume rm acta-essai-hermes || true
  ;;
esac
