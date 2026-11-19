import { assert, check, call, asUserInDb, inDbTransaction, alice, bruno, chloe, admin, code } from './commun.mjs';

// Historique des scénarios et du Contexte (phase 3, ticket 03 ; décisions D3, D13,
// D17). alice propriétaire, bruno contributeur, chloé lectrice ; admin n'est pas
// membre. Les historiques sont écrits par la base, jamais directement.
console.log('\nHistorique des scénarios — barrière 1 : API (guards NestJS)');
export let hsInitiativeId;
const hsCode = `${code.slice(0, 8)}HS`;
let functionalId;
let scenarioId;
let otherScenarioId;
const base = () => `/initiatives/${hsInitiativeId}`;
const requirement = () => `${base()}/requirements/${functionalId}`;
const scenarios = () => `${requirement()}/scenarios`;
const scenarioHistory = (id = scenarioId) => `${scenarios()}/${id}/history`;
const background = () => `${requirement()}/feature/background`;
const backgroundHistory = () => `${background()}/history`;
const versionCount = async (table, column, id) =>
  (await asUserInDb(alice.sub, `SELECT 1 FROM ${table} WHERE ${column} = $1`, [id])).rowCount;
let requirementVersions;

await check('alice crée l’initiative, invite bruno et chloé ; une exigence fonctionnelle, deux scénarios et un Contexte', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: hsCode, name: 'Historique des scénarios' });
  assert.equal(r.status, 201);
  hsInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `${base()}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `${base()}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
  const needId = (await call(alice, 'POST', `${base()}/needs`, { title: 'Paiement', nature: 'problem' })).body.id;
  const req = { title: 'Payer en ligne', statement: 'Énoncé.', type: 'solution', subtype: 'functional', needIds: [needId] };
  functionalId = (await call(alice, 'POST', `${base()}/requirements`, req)).body.id;
  requirementVersions = (await call(alice, 'GET', `${requirement()}/history`)).body.length;
  scenarioId = (await call(alice, 'POST', scenarios(), { title: 'Payer', text: 'Quand je paie', language: 'fr' })).body.id;
  otherScenarioId = (await call(alice, 'POST', scenarios(), { title: 'Rembourser', text: '' })).body.id;
  assert.equal((await call(alice, 'PUT', background(), { baseRowVersion: null, text: 'Étant donné un client' })).status, 200);
});
await check('à la création, l’historique d’un scénario ne contient que son auteur et sa date', async () => {
  const r = await call(chloe, 'GET', scenarioHistory());
  assert.equal(r.status, 200);
  assert.equal(r.body.createdBy.userId, alice.sub);
  assert.ok(r.body.createdAt);
  assert.deepEqual(r.body.versions, []);
});
await check('chaque modification du titre ou du texte est conservée : qui, quand, avant et après', async () => {
  let s = (await call(bruno, 'PATCH', `${scenarios()}/${scenarioId}`, { baseRowVersion: 0, title: 'Payer par carte' })).body;
  s = (await call(alice, 'PATCH', `${scenarios()}/${scenarioId}`, { baseRowVersion: s.rowVersion, text: 'Quand je paie\nAlors je reçois un reçu' })).body;
  // Une saisie qui ne change rien n'ajoute rien.
  await call(alice, 'PATCH', `${scenarios()}/${scenarioId}`, { baseRowVersion: s.rowVersion, title: 'Payer par carte' });
  const { versions } = (await call(chloe, 'GET', scenarioHistory())).body;
  assert.equal(versions.length, 2);
  assert.equal(versions[0].changedBy.userId, bruno.sub);
  assert.deepEqual([versions[0].before, versions[0].after], [
    { title: 'Payer', text: 'Quand je paie' },
    { title: 'Payer par carte', text: 'Quand je paie' },
  ]);
  assert.equal(versions[1].changedBy.userId, alice.sub);
  assert.equal(versions[1].after.text, 'Quand je paie\nAlors je reçois un reçu');
  assert.ok(versions[0].changedAt <= versions[1].changedAt);
});
await check('le Contexte a son propre historique', async () => {
  const opened = (await call(alice, 'GET', `${requirement()}/feature`)).body.background.rowVersion;
  assert.equal((await call(bruno, 'PUT', background(), { baseRowVersion: opened, text: 'Étant donné un client connecté' })).status, 200);
  const r = await call(chloe, 'GET', backgroundHistory());
  assert.equal(r.status, 200);
  assert.equal(r.body.createdBy.userId, alice.sub);
  assert.equal(r.body.versions.length, 1);
  assert.equal(r.body.versions[0].changedBy.userId, bruno.sub);
  assert.deepEqual([r.body.versions[0].before, r.body.versions[0].after], [
    { text: 'Étant donné un client' },
    { text: 'Étant donné un client connecté' },
  ]);
});
await check('un changement d’ordre ou de langue ne figure dans aucun historique', async () => {
  assert.equal((await call(bruno, 'PUT', `${scenarios()}/order`, { scenarioIds: [otherScenarioId, scenarioId] })).status, 200);
  assert.equal((await call(bruno, 'PUT', `${requirement()}/feature/language`, { language: 'en' })).status, 200);
  assert.equal((await call(alice, 'GET', scenarioHistory())).body.versions.length, 2);
  assert.equal((await call(alice, 'GET', scenarioHistory(otherScenarioId))).body.versions.length, 0);
  assert.equal((await call(alice, 'GET', backgroundHistory())).body.versions.length, 1);
});
await check('rien n’apparaît dans l’historique de l’exigence', async () => {
  assert.equal((await call(alice, 'GET', `${requirement()}/history`)).body.length, requirementVersions);
});
await check('un scénario inconnu ou sans Contexte : 404 ; admin (non-membre) ne voit rien : 404', async () => {
  assert.equal((await call(alice, 'GET', scenarioHistory('00000000-0000-4000-8000-000000000000'))).status, 404);
  assert.equal((await call(admin, 'GET', scenarioHistory())).status, 404);
  assert.equal((await call(admin, 'GET', backgroundHistory())).status, 404);
});
await check('initiative archivée : tout membre consulte encore les historiques', async () => {
  assert.equal((await call(alice, 'PUT', `${base()}/archive`)).status, 200);
  try {
    assert.equal((await call(chloe, 'GET', scenarioHistory())).status, 200);
    assert.equal((await call(chloe, 'GET', backgroundHistory())).status, 200);
  } finally {
    assert.equal((await call(alice, 'DELETE', `${base()}/archive`)).status, 200);
  }
});

