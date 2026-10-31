// Encart « Actions suggérées » (ticket 14). Initiative propre à cette section :
// alice propriétaire, bruno contributeur, chloé lectrice ; admin n'en est pas membre.
import { assert, check, call, asUserInDb, alice, bruno, chloe, admin, code } from './commun.mjs';

export let saInitiativeId;
const suggestions = () => `/initiatives/${saInitiativeId}/suggested-actions`;
const dismissal = (key) => `${suggestions()}/${encodeURIComponent(key)}/dismissal`;
const keys = async (u) => (await call(u, 'GET', suggestions())).body.map((s) => s.key);

console.log('\nActions suggérées — barrière 1 : API (guards NestJS)');
await check('alice crée l’initiative et invite bruno (contributeur) et chloé (lectrice)', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}SA`, name: 'Actions suggérées' });
  assert.equal(r.status, 201);
  saInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `/initiatives/${saInitiativeId}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `/initiatives/${saInitiativeId}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
});
await check('chloé (lectrice) voit les suggestions d’une initiative vide, dans l’ordre du référentiel : 200', async () => {
  assert.deepEqual(await keys(chloe), ['R1', 'R3', 'R14:4', 'R14:5', 'R7', 'R14:7', 'R14:8']);
});
await check('admin, non membre, ne voit pas l’encart : 404', async () => {
  assert.equal((await call(admin, 'GET', suggestions())).status, 404);
});
await check('chloé (lectrice) ne peut ni écarter ni créer depuis une suggestion : 403', async () => {
  assert.equal((await call(chloe, 'PUT', dismissal('R7'))).status, 403);
  const r = await call(chloe, 'POST', `/initiatives/${saInitiativeId}/actions`, { title: 'Recueillir les besoins', taskId: '6.1', suggestionKey: 'R7' });
  assert.equal(r.status, 403);
});
await check('admin, non membre, ne peut pas écarter : 404', async () => {
  assert.equal((await call(admin, 'PUT', dismissal('R7'))).status, 404);
});
await check('alice (propriétaire) écarte R14:8 : 204', async () => {
  assert.equal((await call(alice, 'PUT', dismissal('R14:8'))).status, 204);
  assert.ok(!(await keys(chloe)).includes('R14:8'));
});
await check('origine inventée : une suggestion que l’encart ne propose pas (R9) ou écartée : 400', async () => {
  const actions = `/initiatives/${saInitiativeId}/actions`;
  const r = await call(bruno, 'POST', actions, { title: 'Sans rapport', taskId: '7.1', suggestionKey: 'R9' });
  assert.deepEqual([r.status, r.body.refusal], [400, 'suggestionNotOffered']);
  assert.equal((await call(bruno, 'POST', actions, { title: 'Mesurer', taskId: '8.1', suggestionKey: 'R14:8' })).status, 400);
});
await check('clé de suggestion inconnue : 400', async () => {
  assert.equal((await call(bruno, 'PUT', dismissal('R16'))).status, 400);
});
await check('bruno (contributeur) écarte R7 : elle disparaît pour toute l’équipe : 204', async () => {
  assert.equal((await call(bruno, 'PUT', dismissal('R7'))).status, 204);
  assert.equal((await call(bruno, 'PUT', dismissal('R7'))).status, 204);
  assert.ok(!(await keys(alice)).includes('R7'));
  assert.ok(!(await keys(chloe)).includes('R7'));
});
let needId;
await check('R7 revient quand sa situation disparaît (un besoin) puis réapparaît (besoin supprimé)', async () => {
  needId = (await call(alice, 'POST', `/initiatives/${saInitiativeId}/needs`, { title: 'Réclamations perdues', nature: 'problem' })).body.id;
  assert.ok(!(await keys(alice)).includes('R7'));
  assert.equal((await call(alice, 'DELETE', `/initiatives/${saInitiativeId}/needs/${needId}`)).status, 204);
  assert.ok((await keys(alice)).includes('R7'));
});
let actionId;
await check('bruno crée l’action depuis R1 : origine enregistrée, R1 disparaît (situation changée)', async () => {
  const r = await call(bruno, 'POST', `/initiatives/${saInitiativeId}/actions`, { title: 'Planifier l’approche de l’analyse', taskId: '3.1', suggestionKey: 'R1' });
  assert.equal(r.status, 201);
  actionId = r.body.id;
  assert.ok(!(await keys(bruno)).includes('R1'));
});

console.log('\nActions suggérées — barrière 2 : base de données (RLS, compte applicatif)');
await check('l’origine d’une action ne change plus', async () => {
  const r = await asUserInDb(bruno.sub, `UPDATE action SET suggestion_key = 'R2' WHERE id = $1 RETURNING suggestion_key`, [actionId]);
  assert.equal(r.rows[0].suggestion_key, 'R1');
});
await check('chloé (lectrice) lit les écarts mais n’en écrit ni n’en retire', async () => {
  await call(bruno, 'PUT', dismissal('R3'));
  assert.equal((await asUserInDb(chloe.sub, "SELECT 1 FROM suggestion_dismissal WHERE initiative_id = $1 AND suggestion_key = 'R3'", [saInitiativeId])).rowCount, 1);
  await assert.rejects(asUserInDb(chloe.sub, `INSERT INTO suggestion_dismissal (initiative_id, suggestion_key) VALUES ($1, 'R4')`, [saInitiativeId]));
  assert.equal((await asUserInDb(chloe.sub, 'DELETE FROM suggestion_dismissal WHERE initiative_id = $1', [saInitiativeId])).rowCount, 0);
});
await check('bruno (contributeur) écarte et retire un écart directement en base', async () => {
  const insert = await asUserInDb(bruno.sub, `INSERT INTO suggestion_dismissal (initiative_id, suggestion_key) VALUES ($1, 'R4') RETURNING dismissed_by`, [saInitiativeId]);
  assert.equal(insert.rows[0].dismissed_by, bruno.sub);
  assert.equal((await asUserInDb(bruno.sub, `DELETE FROM suggestion_dismissal WHERE initiative_id = $1 AND suggestion_key = 'R3'`, [saInitiativeId])).rowCount, 1);
});
await check('clé de suggestion mal formée refusée par la base', async () => {
  await assert.rejects(asUserInDb(bruno.sub, `INSERT INTO suggestion_dismissal (initiative_id, suggestion_key) VALUES ($1, 'R16')`, [saInitiativeId]));
});
await check('admin, non membre, ne lit aucun écart', async () => {
  assert.equal((await asUserInDb(admin.sub, 'SELECT 1 FROM suggestion_dismissal WHERE initiative_id = $1', [saInitiativeId])).rowCount, 0);
});
await check('bruno ne peut pas écarter au nom d’un autre', async () => {
  await assert.rejects(
    asUserInDb(bruno.sub, `INSERT INTO suggestion_dismissal (initiative_id, suggestion_key, dismissed_by) VALUES ($1, 'R4', $2)`, [saInitiativeId, alice.sub]),
  );
});

console.log('\nActions suggérées — initiative archivée');
await check('alice archive l’initiative : encart vide, écart refusé (403 par l’API, refusé par la base)', async () => {
  assert.equal((await call(alice, 'PUT', `/initiatives/${saInitiativeId}/archive`)).status, 200);
  assert.deepEqual(await keys(chloe), []);
  assert.equal((await call(bruno, 'PUT', dismissal('R4'))).status, 403);
  await assert.rejects(asUserInDb(bruno.sub, `INSERT INTO suggestion_dismissal (initiative_id, suggestion_key) VALUES ($1, 'R4')`, [saInitiativeId]));
});
