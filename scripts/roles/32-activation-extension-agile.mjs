// Activation de l'Extension Agile sur une initiative (Extension Agile, ticket 03 ;
// D10 à D12). alice propriétaire, bruno contributeur, chloé lectrice.
import { assert, check, call, asUserInDb, alice, bruno, chloe, code } from './commun.mjs';

console.log('\nActivation de l’Extension Agile — barrière 1 : API (guards NestJS)');
export let aeInitiativeId;
const aeCode = `${code.slice(0, 8)}AE`;
const path = () => `/initiatives/${aeInitiativeId}`;
const disableInDb = `UPDATE initiative SET agile_extension_enabled = false WHERE id = $1`;
const enabled = async (user) => (await call(user, 'GET', path())).body.agileExtensionEnabled;

await check('à la création, l’Extension Agile est désactivée, même demandée dans le formulaire (D10)', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: aeCode, name: 'Activation agile', agileExtensionEnabled: true });
  assert.equal(r.status, 201);
  assert.equal(r.body.agileExtensionEnabled, false);
  aeInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `${path()}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `${path()}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
});
await check('valeur non booléenne refusée (schéma partagé) : 400', async () => {
  assert.equal((await call(alice, 'PATCH', path(), { agileExtensionEnabled: 'oui' })).status, 400);
});
await check('chloé (lectrice) voit le champ mais ne l’active pas : 403', async () => {
  assert.equal(await enabled(chloe), false);
  assert.equal((await call(chloe, 'PATCH', path(), { agileExtensionEnabled: true })).status, 403);
});
await check('bruno (contributeur) ne l’active pas : 403', async () => {
  assert.equal((await call(bruno, 'PATCH', path(), { agileExtensionEnabled: true })).status, 403);
  assert.equal(await enabled(alice), false);
});
await check('bruno (contributeur) peut renvoyer la valeur inchangée avec la fiche : 200', async () => {
  assert.equal((await call(bruno, 'PATCH', path(), { name: 'Renommée', agileExtensionEnabled: false })).status, 200);
});
await check('alice (propriétaire) l’active sur une initiative prédictive (D12) : 200', async () => {
  assert.equal((await call(alice, 'PATCH', path(), { analysisApproach: 'predictive' })).status, 200);
  const r = await call(alice, 'PATCH', path(), { agileExtensionEnabled: true });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.agileExtensionEnabled, r.body.analysisApproach], [true, 'predictive']);
  assert.equal(await enabled(chloe), true);
});
await check('changer l’approche d’analyse ne touche pas l’Extension Agile (D12)', async () => {
  const r = await call(bruno, 'PATCH', path(), { analysisApproach: 'adaptive' });
  assert.equal(r.status, 200);
  assert.equal(r.body.agileExtensionEnabled, true);
});
await check('bruno (contributeur) ne la désactive pas : 403', async () => {
  assert.equal((await call(bruno, 'PATCH', path(), { agileExtensionEnabled: false })).status, 403);
});
await check('archivée : alice (propriétaire) ne la change plus : 403 (D11)', async () => {
  assert.equal((await call(alice, 'PUT', `${path()}/archive`)).status, 200);
  assert.equal((await call(alice, 'PATCH', path(), { agileExtensionEnabled: false })).status, 403);
  assert.equal(await enabled(chloe), true);
});

console.log('\nActivation de l’Extension Agile — barrière 2 : base de données (RLS, compte applicatif)');
// L'initiative est encore archivée (barrière 1).
await check('archivée : alice (propriétaire) : changement refusé', async () => {
  await assert.rejects(
    asUserInDb(alice.sub, disableInDb, [aeInitiativeId]),
    /lecture seule/,
  );
});
await check('alice (propriétaire) désarchive par l’API : 200', async () => {
  assert.equal((await call(alice, 'DELETE', `${path()}/archive`)).status, 200);
});
await check('bruno (contributeur) : changement refusé', async () => {
  await assert.rejects(
    asUserInDb(bruno.sub, disableInDb, [aeInitiativeId]),
    /propriétaire/,
  );
});
await check('chloé (lectrice) : UPDATE sans effet', async () => {
  const r = await asUserInDb(chloe.sub, disableInDb, [aeInitiativeId]);
  assert.equal(r.rowCount, 0);
});
await check('alice (propriétaire) : désactivation acceptée', async () => {
  const r = await asUserInDb(alice.sub, disableInDb, [aeInitiativeId]);
  assert.equal(r.rowCount, 1);
});
await check('alice (propriétaire) la désactive par l’API : 200', async () => {
  const r = await call(alice, 'PATCH', path(), { agileExtensionEnabled: false });
  assert.equal(r.status, 200);
  assert.equal(r.body.agileExtensionEnabled, false);
});
// Une colonne ajoutée NOT NULL DEFAULT false prend la valeur false sur toutes
// les lignes existantes. On vérifie la colonne plutôt que les données : une
// initiative réelle peut avoir été activée depuis la migration.
await check('les initiatives existantes ont l’Extension Agile désactivée : colonne non nulle, false par défaut (D10)', async () => {
  const r = await asUserInDb(
    alice.sub,
    `SELECT column_default, is_nullable FROM information_schema.columns
     WHERE table_name = 'initiative' AND column_name = 'agile_extension_enabled'`,
    [],
  );
  assert.deepEqual(r.rows, [{ column_default: 'false', is_nullable: 'NO' }]);
});
