import { assert, check, call, asUserInDb, alice, bruno, chloe, admin, code } from './commun.mjs';

// Contexte et langue de la Fonctionnalité (phase 3, ticket 02 ; décisions D2, D3,
// D5, D12, D14, D17). alice propriétaire, bruno contributeur, chloé lectrice ;
// admin n'est pas membre.
console.log('\nContexte et langue — barrière 1 : API (guards NestJS)');
export let clInitiativeId;
const clCode = `${code.slice(0, 8)}CL`;
let needId;
let functionalId;
let otherFunctionalId;
let nonFunctionalId;
const base = () => `/initiatives/${clInitiativeId}`;
const requirement = (id = functionalId) => `${base()}/requirements/${id}`;
const feature = (id = functionalId) => `${requirement(id)}/feature`;
const background = (id = functionalId) => `${feature(id)}/background`;
const language = (id = functionalId) => `${feature(id)}/language`;
const solution = (subtype, title) => ({ title, statement: 'Énoncé.', type: 'solution', subtype, needIds: [needId] });
const steps = '  Étant donné un client connu\n    | nom   |\n    | Marie |';
let opened;

await check('alice crée l’initiative, invite bruno et chloé ; un besoin, deux exigences fonctionnelles et une non fonctionnelle', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: clCode, name: 'Contexte et langue' });
  assert.equal(r.status, 201);
  clInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `${base()}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `${base()}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
  needId = (await call(alice, 'POST', `${base()}/needs`, { title: 'Paiement', nature: 'problem' })).body.id;
  functionalId = (await call(alice, 'POST', `${base()}/requirements`, solution('functional', 'Payer en ligne'))).body.id;
  otherFunctionalId = (await call(alice, 'POST', `${base()}/requirements`, solution('functional', 'Rembourser'))).body.id;
  nonFunctionalId = (await call(alice, 'POST', `${base()}/requirements`, solution('non_functional', 'Temps de réponse'))).body.id;
});
await check('sans scénario ni Contexte, la langue n’est pas fixée ; la changer est refusé : 409 featureLanguageNotSet', async () => {
  assert.deepEqual((await call(chloe, 'GET', feature())).body, { language: null, background: null });
  const r = await call(alice, 'PUT', language(), { language: 'en' });
  assert.deepEqual([r.status, r.body.refusal], [409, 'featureLanguageNotSet']);
});
await check('bruno (contributeur) crée le Contexte, sans scénario : la langue est fixée à celle de son écran ; tout membre le lit', async () => {
  const r = await call(bruno, 'PUT', background(), { baseRowVersion: null, text: steps, language: 'en' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.language, 'en');
  assert.equal(r.body.background.text, steps);
  assert.equal(r.body.background.rowVersion, 0);
  const read = (await call(chloe, 'GET', feature())).body;
  assert.deepEqual([read.language, read.background.text], ['en', steps]);
  opened = read.background.rowVersion;
});
await check('la langue fixée ne change pas à la création d’un scénario dans une autre langue', async () => {
  assert.equal((await call(alice, 'POST', `${requirement()}/scenarios`, { title: 'Payer', text: '', language: 'fr' })).status, 201);
  assert.equal((await call(alice, 'GET', feature())).body.language, 'en');
});
await check('alice et bruno changent la langue, sans traduire aucun texte ; une langue inconnue : 400', async () => {
  const r = await call(alice, 'PUT', language(), { language: 'fr' });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.language, r.body.background.text], ['fr', steps]);
  assert.equal((await call(bruno, 'PUT', language(), { language: 'en' })).body.language, 'en');
  assert.equal((await call(bruno, 'PUT', language(), { language: 'de' })).status, 400);
  // Le changement de langue ne touche pas l'état du Contexte (D13, D14).
  assert.equal((await call(bruno, 'GET', feature())).body.background.rowVersion, opened);
});
await check('le premier scénario fixe la langue à la langue enregistrée de son auteur quand l’écran n’en donne pas', async () => {
  const me = (await call(bruno, 'GET', '/me')).body.locale;
  try {
    assert.equal((await call(bruno, 'PATCH', '/me', { locale: 'en' })).status, 200);
    assert.equal((await call(bruno, 'POST', `${requirement(otherFunctionalId)}/scenarios`, { title: 'Rembourser', text: '' })).status, 201);
    assert.equal((await call(bruno, 'GET', feature(otherFunctionalId))).body.language, 'en');
  } finally {
    await asUserInDb(bruno.sub, 'UPDATE app_user SET locale = $1 WHERE id = $2', [me, bruno.sub]);
  }
});
await check('un Contexte au plus : une seconde création est refusée, avec le Contexte actuel (409 backgroundChangedSince)', async () => {
  const r = await call(alice, 'PUT', background(), { baseRowVersion: null, text: 'Étant donné autre chose' });
  assert.deepEqual([r.status, r.body.refusal], [409, 'backgroundChangedSince']);
  assert.equal(r.body.background.text, steps);
});
await check('Contexte : 10 000 caractères au plus, jamais vide, sans titre ; un texte qui n’est pas du Gherkin s’enregistre', async () => {
  assert.equal((await call(alice, 'PUT', background(), { baseRowVersion: opened, text: 'x'.repeat(10_001) })).status, 400);
  assert.equal((await call(alice, 'PUT', background(), { baseRowVersion: opened, text: '  \n ' })).status, 400);
  const r = await call(alice, 'PUT', background(), { baseRowVersion: opened, text: 'n’importe quoi <<', title: 'Ignoré' });
  assert.equal(r.status, 200);
  assert.equal(r.body.background.rowVersion, opened + 1);
  assert.ok(!('title' in r.body.background) && !('reference' in r.body.background));
  opened = r.body.background.rowVersion;
});
await check('modification simultanée : la seconde saisie, basée sur un état dépassé, est refusée avec le Contexte actuel', async () => {
  const saved = await call(bruno, 'PUT', background(), { baseRowVersion: opened, text: steps });
  assert.equal(saved.status, 200);
  const refused = await call(alice, 'PUT', background(), { baseRowVersion: opened, text: 'Version d’alice' });
  assert.deepEqual([refused.status, refused.body.refusal], [409, 'backgroundChangedSince']);
  assert.equal(refused.body.background.text, steps);
  const again = await call(alice, 'PUT', background(), { baseRowVersion: refused.body.background.rowVersion, text: 'Version d’alice' });
  assert.equal(again.status, 200);
  opened = again.body.background.rowVersion;
});
await check('deux enregistrements arrivés en même temps sur le même état : l’un passe (200), l’autre est refusé (409)', async () => {
  for (let round = 0; round < 5; round++) {
    const state = (await call(alice, 'GET', feature())).body.background.rowVersion;
    const results = await Promise.all([
      call(alice, 'PUT', background(), { baseRowVersion: state, text: `alice ${round}` }),
      call(bruno, 'PUT', background(), { baseRowVersion: state, text: `bruno ${round}` }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  }
});
await check('ni Contexte ni langue sur une exigence qui n’est pas de solution fonctionnelle : 400 notFunctionalRequirement', async () => {
  const r = await call(alice, 'PUT', background(nonFunctionalId), { baseRowVersion: null, text: steps });
  assert.deepEqual([r.status, r.body.refusal], [400, 'notFunctionalRequirement']);
  assert.deepEqual((await call(alice, 'GET', feature(nonFunctionalId))).body, { language: null, background: null });
  const lang = await call(alice, 'PUT', language(nonFunctionalId), { language: 'en' });
  assert.deepEqual([lang.status, lang.body.refusal], [400, 'notFunctionalRequirement']);
});
await check('chloé (lectrice) lit, mais n’écrit ni le Contexte ni la langue : 403', async () => {
  assert.equal((await call(chloe, 'GET', feature())).status, 200);
  assert.equal((await call(chloe, 'PUT', background(), { baseRowVersion: opened, text: 'Non' })).status, 403);
  assert.equal((await call(chloe, 'DELETE', background())).status, 403);
  assert.equal((await call(chloe, 'PUT', language(), { language: 'fr' })).status, 403);
});
await check('admin (non-membre) ne voit ni n’écrit rien : 404', async () => {
  assert.equal((await call(admin, 'GET', feature())).status, 404);
  assert.equal((await call(admin, 'PUT', background(), { baseRowVersion: opened, text: 'Non' })).status, 404);
  assert.equal((await call(admin, 'DELETE', background())).status, 404);
  assert.equal((await call(admin, 'PUT', language(), { language: 'fr' })).status, 404);
});
await check('initiative archivée : tout membre lit, personne n’écrit (403)', async () => {
  assert.equal((await call(alice, 'PUT', `${base()}/archive`)).status, 200);
  try {
    assert.equal((await call(chloe, 'GET', feature())).status, 200);
    assert.equal((await call(alice, 'PUT', background(), { baseRowVersion: opened, text: 'Non' })).status, 403);
    assert.equal((await call(bruno, 'DELETE', background())).status, 403);
    assert.equal((await call(alice, 'PUT', language(), { language: 'fr' })).status, 403);
  } finally {
    assert.equal((await call(alice, 'DELETE', `${base()}/archive`)).status, 200);
  }
});
await check('un Contexte, même sans scénario, fige le type de l’exigence : 409 typeLockedByScenarios', async () => {
  // Retire le scénario : il ne reste que le Contexte.
  for (const s of (await call(alice, 'GET', `${requirement()}/scenarios`)).body) {
    assert.equal((await call(alice, 'DELETE', `${requirement()}/scenarios/${s.id}`)).status, 204);
  }
  const r = await call(alice, 'PATCH', requirement(), { subtype: 'non_functional' });
  assert.deepEqual([r.status, r.body.refusal], [409, 'typeLockedByScenarios']);
});
await check('bruno supprime le Contexte : 204 ; la langue reste fixée ; le type change de nouveau', async () => {
  assert.equal((await call(bruno, 'DELETE', background())).status, 204);
  assert.equal((await call(bruno, 'DELETE', background())).status, 404);
  assert.deepEqual((await call(chloe, 'GET', feature())).body, { language: 'en', background: null });
  // Saisie ouverte avant la suppression : refusée, le Contexte actuel est absent.
  const stale = await call(alice, 'PUT', background(), { baseRowVersion: opened, text: 'Trop tard' });
  assert.deepEqual([stale.status, stale.body.refusal, stale.body.background], [409, 'backgroundChangedSince', null]);
  assert.equal((await call(alice, 'PATCH', requirement(), { subtype: 'non_functional' })).status, 200);
  assert.equal((await call(alice, 'PATCH', requirement(), { subtype: 'functional' })).status, 200);
  const created = await call(alice, 'PUT', background(), { baseRowVersion: null, text: steps });
  assert.equal(created.status, 200);
  opened = created.body.background.rowVersion;
});

console.log('\nContexte et langue — barrière 2 : base de données (RLS, compte applicatif)');
const insertBackground = (sub, requirementId) =>
  asUserInDb(sub, `INSERT INTO gherkin_background (requirement_id, initiative_id, text) VALUES ($1, $2, 'Via SQL')`, [
    requirementId,
    clInitiativeId,
  ]);

await check('propriétaire et contributeur écrivent le Contexte et la langue ; lectrice et non-membre, non', async () => {
  for (const u of [alice, bruno]) {
    assert.equal((await asUserInDb(u.sub, `UPDATE gherkin_background SET text = 'Oui' WHERE requirement_id = $1`, [functionalId])).rowCount, 1);
    assert.equal((await asUserInDb(u.sub, `UPDATE gherkin_feature SET language = 'fr' WHERE requirement_id = $1`, [functionalId])).rowCount, 1);
  }
  assert.equal((await asUserInDb(chloe.sub, `UPDATE gherkin_background SET text = 'Non' WHERE requirement_id = $1`, [functionalId])).rowCount, 0);
  assert.equal((await asUserInDb(chloe.sub, 'DELETE FROM gherkin_background WHERE requirement_id = $1', [functionalId])).rowCount, 0);
  assert.equal((await asUserInDb(chloe.sub, `UPDATE gherkin_feature SET language = 'en' WHERE requirement_id = $1`, [functionalId])).rowCount, 0);
  assert.equal((await asUserInDb(chloe.sub, 'SELECT 1 FROM gherkin_background WHERE requirement_id = $1', [functionalId])).rowCount, 1);
  assert.equal((await asUserInDb(admin.sub, 'SELECT 1 FROM gherkin_background WHERE requirement_id = $1', [functionalId])).rowCount, 0);
  assert.equal((await asUserInDb(admin.sub, 'SELECT 1 FROM gherkin_feature WHERE requirement_id = $1', [functionalId])).rowCount, 0);
  // Une Fonctionnalité ne se supprime qu'avec son exigence.
  assert.equal((await asUserInDb(alice.sub, 'DELETE FROM gherkin_feature WHERE requirement_id = $1', [functionalId])).rowCount, 0);
});
await check('la base refuse un second Contexte, un Contexte sans Fonctionnalité, vide ou trop long, et une langue inconnue', async () => {
  await assert.rejects(insertBackground(alice.sub, functionalId), /duplicate key|gherkin_background_pkey/);
  const bare = (await call(alice, 'POST', `${base()}/requirements`, solution('functional', 'Sans fonctionnalité'))).body.id;
  await assert.rejects(insertBackground(alice.sub, bare), /gherkin_background_feature_fkey/);
  for (const text of ['  \n ', 'x'.repeat(10_001)]) {
    await assert.rejects(
      asUserInDb(alice.sub, 'UPDATE gherkin_background SET text = $1 WHERE requirement_id = $2', [text, functionalId]),
      /gherkin_background_text_check/,
    );
  }
  await assert.rejects(
    asUserInDb(alice.sub, `UPDATE gherkin_feature SET language = 'de' WHERE requirement_id = $1`, [functionalId]),
    /gherkin_feature_language_check/,
  );
});
await check('la base refuse une Fonctionnalité sur une exigence non fonctionnelle, et un Contexte qui change d’exigence', async () => {
  await assert.rejects(
    asUserInDb(alice.sub, `INSERT INTO gherkin_feature (requirement_id, initiative_id, language) VALUES ($1, $2, 'fr')`, [
      nonFunctionalId,
      clInitiativeId,
    ]),
    /solution fonctionnelle/,
  );
  await assert.rejects(
    asUserInDb(alice.sub, 'UPDATE gherkin_background SET requirement_id = $1 WHERE requirement_id = $2', [otherFunctionalId, functionalId]),
    /ne change pas d’exigence/,
  );
});
await check('la base fige le type d’une exigence qui n’a qu’un Contexte, et tient son état', async () => {
  await assert.rejects(
    asUserInDb(alice.sub, `UPDATE requirement SET subtype = 'non_functional' WHERE id = $1`, [functionalId]),
    /requirement_type_locked_by_scenarios|type ne change pas/,
  );
  const before = (await call(alice, 'GET', feature())).body.background.rowVersion;
  const r = await asUserInDb(
    alice.sub,
    `UPDATE gherkin_background SET text = 'Autre état', row_version = 0 WHERE requirement_id = $1 RETURNING row_version`,
    [functionalId],
  );
  assert.equal(r.rows[0].row_version, before + 1);
});
await check('initiative archivée : la base refuse toute écriture, même au propriétaire', async () => {
  assert.equal((await call(alice, 'PUT', `${base()}/archive`)).status, 200);
  try {
    assert.equal((await asUserInDb(alice.sub, `UPDATE gherkin_background SET text = 'Non' WHERE requirement_id = $1`, [functionalId])).rowCount, 0);
    assert.equal((await asUserInDb(alice.sub, 'DELETE FROM gherkin_background WHERE requirement_id = $1', [functionalId])).rowCount, 0);
    assert.equal((await asUserInDb(alice.sub, `UPDATE gherkin_feature SET language = 'en' WHERE requirement_id = $1`, [functionalId])).rowCount, 0);
  } finally {
    assert.equal((await call(alice, 'DELETE', `${base()}/archive`)).status, 200);
  }
});

console.log('\nContexte et langue — suppression de l’exigence');
await check('supprimer l’exigence supprime son Contexte et sa Fonctionnalité', async () => {
  assert.equal((await call(alice, 'DELETE', requirement())).status, 204);
  assert.equal((await asUserInDb(alice.sub, 'SELECT 1 FROM gherkin_background WHERE requirement_id = $1', [functionalId])).rowCount, 0);
  assert.equal((await asUserInDb(alice.sub, 'SELECT 1 FROM gherkin_feature WHERE requirement_id = $1', [functionalId])).rowCount, 0);
});
