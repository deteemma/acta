import { assert, check, call, asUserInDb, inDbTransaction, alice, bruno, chloe, admin, code } from './commun.mjs';
import { IMMEDIATE } from './08-exigences.mjs';

// Statuts d'exigence paramétrables (ticket 11). Liste commune à toute
// l'application : les statuts ajoutés par l'API sont supprimés avant la fin
// (jamais portés par une exigence) ; ceux qu'une exigence porte ne sont créés
// qu'en base, dans une transaction annulée, pour ne rien laisser dans la base
// de développement. Initiative propre à cette section : alice propriétaire,
// bruno contributeur, chloé lectrice.
console.log('\nStatuts d’exigence — barrière 1 : API (guards NestJS)');
export let stInitiativeId;
let stRequirementId;
const statuses = '/requirement-statuses';
const adminStatuses = '/admin/requirement-statuses';
const adminStatus = (statusCode) => `${adminStatuses}/${statusCode}`;
const BABOK = ['proposed', 'verified', 'validated', 'approved', 'deferred', 'rejected'];
// Libellés uniques à chaque exécution.
const labels = { fr: `Recette ${code}`, en: `Testing ${code}` };
const findByLabel = (list, fr) => list.find((s) => s.labels.fr === fr);
const requirement = () => `/initiatives/${stInitiativeId}/requirements/${stRequirementId}`;