console.log('\nHistorique des scénarios — barrière 2 : base de données (RLS, compte applicatif)');
await check('tout membre lit les historiques ; un non-membre, non', async () => {
  for (const u of [alice, bruno, chloe]) {
    assert.equal((await asUserInDb(u.sub, 'SELECT 1 FROM gherkin_scenario_version WHERE scenario_id = $1', [scenarioId])).rowCount, 2);
    assert.equal((await asUserInDb(u.sub, 'SELECT 1 FROM gherkin_background_version WHERE requirement_id = $1', [functionalId])).rowCount, 1);
  }
  assert.equal((await asUserInDb(admin.sub, 'SELECT 1 FROM gherkin_scenario_version WHERE scenario_id = $1', [scenarioId])).rowCount, 0);
  assert.equal((await asUserInDb(admin.sub, 'SELECT 1 FROM gherkin_background_version WHERE requirement_id = $1', [functionalId])).rowCount, 0);
});
await check('aucune écriture directe dans un historique, même par le propriétaire', async () => {
  await assert.rejects(
    asUserInDb(
      alice.sub,
      `INSERT INTO gherkin_scenario_version (initiative_id, scenario_id, changed_by, changed_at, snapshot_before, snapshot_after)
       VALUES ($1, $2, $3, now(), '{}', '{}')`,
      [hsInitiativeId, scenarioId, alice.sub],
    ),
    /row-level security|permission denied/,
  );
  await assert.rejects(
    asUserInDb(
      alice.sub,
      `INSERT INTO gherkin_background_version (initiative_id, requirement_id, changed_by, changed_at, snapshot_before, snapshot_after)
       VALUES ($1, $2, $3, now(), '{}', '{}')`,
      [hsInitiativeId, functionalId, alice.sub],
    ),
    /row-level security|permission denied/,
  );
  for (const [table, column, id] of [
    ['gherkin_scenario_version', 'scenario_id', scenarioId],
    ['gherkin_background_version', 'requirement_id', functionalId],
  ]) {
    const update = asUserInDb(alice.sub, `UPDATE ${table} SET changed_by = $1 WHERE ${column} = $2`, [bruno.sub, id]);
    assert.equal((await update.catch(() => ({ rowCount: 0 }))).rowCount, 0);
    const remove = asUserInDb(alice.sub, `DELETE FROM ${table} WHERE ${column} = $1`, [id]);
    assert.equal((await remove.catch(() => ({ rowCount: 0 }))).rowCount, 0);
  }
  assert.equal(await versionCount('gherkin_scenario_version', 'scenario_id', scenarioId), 2);
});
await check('une modification faite directement en base entre dans l’historique, avec son auteur ; pas un changement de place', async () => {
  // Une seule transaction, annulée ensuite.
  const r = await inDbTransaction([
    { sub: bruno.sub, query: `UPDATE gherkin_scenario SET text = 'Via SQL' WHERE id = $1`, params: [scenarioId] },
    { sub: bruno.sub, query: 'UPDATE gherkin_scenario SET position = 7 WHERE id = $1', params: [scenarioId] },
    {
      sub: alice.sub,
      query: 'SELECT changed_by, snapshot_after FROM gherkin_scenario_version WHERE scenario_id = $1 ORDER BY id DESC',
      params: [scenarioId],
    },
  ]);
  assert.equal(r.rowCount, 3);
  assert.deepEqual([r.rows[0].changed_by, r.rows[0].snapshot_after.text], [bruno.sub, 'Via SQL']);
});

