import { assert, check, call, asUserInDb, alice, bruno, chloe, admin, code } from './commun.mjs';

// Actions (ticket 07). Initiative propre à cette section : alice propriétaire
// et BA, bruno contributeur, chloé lectrice ; admin n'en est pas membre.
console.log('\nActions — barrière 1 : API (guards NestJS)');
export let actionsInitiativeId;
export let aliceActionId;
export let brunoActionId;
export const actions = () => `/initiatives/${actionsInitiativeId}/actions`;
export const actionPath = (id) => `${actions()}/${id}`;
export const mine = async (u) => (await call(u, 'GET', '/actions/mine')).body.map((a) => a.id);
await check('alice crée l’initiative et invite bruno (contributeur) et chloé (lectrice)', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}AC`, name: 'Actions' });
  assert.equal(r.status, 201);
  actionsInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `/initiatives/${actionsInitiativeId}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `/initiatives/${actionsInitiativeId}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
});
await check('création rapide (titre, tâche) : alice responsable, À faire, auteur et dates enregistrés', async () => {
  const r = await call(alice, 'POST', actions(), { title: 'Préparer les entretiens', taskId: '4.1' });
  assert.equal(r.status, 201);
  assert.equal(r.body.assignee.userId, alice.sub);
  assert.equal(r.body.status, 'todo');
  assert.equal(r.body.createdBy.userId, alice.sub);
  assert.ok(r.body.createdAt && r.body.updatedAt);
  aliceActionId = r.body.id;
});
await check('bruno (contributeur) crée une action complète dont il est responsable : 201', async () => {
  const r = await call(bruno, 'POST', actions(), {
    title: 'Entretien avec le service client',
    taskId: '4.2',
    techniqueId: '10.25',
    dueDate: '2026-11-15',
    description: '## Compte rendu\n- point **clé**',
  });
  assert.equal(r.status, 201);
  assert.deepEqual([r.body.assignee.userId, r.body.techniqueId, r.body.dueDate], [bruno.sub, '10.25', '2026-11-15']);
  brunoActionId = r.body.id;
});
await check('tâche BABOK manquante (schéma partagé) ou inconnue du référentiel : 400', async () => {
  assert.equal((await call(alice, 'POST', actions(), { title: 'Sans tâche' })).status, 400);
  const r = await call(alice, 'POST', actions(), { title: 'Tâche inconnue', taskId: '9.9' });
  assert.equal(r.status, 400);
  assert.equal(r.body.refusal, 'unknownBabokElement');
});
await check('chloé (lectrice) consulte les actions : 200', async () => {
  const r = await call(chloe, 'GET', actions());
  assert.equal(r.status, 200);
  assert.equal(r.body.length, 2);
  assert.equal((await call(chloe, 'GET', actionPath(aliceActionId))).status, 200);
});
await check('chloé (lectrice) ne crée, ne modifie ni ne supprime : 403', async () => {
  assert.equal((await call(chloe, 'POST', actions(), { title: 'Interdit', taskId: '4.1' })).status, 403);
  assert.equal((await call(chloe, 'PATCH', actionPath(aliceActionId), { status: 'done' })).status, 403);
  assert.equal((await call(chloe, 'DELETE', actionPath(aliceActionId))).status, 403);
});
await check('chloé (lectrice) ne peut pas être responsable : 400', async () => {
  const r = await call(bruno, 'PATCH', actionPath(aliceActionId), { assigneeId: chloe.sub });
  assert.equal(r.status, 400);
  assert.equal(r.body.refusal, 'assigneeNotEligible');
});
await check('admin (non-membre) ne voit ni ne crée d’action : 404', async () => {
  assert.equal((await call(admin, 'GET', actions())).status, 404);
  assert.equal((await call(admin, 'GET', actionPath(aliceActionId))).status, 404);
  assert.equal((await call(admin, 'POST', actions(), { title: 'Interdit', taskId: '4.1' })).status, 404);
  assert.ok(!(await mine(admin)).includes(aliceActionId));
});
await check('bruno (contributeur) fait avancer l’action d’alice : auteur de la modification enregistré', async () => {
  const r = await call(bruno, 'PATCH', actionPath(aliceActionId), { status: 'in_progress' });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'in_progress');
  assert.equal(r.body.createdBy.userId, alice.sub);
  assert.equal(r.body.updatedBy.userId, bruno.sub);
});
await check('statuts libres : une action terminée se rouvre', async () => {
  assert.equal((await call(alice, 'PATCH', actionPath(aliceActionId), { status: 'done' })).body.status, 'done');
  assert.equal((await call(alice, 'PATCH', actionPath(aliceActionId), { status: 'todo' })).body.status, 'todo');
});
await check('« Mes actions » : chacun les siennes, toutes initiatives confondues', async () => {
  const [a, b, c] = [await mine(alice), await mine(bruno), await mine(chloe)];
  assert.ok(a.includes(aliceActionId) && !a.includes(brunoActionId));
  assert.ok(b.includes(brunoActionId) && !b.includes(aliceActionId));
  assert.ok(!c.includes(aliceActionId) && !c.includes(brunoActionId));
});
await check('bruno passe lecteur : il reste responsable, signalé comme ne pouvant plus l’être', async () => {
  assert.equal((await call(alice, 'PATCH', `/initiatives/${actionsInitiativeId}/members/${bruno.sub}`, { role: 'reader' })).status, 204);
  const r = await call(alice, 'GET', actionPath(brunoActionId));
  assert.equal(r.body.assignee.userId, bruno.sub);
  assert.equal(r.body.assignee.eligible, false);
  assert.equal((await call(bruno, 'PATCH', actionPath(brunoActionId), { status: 'done' })).status, 403);
  // Modifier l'action sans changer de responsable reste possible.
  assert.equal((await call(alice, 'PATCH', actionPath(brunoActionId), { title: 'Entretien reporté' })).status, 200);
  assert.equal((await call(alice, 'PATCH', `/initiatives/${actionsInitiativeId}/members/${bruno.sub}`, { role: 'contributor' })).status, 204);
});
await check('initiative archivée : actions en lecture seule, signalées dans « Mes actions »', async () => {
  assert.equal((await call(alice, 'PUT', `/initiatives/${actionsInitiativeId}/archive`)).status, 200);
  assert.equal((await call(chloe, 'GET', actions())).status, 200);
  assert.equal((await call(alice, 'POST', actions(), { title: 'Interdit', taskId: '4.1' })).status, 403);
  assert.equal((await call(bruno, 'PATCH', actionPath(brunoActionId), { status: 'done' })).status, 403);
  assert.equal((await call(alice, 'DELETE', actionPath(aliceActionId))).status, 403);
  const own = (await call(alice, 'GET', '/actions/mine')).body.find((a) => a.id === aliceActionId);
  assert.equal(own?.initiative.archived, true);
});

console.log('\nActions — barrière 2 : base de données (RLS, compte applicatif)');
// L'initiative est encore archivée.
await check('archivée : alice (propriétaire) : UPDATE et DELETE sans effet, INSERT refusé', async () => {
  assert.equal((await asUserInDb(alice.sub, `UPDATE action SET title = 'Interdit' WHERE id = $1`, [aliceActionId])).rowCount, 0);
  assert.equal((await asUserInDb(alice.sub, `DELETE FROM action WHERE id = $1`, [aliceActionId])).rowCount, 0);
  await assert.rejects(
    asUserInDb(alice.sub, `INSERT INTO action (id, initiative_id, title, task_id, assignee_id) VALUES (gen_random_uuid(), $1, 'x', '4.1', $2)`, [actionsInitiativeId, alice.sub]),
    /row-level security/,
  );
});
await check('alice désarchive l’initiative : 200', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${actionsInitiativeId}/archive`)).status, 200);
});
export const insertAction = (sub, assignee) =>
  asUserInDb(
    sub,
    `INSERT INTO action (id, initiative_id, title, task_id, assignee_id) VALUES (gen_random_uuid(), $1, 'Via SQL', '4.1', $2) RETURNING created_by`,
    [actionsInitiativeId, assignee],
  );
