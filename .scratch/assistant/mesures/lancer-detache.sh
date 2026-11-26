#!/usr/bin/env bash
# Envoie les requêtes choisies au serveur en UNE seule connexion SSH (le pare-feu
# limite à 6 connexions par 30 s), puis les lance l'une après l'autre, détachées
# de SSH. Résultats dans /tmp/mesure-assistant/res-*.json, durées dans journal.txt.
# Usage : bash lancer-detache.sh T8 T9
set -eu
cd "$(dirname "$0")/payloads"
fichiers=""
for t in "$@"; do fichiers="$fichiers $(ls ${t}*.json)"; done
boucle="for n in$fichiers; do s=\$(date +%s); docker exec -i hermes-agent curl -s --max-time 3600 http://ollama:11434/api/chat -d @- < \$n > res-\$n; echo \"\$n \$((\$(date +%s)-s)) s\" >> journal.txt; done; echo fin >> journal.txt"
tar -cf - $fichiers | base64 -w0 | /c/Windows/System32/OpenSSH/ssh.exe -o BatchMode=yes vps "
set -e
mkdir -p /tmp/mesure-assistant
cd /tmp/mesure-assistant
rm -f res-* journal.txt
base64 -d | tar -xf -
ls -l$fichiers
nohup sh -c '$boucle' > /dev/null 2>&1 < /dev/null &
echo lancé"
