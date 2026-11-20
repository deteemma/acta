import { assert, check, call, asUserInDb, alice, bruno, chloe, admin, code } from './commun.mjs';

// Scénarios dans la palette de recherche (phase 3, ticket 06 ; décision D20).
// alice propriétaire, chloé lectrice ; bruno et admin ne sont pas membres.
console.log('\nScénarios dans la palette — barrière 1 : API (guards NestJS)');
export let spInitiativeId;
const spCode = `${code.slice(0, 8)}SP`;
let functionalId;
let scenarioId;
const base = () => `/initiatives/${spInitiativeId}`;
const found = async (user) => (await call(user, 'GET', '/references')).body.find((r) => r.id === scenarioId);

await check('alice crée l’initiative, invite chloé ; une exigence fonctionnelle et un scénario', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: spCode, name: 'Scénarios dans la palette' });
  assert.equal(r.status, 201);
  spInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `${base()}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
  const needId = (await call(alice, 'POST', `${base()}/needs`, { title: 'Paiement', nature: 'problem' })).body.id;
  const req = { title: 'Payer en ligne', statement: 'Énoncé.', type: 'solution', subtype: 'functional', needIds: [needId] };
  functionalId = (await call(alice, 'POST', `${base()}/requirements`, req)).body.id;
  const s = await call(alice, 'POST', `${base()}/requirements/${functionalId}/scenarios`, { title: 'Paiement accepté', text: '' });
  assert.equal(s.status, 201);
  scenarioId = s.body.id;
});
await check('chloé (lectrice) trouve le scénario dans les références, avec son exigence', async () => {
  const r = await found(chloe);
  assert.ok(r, 'scénario absent des références');
  assert.equal(r.category, 'scenario');
  assert.match(r.reference, new RegExp(`^${spCode}-[A-Z]+-001$`));
  assert.deepEqual([r.title, r.initiativeId, r.initiativeArchived], ['Paiement accepté', spInitiativeId, false]);
  assert.deepEqual(r.scenario, { requirementId: functionalId });
  assert.equal(r.requirement, null);
});
await check('bruno et admin (non-membres) ne trouvent pas le scénario', async () => {
  assert.equal(await found(bruno), undefined);
  assert.equal(await found(admin), undefined);
});
await check('le scénario d’une initiative archivée reste trouvé, signalé archivé', async () => {
  assert.equal((await call(alice, 'PUT', `${base()}/archive`)).status, 200);
  assert.equal((await found(chloe))?.initiativeArchived, true);
  assert.equal((await call(alice, 'DELETE', `${base()}/archive`)).status, 200);
});

console.log('\nScénarios dans la palette — barrière 2 : base (RLS PostgreSQL)');
await check('bruno (non-membre) ne lit pas le scénario en base, chloé (lectrice) le lit', async () => {
  const query = 'SELECT reference FROM gherkin_scenario WHERE id = $1';
  assert.equal((await asUserInDb(bruno.sub, query, [scenarioId])).rowCount, 0);
  assert.equal((await asUserInDb(chloe.sub, query, [scenarioId])).rowCount, 1);
});