await check('chloé (lectrice) : INSERT refusé, UPDATE et DELETE sans effet', async () => {
  await assert.rejects(insertAction(chloe.sub, alice.sub), /row-level security/);
  assert.equal((await asUserInDb(chloe.sub, `UPDATE action SET title = 'Piraté' WHERE id = $1`, [aliceActionId])).rowCount, 0);
  assert.equal((await asUserInDb(chloe.sub, `DELETE FROM action WHERE id = $1`, [aliceActionId])).rowCount, 0);
});
await check('admin (non-membre) : aucune action visible, aucune écriture', async () => {
  assert.equal((await asUserInDb(admin.sub, `SELECT 1 FROM action WHERE initiative_id = $1`, [actionsInitiativeId])).rowCount, 0);
  assert.equal((await asUserInDb(admin.sub, `UPDATE action SET title = 'Piraté' WHERE id = $1`, [aliceActionId])).rowCount, 0);
  await assert.rejects(insertAction(admin.sub, alice.sub), /row-level security/);
});
await check('bruno (contributeur) : INSERT accepté, auteur imposé par la base', async () => {
  const r = await insertAction(bruno.sub, bruno.sub);
  assert.equal(r.rows[0].created_by, bruno.sub);
});
await check('responsable lecteur ou non-membre refusé (déclencheur)', async () => {
  await assert.rejects(insertAction(bruno.sub, chloe.sub), /responsable/);
  await assert.rejects(insertAction(bruno.sub, admin.sub), /responsable/);
});
await check('bruno ne falsifie ni l’auteur ni les dates (déclencheur)', async () => {
  const r = await asUserInDb(
    bruno.sub,
    `UPDATE action SET created_by = $2, updated_by = $2, created_at = '2000-01-01' WHERE id = $1 RETURNING created_by, updated_by, created_at`,
    [aliceActionId, chloe.sub],
  );
  assert.equal(r.rows[0].created_by, alice.sub);
  assert.equal(r.rows[0].updated_by, bruno.sub);
  assert.notEqual(r.rows[0].created_at.getFullYear(), 2000);
});
await check('une action ne change pas d’initiative', async () => {
  const r = await call(bruno, 'POST', '/initiatives', { code: `${code.slice(0, 8)}AD`, name: 'Autre' });
  await assert.rejects(
    asUserInDb(bruno.sub, `UPDATE action SET initiative_id = $2 WHERE id = $1`, [brunoActionId, r.body.id]),
    /ne change pas/,
  );
  assert.equal((await call(bruno, 'DELETE', `/initiatives/${r.body.id}`)).status, 204);
});
await check('description de plus de 20 000 caractères refusée (contrainte en base)', async () => {
  await assert.rejects(
    asUserInDb(bruno.sub, `UPDATE action SET description = repeat('x', 20001) WHERE id = $1`, [aliceActionId]),
    /check constraint/,
  );
});
await check('bruno (contributeur) supprime une action liée à rien : 204', async () => {
  assert.equal((await call(bruno, 'DELETE', actionPath(aliceActionId))).status, 204);
  assert.equal((await call(alice, 'GET', actionPath(aliceActionId))).status, 404);
});
