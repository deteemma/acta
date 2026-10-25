// Exécuteur de migrations (conteneur « migrations », ADR-0003) : applique dans
// l'ordre les fichiers api/migrations/*.sql pas encore appliqués, chacun dans
// sa transaction. Se connecte avec le compte propriétaire de la base.
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import pg from 'pg';

const url = process.env.MIGRATIONS_DATABASE_URL;
if (!url) {
  console.error('MIGRATIONS_DATABASE_URL manquant');
  process.exit(1);
}
const dir = process.env.MIGRATIONS_DIR ?? resolve(import.meta.dirname, '../../migrations');
// Verrou partagé par toutes les instances : une seule migration à la fois.
const LOCK_ID = 727_001;

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migration (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const applied = new Set(
    (await client.query<{ name: string }>('SELECT name FROM schema_migration')).rows.map((r) => r.name),
  );
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sqlText = await readFile(join(dir, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sqlText);
      await client.query('INSERT INTO schema_migration (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`✔ ${file}`);
      count++;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`✘ ${file}`);
      throw error;
    }
  }
  console.log(count ? `${count} migration(s) appliquée(s).` : 'Base déjà à jour.');
} finally {
  await client.end();
}
