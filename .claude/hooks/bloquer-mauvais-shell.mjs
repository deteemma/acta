// Hook PreToolUse (Bash et PowerShell) : envoie chaque commande vers le shell où
// elle fonctionne sur ce poste Windows.
// - `docker compose … --build` sous Git Bash s'arrête sur « additional privileges
//   requested: pass --allow=fs.read=… » (COMPOSE_BAKE=false n'y change rien) ;
//   depuis PowerShell, la construction passe.
// - `bash …` depuis PowerShell lance le bash de WSL, qui ne voit pas docker ;
//   les scripts .sh se lancent depuis l'outil Bash (Git Bash).
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
}

if (tool === 'PowerShell') {
  const wsl = segments.find((s) => /^(&\s*)?bash(\.exe)?\s/.test(s));
  if (wsl) {
    refuse(
      wsl,
      'Depuis PowerShell, `bash` est celui de WSL, qui ne trouve pas docker. ' +
        'Lancer ce script avec l’outil Bash (Git Bash).',
    );
  }
}
