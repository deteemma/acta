// Vérifie que deux sections de scripts/roles/ ne créent pas d'initiative avec le
// même code : `${code.slice(0, 8)}XX` dans deux fichiers donne un refus 409 en
// cascade au contrôle des permissions. Un même suffixe dans un seul fichier est
// permis (un test peut réutiliser un code exprès). Lancé par `pnpm lint`.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, 'roles');
const filesBySuffix = new Map();
for (const file of readdirSync(dir).filter((f) => f.endsWith('.mjs'))) {
  const source = readFileSync(join(dir, file), 'utf8');
  for (const [, suffix] of source.matchAll(/code\.slice\(0, 8\)\}([A-Z0-9]+)`/g)) {
    if (!filesBySuffix.has(suffix)) filesBySuffix.set(suffix, new Set());
    filesBySuffix.get(suffix).add(file);
  }
}

const clashes = [...filesBySuffix].filter(([, files]) => files.size > 1);
if (clashes.length) {
  for (const [suffix, files] of clashes) {
    console.error(`Code d'initiative « …${suffix} » utilisé dans plusieurs sections : ${[...files].join(', ')}`);
  }
  console.error(`Choisir un suffixe absent de scripts/roles/. Déjà pris : ${[...filesBySuffix.keys()].sort().join(' ')}`);
  process.exit(1);
}
console.log(`Codes d'initiative des tests de permissions : ${filesBySuffix.size} suffixes, sans doublon entre sections.`);
