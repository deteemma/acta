import { assert, check, call, asUserInDb, inDbTransaction, alice, bruno, chloe, admin, code } from './commun.mjs';

// Ticket générique et passage de l'Action (phase 2, ticket 16) : référence,
// statut En attente et historique. alice propriétaire, bruno contributeur,
// chloé lectrice ; admin n'est pas membre.
console.log('\nTicket et historique — barrière 1 : API (guards NestJS)');
const tkCode = `${code.slice(0, 8)}TK`;
export let tkInitiativeId;
let firstId;
let secondId;
let stakeholderId;
let needId;
const actions = () => `/initiatives/${tkInitiativeId}/actions`;
const history = (id) => `${actions()}/${id}/history`;

await check('alice crée l’initiative et invite bruno (contributeur) et chloé (lectrice)', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: tkCode, name: 'Tickets' });
  assert.equal(r.status, 201);
  tkInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `/initiatives/${tkInitiativeId}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `/initiatives/${tkInitiativeId}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
  stakeholderId = (await call(alice, 'POST', `/initiatives/${tkInitiativeId}/stakeholders`, { name: 'Sponsor', kind: 'person', roles: ['sponsor'] })).body.id;
  needId = (await call(alice, 'POST', `/initiatives/${tkInitiativeId}/needs`, { title: 'Besoin', nature: 'problem' })).body.id;
});
await check('une action reçoit la référence CODE-AC-NNN, numérotée à la suite', async () => {
  const first = await call(alice, 'POST', actions(), { title: 'Première', taskId: '4.1' });
  const second = await call(bruno, 'POST', actions(), { title: 'Seconde', taskId: '4.2' });
  assert.equal(first.status, 201);
  assert.equal(first.body.reference, `${tkCode}-AC-001`);
  assert.equal(second.body.reference, `${tkCode}-AC-002`);
  firstId = first.body.id;
  secondId = second.body.id;
});
await check('la référence figure dans « Mes actions » et n’est pas modifiable par l’API', async () => {
  const own = (await call(alice, 'GET', '/actions/mine')).body.find((a) => a.id === firstId);
  assert.equal(own.reference, `${tkCode}-AC-001`);
  const r = await call(alice, 'PATCH', `${actions()}/${firstId}`, { reference: 'AUTRE-AC-999', title: 'Première' });
  assert.equal(r.body.reference, `${tkCode}-AC-001`);
});
await check('une référence supprimée n’est jamais réutilisée', async () => {
  const third = await call(alice, 'POST', actions(), { title: 'À supprimer', taskId: '4.1' });
  assert.equal(third.body.reference, `${tkCode}-AC-003`);
  assert.equal((await call(alice, 'DELETE', `${actions()}/${third.body.id}`)).status, 204);
  const fourth = await call(alice, 'POST', actions(), { title: 'Après', taskId: '4.1' });
  assert.equal(fourth.body.reference, `${tkCode}-AC-004`);
  assert.equal((await call(alice, 'DELETE', `${actions()}/${fourth.body.id}`)).status, 204);
});
await check('la création n’ajoute rien à l’historique, et le code de l’initiative est figé', async () => {
  assert.deepEqual((await call(alice, 'GET', history(secondId))).body, []);
  const r = await call(alice, 'PATCH', `/initiatives/${tkInitiativeId}`, { code: `${code.slice(0, 8)}TZ` });
  assert.equal(r.status, 409);
  assert.equal(r.body.refusal, 'codeFrozen');
});
await check('l’acronyme AC est réservé à sa catégorie, visible dans l’administration', async () => {
  const list = await call(admin, 'GET', '/admin/reference-categories');
  assert.equal(list.body.find((c) => c.category === 'action').acronym, 'AC');
  const r = await call(admin, 'PATCH', '/admin/reference-categories/need', { acronym: 'AC' });
  assert.equal(r.status, 409);
  assert.equal(r.body.refusal, 'acronymTaken');
});
await check('bruno (contributeur) met l’action En attente : elle reste dans « Mes actions », d’où viennent les alertes', async () => {
  const r = await call(bruno, 'PATCH', `${actions()}/${secondId}`, { status: 'on_hold' });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'on_hold');
  assert.equal((await call(bruno, 'GET', '/actions/mine')).body.find((a) => a.id === secondId).status, 'on_hold');
});
await check('un statut inconnu est refusé : 400', async () => {
  assert.equal((await call(bruno, 'PATCH', `${actions()}/${secondId}`, { status: 'paused' })).status, 400);
});
await check('l’historique indique qui, quand, et l’ancienne et la nouvelle valeur', async () => {
  const r = await call(alice, 'GET', history(secondId));
  assert.equal(r.status, 200);
  assert.equal(r.body.length, 1);
  const [entry] = r.body;
  assert.equal(entry.changedBy.userId, bruno.sub);
  assert.ok(entry.changedAt);
  assert.deepEqual([entry.before.status, entry.after.status], ['todo', 'on_hold']);
});
await check('une partie prenante concernée y figure ; un besoin lié, non', async () => {
  await call(bruno, 'PATCH', `${actions()}/${secondId}`, { stakeholderIds: [stakeholderId] });
  await call(bruno, 'PATCH', `${actions()}/${secondId}`, { needIds: [needId] });
  const r = await call(alice, 'GET', history(secondId));
  assert.equal(r.body.length, 2);
  assert.deepEqual(r.body[1].after.stakeholders, [{ id: stakeholderId, name: 'Sponsor' }]);
});
await check('enregistrer sans rien changer n’ajoute rien', async () => {
  await call(bruno, 'PATCH', `${actions()}/${secondId}`, { status: 'on_hold' });
  assert.equal((await call(alice, 'GET', history(secondId))).body.length, 2);
});
await check('chloé (lectrice) consulte l’historique et ne modifie rien : 200, 403', async () => {
  assert.equal((await call(chloe, 'GET', history(secondId))).body.length, 2);
  assert.equal((await call(chloe, 'PATCH', `${actions()}/${secondId}`, { status: 'todo' })).status, 403);
});
await check('admin (non-membre) ne consulte pas l’historique : 404', async () => {
  assert.equal((await call(admin, 'GET', history(secondId))).status, 404);
});

