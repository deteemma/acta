// Usage des techniques dans toute l'application (ticket 13) : comptage qui
// porte aussi sur les initiatives dont l'utilisateur n'est pas membre, sans
// jamais en révéler une action. Initiative propre à cette section : alice
// seule membre ; bruno n'en est pas membre.
import { API, assert, check, call, asUserInDb, alice, bruno, chloe, admin, code } from './commun.mjs';

export let usageInitiativeId;
const usage = async (u) => (await call(u, 'GET', '/babok/technique-usage')).body;
const before = await usage(bruno);

console.log('\nUsage des techniques — barrière 1 : API (guards NestJS)');
await check('sans jeton : 401', async () => {
  assert.equal((await fetch(`${API}/babok/technique-usage`)).status, 401);
});
await check('alice crée une initiative et deux actions avec la technique 10.43, une sans technique', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}TU`, name: 'Usage des techniques' });
  assert.equal(r.status, 201);
  usageInitiativeId = r.body.id;
  const actions = `/initiatives/${usageInitiativeId}/actions`;
  for (const body of [
    { title: 'Cartographier les parties prenantes', taskId: '3.2', techniqueId: '10.43' },
    { title: 'Revoir la carte', taskId: '4.5', techniqueId: '10.43' },
    { title: 'Sans technique', taskId: '3.1' },
  ]) {
    assert.equal((await call(alice, 'POST', actions, body)).status, 201);
  }
});
await check('bruno, non membre, voit l’usage de 10.43 augmenter de 2 : des nombres seuls', async () => {
  const after = await usage(bruno);
  assert.equal((after['10.43'] ?? 0) - (before['10.43'] ?? 0), 2);
  assert.ok(Object.entries(after).every(([id, n]) => /^\d+\.\d+$/.test(id) && Number.isInteger(n) && n > 0));
});
await check('bruno, non membre, ne voit pas les actions de l’initiative : 404', async () => {
  assert.equal((await call(bruno, 'GET', `/initiatives/${usageInitiativeId}/actions`)).status, 404);
});
await check('propriétaire (alice), non-membres (bruno, chloé) et admin reçoivent le même comptage', async () => {
  const counts = await Promise.all([alice, chloe, admin].map(usage));
  for (const c of counts) assert.deepEqual(c, await usage(bruno));
});

console.log('\nUsage des techniques — barrière 2 : base de données (RLS, compte applicatif)');
await check('bruno lit le comptage (technique, nombre) mais aucune action de l’initiative', async () => {
  const counts = await asUserInDb(bruno.sub, 'SELECT * FROM technique_usage_counts()');
  assert.deepEqual(counts.fields.map((f) => f.name), ['technique_id', 'action_count']);
  assert.ok(counts.rows.some((row) => row.technique_id === '10.43'));
  const actions = await asUserInDb(bruno.sub, 'SELECT 1 FROM action WHERE initiative_id = $1', [usageInitiativeId]);
  assert.equal(actions.rowCount, 0);
});
await check('sans utilisateur, aucun comptage', async () => {
  assert.equal((await asUserInDb('', 'SELECT * FROM technique_usage_counts()')).rowCount, 0);
});
