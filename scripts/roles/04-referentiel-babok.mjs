// Référentiel BABOK.
import { API, assert, check, call, asUserInDb, alice, bruno, chloe, admin } from './commun.mjs';

console.log('\nRéférentiel BABOK — barrière 1 : API (guards NestJS)');
await check('sans jeton : 401', async () => {
  assert.equal((await fetch(`${API}/babok`)).status, 401);
});
await check('bruno et admin consultent le même référentiel : 6 domaines, 30 tâches, 50 techniques', async () => {
  const [r, a] = [await call(bruno, 'GET', '/babok'), await call(admin, 'GET', '/babok')];
  assert.equal(r.status, 200);
  assert.deepEqual(a.body, r.body);
  assert.deepEqual([r.body.knowledgeAreas.length, r.body.tasks.length, r.body.techniques.length], [6, 30, 50]);
  const verify = r.body.tasks.find((t) => t.id === '7.2');
  assert.deepEqual(verify.name, { en: 'Verify Requirements', fr: 'Vérifier les exigences' });
  assert.deepEqual(verify.techniqueIds, ['10.1', '10.26', '10.28', '10.37']);
  assert.equal(r.body.tasks.reduce((n, t) => n + t.techniqueIds.length, 0), 341);
});
await check('aucune écriture par l’API, administrateur compris : 404', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal((await call(admin, method, '/babok', {})).status, 404, method);
  }
});

console.log('\nRéférentiel BABOK — barrière 2 : base de données (RLS, compte applicatif)');
export const babokTables = ['babok_knowledge_area', 'babok_task', 'babok_technique', 'babok_task_technique'];
await check('tout utilisateur lit le référentiel ; sans utilisateur, rien', async () => {
  const counts = async (sub) =>
    Promise.all(babokTables.map(async (table) => (await asUserInDb(sub, `SELECT 1 FROM ${table}`)).rowCount));
  assert.deepEqual(await counts(chloe.sub), [6, 30, 50, 341]);
  assert.deepEqual(await counts(''), [0, 0, 0, 0]);
});
await check('admin (transaction d’administrateur) ne peut pas ajouter d’élément', async () => {
  await assert.rejects(
    asUserInDb(admin.sub, `INSERT INTO babok_task_technique (task_id, technique_id) VALUES ('7.2', '10.5')`, [], { admin: true }),
    /row-level security/,
  );
});
await check('admin ne peut ni modifier ni supprimer : aucune ligne touchée', async () => {
  const opts = { admin: true };
  assert.equal((await asUserInDb(admin.sub, `UPDATE babok_task SET name_fr = 'Piraté'`, [], opts)).rowCount, 0);
  assert.equal((await asUserInDb(admin.sub, `DELETE FROM babok_task_technique`, [], opts)).rowCount, 0);
  assert.equal((await asUserInDb(alice.sub, `DELETE FROM babok_technique`, [])).rowCount, 0);
});