console.log('\nHistorique des scénarios — suppression');
await check('l’historique disparaît avec son scénario', async () => {
  assert.equal((await call(alice, 'PATCH', `${scenarios()}/${otherScenarioId}`, { baseRowVersion: 0, text: 'Quand je rembourse' })).status, 200);
  assert.equal(await versionCount('gherkin_scenario_version', 'scenario_id', otherScenarioId), 1);
  assert.equal((await call(bruno, 'DELETE', `${scenarios()}/${otherScenarioId}`)).status, 204);
  assert.equal(await versionCount('gherkin_scenario_version', 'scenario_id', otherScenarioId), 0);
  assert.equal((await call(alice, 'GET', scenarioHistory(otherScenarioId))).status, 404);
});
await check('l’historique disparaît avec son Contexte : un nouveau Contexte repart d’un historique vierge', async () => {
  assert.equal((await call(bruno, 'DELETE', background())).status, 204);
  assert.equal(await versionCount('gherkin_background_version', 'requirement_id', functionalId), 0);
  assert.equal((await call(alice, 'GET', backgroundHistory())).status, 404);
  assert.equal((await call(bruno, 'PUT', background(), { baseRowVersion: null, text: 'Étant donné un autre client' })).status, 200);
  const r = (await call(chloe, 'GET', backgroundHistory())).body;
  assert.deepEqual([r.createdBy.userId, r.versions], [bruno.sub, []]);
});
await check('supprimer l’exigence supprime les historiques de ses scénarios et de son Contexte', async () => {
  const opened = (await call(alice, 'GET', `${requirement()}/feature`)).body.background.rowVersion;
  assert.equal((await call(alice, 'PUT', background(), { baseRowVersion: opened, text: 'Étant donné encore un client' })).status, 200);
  assert.equal(await versionCount('gherkin_background_version', 'requirement_id', functionalId), 1);
  assert.equal((await call(alice, 'DELETE', requirement())).status, 204);
  assert.equal(await versionCount('gherkin_scenario_version', 'scenario_id', scenarioId), 0);
  assert.equal(await versionCount('gherkin_background_version', 'requirement_id', functionalId), 0);
});
