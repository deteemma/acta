// Hook Stop : la responsable fonctionnelle lit en français (CLAUDE.md, Langues).
// Si les messages du dernier tour sont surtout en anglais, l'arrêt est refusé et
// Claude reformule en français. Le code (blocs ``` et `…`) n'est pas compté.
import { readFileSync } from 'node:fs';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const { transcript_path: transcriptPath, stop_hook_active: alreadyBlocked } = JSON.parse(input);
if (alreadyBlocked || !transcriptPath) process.exit(0);

const entries = readFileSync(transcriptPath, 'utf8')
  .split('\n')
  .filter(Boolean)
  .flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });

// Textes de Claude depuis le dernier message réel de l'utilisateur (hors résultats d'outils).
const isRealUserMessage = (entry) => {
  if (entry.type !== 'user' || entry.isMeta) return false;
  const content = entry.message?.content;
  return typeof content === 'string' || (Array.isArray(content) && content.some((part) => part.type === 'text'));
};
let start = entries.length;
while (start > 0 && !isRealUserMessage(entries[start - 1])) start--;
const text = entries
  .slice(start)
  .filter((entry) => entry.type === 'assistant' && Array.isArray(entry.message?.content))
  .flatMap((entry) => entry.message.content.filter((part) => part.type === 'text').map((part) => part.text))
  .join('\n')
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/`[^`]*`/g, ' ');

const words = text.toLowerCase().split(/[^a-zà-ÿ']+/);
const count = (list) => words.filter((word) => list.has(word)).length;
const english = count(new Set(['the', 'and', 'is', 'are', 'i', 'it', 'this', 'that', 'with', 'now', 'of', 'to', 'was']));
const french = count(new Set(['le', 'la', 'les', 'et', 'est', 'je', 'de', 'des', 'du', 'avec', 'pour', 'que', 'une', 'un']));

if (english >= 8 && english > french) {
  console.log(
    JSON.stringify({
      decision: 'block',
      reason:
        'Les messages de ce tour sont surtout en anglais. La responsable fonctionnelle lit en français : ' +
        'réécris ton compte rendu en français (identifiants de code inchangés).',
    }),
  );
}
