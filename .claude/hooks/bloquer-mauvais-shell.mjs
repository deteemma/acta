// Hook PreToolUse (Bash et PowerShell) : envoie chaque commande vers le shell où
// elle fonctionne sur ce poste Windows.
// - `docker compose … --build` sous Git Bash s'arrête sur « additional privileges
//   requested: pass --allow=fs.read=… » (COMPOSE_BAKE=false n'y change rien) ;
//   depuis PowerShell, la construction passe.
// - `bash …` depuis PowerShell lance le bash de WSL, qui ne voit pas docker ;
//   les scripts .sh se lancent depuis l'outil Bash (Git Bash). Sauf à travers
//   `ssh` : ce bash-là tourne sur le serveur.
// - Un fichier du dépôt se modifie avec Edit ou Write (CLAUDE.md) : un script
//   `python -` ou un `cat > fichier <<` réécrit les fins de ligne, abîme les
//   barres obliques inverses et échoue sur les apostrophes des heredocs.
let input = '';
for await (const chunk of process.stdin) input += chunk;
const { tool_name: tool, tool_input: toolInput } = JSON.parse(input);
const command = toolInput?.command ?? '';

const segments = command
  .split('\n')
  .flatMap((line) => line.split(/;|&&|\|\||\|/))
  .map((segment) => segment.trim());

const refuse = (segment, advice) => {
  console.error(`Commande refusée : « ${segment} ». ${advice}`);
  process.exit(2);
};

if (tool === 'Bash') {
  const build = segments.find((s) => /^(\w+=\S*\s+)*docker\s+compose\b.*(\s--build\b|\sbuild\b)/.test(s));
  if (build) {
    refuse(
      build,
      'Sous Git Bash, la construction Docker échoue (« additional privileges requested »). ' +
        'La lancer avec l’outil PowerShell, sans autre option : docker compose up -d --build',
    );
  }

  const inlinePython = segments.find((s) => /^(\w+=\S*\s+)*(python3?|py)(\.exe)?\s+-(\s|<|$)/.test(s));
  if (inlinePython) {
    refuse(
      inlinePython,
      'Modifier un fichier du dépôt avec l’outil Edit (plusieurs appels Edit dans une même réponse si besoin). ' +
        'Un script qui n’est pas une modification de fichier s’écrit d’abord dans le scratchpad avec Write, puis s’exécute.',
    );
  }

  const outsideScratch = /scratchpad|\$\{?(TMP|TEMP|TMPDIR)\b|^["']?\/tmp\/|^\/dev\//;
  const heredocWrite = segments.find((s) => {
    const target = /^cat\s*>>?\s*(\S+)\s*<</.exec(s)?.[1];
    return target !== undefined && !outsideScratch.test(target);
  });
  if (heredocWrite) {
    refuse(
      heredocWrite,
      'Écrire un fichier du dépôt avec l’outil Write (nouveau fichier) ou Edit (ajout à un fichier existant).',
    );
  }
}

if (tool === 'PowerShell' && !/\bssh(\.exe)?\b/i.test(command)) {
  const wsl = segments.find((s) => /^(&\s*)?bash(\.exe)?\s/.test(s));
  if (wsl) {
    refuse(
      wsl,
      'Depuis PowerShell, `bash` est celui de WSL, qui ne trouve pas docker. ' +
        'Lancer ce script avec l’outil Bash (Git Bash).',
    );
  }
}
