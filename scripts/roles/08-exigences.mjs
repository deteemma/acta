import { assert, check, call, asUserInDb, inDbTransaction, alice, bruno, chloe, admin, code } from './commun.mjs';
import { categories } from './07-references-et-besoins.mjs';

// Exigences (ticket 10). Initiative propre à cette section : alice
// propriétaire, bruno contributeur, chloé lectrice ; admin n'en est pas membre.
console.log('\nExigences — barrière 1 : API (guards NestJS)');
export let exInitiativeId;
export const exCode = `${code.slice(0, 8)}EX`;
export let otherExInitiativeId;
export let exAcronym;
export let exNeedId;
export let exSourceId;
export let rootId;
export let childId;
export let exActionId;
export let otherRequirementId;
export let otherExNeedId;
export let otherExSourceId;
export const requirements = (id = exInitiativeId) => `/initiatives/${id}/requirements`;
export const requirementPath = (id) => `${requirements()}/${id}`;
export const exActions = () => `/initiatives/${exInitiativeId}/actions`;
export const business = () => ({ title: 'Suivi des réclamations', statement: 'Le service client suit chaque réclamation.', type: 'business', needIds: [exNeedId] });
await check('alice crée l’initiative et invite bruno (contributeur) et chloé (lectrice) ; un besoin, une partie prenante', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: exCode, name: 'Exigences' });
  assert.equal(r.status, 201);
  exInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `/initiatives/${exInitiativeId}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `/initiatives/${exInitiativeId}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
  exSourceId = (await call(alice, 'POST', `/initiatives/${exInitiativeId}/stakeholders`, { name: 'Service client', kind: 'group', roles: ['end_user'] })).body.id;
  exNeedId = (await call(alice, 'POST', `/initiatives/${exInitiativeId}/needs`, { title: 'Réclamations perdues', nature: 'problem' })).body.id;
  exAcronym = (await call(admin, 'GET', categories)).body.find((c) => c.category === 'requirement').acronym;
});
await check('bruno (contributeur) crée une exigence : référence attribuée, statut Proposée, besoin, source, auteur', async () => {
  const r = await call(bruno, 'POST', requirements(), { ...business(), stakeholderIds: [exSourceId], status: 'approved' });
  assert.equal(r.status, 201);
  assert.equal(r.body.reference, `${exCode}-${exAcronym}-001`);
  assert.deepEqual([r.body.status, r.body.subtype, r.body.parent], ['proposed', null, null]);
  assert.deepEqual([r.body.needs.map((n) => n.id), r.body.stakeholders.map((s) => s.id)], [[exNeedId], [exSourceId]]);
  assert.equal(r.body.createdBy.userId, bruno.sub);
  rootId = r.body.id;
});
await check('alice crée une exigence de solution fonctionnelle qui dérive de la première, sans besoin', async () => {
  const r = await call(alice, 'POST', requirements(), { title: 'Saisie', statement: 'Saisir une réclamation.', type: 'solution', subtype: 'functional', parentId: rootId });
  assert.equal(r.status, 201);
  assert.deepEqual([r.body.reference, r.body.parent.id, r.body.needs], [`${exCode}-${exAcronym}-002`, rootId, []]);
  childId = r.body.id;
});
await check('sous-type absent ou de trop, ni besoin ni parente, énoncé vide (schéma partagé) : 400', async () => {
  assert.equal((await call(bruno, 'POST', requirements(), { ...business(), type: 'solution' })).status, 400);
  assert.equal((await call(bruno, 'POST', requirements(), { ...business(), subtype: 'functional' })).status, 400);
  assert.equal((await call(bruno, 'POST', requirements(), { ...business(), needIds: [] })).status, 400);
  assert.equal((await call(bruno, 'POST', requirements(), { ...business(), statement: ' ' })).status, 400);
});
await check('chloé (lectrice) consulte la liste (par référence), une fiche et son historique : 200', async () => {
  const r = await call(chloe, 'GET', requirements());
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.map((x) => x.id), [rootId, childId]);
  assert.equal((await call(chloe, 'GET', requirementPath(rootId))).status, 200);
  assert.equal((await call(chloe, 'GET', `${requirementPath(rootId)}/history`)).status, 200);
});
await check('chloé (lectrice) ne crée, ne modifie, ne change pas le statut ni ne supprime : 403', async () => {
  assert.equal((await call(chloe, 'POST', requirements(), business())).status, 403);
  assert.equal((await call(chloe, 'PATCH', requirementPath(rootId), { status: 'approved' })).status, 403);
  assert.equal((await call(chloe, 'DELETE', requirementPath(childId))).status, 403);
});
await check('admin (non-membre) ne voit, ne crée ni ne modifie aucune exigence : 404', async () => {
  assert.equal((await call(admin, 'GET', requirements())).status, 404);
  assert.equal((await call(admin, 'GET', requirementPath(rootId))).status, 404);
  assert.equal((await call(admin, 'GET', `${requirementPath(rootId)}/history`)).status, 404);
  assert.equal((await call(admin, 'POST', requirements(), business())).status, 404);
  assert.equal((await call(admin, 'PATCH', requirementPath(rootId), { status: 'rejected' })).status, 404);
  assert.equal((await call(admin, 'DELETE', requirementPath(childId))).status, 404);
});
await check('palette et aperçu : chloé trouve l’exigence avec son type et son statut, admin (non-membre) non', async () => {
  const mine = (await call(chloe, 'GET', '/references')).body.find((x) => x.id === childId);
  assert.deepEqual([mine.category, mine.requirement], ['requirement', { type: 'solution', subtype: 'functional', status: 'proposed' }]);
  assert.ok(!(await call(admin, 'GET', '/references')).body.some((x) => x.initiativeId === exInitiativeId));
});
await check('tout statut passe à tout autre ; l’historique garde qui, quand, ancienne et nouvelle valeur', async () => {
  assert.equal((await call(bruno, 'PATCH', requirementPath(rootId), { status: 'approved' })).body.status, 'approved');
  const r = await call(alice, 'PATCH', requirementPath(rootId), { status: 'proposed', stakeholderIds: [] });
  assert.deepEqual([r.body.status, r.body.stakeholders, r.body.updatedBy.userId], ['proposed', [], alice.sub]);
  const h = (await call(chloe, 'GET', `${requirementPath(rootId)}/history`)).body;
  assert.deepEqual(h.map((v) => v.changedBy.userId), [bruno.sub, bruno.sub, alice.sub]);
  assert.deepEqual(h.map((v) => v.snapshot.status), ['proposed', 'approved', 'proposed']);
  assert.deepEqual(h.map((v) => v.snapshot.stakeholders.length), [1, 1, 0]);
  // Rien à changer : pas de nouvelle version.
  await call(alice, 'PATCH', requirementPath(rootId), { status: 'proposed' });
  assert.equal((await call(chloe, 'GET', `${requirementPath(rootId)}/history`)).body.length, 3);
});
await check('boucle, ni besoin ni parente, sous-type incohérent : 400 avec le motif', async () => {
  const cycle = await call(bruno, 'PATCH', requirementPath(rootId), { parentId: childId });
  assert.deepEqual([cycle.status, cycle.body.refusal], [400, 'parentCycle']);
  const self = await call(bruno, 'PATCH', requirementPath(rootId), { parentId: rootId });
  assert.equal(self.body.refusal, 'parentCycle');
  const origin = await call(bruno, 'PATCH', requirementPath(rootId), { needIds: [] });
  assert.deepEqual([origin.status, origin.body.refusal], [400, 'originRequired']);
  const orphan = await call(bruno, 'PATCH', requirementPath(childId), { parentId: null });
  assert.equal(orphan.body.refusal, 'originRequired');
  const subtype = await call(bruno, 'PATCH', requirementPath(rootId), { type: 'solution' });
  assert.deepEqual([subtype.status, subtype.body.refusal], [400, 'subtypeMismatch']);
});
await check('parente, besoin ou source d’une autre initiative : 400', async () => {
  const o = await call(bruno, 'POST', '/initiatives', { code: `${code.slice(0, 8)}EY`, name: 'Autre' });
  otherExInitiativeId = o.body.id;
  otherExNeedId = (await call(bruno, 'POST', `/initiatives/${otherExInitiativeId}/needs`, { title: 'Ailleurs', nature: 'problem' })).body.id;
  otherExSourceId = (await call(bruno, 'POST', `/initiatives/${otherExInitiativeId}/stakeholders`, { name: 'Ailleurs', kind: 'person', roles: ['sponsor'] })).body.id;
  otherRequirementId = (await call(bruno, 'POST', requirements(otherExInitiativeId), { ...business(), needIds: [otherExNeedId] })).body.id;
  assert.equal((await call(bruno, 'PATCH', requirementPath(childId), { parentId: otherRequirementId })).body.refusal, 'unknownRequirement');
  assert.equal((await call(bruno, 'PATCH', requirementPath(rootId), { needIds: [otherExNeedId] })).body.refusal, 'unknownNeed');
  assert.equal((await call(bruno, 'PATCH', requirementPath(rootId), { stakeholderIds: [otherExSourceId] })).body.refusal, 'unknownStakeholder');
});
await check('une action est liée à des exigences ; exigence d’une autre initiative : 400', async () => {
  const r = await call(bruno, 'POST', exActions(), { title: 'Atelier', taskId: '7.1', requirementIds: [childId] });
  assert.equal(r.status, 201);
  assert.deepEqual(r.body.requirements.map((x) => x.reference), [`${exCode}-${exAcronym}-002`]);
  exActionId = r.body.id;
  const p = await call(alice, 'PATCH', `${exActions()}/${exActionId}`, { requirementIds: [childId, rootId] });
  assert.deepEqual(p.body.requirements.map((x) => x.id), [rootId, childId]);
  const o = await call(bruno, 'PATCH', `${exActions()}/${exActionId}`, { requirementIds: [otherRequirementId] });
  assert.deepEqual([o.status, o.body.refusal], [400, 'unknownRequirement']);
  assert.equal((await call(chloe, 'PATCH', `${exActions()}/${exActionId}`, { requirementIds: [] })).status, 403);
});
await check('liées : ni l’exigence, ni sa parente, ni l’action, ni le besoin, ni la source ne se suppriment (409)', async () => {
  assert.equal((await call(alice, 'PATCH', requirementPath(rootId), { stakeholderIds: [exSourceId] })).status, 200);
  const linked = await call(alice, 'DELETE', requirementPath(childId));
  assert.deepEqual([linked.status, linked.body.refusal], [409, 'requirementLinked']);
  assert.equal((await call(alice, 'PATCH', `${exActions()}/${exActionId}`, { requirementIds: [] })).status, 200);
  assert.equal((await call(alice, 'DELETE', requirementPath(rootId))).body.refusal, 'requirementLinked');
  assert.equal((await call(alice, 'PATCH', `${exActions()}/${exActionId}`, { requirementIds: [rootId] })).status, 200);
  assert.equal((await call(alice, 'DELETE', `${exActions()}/${exActionId}`)).body.refusal, 'linked');
  assert.equal((await call(alice, 'DELETE', `/initiatives/${exInitiativeId}/needs/${exNeedId}`)).body.refusal, 'needLinked');
  assert.equal((await call(alice, 'DELETE', `/initiatives/${exInitiativeId}/stakeholders/${exSourceId}`)).body.refusal, 'stakeholderLinked');
});
await check('liée à rien, une exigence se supprime avec son historique ; son numéro n’est pas réattribué', async () => {
  assert.equal((await call(bruno, 'DELETE', requirementPath(childId))).status, 204);
  assert.equal((await call(chloe, 'GET', `${requirementPath(childId)}/history`)).status, 404);
  const r = await call(bruno, 'POST', requirements(), { ...business(), parentId: rootId });
  assert.equal(r.body.reference, `${exCode}-${exAcronym}-003`);
  childId = r.body.id;
});
await check('initiative archivée : exigences, statuts et liens en lecture seule', async () => {
  assert.equal((await call(alice, 'PUT', `/initiatives/${exInitiativeId}/archive`)).status, 200);
  assert.equal((await call(chloe, 'GET', requirements())).status, 200);
  assert.equal((await call(chloe, 'GET', `${requirementPath(rootId)}/history`)).status, 200);
  assert.equal((await call(alice, 'POST', requirements(), business())).status, 403);
  assert.equal((await call(bruno, 'PATCH', requirementPath(rootId), { status: 'deferred' })).status, 403);
  assert.equal((await call(alice, 'DELETE', requirementPath(childId))).status, 403);
  assert.equal((await call(alice, 'PATCH', `${exActions()}/${exActionId}`, { requirementIds: [] })).status, 403);
});

