import { assert, check, call, asUserInDb, alice, bruno, chloe, admin, code } from './commun.mjs';

// Parties prenantes (ticket 08). Initiative propre à cette section : alice
// propriétaire, bruno contributeur, chloé lectrice ; admin n'en est pas membre.
console.log('\nParties prenantes — barrière 1 : API (guards NestJS)');
export let shInitiativeId;
export let sponsorId;
export let chloeStakeholderId;
export let shActionId;
export let otherShInitiativeId;
export let otherStakeholderId;
export const stakeholders = (id = shInitiativeId) => `/initiatives/${id}/stakeholders`;
export const stakeholderPath = (id) => `${stakeholders()}/${id}`;
export const shActions = () => `/initiatives/${shInitiativeId}/actions`;
export const sponsor = { name: 'Direction commerciale', kind: 'group', roles: ['sponsor', 'customer'], influence: 'high', interest: 'medium' };
await check('alice crée l’initiative et invite bruno (contributeur) et chloé (lectrice)', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}PP`, name: 'Parties prenantes' });
  assert.equal(r.status, 201);
  shInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `/initiatives/${shInitiativeId}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `/initiatives/${shInitiativeId}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
});
await check('alice (propriétaire) crée une fiche : nature, rôles BABOK, matrice, auteur et dates', async () => {
  const r = await call(alice, 'POST', stakeholders(), { ...sponsor, contact: 'Bâtiment B', notes: '**Décideur**' });
  assert.equal(r.status, 201);
  assert.deepEqual([r.body.kind, r.body.roles, r.body.influence, r.body.interest], ['group', ['sponsor', 'customer'], 'high', 'medium']);
  assert.equal(r.body.createdBy.userId, alice.sub);
  assert.equal(r.body.user, null);
  sponsorId = r.body.id;
});
await check('sans rôle BABOK ou rôle inconnu (schéma partagé) : 400', async () => {
  assert.equal((await call(alice, 'POST', stakeholders(), { ...sponsor, roles: [] })).status, 400);
  assert.equal((await call(alice, 'POST', stakeholders(), { ...sponsor, roles: ['chef'] })).status, 400);
});
await check('bruno (contributeur) relie une fiche au compte de chloé (lectrice), sans influence ni intérêt', async () => {
  const r = await call(bruno, 'POST', stakeholders(), { name: 'Chloé', kind: 'person', roles: ['end_user'], userId: chloe.sub });
  assert.equal(r.status, 201);
  assert.deepEqual([r.body.user.userId, r.body.user.member, r.body.influence], [chloe.sub, true, null]);
  chloeStakeholderId = r.body.id;
});
await check('un compte n’est relié qu’à une fiche par initiative : 409', async () => {
  const r = await call(alice, 'POST', stakeholders(), { name: 'Chloé bis', kind: 'person', roles: ['tester'], userId: chloe.sub });
  assert.equal(r.status, 409);
  assert.equal(r.body.refusal, 'userAlreadyLinked');
  const p = await call(alice, 'PATCH', stakeholderPath(sponsorId), { userId: chloe.sub });
  assert.equal(p.body.refusal, 'userAlreadyLinked');
});
await check('le compte d’un non-membre ne se relie pas : 400', async () => {
  const r = await call(alice, 'PATCH', stakeholderPath(sponsorId), { userId: admin.sub });
  assert.equal(r.status, 400);
  assert.equal(r.body.refusal, 'userNotMember');
});
await check('chloé peut être reliée à une fiche dans une autre initiative', async () => {
  const r = await call(bruno, 'POST', '/initiatives', { code: `${code.slice(0, 8)}PQ`, name: 'Autre' });
  otherShInitiativeId = r.body.id;
  assert.equal((await call(bruno, 'POST', `/initiatives/${otherShInitiativeId}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
  const s = await call(bruno, 'POST', stakeholders(otherShInitiativeId), { name: 'Chloé', kind: 'person', roles: ['regulator'], userId: chloe.sub });
  assert.equal(s.status, 201);
  otherStakeholderId = s.body.id;
});
await check('chloé (lectrice) consulte la liste et une fiche : 200', async () => {
  const r = await call(chloe, 'GET', stakeholders());
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.map((s) => s.name), ['Chloé', 'Direction commerciale']);
  assert.equal((await call(chloe, 'GET', stakeholderPath(sponsorId))).status, 200);
});
await check('chloé (lectrice) ne crée, ne modifie ni ne supprime : 403', async () => {
  assert.equal((await call(chloe, 'POST', stakeholders(), sponsor)).status, 403);
  assert.equal((await call(chloe, 'PATCH', stakeholderPath(sponsorId), { influence: 'low' })).status, 403);
  assert.equal((await call(chloe, 'DELETE', stakeholderPath(sponsorId))).status, 403);
});
await check('admin (non-membre) ne voit ni ne crée de partie prenante : 404', async () => {
  assert.equal((await call(admin, 'GET', stakeholders())).status, 404);
  assert.equal((await call(admin, 'GET', stakeholderPath(sponsorId))).status, 404);
  assert.equal((await call(admin, 'POST', stakeholders(), sponsor)).status, 404);
  assert.equal((await call(admin, 'DELETE', stakeholderPath(sponsorId))).status, 404);
});
await check('bruno (contributeur) modifie la fiche d’alice : auteur de la modification enregistré', async () => {
  const r = await call(bruno, 'PATCH', stakeholderPath(sponsorId), { interest: 'high', contact: '' });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.interest, r.body.contact, r.body.createdBy.userId, r.body.updatedBy.userId], ['high', null, alice.sub, bruno.sub]);
});
await check('une action est liée à des parties prenantes, à la création comme à la modification', async () => {
  const r = await call(alice, 'POST', shActions(), { title: 'Atelier de cadrage', taskId: '4.2', stakeholderIds: [sponsorId] });
  assert.equal(r.status, 201);
  assert.deepEqual(r.body.stakeholders.map((s) => s.id), [sponsorId]);
  shActionId = r.body.id;
  const p = await call(bruno, 'PATCH', `${shActions()}/${shActionId}`, { stakeholderIds: [sponsorId, chloeStakeholderId] });
  assert.deepEqual(p.body.stakeholders.map((s) => s.name), ['Chloé', 'Direction commerciale']);
  assert.equal(p.body.updatedBy.userId, bruno.sub);
});
await check('partie prenante d’une autre initiative : 400', async () => {
  const r = await call(bruno, 'PATCH', `${shActions()}/${shActionId}`, { stakeholderIds: [otherStakeholderId] });
  assert.equal(r.status, 400);
  assert.equal(r.body.refusal, 'unknownStakeholder');
});
await check('chloé (lectrice) ne lie pas de partie prenante : 403', async () => {
  assert.equal((await call(chloe, 'PATCH', `${shActions()}/${shActionId}`, { stakeholderIds: [] })).status, 403);
});
await check('liée : ni la partie prenante ni l’action ne se suppriment (409)', async () => {
  const s = await call(alice, 'DELETE', stakeholderPath(sponsorId));
  assert.equal(s.status, 409);
  assert.equal(s.body.refusal, 'stakeholderLinked');
  const a = await call(alice, 'DELETE', `${shActions()}/${shActionId}`);
  assert.equal(a.status, 409);
  assert.equal(a.body.refusal, 'linked');
});
await check('retirée de l’action, une fiche reliée à un compte se supprime : 204', async () => {
  const p = await call(bruno, 'PATCH', `${shActions()}/${shActionId}`, { stakeholderIds: [sponsorId] });
  assert.equal(p.status, 200);
  assert.equal((await call(bruno, 'DELETE', stakeholderPath(chloeStakeholderId))).status, 204);
  assert.equal((await call(alice, 'GET', stakeholderPath(chloeStakeholderId))).status, 404);
});
await check('initiative archivée : parties prenantes et liens en lecture seule', async () => {
  assert.equal((await call(alice, 'PUT', `/initiatives/${shInitiativeId}/archive`)).status, 200);
  assert.equal((await call(chloe, 'GET', stakeholders())).status, 200);
  assert.equal((await call(alice, 'POST', stakeholders(), sponsor)).status, 403);
  assert.equal((await call(bruno, 'PATCH', stakeholderPath(sponsorId), { influence: 'low' })).status, 403);
  assert.equal((await call(alice, 'DELETE', stakeholderPath(sponsorId))).status, 403);
  assert.equal((await call(alice, 'PATCH', `${shActions()}/${shActionId}`, { stakeholderIds: [] })).status, 403);
});