console.log('\nTicket et historique — barrière 2 : base de données (RLS, compte applicatif)');
await check('la référence, le type et les auteurs ne se falsifient pas (déclencheur)', async () => {
  const r = await asUserInDb(bruno.sub, `UPDATE ticket SET reference = 'FAUX-AC-001' WHERE id = $1 RETURNING reference`, [secondId]);
  assert.equal(r.rows[0].reference, `${tkCode}-AC-002`);
  const created = await asUserInDb(
    bruno.sub,
    `INSERT INTO ticket (id, type, initiative_id, reference, title, task_id, assignee_id)
     VALUES (gen_random_uuid(), 'action', $1, 'FAUX-AC-001', 'Via SQL', '4.1', $2) RETURNING reference`,
    [tkInitiativeId, bruno.sub],
  );
  assert.notEqual(created.rows[0].reference, 'FAUX-AC-001');
  await assert.rejects(asUserInDb(bruno.sub, `UPDATE ticket SET type = 'risk' WHERE id = $1`, [secondId]), /ne change pas de type/);
});
await check('un statut inconnu est refusé (contrainte en base) ; En attente est accepté', async () => {
  await assert.rejects(asUserInDb(bruno.sub, `UPDATE ticket SET status = 'paused' WHERE id = $1`, [secondId]), /check constraint/);
  const r = await asUserInDb(bruno.sub, `UPDATE ticket SET status = 'on_hold' WHERE id = $1 RETURNING status`, [secondId]);
  assert.equal(r.rows[0].status, 'on_hold');
});
await check('une écriture directe en base est aussi tracée, au nom de son auteur', async () => {
  const r = await inDbTransaction([
    { sub: bruno.sub, query: `UPDATE ticket SET title = 'Via SQL' WHERE id = $1`, params: [firstId] },
    { sub: bruno.sub, query: 'SET CONSTRAINTS ALL IMMEDIATE' },
    { sub: bruno.sub, query: `SELECT changed_by, snapshot_after ->> 'title' AS title FROM ticket_version WHERE ticket_id = $1 ORDER BY id DESC LIMIT 1`, params: [firstId] },
  ]);
  assert.deepEqual([r.rows[0].changed_by, r.rows[0].title], [bruno.sub, 'Via SQL']);
});
await check('propriétaire, contributeur et lectrice lisent l’historique, sans l’écrire', async () => {
  for (const u of [alice, bruno, chloe]) {
    assert.equal((await asUserInDb(u.sub, 'SELECT 1 FROM ticket_version WHERE ticket_id = $1', [secondId])).rowCount, 2);
    assert.equal((await asUserInDb(u.sub, `UPDATE ticket_version SET changed_by = $2 WHERE ticket_id = $1`, [secondId, u.sub])).rowCount, 0);
    assert.equal((await asUserInDb(u.sub, 'DELETE FROM ticket_version WHERE ticket_id = $1', [secondId])).rowCount, 0);
    await assert.rejects(
      asUserInDb(
        u.sub,
        `INSERT INTO ticket_version (initiative_id, ticket_id, changed_by, changed_at, snapshot_before, snapshot_after)
         VALUES ($1, $2, $3, now(), '{}', '{}')`,
        [tkInitiativeId, secondId, u.sub],
      ),
      /row-level security/,
    );
  }
});
await check('l’état de départ de l’historique n’est accessible à personne', async () => {
  assert.equal((await asUserInDb(alice.sub, 'SELECT 1 FROM ticket_snapshot WHERE ticket_id = $1', [secondId])).rowCount, 0);
  assert.equal((await asUserInDb(alice.sub, 'UPDATE ticket_snapshot SET snapshot = $2 WHERE ticket_id = $1', [secondId, '{}'])).rowCount, 0);
  await assert.rejects(asUserInDb(alice.sub, 'SELECT record_ticket_version($1)', [secondId]), /permission denied/);
});
await check('admin (non-membre) : aucun ticket ni historique visible', async () => {
  assert.equal((await asUserInDb(admin.sub, 'SELECT 1 FROM ticket WHERE initiative_id = $1', [tkInitiativeId])).rowCount, 0);
  assert.equal((await asUserInDb(admin.sub, 'SELECT 1 FROM ticket_version WHERE initiative_id = $1', [tkInitiativeId])).rowCount, 0);
});
await check('l’auteur d’une modification reste lisible après son départ de l’initiative', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${tkInitiativeId}/members/${encodeURIComponent(chloe.sub)}`)).status, 204);
  assert.equal((await call(alice, 'POST', `/initiatives/${tkInitiativeId}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
  const r = await call(alice, 'GET', history(secondId));
  assert.equal(r.body[0].changedBy.email, 'bruno@exemple.test');
});

console.log('\nTicket et historique — initiative archivée');
await check('alice archive : écriture refusée (403, aucune ligne en base), historique consultable', async () => {
  assert.equal((await call(alice, 'PUT', `/initiatives/${tkInitiativeId}/archive`)).status, 200);
  assert.equal((await call(bruno, 'PATCH', `${actions()}/${secondId}`, { status: 'todo' })).status, 403);
  assert.equal((await asUserInDb(bruno.sub, `UPDATE ticket SET status = 'todo' WHERE id = $1`, [secondId])).rowCount, 0);
  for (const u of [alice, bruno, chloe]) {
    assert.equal((await call(u, 'GET', history(secondId))).body.length, 2);
    assert.equal((await asUserInDb(u.sub, 'SELECT 1 FROM ticket_version WHERE ticket_id = $1', [secondId])).rowCount, 2);
  }
  assert.equal((await call(alice, 'DELETE', `/initiatives/${tkInitiativeId}/archive`)).status, 200);
});
