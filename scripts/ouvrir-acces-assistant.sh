#!/usr/bin/env bash
# Accès local à l'instance Hermes d'ACTA du serveur (ticket 11 de l'assistant).
#
# Usage : bash scripts/ouvrir-acces-assistant.sh [hôte-ssh] [port-local]
#   hôte-ssh   : alias SSH du serveur (par défaut « vps »)
#   port-local : port du tunnel sur ce poste (par défaut 8642)
#
# Ouvre un tunnel SSH du poste vers le conteneur Hermes, par l'hôte du serveur :
# aucun port de Hermes n'est publié et Hermes reste sur ses seuls réseaux
# (AS35). Le tunnel reste ouvert tant que la commande tourne, et se rouvre
# s'il est coupé (Ctrl+C pour le fermer). Dans le .env local : HERMES_URL=http://host.docker.internal:<port>
# et HERMES_API_KEY=<celle du serveur>, puis redémarrer l'API (INSTALL.md, § 7.4).
set -euo pipefail

HOTE="${1:-vps}"
PORT="${2:-8642}"
cd "$(dirname "$0")/.."
APP="$(grep -E '^APP_NAME=' .env | tail -n1 | cut -d= -f2-)"
CONTENEUR="$APP-assistant-1"
RESEAU="${APP}_assistant"

# Sous Git Bash, le ssh de Windows utilise l'agent qui détient la clé.
SSH=ssh
[ -x /c/Windows/System32/OpenSSH/ssh.exe ] && SSH=/c/Windows/System32/OpenSSH/ssh.exe

# Une connexion coupée est rouverte, en relisant l'adresse du conteneur sur le
# réseau API ↔ Hermes (elle change à chaque redémarrage de Hermes). La pause
# entre deux essais ménage le pare-feu du serveur (connexions SSH limitées).
while :; do
  IP="$("$SSH" -o BatchMode=yes -o ConnectTimeout=15 "$HOTE" \
    "docker inspect --format '{{(index .NetworkSettings.Networks \"$RESEAU\").IPAddress}}' $CONTENEUR" || true)"
  if [[ "$IP" =~ ^[0-9.]+$ ]]; then
    echo "$(date +%H:%M:%S) Tunnel 127.0.0.1:$PORT → $CONTENEUR ($IP:8642) par $HOTE. Ctrl+C pour fermer."
    "$SSH" -N -o BatchMode=yes -o ExitOnForwardFailure=yes -o ConnectTimeout=15 \
      -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
      -L "127.0.0.1:$PORT:$IP:8642" "$HOTE" || true
    echo "$(date +%H:%M:%S) Tunnel coupé : nouvel essai dans 20 s."
  else
    echo "$(date +%H:%M:%S) Adresse de $CONTENEUR introuvable (« $IP ») : nouvel essai dans 20 s." >&2
  fi
  sleep 20
done
