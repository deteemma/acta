// Hook PreToolUse (Bash) : refuse `cat > fichier` sans heredoc. Sans entrée,
// la commande attend le clavier et reste bloquée jusqu'au délai maximal.
let input = '';
for await (const chunk of process.stdin) input += chunk;
const command = JSON.parse(input).tool_input?.command ?? '';

const blocked = command
  .split('\n')
  .flatMap((line) => line.split(/;|&&|\|\|/))
  .find((segment) => /^\s*cat\s*>>?/.test(segment) && !segment.includes('<<'));

if (blocked) {
  console.error(
    `Commande refusée : « ${blocked.trim()} » attend une saisie au clavier et resterait bloquée. ` +
      'Écrire le fichier avec l’outil Write, ou fournir le contenu par un heredoc (cat > f <<\'EOF\').',
  );
  process.exit(2);
}
