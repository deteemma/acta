import { assert, check, call, asUserInDb, alice, bruno, chloe, admin, code } from './commun.mjs';

// Scénarios Gherkin d'une exigence (phase 3, ticket 01 ; décisions D1 à D19).
// alice propriétaire, bruno contributeur, chloé lectrice ; admin n'est pas membre.
console.log('\nScénarios Gherkin — barrière 1 : API (guards NestJS)');
export let scInitiativeId;
const scCode = `${code.slice(0, 8)}SC`;
let needId;
let functionalId;
let nonFunctionalId;
let scenarioAcronym;
const base = () => `/initiatives/${scInitiativeId}`;
const requirement = (id = functionalId) => `${base()}/requirements/${id}`;
const scenarios = (id = functionalId) => `${requirement(id)}/scenarios`;
const scenario = (id) => `${scenarios()}/${id}`;
const list = async (user = alice) => (await call(user, 'GET', scenarios())).body;
const solution = (subtype, title) => ({ title, statement: 'Énoncé.', type: 'solution', subtype, needIds: [needId] });
const gherkin = 'Étant donné un client connu\nQuand il paie\nAlors le paiement est accepté';
const ids = {};

await check('alice crée l’initiative, invite bruno et chloé ; un besoin, une exigence fonctionnelle et une non fonctionnelle', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: scCode, name: 'Scénarios' });
  assert.equal(r.status, 201);
  scInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `${base()}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `${base()}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
  needId = (await call(alice, 'POST', `${base()}/needs`, { title: 'Paiement', nature: 'problem' })).body.id;
  functionalId = (await call(alice, 'POST', `${base()}/requirements`, solution('functional', 'Payer en ligne'))).body.id;
  nonFunctionalId = (await call(alice, 'POST', `${base()}/requirements`, solution('non_functional', 'Temps de réponse'))).body.id;
  scenarioAcronym = (await call(admin, 'GET', '/admin/reference-categories')).body.find((c) => c.category === 'scenario').acronym;
  assert.ok(['SC', 'SCE', 'SCEN'].includes(scenarioAcronym));
});
await check('la catégorie « scénario » est livrée et paramétrable dans l’administration des acronymes', async () => {
  const categories = (await call(admin, 'GET', '/admin/reference-categories')).body;
  assert.ok(categories.some((c) => c.category === 'scenario' && c.usedAcronyms.includes(scenarioAcronym)));
});
await check('bruno (contributeur) crée trois scénarios : référence CODE-SC-NNN, chacun en dernier', async () => {
  for (const [key, title] of [['a', 'Paiement accepté'], ['b', 'Paiement refusé'], ['c', 'Carte expirée']]) {
    const r = await call(bruno, 'POST', scenarios(), { title, text: gherkin });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    ids[key] = r.body.id;
  }
  const all = await list(chloe);
  assert.deepEqual(all.map((s) => s.reference), [1, 2, 3].map((n) => `${scCode}-${scenarioAcronym}-00${n}`));
  assert.deepEqual(all.map((s) => s.id), [ids.a, ids.b, ids.c]);
  assert.equal(all[0].text, gherkin);
});
await check('titre obligatoire ; texte de 10 000 caractères au plus ; un texte qui n’est pas du Gherkin s’enregistre', async () => {
  assert.equal((await call(alice, 'POST', scenarios(), { title: ' ', text: gherkin })).status, 400);
  assert.equal((await call(alice, 'POST', scenarios(), { title: 'Long', text: 'x'.repeat(10_001) })).status, 400);
  const r = await call(alice, 'POST', scenarios(), { title: 'Pas du Gherkin', text: 'n’importe quoi <<' });
  assert.equal(r.status, 201);
  ids.d = r.body.id;
});
await check('pas de scénario sur une exigence qui n’est pas de solution fonctionnelle : 400 notFunctionalRequirement', async () => {
  const r = await call(alice, 'POST', scenarios(nonFunctionalId), { title: 'Non', text: '' });
  assert.deepEqual([r.status, r.body.refusal], [400, 'notFunctionalRequirement']);
  assert.deepEqual((await call(alice, 'GET', scenarios(nonFunctionalId))).body, []);
});
await check('chloé (lectrice) lit, mais n’écrit pas : 403', async () => {
  assert.equal((await call(chloe, 'GET', scenarios())).status, 200);
  assert.equal((await call(chloe, 'POST', scenarios(), { title: 'Non', text: '' })).status, 403);
  assert.equal((await call(chloe, 'PATCH', scenario(ids.a), { baseRowVersion: 0, title: 'Non' })).status, 403);
  assert.equal((await call(chloe, 'PUT', `${scenarios()}/order`, { scenarioIds: [] })).status, 403);
  assert.equal((await call(chloe, 'DELETE', scenario(ids.a))).status, 403);
});
await check('admin (non-membre) ne voit, ne crée, ne modifie ni ne supprime aucun scénario : 404', async () => {
  assert.equal((await call(admin, 'GET', scenarios())).status, 404);
  assert.equal((await call(admin, 'POST', scenarios(), { title: 'Non', text: '' })).status, 404);
  assert.equal((await call(admin, 'PATCH', scenario(ids.a), { baseRowVersion: 0, title: 'Non' })).status, 404);
  assert.equal((await call(admin, 'PUT', `${scenarios()}/order`, { scenarioIds: [] })).status, 404);
  assert.equal((await call(admin, 'DELETE', scenario(ids.a))).status, 404);
});
await check('ordre réglé à la main : 200 ; un ordre dépassé (scénario en plus ou en moins) : 409 scenarioOrderOutdated', async () => {
  const r = await call(bruno, 'PUT', `${scenarios()}/order`, { scenarioIds: [ids.c, ids.a, ids.d, ids.b] });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.map((s) => s.id), [ids.c, ids.a, ids.d, ids.b]);
  // L'ordre ne modifie pas le scénario : son état reste le même.
  assert.ok(r.body.every((s) => s.rowVersion === 0));
  const stale = await call(alice, 'PUT', `${scenarios()}/order`, { scenarioIds: [ids.a, ids.c, ids.b] });
  assert.deepEqual([stale.status, stale.body.refusal], [409, 'scenarioOrderOutdated']);
  assert.deepEqual((await list()).map((s) => s.id), [ids.c, ids.a, ids.d, ids.b]);
});
await check('modification simultanée : la seconde saisie, basée sur un état dépassé, est refusée avec le scénario actuel', async () => {
  const opened = (await list()).find((s) => s.id === ids.a).rowVersion;
  const saved = await call(bruno, 'PATCH', scenario(ids.a), { baseRowVersion: opened, text: 'Quand bruno modifie' });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.rowVersion, opened + 1);
  const refused = await call(alice, 'PATCH', scenario(ids.a), { baseRowVersion: opened, title: 'Version d’alice' });
  assert.deepEqual([refused.status, refused.body.refusal], [409, 'scenarioChangedSince']);
  assert.deepEqual([refused.body.scenario.title, refused.body.scenario.text], ['Paiement accepté', 'Quand bruno modifie']);
  // Rechargé, la modification passe.
  const again = await call(alice, 'PATCH', scenario(ids.a), { baseRowVersion: refused.body.scenario.rowVersion, title: 'Version d’alice' });
  assert.equal(again.status, 200);
  assert.equal(again.body.title, 'Version d’alice');
});
await check('deux enregistrements arrivés en même temps sur le même état : l’un passe (200), l’autre est refusé (409)', async () => {
  for (let round = 0; round < 5; round++) {
    const opened = (await list()).find((s) => s.id === ids.b).rowVersion;
    const results = await Promise.all([
      call(alice, 'PATCH', scenario(ids.b), { baseRowVersion: opened, text: `alice ${round}` }),
      call(bruno, 'PATCH', scenario(ids.b), { baseRowVersion: opened, text: `bruno ${round}` }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  }
});
await check('type et sous-type figés tant que l’exigence a un scénario : 409 typeLockedByScenarios ; le reste se modifie', async () => {
  for (const change of [{ subtype: 'non_functional' }, { type: 'business', subtype: null }]) {
    const r = await call(alice, 'PATCH', requirement(), change);
    assert.deepEqual([r.status, r.body.refusal], [409, 'typeLockedByScenarios'], JSON.stringify(change));
  }
  assert.equal((await call(alice, 'PATCH', requirement(), { title: 'Payer en ligne, carte ou virement' })).status, 200);
  assert.equal((await call(alice, 'PATCH', requirement(), { type: 'solution', subtype: 'functional' })).status, 200);
});
await check('suppression définitive d’un scénario : 204 ; sa référence n’est pas réattribuée', async () => {
  assert.equal((await call(bruno, 'DELETE', scenario(ids.d))).status, 204);
  assert.equal((await call(bruno, 'DELETE', scenario(ids.d))).status, 404);
  const r = await call(bruno, 'POST', scenarios(), { title: 'Après suppression', text: '' });
  assert.equal(r.body.reference, `${scCode}-${scenarioAcronym}-005`);
  ids.e = r.body.id;
  assert.equal((await list()).at(-1).id, ids.e);
});
await check('un scénario d’une autre exigence n’est pas accessible par celle-ci : 404', async () => {
  assert.equal((await call(alice, 'PATCH', `${scenarios(nonFunctionalId)}/${ids.a}`, { baseRowVersion: 0, title: 'Non' })).status, 404);
  assert.equal((await call(alice, 'DELETE', `${scenarios(nonFunctionalId)}/${ids.a}`)).status, 404);
});
await check('initiative archivée : tout membre lit, personne n’écrit (403)', async () => {
  assert.equal((await call(alice, 'PUT', `${base()}/archive`)).status, 200);
  try {
    assert.equal((await call(chloe, 'GET', scenarios())).status, 200);
    assert.equal((await call(alice, 'POST', scenarios(), { title: 'Non', text: '' })).status, 403);
    assert.equal((await call(bruno, 'PATCH', scenario(ids.a), { baseRowVersion: 0, title: 'Non' })).status, 403);
    assert.equal((await call(alice, 'DELETE', scenario(ids.a))).status, 403);
    assert.equal((await call(alice, 'PUT', `${scenarios()}/order`, { scenarioIds: (await list()).map((s) => s.id) })).status, 403);
  } finally {
    assert.equal((await call(alice, 'DELETE', `${base()}/archive`)).status, 200);
  }
});

console.log('\nScénarios Gherkin — barrière 2 : base de données (RLS, compte applicatif)');
const insert = (sub, requirementId = functionalId) =>
  asUserInDb(
    sub,
    `INSERT INTO gherkin_scenario (id, initiative_id, requirement_id, title, text, reference, position)
     VALUES (gen_random_uuid(), $1, $2, 'Via SQL', '', 'FAUX', 99) RETURNING reference, position`,
    [scInitiativeId, requirementId],
  );

await check('contributeur : la référence et la place (en dernier) sont posées par la base, pas par la requête', async () => {
  const r = await insert(bruno.sub);
  assert.match(r.rows[0].reference, new RegExp(`^${scCode}-${scenarioAcronym}-\\d{3}$`));
  const last = await asUserInDb(bruno.sub, 'SELECT max(position) AS max FROM gherkin_scenario WHERE requirement_id = $1', [functionalId]);
  assert.equal(r.rows[0].position, last.rows[0].max + 1);
});
await check('propriétaire et contributeur écrivent ; lectrice et non-membre, non', async () => {
  for (const u of [alice, bruno]) {
    assert.equal((await insert(u.sub)).rowCount, 1);
    assert.equal((await asUserInDb(u.sub, `UPDATE gherkin_scenario SET title = 'Oui' WHERE id = $1`, [ids.a])).rowCount, 1);
    assert.equal((await asUserInDb(u.sub, 'DELETE FROM gherkin_scenario WHERE id = $1', [ids.a])).rowCount, 1);
  }
  await assert.rejects(insert(chloe.sub), /row-level security/);
  assert.equal((await asUserInDb(chloe.sub, `UPDATE gherkin_scenario SET title = 'Non' WHERE id = $1`, [ids.a])).rowCount, 0);
  assert.equal((await asUserInDb(chloe.sub, 'DELETE FROM gherkin_scenario WHERE id = $1', [ids.a])).rowCount, 0);
  assert.equal((await asUserInDb(chloe.sub, 'SELECT 1 FROM gherkin_scenario WHERE id = $1', [ids.a])).rowCount, 1);
  assert.equal((await asUserInDb(admin.sub, 'SELECT 1 FROM gherkin_scenario WHERE id = $1', [ids.a])).rowCount, 0);
});
await check('la base refuse un scénario sur une exigence non fonctionnelle, et le déplacement vers une autre exigence', async () => {
  await assert.rejects(insert(alice.sub, nonFunctionalId), /solution fonctionnelle/);
  await assert.rejects(
    asUserInDb(alice.sub, 'UPDATE gherkin_scenario SET requirement_id = $1 WHERE id = $2', [nonFunctionalId, ids.a]),
    /ne change pas d’exigence/,
  );
});
await check('la base refuse un texte de plus de 10 000 caractères, et un changement de type de l’exigence', async () => {
  await assert.rejects(
    asUserInDb(alice.sub, 'UPDATE gherkin_scenario SET text = $1 WHERE id = $2', ['x'.repeat(10_001), ids.a]),
    /gherkin_scenario_text_check/,
  );
  await assert.rejects(
    asUserInDb(alice.sub, `UPDATE requirement SET subtype = 'non_functional' WHERE id = $1`, [functionalId]),
    /requirement_type_locked_by_scenarios|type ne change pas/,
  );
});
await check('la base tient l’état du scénario : il change avec le titre ou le texte, pas avec l’ordre', async () => {
  const r = await asUserInDb(
    alice.sub,
    `WITH a AS (UPDATE gherkin_scenario SET position = 7 WHERE id = $1 RETURNING row_version) SELECT row_version FROM a`,
    [ids.a],
  );
  const before = (await list()).find((s) => s.id === ids.a).rowVersion;
  assert.equal(r.rows[0].row_version, before);
  const t = await asUserInDb(alice.sub, `UPDATE gherkin_scenario SET text = 'autre', row_version = 0 WHERE id = $1 RETURNING row_version`, [ids.a]);
  assert.equal(t.rows[0].row_version, before + 1);
});
await check('initiative archivée : la base refuse toute écriture, même au propriétaire', async () => {
  assert.equal((await call(alice, 'PUT', `${base()}/archive`)).status, 200);
  try {
    await assert.rejects(insert(alice.sub), /row-level security/);
    assert.equal((await asUserInDb(alice.sub, `UPDATE gherkin_scenario SET title = 'Non' WHERE id = $1`, [ids.a])).rowCount, 0);
    assert.equal((await asUserInDb(alice.sub, 'DELETE FROM gherkin_scenario WHERE id = $1', [ids.a])).rowCount, 0);
    assert.equal((await asUserInDb(alice.sub, 'UPDATE gherkin_scenario SET position = 9 WHERE id = $1', [ids.a])).rowCount, 0);
  } finally {
    assert.equal((await call(alice, 'DELETE', `${base()}/archive`)).status, 200);
  }
});

console.log('\nScénarios Gherkin — suppression de l’exigence');
await check('supprimer l’exigence supprime ses scénarios ; leurs références ne sont pas réattribuées', async () => {
  const before = await list();
  assert.ok(before.length > 0);
  assert.equal((await call(alice, 'DELETE', requirement())).status, 204);
  assert.equal((await asUserInDb(alice.sub, 'SELECT 1 FROM gherkin_scenario WHERE requirement_id = $1', [functionalId])).rowCount, 0);
  const next = (await call(alice, 'POST', `${base()}/requirements`, solution('functional', 'Autre'))).body.id;
  const r = await call(alice, 'POST', scenarios(next), { title: 'Nouveau', text: '' });
  assert.ok(!before.some((s) => s.reference === r.body.reference));
});
