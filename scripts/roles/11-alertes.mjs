// Alertes (ticket 15) : la base garde qui a attribué chaque action, et chacun
// marque ses propres alertes comme vues. Initiative propre à cette section :
// alice propriétaire, bruno contributeur, chloé lectrice ; admin n'en est pas membre.
import { API, assert, check, call, asUserInDb, alice, bruno, chloe, admin, code } from './commun.mjs';

export let alInitiativeId;
const actions = () => `/initiatives/${alInitiativeId}/actions`;
let actionId;

console.log('\nAlertes — barrière 1 : API');
await check('alice crée l’initiative et invite bruno (contributeur) et chloé (lectrice)', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}AL`, name: 'Alertes' });
  assert.equal(r.status, 201);
  alInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `/initiatives/${alInitiativeId}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `/initiatives/${alInitiativeId}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
});
await check('bruno attribue une action à alice : attribuée par bruno, aussi dans « Mes actions » d’alice', async () => {
  const r = await call(bruno, 'POST', actions(), { title: 'Préparer l’atelier', taskId: '4.1', assigneeId: alice.sub });
  assert.equal(r.status, 201);
  actionId = r.body.id;
  assert.equal(r.body.assignedBy.userId, bruno.sub);
  const mine = (await call(alice, 'GET', '/actions/mine')).body.find((a) => a.id === actionId);
  assert.equal(mine.assignedBy.userId, bruno.sub);
});
await check('alice modifie l’action sans changer de responsable : l’attribution ne change pas', async () => {
  const r = await call(alice, 'PATCH', `${actions()}/${actionId}`, { title: 'Préparer l’atelier du 5' });
  assert.equal(r.body.assignedBy.userId, bruno.sub);
});
await check('alice se crée une action : attribuée par elle-même', async () => {
  const r = await call(alice, 'POST', actions(), { title: 'Relire', taskId: '4.1' });
  assert.equal(r.body.assignedBy.userId, alice.sub);
});
await check('chloé (lectrice) voit qui a attribué l’action ; admin, non membre, ne voit pas l’action : 404', async () => {
  assert.equal((await call(chloe, 'GET', `${actions()}/${actionId}`)).body.assignedBy.userId, bruno.sub);
  assert.equal((await call(admin, 'GET', `${actions()}/${actionId}`)).status, 404);
});
await check('sans jeton, marquer les alertes comme vues : 401 ; liste mal formée : 400', async () => {
  assert.equal((await fetch(`${API}/me/alerts-seen`, { method: 'PUT' })).status, 401);
  assert.equal((await call(alice, 'PUT', '/me/alerts-seen', { alertKeys: 'tout' })).status, 400);
});
await check('alice ouvre ses alertes : date et liste vue enregistrées sur son compte', async () => {
  const keys = [`assigned:${actionId}`];
  const r = await call(alice, 'PUT', '/me/alerts-seen', { alertKeys: keys });
  assert.equal(r.status, 200);
  assert.ok(Date.now() - Date.parse(r.body.alertsSeenAt) < 60_000);
  assert.deepEqual(r.body.alertsSeenKeys, keys);
  assert.deepEqual((await call(alice, 'GET', '/me')).body.alertsSeenKeys, keys);
});

console.log('\nAlertes — barrière 2 : base de données (RLS, compte applicatif)');
await check('l’auteur de l’attribution est celui qui écrit, jamais celui que le client indique', async () => {
  const r = await asUserInDb(
    bruno.sub,
    `UPDATE action SET assignee_id = $2, assigned_by = $2 WHERE id = $1 RETURNING assigned_by`,
    [actionId, bruno.sub],
  );
  assert.equal(r.rows[0].assigned_by, bruno.sub);
  const keep = await asUserInDb(alice.sub, `UPDATE action SET assigned_by = $2 WHERE id = $1 RETURNING assigned_by`, [actionId, alice.sub]);
  assert.equal(keep.rows[0].assigned_by, bruno.sub);
});
await check('chloé (lectrice) lit l’auteur de l’attribution ; admin, non membre, ne lit pas l’action', async () => {
  const reader = await asUserInDb(chloe.sub, 'SELECT assigned_by FROM action WHERE id = $1', [actionId]);
  assert.equal(reader.rows[0].assigned_by, bruno.sub);
  assert.equal((await asUserInDb(chloe.sub, 'SELECT 1 FROM app_user WHERE id = $1', [bruno.sub])).rowCount, 1);
  assert.equal((await asUserInDb(admin.sub, 'SELECT 1 FROM action WHERE id = $1', [actionId])).rowCount, 0);
});
await check('bruno ne peut pas marquer les alertes d’alice comme vues', async () => {
  const r = await asUserInDb(bruno.sub, `UPDATE app_user SET alerts_seen_at = now(), alerts_seen_keys = '{}' WHERE id = $1`, [alice.sub]);
  assert.equal(r.rowCount, 0);
});

console.log('\nAlertes — initiative archivée');
await check('alice archive l’initiative : réattribution refusée (403 par l’API, aucune ligne en base)', async () => {
  assert.equal((await call(alice, 'PUT', `/initiatives/${alInitiativeId}/archive`)).status, 200);
  assert.equal((await call(bruno, 'PATCH', `${actions()}/${actionId}`, { assigneeId: alice.sub })).status, 403);
  const r = await asUserInDb(bruno.sub, 'UPDATE action SET assignee_id = $2 WHERE id = $1', [actionId, alice.sub]);
  assert.equal(r.rowCount, 0);
});