console.log('\nExigences — barrière 2 : base de données (RLS, compte applicatif)');
// L'initiative est encore archivée. Les vérifications de fin de transaction
// (besoin ou parente, historique) sont avancées par SET CONSTRAINTS … IMMEDIATE.
export const IMMEDIATE = 'SET CONSTRAINTS requirement_finalize, requirement_need_finalize, requirement_stakeholder_finalize IMMEDIATE';
export const insertRequirementSql = `INSERT INTO requirement (id, initiative_id, reference, title, statement, type, parent_id)
  VALUES (gen_random_uuid(), $1, 'FAUX-EX-999', 'Via SQL', 'Énoncé', 'business', $2) RETURNING id, reference, created_by, status`;
export const insertRequirement = (sub) => asUserInDb(sub, insertRequirementSql, [exInitiativeId, rootId]);
await check('archivée : alice (propriétaire) : UPDATE et DELETE sans effet, INSERT refusé', async () => {
  assert.equal((await asUserInDb(alice.sub, `UPDATE requirement SET status = 'deferred' WHERE id = $1`, [rootId])).rowCount, 0);
  assert.equal((await asUserInDb(alice.sub, `DELETE FROM requirement WHERE id = $1`, [childId])).rowCount, 0);
  assert.equal((await asUserInDb(alice.sub, `DELETE FROM action_requirement WHERE action_id = $1`, [exActionId])).rowCount, 0);
  await assert.rejects(insertRequirement(alice.sub), /row-level security/);
});
await check('alice désarchive l’initiative : 200', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${exInitiativeId}/archive`)).status, 200);
});
await check('alice (propriétaire) : UPDATE, INSERT de liens et d’exigence acceptés', async () => {
  assert.equal((await asUserInDb(alice.sub, `UPDATE requirement SET status = 'validated' WHERE id = $1`, [rootId])).rowCount, 1);
  assert.equal((await asUserInDb(alice.sub, `INSERT INTO requirement_stakeholder VALUES ($1, $2, $3)`, [exInitiativeId, childId, exSourceId])).rowCount, 1);
  assert.equal((await insertRequirement(alice.sub)).rows[0].created_by, alice.sub);
});
await check('chloé (lectrice) : INSERT refusés, UPDATE et DELETE sans effet', async () => {
  await assert.rejects(insertRequirement(chloe.sub), /row-level security/);
  assert.equal((await asUserInDb(chloe.sub, `UPDATE requirement SET status = 'rejected' WHERE id = $1`, [rootId])).rowCount, 0);
  assert.equal((await asUserInDb(chloe.sub, `DELETE FROM requirement_need WHERE requirement_id = $1`, [rootId])).rowCount, 0);
  assert.equal((await asUserInDb(chloe.sub, `DELETE FROM requirement_stakeholder WHERE requirement_id = $1`, [rootId])).rowCount, 0);
  assert.equal((await asUserInDb(chloe.sub, `DELETE FROM action_requirement WHERE action_id = $1`, [exActionId])).rowCount, 0);
  for (const [table, linkId] of [['requirement_need', exNeedId], ['requirement_stakeholder', exSourceId]]) {
    await assert.rejects(asUserInDb(chloe.sub, `INSERT INTO ${table} VALUES ($1, $2, $3)`, [exInitiativeId, childId, linkId]), /row-level security/);
  }
  await assert.rejects(
    asUserInDb(chloe.sub, `INSERT INTO action_requirement VALUES ($1, $2, $3)`, [exInitiativeId, exActionId, childId]),
    /row-level security/,
  );
});
await check('admin (non-membre) : aucune exigence, aucun lien, aucun historique visible ; aucune écriture', async () => {
  for (const table of ['requirement', 'requirement_need', 'requirement_stakeholder', 'action_requirement', 'requirement_version']) {
    assert.equal((await asUserInDb(admin.sub, `SELECT 1 FROM ${table} WHERE initiative_id = $1`, [exInitiativeId])).rowCount, 0, table);
  }
  assert.equal((await asUserInDb(admin.sub, `UPDATE requirement SET status = 'rejected' WHERE id = $1`, [rootId])).rowCount, 0);
  await assert.rejects(insertRequirement(admin.sub), /row-level security/);
});
await check('bruno (contributeur) : INSERT accepté ; référence, statut, auteur et historique imposés par la base', async () => {
  const r = await inDbTransaction([
    { sub: bruno.sub, query: insertRequirementSql, params: [exInitiativeId, rootId] },
    { sub: bruno.sub, query: IMMEDIATE },
    { sub: bruno.sub, query: `SELECT r.reference, r.created_by, r.status, v.changed_by FROM requirement r JOIN requirement_version v ON v.requirement_id = r.id WHERE r.title = 'Via SQL' AND r.initiative_id = $1`, params: [exInitiativeId] },
  ]);
  assert.deepEqual(Object.values(r.rows[0]), [`${exCode}-${exAcronym}-004`, bruno.sub, 'proposed', bruno.sub]);
});
await check('ni besoin ni parente : refusé par la base en fin de transaction', async () => {
  await assert.rejects(
    inDbTransaction([
      { sub: bruno.sub, query: insertRequirementSql, params: [exInitiativeId, null] },
      { sub: bruno.sub, query: IMMEDIATE },
    ]),
    /au moins un besoin/,
  );
  await assert.rejects(
    inDbTransaction([
      { sub: bruno.sub, query: `DELETE FROM requirement_need WHERE requirement_id = $1`, params: [rootId] },
      { sub: bruno.sub, query: IMMEDIATE },
    ]),
    /au moins un besoin/,
  );
});
await check('bruno ne change ni la référence, ni l’auteur, ni l’initiative d’une exigence (déclencheur)', async () => {
  const r = await asUserInDb(
    bruno.sub,
    `UPDATE requirement SET reference = 'FAUX-EX-001', created_by = $2 WHERE id = $1 RETURNING reference, created_by, updated_by`,
    [rootId, chloe.sub],
  );
  assert.deepEqual(Object.values(r.rows[0]), [`${exCode}-${exAcronym}-001`, bruno.sub, bruno.sub]);
  await assert.rejects(
    asUserInDb(bruno.sub, `UPDATE requirement SET initiative_id = $2 WHERE id = $1`, [rootId, otherExInitiativeId]),
    /ne change pas/,
  );
});
await check('sous-type incohérent, statut inconnu, énoncé vide, boucle : refusés par la base', async () => {
  await assert.rejects(asUserInDb(bruno.sub, `UPDATE requirement SET type = 'solution' WHERE id = $1`, [rootId]), /check constraint/);
  await assert.rejects(asUserInDb(bruno.sub, `UPDATE requirement SET subtype = 'functional' WHERE id = $1`, [rootId]), /check constraint/);
  await assert.rejects(asUserInDb(bruno.sub, `UPDATE requirement SET status = 'piraté' WHERE id = $1`, [rootId]), /check constraint/);
  await assert.rejects(asUserInDb(bruno.sub, `UPDATE requirement SET statement = '' WHERE id = $1`, [rootId]), /check constraint/);
  await assert.rejects(asUserInDb(bruno.sub, `UPDATE requirement SET parent_id = $2 WHERE id = $1`, [rootId, childId]), /descend/);
  await assert.rejects(asUserInDb(bruno.sub, `UPDATE requirement SET parent_id = id WHERE id = $1`, [rootId]), /descend/);
});
await check('historique : modification en base enregistrée avec son auteur ; aucune écriture directe', async () => {
  const r = await inDbTransaction([
    { sub: bruno.sub, query: `UPDATE requirement SET status = 'verified' WHERE id = $1`, params: [rootId] },
    { sub: bruno.sub, query: IMMEDIATE },
    { sub: bruno.sub, query: `SELECT changed_by, snapshot->>'status' AS status FROM requirement_version WHERE requirement_id = $1 ORDER BY id DESC LIMIT 1`, params: [rootId] },
  ]);
  assert.deepEqual(Object.values(r.rows[0]), [bruno.sub, 'verified']);
  await assert.rejects(
    asUserInDb(alice.sub, `INSERT INTO requirement_version (initiative_id, requirement_id, changed_by, changed_at, snapshot) VALUES ($1, $2, $3, now(), '{}')`, [exInitiativeId, rootId, alice.sub]),
    /row-level security/,
  );
  assert.equal((await asUserInDb(alice.sub, `UPDATE requirement_version SET changed_by = $2 WHERE requirement_id = $1`, [rootId, chloe.sub])).rowCount, 0);
  assert.equal((await asUserInDb(alice.sub, `DELETE FROM requirement_version WHERE requirement_id = $1`, [rootId])).rowCount, 0);
  await assert.rejects(asUserInDb(alice.sub, `SELECT finalize_requirement($1)`, [rootId]), /permission denied/);
});
await check('liens vers une parente, un besoin, une source ou une exigence d’une autre initiative refusés (clé étrangère)', async () => {
  await assert.rejects(asUserInDb(bruno.sub, `UPDATE requirement SET parent_id = $2 WHERE id = $1`, [childId, otherRequirementId]), /foreign key/);
  await assert.rejects(asUserInDb(bruno.sub, `INSERT INTO requirement_need VALUES ($1, $2, $3)`, [exInitiativeId, rootId, otherExNeedId]), /foreign key/);
  await assert.rejects(asUserInDb(bruno.sub, `INSERT INTO requirement_stakeholder VALUES ($1, $2, $3)`, [exInitiativeId, rootId, otherExSourceId]), /foreign key/);
  await assert.rejects(asUserInDb(bruno.sub, `INSERT INTO action_requirement VALUES ($1, $2, $3)`, [exInitiativeId, exActionId, otherRequirementId]), /foreign key/);
});
await check('liées : DELETE de l’exigence, de sa parente, du besoin et de la source refusés (clé étrangère)', async () => {
  await assert.rejects(asUserInDb(bruno.sub, `DELETE FROM requirement WHERE id = $1`, [rootId]), /foreign key/);
  await assert.rejects(asUserInDb(bruno.sub, `DELETE FROM need WHERE id = $1`, [exNeedId]), /foreign key/);
  await assert.rejects(asUserInDb(bruno.sub, `DELETE FROM stakeholder WHERE id = $1`, [exSourceId]), /foreign key/);
});
await check('bruno (contributeur) : DELETE d’une exigence liée à rien accepté, liens et historique compris', async () => {
  assert.equal((await asUserInDb(bruno.sub, `DELETE FROM requirement WHERE id = $1`, [childId])).rowCount, 1);
});