console.log('\nParties prenantes — barrière 2 : base de données (RLS, compte applicatif)');
// L'initiative est encore archivée.
export const insertStakeholder = (sub, userId = null, initiative = shInitiativeId) =>
  asUserInDb(
    sub,
    `INSERT INTO stakeholder (id, initiative_id, name, kind, roles, user_id) VALUES (gen_random_uuid(), $1, 'Via SQL', 'person', '{sponsor}', $2) RETURNING id, created_by`,
    [initiative, userId],
  );
await check('archivée : alice (propriétaire) : UPDATE et DELETE sans effet, INSERT refusé', async () => {
  assert.equal((await asUserInDb(alice.sub, `UPDATE stakeholder SET name = 'Interdit' WHERE id = $1`, [sponsorId])).rowCount, 0);
  assert.equal((await asUserInDb(alice.sub, `DELETE FROM action_stakeholder WHERE stakeholder_id = $1`, [sponsorId])).rowCount, 0);
  await assert.rejects(insertStakeholder(alice.sub), /row-level security/);
});
await check('alice désarchive l’initiative : 200', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${shInitiativeId}/archive`)).status, 200);
});
await check('chloé (lectrice) : INSERT refusés, UPDATE et DELETE sans effet', async () => {
  await assert.rejects(insertStakeholder(chloe.sub), /row-level security/);
  assert.equal((await asUserInDb(chloe.sub, `UPDATE stakeholder SET name = 'Piraté' WHERE id = $1`, [sponsorId])).rowCount, 0);
  assert.equal((await asUserInDb(chloe.sub, `DELETE FROM action_stakeholder WHERE stakeholder_id = $1`, [sponsorId])).rowCount, 0);
  await assert.rejects(
    asUserInDb(chloe.sub, `INSERT INTO action_stakeholder VALUES ($1, $2, $3)`, [shInitiativeId, shActionId, sponsorId]),
    /row-level security/,
  );
});
await check('admin (non-membre) : aucune fiche ni lien visible, aucune écriture', async () => {
  assert.equal((await asUserInDb(admin.sub, `SELECT 1 FROM stakeholder WHERE initiative_id = $1`, [shInitiativeId])).rowCount, 0);
  assert.equal((await asUserInDb(admin.sub, `SELECT 1 FROM action_stakeholder WHERE initiative_id = $1`, [shInitiativeId])).rowCount, 0);
  assert.equal((await asUserInDb(admin.sub, `UPDATE stakeholder SET name = 'Piraté' WHERE id = $1`, [sponsorId])).rowCount, 0);
  await assert.rejects(insertStakeholder(admin.sub), /row-level security/);
});
await check('bruno (contributeur) : INSERT accepté, auteur imposé par la base', async () => {
  const r = await insertStakeholder(bruno.sub);
  assert.equal(r.rows[0].created_by, bruno.sub);
});
await check('compte d’un non-membre refusé, compte déjà relié refusé (déclencheur, unicité)', async () => {
  await assert.rejects(insertStakeholder(bruno.sub, admin.sub), /membre/);
  await assert.rejects(
    asUserInDb(
      bruno.sub,
      `INSERT INTO stakeholder (id, initiative_id, name, kind, roles, user_id) VALUES
         (gen_random_uuid(), $1, 'A', 'person', '{sponsor}', $2), (gen_random_uuid(), $1, 'B', 'person', '{sponsor}', $2)`,
      [shInitiativeId, bruno.sub],
    ),
    /stakeholder_user_unique/,
  );
});
await check('aucun rôle, ou notes de plus de 20 000 caractères : refusés (contraintes en base)', async () => {
  await assert.rejects(asUserInDb(bruno.sub, `UPDATE stakeholder SET roles = '{}' WHERE id = $1`, [sponsorId]), /check constraint/);
  await assert.rejects(asUserInDb(bruno.sub, `UPDATE stakeholder SET notes = repeat('x', 20001) WHERE id = $1`, [sponsorId]), /check constraint/);
});
await check('bruno ne falsifie ni l’auteur ni les dates (déclencheur)', async () => {
  const r = await asUserInDb(
    bruno.sub,
    `UPDATE stakeholder SET created_by = $2, updated_by = $2, created_at = '2000-01-01' WHERE id = $1 RETURNING created_by, updated_by, created_at`,
    [sponsorId, chloe.sub],
  );
  assert.equal(r.rows[0].created_by, alice.sub);
  assert.equal(r.rows[0].updated_by, bruno.sub);
  assert.notEqual(r.rows[0].created_at.getFullYear(), 2000);
});
await check('une partie prenante ne change pas d’initiative', async () => {
  await assert.rejects(
    asUserInDb(bruno.sub, `UPDATE stakeholder SET initiative_id = $2 WHERE id = $1`, [sponsorId, otherShInitiativeId]),
    /ne change pas/,
  );
});
await check('lien vers une partie prenante d’une autre initiative refusé (clé étrangère)', async () => {
  await assert.rejects(
    asUserInDb(bruno.sub, `INSERT INTO action_stakeholder VALUES ($1, $2, $3)`, [shInitiativeId, shActionId, otherStakeholderId]),
    /foreign key/,
  );
});
await check('partie prenante et action liées : DELETE refusé (clé étrangère)', async () => {
  await assert.rejects(asUserInDb(bruno.sub, `DELETE FROM stakeholder WHERE id = $1`, [sponsorId]), /foreign key/);
  await assert.rejects(asUserInDb(bruno.sub, `DELETE FROM action WHERE id = $1`, [shActionId]), /foreign key/);
});
await check('chloé quitte l’initiative : sa fiche reste reliée à son compte, signalée', async () => {
  assert.equal((await call(bruno, 'DELETE', `/initiatives/${otherShInitiativeId}/members/${chloe.sub}`)).status, 204);
  const r = await call(bruno, 'GET', `${stakeholders(otherShInitiativeId)}/${otherStakeholderId}`);
  assert.deepEqual([r.body.user.userId, r.body.user.member], [chloe.sub, false]);
});
