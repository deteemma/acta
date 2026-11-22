// Référentiel de l'Extension Agile (Extension Agile, ticket 02 ; D1, D2, D6).
// Servi par la même route que le BABOK : « sans jeton : 401 » et « aucune
// écriture par l'API : 404 » sont déjà vérifiés par 04-referentiel-babok.
import { assert, check, call, asUserInDb, alice, bruno, chloe, admin } from './commun.mjs';

console.log('\nRéférentiel agile — barrière 1 : API (guards NestJS)');
await check('bruno et admin consultent le même référentiel agile : 7 principes, 3 horizons, 24 techniques agiles', async () => {
  const [r, a] = [await call(bruno, 'GET', '/babok'), await call(admin, 'GET', '/babok')];
  assert.equal(r.status, 200);
  assert.deepEqual(a.body.agile, r.body.agile);
  const { principles, horizons, techniques } = r.body.agile;
  assert.deepEqual([principles.length, horizons.length, techniques.length], [7, 3, 24]);
  assert.deepEqual(
    horizons.map((h) => h.name.fr),
    ['horizon Stratégie', 'horizon Initiative', 'horizon Livraison'],
  );
  const kanban = techniques.find((t) => t.id === 'ae-7.10');
  assert.deepEqual(kanban.name, { en: 'Portfolio Kanban', fr: 'Kanban de portefeuille' });
  assert.equal(kanban.section, '7.10');
  assert.deepEqual(kanban.horizonIds, ['ae-5.1']);
  assert.deepEqual(techniques.find((t) => t.id === 'ae-7.15').horizonIds, ['ae-5.1', 'ae-5.2', 'ae-5.3']);
  assert.equal(techniques.reduce((n, t) => n + t.horizonIds.length, 0), 48);
});

console.log('\nRéférentiel agile — barrière 2 : base de données (RLS, compte applicatif)');
const agileTables = ['agile_principle', 'agile_horizon', 'agile_technique', 'agile_technique_horizon'];
await check('tout utilisateur lit le référentiel agile ; sans utilisateur, rien', async () => {
  const counts = async (sub) =>
    Promise.all(agileTables.map(async (table) => (await asUserInDb(sub, `SELECT 1 FROM ${table}`)).rowCount));
  assert.deepEqual(await counts(chloe.sub), [7, 3, 24, 48]);
  assert.deepEqual(await counts(''), [0, 0, 0, 0]);
});
await check('admin (transaction d’administrateur) ne peut pas ajouter de relation', async () => {
  await assert.rejects(
    asUserInDb(admin.sub, `INSERT INTO agile_technique_horizon (technique_id, horizon_id) VALUES ('ae-7.2', 'ae-5.1')`, [], { admin: true }),
    /row-level security/,
  );
});
await check('admin ne peut ni modifier ni supprimer : aucune ligne touchée', async () => {
  const opts = { admin: true };
  assert.equal((await asUserInDb(admin.sub, `UPDATE agile_technique SET name_fr = 'Piraté'`, [], opts)).rowCount, 0);
  assert.equal((await asUserInDb(admin.sub, `DELETE FROM agile_technique_horizon`, [], opts)).rowCount, 0);
  assert.equal((await asUserInDb(alice.sub, `DELETE FROM agile_principle`, [])).rowCount, 0);
});
