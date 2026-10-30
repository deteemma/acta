import { assert, check, call, asUserInDb, inDbTransaction, alice, bruno, chloe, admin, code } from './commun.mjs';

// Références et besoins (ticket 09). État de départ : alice propriétaire,
// bruno contributeur, chloé lectrice, admin non-membre (mais administrateur).
console.log('\nRéférences et besoins — barrière 1 : API (guards NestJS)');
export let rbInitiativeId;
export let rbCode = `${code.slice(0, 8)}RB`;
export let otherRbInitiativeId;
export let otherNeedId;
export let originId;
export let needId;
export let secondNeedId;
export let rbActionId;
export let needAcronym;
export const needs = (id = rbInitiativeId) => `/initiatives/${id}/needs`;
export const needPath = (id) => `${needs()}/${id}`;
export const rbActions = () => `/initiatives/${rbInitiativeId}/actions`;
export const categories = '/admin/reference-categories';
export const problem = { title: 'Délais de traitement trop longs', nature: 'problem' };
await check('alice crée l’initiative et invite bruno (contributeur) et chloé (lectrice)', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: rbCode, name: 'Références et besoins' });
  assert.equal(r.status, 201);
  assert.equal(r.body.codeFrozen, false);
  rbInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `/initiatives/${rbInitiativeId}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `/initiatives/${rbInitiativeId}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
  const s = await call(alice, 'POST', `/initiatives/${rbInitiativeId}/stakeholders`, { name: 'Service client', kind: 'group', roles: ['end_user'] });
  originId = s.body.id;
});
await check('admin consulte les acronymes ; bruno, chloé (non administrateurs) : 403', async () => {
  const r = await call(admin, 'GET', categories);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.map((c) => c.category), ['need', 'requirement']);
  needAcronym = r.body[0].acronym;
  assert.equal((await call(bruno, 'GET', categories)).status, 403);
  assert.equal((await call(chloe, 'PATCH', `${categories}/need`, { acronym: 'BS' })).status, 403);
});
await check('acronyme invalide (400), acronyme d’une autre catégorie (409 acronymTaken)', async () => {
  assert.equal((await call(admin, 'PATCH', `${categories}/need`, { acronym: 'B1' })).status, 400);
  assert.equal((await call(admin, 'PATCH', `${categories}/need`, { acronym: 'BESOIN' })).status, 400);
  assert.equal((await call(admin, 'PATCH', `${categories}/nothing`, { acronym: 'NO' })).status, 400);
  const r = await call(admin, 'PATCH', `${categories}/requirement`, { acronym: needAcronym });
  assert.equal(r.status, 409);
  assert.equal(r.body.refusal, 'acronymTaken');
});
await check('alice (propriétaire) change le code tant qu’aucune référence n’existe : 200', async () => {
  rbCode = `${code.slice(0, 8)}RC`;
  const r = await call(alice, 'PATCH', `/initiatives/${rbInitiativeId}`, { code: rbCode });
  assert.equal(r.status, 200);
  assert.equal(r.body.code, rbCode);
});
await check('bruno (contributeur) crée un besoin : référence attribuée, origine, auteur', async () => {
  const r = await call(bruno, 'POST', needs(), { ...problem, description: '**Urgent**', stakeholderIds: [originId] });
  assert.equal(r.status, 201);
  assert.equal(r.body.reference, `${rbCode}-${needAcronym}-001`);
  assert.deepEqual(r.body.stakeholders.map((s) => s.id), [originId]);
  assert.deepEqual([r.body.nature, r.body.createdBy.userId], ['problem', bruno.sub]);
  needId = r.body.id;
  const s = await call(alice, 'POST', needs(), { title: 'Vente croisée', nature: 'opportunity' });
  assert.equal(s.body.reference, `${rbCode}-${needAcronym}-002`);
  secondNeedId = s.body.id;
});
await check('sans nature, nature inconnue ou titre vide (schéma partagé) : 400', async () => {
  assert.equal((await call(bruno, 'POST', needs(), { title: 'Sans nature' })).status, 400);
  assert.equal((await call(bruno, 'POST', needs(), { ...problem, nature: 'risk' })).status, 400);
  assert.equal((await call(bruno, 'POST', needs(), { ...problem, title: ' ' })).status, 400);
});
await check('une référence existe : le code est figé (409 codeFrozen), même pour la propriétaire', async () => {
  assert.equal((await call(alice, 'GET', `/initiatives/${rbInitiativeId}`)).body.codeFrozen, true);
  const r = await call(alice, 'PATCH', `/initiatives/${rbInitiativeId}`, { code: `${code.slice(0, 8)}RZ` });
  assert.equal(r.status, 409);
  assert.equal(r.body.refusal, 'codeFrozen');
  assert.equal((await call(alice, 'PATCH', `/initiatives/${rbInitiativeId}`, { code: rbCode, name: 'Renommée' })).status, 200);
});
await check('chloé (lectrice) consulte la liste (par référence) et une fiche : 200', async () => {
  const r = await call(chloe, 'GET', needs());
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.map((n) => n.id), [needId, secondNeedId]);
  assert.equal((await call(chloe, 'GET', needPath(needId))).status, 200);
});
await check('chloé (lectrice) ne crée, ne modifie ni ne supprime : 403', async () => {
  assert.equal((await call(chloe, 'POST', needs(), problem)).status, 403);
  assert.equal((await call(chloe, 'PATCH', needPath(needId), { title: 'Piraté' })).status, 403);
  assert.equal((await call(chloe, 'DELETE', needPath(needId))).status, 403);
});
await check('admin (non-membre) ne voit ni ne crée de besoin : 404', async () => {
  assert.equal((await call(admin, 'GET', needs())).status, 404);
  assert.equal((await call(admin, 'GET', needPath(needId))).status, 404);
  assert.equal((await call(admin, 'POST', needs(), problem)).status, 404);
  assert.equal((await call(admin, 'PATCH', needPath(needId), { title: 'Piraté' })).status, 404);
  assert.equal((await call(admin, 'DELETE', needPath(needId))).status, 404);
});
await check('palette : chloé (lectrice) trouve les références, admin (non-membre) non', async () => {
  const mine = await call(chloe, 'GET', '/references');
  assert.equal(mine.status, 200);
  assert.ok(mine.body.some((r) => r.reference === `${rbCode}-${needAcronym}-001`));
  const theirs = await call(admin, 'GET', '/references');
  assert.ok(!theirs.body.some((r) => r.initiativeId === rbInitiativeId));
});
await check('alice (propriétaire) modifie le besoin : auteur de la modification, référence inchangée', async () => {
  const r = await call(alice, 'PATCH', needPath(needId), { nature: 'opportunity', stakeholderIds: [] });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.nature, r.body.stakeholders, r.body.reference], ['opportunity', [], `${rbCode}-${needAcronym}-001`]);
  assert.deepEqual([r.body.createdBy.userId, r.body.updatedBy.userId], [bruno.sub, alice.sub]);
  assert.equal((await call(alice, 'PATCH', needPath(needId), { stakeholderIds: [originId] })).body.stakeholders.length, 1);
});
await check('partie prenante d’une autre initiative à l’origine : 400', async () => {
  const r = await call(bruno, 'POST', '/initiatives', { code: `${code.slice(0, 8)}RD`, name: 'Autre' });
  otherRbInitiativeId = r.body.id;
  otherNeedId = (await call(bruno, 'POST', needs(otherRbInitiativeId), problem)).body.id;
  const o = await call(bruno, 'POST', `/initiatives/${otherRbInitiativeId}/stakeholders`, { name: 'Ailleurs', kind: 'person', roles: ['sponsor'] });
  const p = await call(bruno, 'PATCH', needPath(needId), { stakeholderIds: [o.body.id] });
  assert.equal(p.status, 400);
  assert.equal(p.body.refusal, 'unknownStakeholder');
});
await check('une action est liée à des besoins, à la création comme à la modification', async () => {
  const r = await call(bruno, 'POST', rbActions(), { title: 'Entretiens', taskId: '4.2', needIds: [needId] });
  assert.equal(r.status, 201);
  assert.deepEqual(r.body.needs.map((n) => n.reference), [`${rbCode}-${needAcronym}-001`]);
  rbActionId = r.body.id;
  const p = await call(alice, 'PATCH', `${rbActions()}/${rbActionId}`, { needIds: [secondNeedId, needId] });
  assert.deepEqual(p.body.needs.map((n) => n.id), [needId, secondNeedId]);
  assert.equal(p.body.updatedBy.userId, alice.sub);
});
await check('besoin d’une autre initiative : 400 ; chloé (lectrice) ne lie pas : 403', async () => {
  const r = await call(bruno, 'PATCH', `${rbActions()}/${rbActionId}`, { needIds: [otherNeedId] });
  assert.equal(r.status, 400);
  assert.equal(r.body.refusal, 'unknownNeed');
  assert.equal((await call(chloe, 'PATCH', `${rbActions()}/${rbActionId}`, { needIds: [] })).status, 403);
});
await check('liés : ni le besoin, ni l’action, ni la partie prenante à l’origine ne se suppriment (409)', async () => {
  const n = await call(alice, 'DELETE', needPath(needId));
  assert.equal(n.status, 409);
  assert.equal(n.body.refusal, 'needLinked');
  assert.equal((await call(alice, 'DELETE', `${rbActions()}/${rbActionId}`)).body.refusal, 'linked');
  const s = await call(alice, 'DELETE', `/initiatives/${rbInitiativeId}/stakeholders/${originId}`);
  assert.equal(s.status, 409);
  assert.equal(s.body.refusal, 'stakeholderLinked');
});
await check('retiré des actions, un besoin à l’origine renseignée se supprime ; son numéro n’est pas réattribué', async () => {
  assert.equal((await call(bruno, 'PATCH', `${rbActions()}/${rbActionId}`, { needIds: [secondNeedId] })).status, 200);
  assert.equal((await call(bruno, 'DELETE', needPath(needId))).status, 204);
  assert.equal((await call(alice, 'GET', needPath(needId))).status, 404);
  const r = await call(bruno, 'POST', needs(), problem);
  assert.equal(r.body.reference, `${rbCode}-${needAcronym}-003`);
  needId = r.body.id;
});
await check('aucune référence restante n’y change rien : le code reste figé', async () => {
  const r = await call(alice, 'PATCH', `/initiatives/${rbInitiativeId}`, { code: `${code.slice(0, 8)}RZ` });
  assert.equal(r.body.refusal, 'codeFrozen');
});
await check('initiative archivée : besoins et liens en lecture seule', async () => {
  assert.equal((await call(alice, 'PUT', `/initiatives/${rbInitiativeId}/archive`)).status, 200);
  assert.equal((await call(chloe, 'GET', needs())).status, 200);
  assert.equal((await call(alice, 'POST', needs(), problem)).status, 403);
  assert.equal((await call(bruno, 'PATCH', needPath(needId), { title: 'Interdit' })).status, 403);
  assert.equal((await call(alice, 'DELETE', needPath(needId))).status, 403);
  assert.equal((await call(alice, 'PATCH', `${rbActions()}/${rbActionId}`, { needIds: [] })).status, 403);
});

