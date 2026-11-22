// Technique agile d'une action (Extension Agile, ticket 04 ; D13 à D16).
// alice propriétaire, bruno contributeur, chloé lectrice.
import { assert, check, call, asUserInDb, alice, bruno, chloe, code } from './commun.mjs';

console.log('\nTechnique agile d’une action — barrière 1 : API (guards NestJS)');
export let taInitiativeId;
let brunoActionId;
let suggestedActionId;
const path = () => `/initiatives/${taInitiativeId}`;
const actions = () => `${path()}/actions`;
const actionPath = (id) => `${actions()}/${id}`;
const setModule = (enabled) => call(alice, 'PATCH', path(), { agileExtensionEnabled: enabled });

await check('alice crée l’initiative et invite bruno (contributeur) et chloé (lectrice)', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}TA`, name: 'Technique agile' });
  assert.equal(r.status, 201);
  taInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `${path()}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `${path()}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
});
await check('module désactivé : bruno ne pose pas de technique agile à la création (D6, D14)', async () => {
  const r = await call(bruno, 'POST', actions(), { title: 'Rétro', taskId: '4.1', agileTechniqueId: 'ae-7.15' });
  assert.deepEqual([r.status, r.body.refusal], [400, 'agileExtensionDisabled']);
});
await check('module désactivé : l’action indique que le champ est masqué, sans technique agile', async () => {
  const r = await call(bruno, 'POST', actions(), { title: 'Rétro', taskId: '4.1' });
  assert.equal(r.status, 201);
  assert.deepEqual([r.body.agileTechniqueId, r.body.initiative.agileExtensionEnabled], [null, false]);
  brunoActionId = r.body.id;
});
await check('module désactivé : bruno ne pose pas de technique agile en modification', async () => {
  const r = await call(bruno, 'PATCH', actionPath(brunoActionId), { agileTechniqueId: 'ae-7.15' });
  assert.deepEqual([r.status, r.body.refusal], [400, 'agileExtensionDisabled']);
});
await check('alice active le module : 200', async () => {
  assert.equal((await setModule(true)).status, 200);
  assert.equal((await call(chloe, 'GET', actionPath(brunoActionId))).body.initiative.agileExtensionEnabled, true);
});
await check('bruno (contributeur) crée une action avec technique BABOK et technique agile : 201 (D14, D16)', async () => {
  const r = await call(bruno, 'POST', actions(), {
    title: 'Revue de sprint',
    taskId: '4.1',
    techniqueId: '10.37',
    agileTechniqueId: 'ae-7.16',
  });
  assert.equal(r.status, 201);
  assert.deepEqual([r.body.techniqueId, r.body.agileTechniqueId], ['10.37', 'ae-7.16']);
});
await check('technique agile inconnue du référentiel : 400', async () => {
  const r = await call(bruno, 'PATCH', actionPath(brunoActionId), { agileTechniqueId: 'ae-7.99' });
  assert.deepEqual([r.status, r.body.refusal], [400, 'unknownBabokElement']);
});
await check('identifiant BABOK à la place d’une technique agile (schéma partagé) : 400', async () => {
  assert.equal((await call(bruno, 'PATCH', actionPath(brunoActionId), { agileTechniqueId: '10.37' })).status, 400);
});
await check('bruno (contributeur) pose une technique agile en modification : 200, dans l’historique (D16)', async () => {
  const r = await call(bruno, 'PATCH', actionPath(brunoActionId), { agileTechniqueId: 'ae-7.15' });
  assert.equal(r.status, 200);
  assert.equal(r.body.agileTechniqueId, 'ae-7.15');
  const history = (await call(alice, 'GET', `${actionPath(brunoActionId)}/history`)).body;
  const last = history.at(-1);
  assert.deepEqual([last.before.agileTechniqueId, last.after.agileTechniqueId, last.changedBy.userId], [null, 'ae-7.15', bruno.sub]);
});
await check('chloé (lectrice) voit la technique agile mais ne la change pas : 403', async () => {
  assert.equal((await call(chloe, 'GET', actionPath(brunoActionId))).body.agileTechniqueId, 'ae-7.15');
  assert.equal((await call(chloe, 'PATCH', actionPath(brunoActionId), { agileTechniqueId: null })).status, 403);
  assert.equal((await call(chloe, 'POST', actions(), { title: 'Lecture', taskId: '4.1', agileTechniqueId: 'ae-7.15' })).status, 403);
});
await check('création depuis une action suggérée avec technique agile : 400 (D16)', async () => {
  const r = await call(bruno, 'POST', actions(), { title: 'Planifier', taskId: '3.1', suggestionKey: 'R2', agileTechniqueId: 'ae-7.15' });
  assert.equal(r.status, 400);
});
await check('créée depuis une action suggérée, sans technique agile, elle en reçoit une ensuite : 200 (D16)', async () => {
  const created = await call(bruno, 'POST', actions(), { title: 'Planifier', taskId: '3.1', suggestionKey: 'R2' });
  assert.equal(created.status, 201);
  assert.equal(created.body.agileTechniqueId, null);
  suggestedActionId = created.body.id;
  const r = await call(alice, 'PATCH', actionPath(suggestedActionId), { agileTechniqueId: 'ae-7.10' });
  assert.deepEqual([r.status, r.body.agileTechniqueId], [200, 'ae-7.10']);
});
await check('Terminée et Annulée comptent : désactivation refusée avec le nombre d’actions, 3 (D13)', async () => {
  assert.equal((await call(bruno, 'PATCH', actionPath(brunoActionId), { status: 'done' })).status, 200);
  assert.equal((await call(bruno, 'PATCH', actionPath(suggestedActionId), { status: 'cancelled' })).status, 200);
  const r = await setModule(false);
  assert.deepEqual([r.status, r.body.refusal, r.body.count], [400, 'agileTechniquesInUse', 3]);
  assert.equal((await call(alice, 'GET', path())).body.agileExtensionEnabled, true);
});

console.log('\nTechnique agile d’une action — barrière 2 : base de données (RLS, compte applicatif)');
const disableInDb = `UPDATE initiative SET agile_extension_enabled = false WHERE id = $1`;
await check('alice (propriétaire) : désactivation refusée tant qu’une action porte une technique agile (D13)', async () => {
  await assert.rejects(asUserInDb(alice.sub, disableInDb, [taInitiativeId]), /technique agile/);
});
await check('création depuis une action suggérée avec technique agile : refusée (D16)', async () => {
  await assert.rejects(
    asUserInDb(
      bruno.sub,
      `INSERT INTO ticket (id, initiative_id, type, title, task_id, assignee_id, suggestion_key, agile_technique_id)
       VALUES (gen_random_uuid(), $1, 'action', 'Suggérée', '3.1', $2, 'R2', 'ae-7.15')`,
      [taInitiativeId, bruno.sub],
    ),
    /action suggérée/,
  );
});
await check('technique agile sur un autre type de ticket : refusée', async () => {
  await assert.rejects(
    asUserInDb(
      bruno.sub,
      `INSERT INTO ticket (id, initiative_id, type, title, agile_technique_id) VALUES (gen_random_uuid(), $1, 'question', 'Question', 'ae-7.15')`,
      [taInitiativeId],
    ),
    /ticket_action_fields/,
  );
});
await check('chloé (lectrice) : modification sans effet', async () => {
  const r = await asUserInDb(chloe.sub, `UPDATE ticket SET agile_technique_id = NULL WHERE initiative_id = $1`, [taInitiativeId]);
  assert.equal(r.rowCount, 0);
});

console.log('\nTechnique agile d’une action — désactivation après retrait');
await check('techniques agiles retirées : alice désactive le module (D13)', async () => {
  for (const r of (await call(alice, 'GET', actions())).body.filter((a) => a.agileTechniqueId)) {
    assert.equal((await call(alice, 'PATCH', actionPath(r.id), { agileTechniqueId: null })).status, 200);
  }
  const r = await setModule(false);
  assert.deepEqual([r.status, r.body.agileExtensionEnabled], [200, false]);
});
await check('module désactivé : la base refuse une technique agile (D14)', async () => {
  await assert.rejects(
    asUserInDb(bruno.sub, `UPDATE ticket SET agile_technique_id = 'ae-7.15' WHERE id = $1`, [brunoActionId]),
    /Extension Agile désactivée/,
  );
});
await check('module désactivé : retirer ou garder « Aucune » reste permis', async () => {
  assert.equal((await call(bruno, 'PATCH', actionPath(brunoActionId), { agileTechniqueId: null, title: 'Rétro terminée' })).status, 200);
});

console.log('\nTechnique agile d’une action — initiative archivée');
await check('archivée : alice (propriétaire) ne change plus la technique agile : 403', async () => {
  assert.equal((await setModule(true)).status, 200);
  assert.equal((await call(alice, 'PUT', `${path()}/archive`)).status, 200);
  assert.equal((await call(alice, 'PATCH', actionPath(brunoActionId), { agileTechniqueId: 'ae-7.15' })).status, 403);
  assert.equal((await call(bruno, 'POST', actions(), { title: 'Archivée', taskId: '4.1', agileTechniqueId: 'ae-7.15' })).status, 403);
});
await check('archivée : la base ignore la modification de la technique agile', async () => {
  const r = await asUserInDb(alice.sub, `UPDATE ticket SET agile_technique_id = 'ae-7.15' WHERE id = $1`, [brunoActionId]);
  assert.equal(r.rowCount, 0);
});
