// Vérifie que chaque table créée par une migration active la RLS (ADR-0003) :
// sans `ENABLE ROW LEVEL SECURITY`, le compte applicatif la lit en entier.
// Lancé par `pnpm lint`, donc aussi en CI.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', 'api', 'migrations');
const sql = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(dir, f), 'utf8'))
  .join('\n')
  .replace(/--[^\n]*/g, '');

const name = String.raw`(?:public\.)?"?(\w+)"?`;
const created = [...sql.matchAll(new RegExp(String.raw`CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?${name}`, 'gi'))].map((m) => m[1]);
const secured = new Set(
  [...sql.matchAll(new RegExp(String.raw`ALTER\s+TABLE\s+(?:ONLY\s+)?${name}\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY`, 'gi'))].map((m) => m[1]),
);

const missing = created.filter((t) => !secured.has(t));
if (missing.length) {
  console.error(`RLS non activée (ALTER TABLE … ENABLE ROW LEVEL SECURITY) : ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`RLS activée sur les ${created.length} tables des migrations.`);