await check('alice crée l’initiative, invite bruno (contributeur) et chloé (lectrice) ; un besoin, une exigence', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}ST`, name: 'Statuts d’exigence' });
  assert.equal(r.status, 201);
  stInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `/initiatives/${stInitiativeId}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `/initiatives/${stInitiativeId}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
  const needId = (await call(alice, 'POST', `/initiatives/${stInitiativeId}/needs`, { title: 'Recette', nature: 'problem' })).body.id;
  const created = await call(bruno, 'POST', `/initiatives/${stInitiativeId}/requirements`, {
    title: 'Recette des statuts',
    statement: 'Chaque statut se teste.',
    type: 'business',
    needIds: [needId],
  });
  assert.equal(created.status, 201);
  stRequirementId = created.body.id;
});
await check('tout utilisateur connecté (chloé, admin) lit la liste : les 6 statuts du BABOK en tête, bilingues', async () => {
  for (const u of [chloe, admin]) {
    const r = await call(u, 'GET', statuses);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.slice(0, 6).map((s) => [s.code, s.babok, s.active]), BABOK.map((c) => [c, true, true]));
    assert.deepEqual(r.body[1].labels, { fr: 'Vérifiée', en: 'Verified' });
    assert.equal('used' in r.body[0], false);
  }
});
await check('alice, bruno, chloé (non administrateurs) : administration des statuts refusée (403)', async () => {
  for (const u of [alice, bruno, chloe]) {
    assert.equal((await call(u, 'GET', adminStatuses)).status, 403);
    assert.equal((await call(u, 'POST', adminStatuses, { labels })).status, 403);
    assert.equal((await call(u, 'PATCH', adminStatus('verified'), { active: false })).status, 403);
    assert.equal((await call(u, 'DELETE', adminStatus('verified'))).status, 403);
  }
});
await check('admin : libellé manquant ou de plus de 50 caractères (schéma partagé) : 400', async () => {
  assert.equal((await call(admin, 'POST', adminStatuses, { labels: { fr: labels.fr } })).status, 400);
  assert.equal((await call(admin, 'POST', adminStatuses, { labels: { fr: ' ', en: labels.en } })).status, 400);
  assert.equal((await call(admin, 'POST', adminStatuses, { labels: { fr: 'x'.repeat(51), en: labels.en } })).status, 400);
});
await check('admin : libellé d’un statut du BABOK, accents et majuscules ignorés : 409 labelTaken', async () => {
  const r = await call(admin, 'POST', adminStatuses, { labels: { fr: 'VERIFIEE', en: labels.en } });
  assert.deepEqual([r.status, r.body.refusal], [409, 'labelTaken']);
});
let addedCode;
await check('admin ajoute un statut : actif, non utilisé, après ceux du BABOK ; proposé à tous', async () => {
  const r = await call(admin, 'POST', adminStatuses, { labels });
  assert.equal(r.status, 201);
  const added = findByLabel(r.body, labels.fr);
  assert.deepEqual([added.babok, added.active, added.used, added.labels], [false, true, false, labels]);
  assert.ok(r.body.indexOf(added) >= 6);
  addedCode = added.code;
  assert.ok(findByLabel((await call(chloe, 'GET', statuses)).body, labels.fr));
  const again = await call(admin, 'POST', adminStatuses, { labels: { fr: labels.fr.toUpperCase(), en: 'Autre' } });
  assert.deepEqual([again.status, again.body.refusal], [409, 'labelTaken']);
});
await check('admin : statuts du BABOK ni renommés, ni désactivés, ni supprimés (409) ; statut inconnu (404)', async () => {
  for (const change of [{ labels: { fr: 'Soumise', en: 'Submitted' } }, { active: false }]) {
    const r = await call(admin, 'PATCH', adminStatus('verified'), change);
    assert.deepEqual([r.status, r.body.refusal], [409, 'babokStatusLocked']);
  }
  const r = await call(admin, 'DELETE', adminStatus('proposed'));
  assert.deepEqual([r.status, r.body.refusal], [409, 'babokStatusLocked']);
  assert.equal((await call(admin, 'PATCH', adminStatus('inconnu'), { active: false })).status, 404);
});
await check('admin renomme le statut ajouté, puis le désactive : toujours listé, inactif', async () => {
  const renamed = { fr: `${labels.fr} bis`, en: `${labels.en} bis` };
  let r = await call(admin, 'PATCH', adminStatus(addedCode), { labels: renamed });
  assert.deepEqual([r.status, r.body.find((s) => s.code === addedCode).labels], [200, renamed]);
  r = await call(admin, 'PATCH', adminStatus(addedCode), { active: false });
  assert.equal(r.body.find((s) => s.code === addedCode).active, false);
  assert.equal((await call(chloe, 'GET', statuses)).body.find((s) => s.code === addedCode).active, false);
});
await check('bruno (contributeur) : statut désactivé ou inconnu refusé sur une exigence (400)', async () => {
  let r = await call(bruno, 'PATCH', requirement(), { status: addedCode });
  assert.deepEqual([r.status, r.body.refusal], [400, 'inactiveStatus']);
  r = await call(bruno, 'PATCH', requirement(), { status: 'inconnu' });
  assert.deepEqual([r.status, r.body.refusal], [400, 'unknownStatus']);
  assert.equal((await call(bruno, 'GET', requirement())).body.status, 'proposed');
});
await check('chloé (lectrice) : changement de statut refusé (403)', async () => {
  assert.equal((await call(chloe, 'PATCH', requirement(), { status: 'approved' })).status, 403);
});
await check('alice (propriétaire) : statut désactivé refusé (400), statut actif accepté', async () => {
  const r = await call(alice, 'PATCH', requirement(), { status: addedCode });
  assert.deepEqual([r.status, r.body.refusal], [400, 'inactiveStatus']);
  assert.equal((await call(alice, 'PATCH', requirement(), { status: 'approved' })).body.status, 'approved');
  assert.equal((await call(alice, 'PATCH', requirement(), { status: 'proposed' })).body.status, 'proposed');
});
await check('initiative archivée : changement de statut refusé à alice et bruno (403)', async () => {
  assert.equal((await call(alice, 'PUT', `/initiatives/${stInitiativeId}/archive`)).status, 200);
  for (const u of [alice, bruno]) assert.equal((await call(u, 'PATCH', requirement(), { status: 'approved' })).status, 403);
});
await check('admin réactive puis supprime le statut jamais utilisé : il disparaît de la liste', async () => {
  let r = await call(admin, 'PATCH', adminStatus(addedCode), { active: true });
  assert.equal(r.body.find((s) => s.code === addedCode).active, true);
  r = await call(admin, 'DELETE', adminStatus(addedCode));
  assert.equal(r.status, 200);
  assert.equal(r.body.some((s) => s.code === addedCode), false);
  assert.equal((await call(chloe, 'GET', statuses)).body.some((s) => s.code === addedCode), false);
});

console.log('\nStatuts d’exigence — barrière 2 : base de données (RLS, compte applicatif)');
const addSql = `SELECT admin_add_requirement_status('test-statut', $1, $2)`;
const add = { sub: admin.sub, admin: true, query: addSql, params: [labels.fr, labels.en] };
const setStatus = (status) => ({
  sub: bruno.sub,
  query: 'UPDATE requirement SET status = $2 WHERE id = $1',
  params: [stRequirementId, status],
});
const deactivate = { sub: admin.sub, admin: true, query: `SELECT admin_update_requirement_status('test-statut', NULL, NULL, false)` };
const remove = { sub: admin.sub, admin: true, query: `SELECT admin_delete_requirement_status('test-statut')` };
await check('alice, admin : aucune écriture directe dans la liste des statuts, même en transaction d’administrateur', async () => {
  for (const [u, isAdmin] of [[alice, false], [admin, true]]) {
    await assert.rejects(
      asUserInDb(u.sub, `INSERT INTO requirement_status (code, label_fr, label_en, created_at) VALUES ('x', 'X', 'X', now())`, [], { admin: isAdmin }),
      /row-level security/,
    );
    assert.equal((await asUserInDb(u.sub, `UPDATE requirement_status SET active = false WHERE code = 'verified'`, [], { admin: isAdmin })).rowCount, 0);
    assert.equal((await asUserInDb(u.sub, `DELETE FROM requirement_status WHERE code = 'verified'`, [], { admin: isAdmin })).rowCount, 0);
  }
});
await check('alice (hors transaction d’administrateur) : fonctions d’administration des statuts refusées', async () => {
  for (const query of [addSql, `SELECT admin_used_requirement_statuses()`, `SELECT admin_delete_requirement_status('verified')`]) {
    await assert.rejects(asUserInDb(alice.sub, query, query === addSql ? [labels.fr, labels.en] : []), /réservé à l’administrateur/);
  }
});
await check('admin : statut du BABOK ni désactivé, ni renommé, ni supprimé par la base', async () => {
  for (const query of [
    `SELECT admin_update_requirement_status('verified', NULL, NULL, false)`,
    `SELECT admin_update_requirement_status('verified', 'Soumise', 'Submitted', NULL)`,
    `SELECT admin_delete_requirement_status('proposed')`,
  ]) {
    await assert.rejects(asUserInDb(admin.sub, query, [], { admin: true }), /BABOK/);
  }
});
await check('initiative archivée : changement de statut sans effet en base pour alice et bruno', async () => {
  for (const u of [alice, bruno]) {
    const r = await asUserInDb(u.sub, `UPDATE requirement SET status = 'approved' WHERE id = $1`, [stRequirementId]);
    assert.equal(r.rowCount, 0);
  }
});
await check('alice désarchive l’initiative : 200', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${stInitiativeId}/archive`)).status, 200);
});
await check('alice (propriétaire) : statut attribué en base', async () => {
  const r = await asUserInDb(alice.sub, `UPDATE requirement SET status = 'approved' WHERE id = $1 RETURNING status`, [stRequirementId]);
  assert.equal(r.rows[0].status, 'approved');
});
await check('un statut désactivé n’est plus attribué par la base, mais l’exigence qui le porte le garde', async () => {
  const r = await inDbTransaction([
    add,
    setStatus('test-statut'),
    deactivate,
    { sub: bruno.sub, query: `UPDATE requirement SET title = 'Recette, suite' WHERE id = $1 RETURNING status`, params: [stRequirementId] },
  ]);
  assert.equal(r.rows[0].status, 'test-statut');
  await assert.rejects(inDbTransaction([add, deactivate, setStatus('test-statut')]), /désactivé/);
});
await check('un statut porté, ou seulement présent dans l’historique, ne se supprime pas', async () => {
  await assert.rejects(inDbTransaction([add, setStatus('test-statut'), remove]), /déjà utilisé/);
  await assert.rejects(
    inDbTransaction([add, setStatus('test-statut'), { sub: bruno.sub, query: IMMEDIATE }, setStatus('proposed'), { sub: bruno.sub, query: IMMEDIATE }, remove]),
    /déjà utilisé/,
  );
  const used = await inDbTransaction([add, setStatus('test-statut'), { sub: admin.sub, admin: true, query: `SELECT admin_used_requirement_statuses() AS code` }]);
  assert.ok(used.rows.some((row) => row.code === 'test-statut'));
});
await check('un statut inconnu n’est pas attribué par la base (clé étrangère)', async () => {
  await assert.rejects(inDbTransaction([setStatus('inconnu')]), /requirement_status_fkey/);
});