console.log('\nRéférences et besoins — barrière 2 : base de données (RLS, compte applicatif)');
// L'initiative est encore archivée.
export const insertNeed = (sub, initiative = rbInitiativeId) =>
  asUserInDb(
    sub,
    `INSERT INTO need (id, initiative_id, reference, title, nature) VALUES (gen_random_uuid(), $1, 'FAUX-BE-999', 'Via SQL', 'problem') RETURNING reference, created_by`,
    [initiative],
  );
await check('archivée : alice (propriétaire) : UPDATE et DELETE sans effet, INSERT refusé', async () => {
  assert.equal((await asUserInDb(alice.sub, `UPDATE need SET title = 'Interdit' WHERE id = $1`, [needId])).rowCount, 0);
  assert.equal((await asUserInDb(alice.sub, `DELETE FROM action_need WHERE action_id = $1`, [rbActionId])).rowCount, 0);
  await assert.rejects(insertNeed(alice.sub), /row-level security/);
});
await check('alice désarchive l’initiative : 200', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${rbInitiativeId}/archive`)).status, 200);
});
await check('chloé (lectrice) : INSERT refusés, UPDATE et DELETE sans effet', async () => {
  await assert.rejects(insertNeed(chloe.sub), /row-level security/);
  assert.equal((await asUserInDb(chloe.sub, `UPDATE need SET title = 'Piraté' WHERE id = $1`, [needId])).rowCount, 0);
  assert.equal((await asUserInDb(chloe.sub, `DELETE FROM need_stakeholder WHERE need_id = $1`, [needId])).rowCount, 0);
  assert.equal((await asUserInDb(chloe.sub, `DELETE FROM action_need WHERE action_id = $1`, [rbActionId])).rowCount, 0);
  await assert.rejects(
    asUserInDb(chloe.sub, `INSERT INTO action_need VALUES ($1, $2, $3)`, [rbInitiativeId, rbActionId, needId]),
    /row-level security/,
  );
  await assert.rejects(
    asUserInDb(chloe.sub, `INSERT INTO need_stakeholder VALUES ($1, $2, $3)`, [rbInitiativeId, needId, originId]),
    /row-level security/,
  );
});
await check('admin (non-membre) : aucun besoin ni lien visible, aucune écriture', async () => {
  assert.equal((await asUserInDb(admin.sub, `SELECT 1 FROM need WHERE initiative_id = $1`, [rbInitiativeId])).rowCount, 0);
  assert.equal((await asUserInDb(admin.sub, `SELECT 1 FROM need_stakeholder WHERE initiative_id = $1`, [rbInitiativeId])).rowCount, 0);
  assert.equal((await asUserInDb(admin.sub, `SELECT 1 FROM action_need WHERE initiative_id = $1`, [rbInitiativeId])).rowCount, 0);
  assert.equal((await asUserInDb(admin.sub, `UPDATE need SET title = 'Piraté' WHERE id = $1`, [needId])).rowCount, 0);
  await assert.rejects(insertNeed(admin.sub), /row-level security/);
});
await check('bruno (contributeur) : INSERT accepté, référence et auteur imposés par la base', async () => {
  const r = await insertNeed(bruno.sub);
  assert.deepEqual([r.rows[0].reference, r.rows[0].created_by], [`${rbCode}-${needAcronym}-004`, bruno.sub]);
});
await check('bruno ne change ni la référence, ni l’auteur, ni l’initiative d’un besoin (déclencheur)', async () => {
  const r = await asUserInDb(
    bruno.sub,
    `UPDATE need SET reference = 'FAUX-BE-001', created_by = $2 WHERE id = $1 RETURNING reference, created_by, updated_by`,
    [secondNeedId, chloe.sub],
  );
  assert.deepEqual(Object.values(r.rows[0]), [`${rbCode}-${needAcronym}-002`, alice.sub, bruno.sub]);
  await assert.rejects(
    asUserInDb(bruno.sub, `UPDATE need SET initiative_id = $2 WHERE id = $1`, [needId, otherRbInitiativeId]),
    /ne change pas/,
  );
});
await check('titre vide ou description de plus de 20 000 caractères : refusés (contraintes en base)', async () => {
  await assert.rejects(asUserInDb(bruno.sub, `UPDATE need SET title = '' WHERE id = $1`, [needId]), /check constraint/);
  await assert.rejects(asUserInDb(bruno.sub, `UPDATE need SET description = repeat('x', 20001) WHERE id = $1`, [needId]), /check constraint/);
});
await check('compteur : invisible et non modifiable ; numérotation inaccessible directement', async () => {
  assert.equal((await asUserInDb(alice.sub, `SELECT 1 FROM reference_counter WHERE initiative_id = $1`, [rbInitiativeId])).rowCount, 0);
  assert.equal((await asUserInDb(alice.sub, `UPDATE reference_counter SET last_number = 0 WHERE initiative_id = $1`, [rbInitiativeId])).rowCount, 0);
  assert.equal((await asUserInDb(alice.sub, `DELETE FROM reference_counter WHERE initiative_id = $1`, [rbInitiativeId])).rowCount, 0);
  await assert.rejects(asUserInDb(alice.sub, `SELECT next_reference($1, 'need')`, [rbInitiativeId]), /permission denied/);
});
await check('alice (propriétaire) : changement de code refusé par la base dès qu’une référence existe', async () => {
  await assert.rejects(
    asUserInDb(alice.sub, `UPDATE initiative SET code = $2 WHERE id = $1`, [rbInitiativeId, `${code.slice(0, 8)}RZ`]),
    /ne change plus/,
  );
});
await check('acronymes : écriture directe sans effet ; fonction réservée à l’administrateur', async () => {
  for (const u of [alice, admin]) {
    assert.equal((await asUserInDb(u.sub, `UPDATE reference_category SET acronym = 'ZZ'`, [], { admin: true })).rowCount, 0);
  }
  await assert.rejects(asUserInDb(alice.sub, `INSERT INTO reference_acronym VALUES ('ZZ', 'need')`, []), /row-level security/);
  await assert.rejects(asUserInDb(bruno.sub, `SELECT admin_set_reference_acronym('need', 'ZZ')`, []), /administrateur/);
});
await check('admin : acronyme d’une autre catégorie refusé par la base', async () => {
  await assert.rejects(
    asUserInDb(admin.sub, `SELECT admin_set_reference_acronym('requirement', $1)`, [needAcronym], { admin: true }),
    /autre catégorie/,
  );
});
await check('nouvel acronyme : les références attribuées restent, la suivante le prend, numéro continu (annulé)', async () => {
  const r = await inDbTransaction([
    { sub: admin.sub, admin: true, query: `SELECT admin_set_reference_acronym('need', 'ZZQ')` },
    { sub: bruno.sub, query: `INSERT INTO need (id, initiative_id, title, nature) VALUES (gen_random_uuid(), $1, 'Après', 'problem')`, params: [rbInitiativeId] },
    { sub: bruno.sub, query: `SELECT reference FROM need WHERE initiative_id = $1`, params: [rbInitiativeId] },
  ]);
  const references = r.rows.map((row) => row.reference).sort();
  assert.ok(references.includes(`${rbCode}-${needAcronym}-002`));
  // L'insertion SQL précédente a été annulée avec sa transaction : le compteur en était à 3.
  assert.ok(references.includes(`${rbCode}-ZZQ-004`));
});
await check('liens vers un besoin ou une partie prenante d’une autre initiative refusés (clé étrangère)', async () => {
  await assert.rejects(
    asUserInDb(bruno.sub, `INSERT INTO action_need VALUES ($1, $2, $3)`, [rbInitiativeId, rbActionId, otherNeedId]),
    /foreign key/,
  );
  await assert.rejects(
    asUserInDb(bruno.sub, `INSERT INTO need_stakeholder VALUES ($1, $2, $3)`, [otherRbInitiativeId, otherNeedId, originId]),
    /foreign key/,
  );
});
await check('besoin lié à une action, partie prenante à l’origine : DELETE refusé (clé étrangère)', async () => {
  await assert.rejects(asUserInDb(bruno.sub, `DELETE FROM need WHERE id = $1`, [secondNeedId]), /foreign key/);
  assert.equal((await call(bruno, 'PATCH', needPath(needId), { stakeholderIds: [originId] })).status, 200);
  await assert.rejects(asUserInDb(bruno.sub, `DELETE FROM stakeholder WHERE id = $1`, [originId]), /foreign key/);
});
await check('bruno (contributeur) : DELETE d’un besoin non lié accepté, origine comprise', async () => {
  assert.equal((await asUserInDb(bruno.sub, `DELETE FROM need WHERE id = $1`, [needId])).rowCount, 1);
});
