import { assert, check, call, asUserInDb, login, alice, bruno, chloe, admin, code } from './commun.mjs';
import { otherInitiativeId } from './01-initiatives.mjs';

// Administration des comptes (ticket 05, ADR-0005). Initiative propre à cette
// section : alice propriétaire et BA, bruno contributeur, chloé lectrice.
console.log('\nAdministration — barrière 1 : API (guards NestJS)');
export const accounts = '/admin/accounts';
export const orphans = '/admin/orphan-initiatives';
export const account = (u) => `${accounts}/${u.sub}`;
export const designate = (id, u) => call(admin, 'POST', `${orphans}/${id}/owner-designations`, { userId: u.sub });
export const isOrphan = async (id) => (await call(admin, 'GET', orphans)).body.some((i) => i.id === id);
export let orphanId;
await check('alice (non administratrice) n’accède pas à l’administration : 403', async () => {
  assert.equal((await call(alice, 'GET', accounts)).status, 403);
  assert.equal((await call(alice, 'GET', orphans)).status, 403);
  assert.equal((await call(alice, 'PATCH', account(bruno), { enabled: false })).status, 403);
});
await check('/me indique le rôle administrateur', async () => {
  assert.equal((await call(admin, 'GET', '/me')).body.isAdmin, true);
  assert.equal((await call(alice, 'GET', '/me')).body.isAdmin, false);
});
await check('admin liste les comptes, avec leur rôle administrateur', async () => {
  const r = await call(admin, 'GET', accounts);
  assert.equal(r.status, 200);
  assert.equal(r.body.find((a) => a.id === alice.sub)?.isAdmin, false);
  assert.equal(r.body.find((a) => a.id === admin.sub)?.isAdmin, true);
});
// Un compte n'est jamais supprimé : « dora » est créée au premier passage, puis réutilisée.
export let dora;
await check('admin crée le compte dora (mot de passe temporaire)', async () => {
  const input = { username: 'dora', email: 'dora@exemple.test', firstName: 'Dora', lastName: 'Nouvelle', temporaryPassword: 'Temp1234!' };
  const r = await call(admin, 'POST', accounts, input);
  assert.ok([201, 409].includes(r.status), `statut ${r.status}`);
  const again = await call(admin, 'POST', accounts, input);
  assert.equal(again.status, 409);
  assert.equal(again.body.refusal, 'accountExists');
  dora = (await call(admin, 'GET', accounts)).body.find((a) => a.username === 'dora');
  assert.equal(dora?.enabled, true);
  assert.equal(dora?.email, 'dora@exemple.test');
});
await check('création sans mot de passe temporaire refusée (schéma partagé) : 400', async () => {
  assert.equal((await call(admin, 'POST', accounts, { username: 'eve', email: 'eve@exemple.test', firstName: 'Eve', lastName: 'X' })).status, 400);
});
await check('mot de passe temporaire de moins de 6 caractères refusé (schéma partagé) : 400', async () => {
  assert.equal((await call(admin, 'POST', accounts, { username: 'eve', email: 'eve@exemple.test', firstName: 'Eve', lastName: 'X', temporaryPassword: '12345' })).status, 400);
});
await check('admin donne puis retire le rôle administrateur à dora', async () => {
  assert.equal((await call(admin, 'PATCH', `${accounts}/${dora.id}`, { isAdmin: true })).body.isAdmin, true);
  assert.equal((await call(admin, 'PATCH', `${accounts}/${dora.id}`, { isAdmin: false })).body.isAdmin, false);
});
await check('admin ne se désactive pas et ne se retire pas le rôle : 403', async () => {
  const disable = await call(admin, 'PATCH', account(admin), { enabled: false });
  assert.equal(disable.status, 403);
  assert.equal(disable.body.refusal, 'self');
  assert.equal((await call(admin, 'PATCH', account(admin), { isAdmin: false })).body.refusal, 'self');
});
await check('rôle retiré : bruno, avec son ancien jeton d’administrateur, est refusé : 403', async () => {
  assert.equal((await call(admin, 'PATCH', account(bruno), { isAdmin: true })).body.isAdmin, true);
  const staleBruno = await login('bruno');
  assert.equal((await call(admin, 'PATCH', account(bruno), { isAdmin: false })).body.isAdmin, false);
  const r = await call(staleBruno, 'PATCH', account(admin), { isAdmin: false });
  assert.equal(r.status, 403);
  assert.equal(r.body.refusal, 'forbidden');
  assert.equal((await call(admin, 'GET', '/me')).body.isAdmin, true);
});
await check('aucune route de suppression de compte : 404', async () => {
  assert.equal((await call(admin, 'DELETE', `${accounts}/${dora.id}`)).status, 404);
});
await check('alice crée une initiative avec bruno (contributeur) et chloé (lectrice)', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: `${code}O`, name: 'Initiative orpheline' });
  assert.equal(r.status, 201);
  orphanId = r.body.id;
  await call(alice, 'PATCH', `/initiatives/${orphanId}`, { description: 'Contenu confidentiel' });
  assert.equal((await call(alice, 'POST', `/initiatives/${orphanId}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `/initiatives/${orphanId}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
  assert.equal(await isOrphan(orphanId), false);
});
await check('admin désactive alice : elle ne peut plus se connecter', async () => {
  const r = await call(admin, 'PATCH', account(alice), { enabled: false });
  assert.equal(r.status, 200);
  assert.equal(r.body.enabled, false);
  await assert.rejects(login('alice'), /connexion de alice impossible/);
});
await check('l’initiative d’alice est sans propriétaire actif : nom, code et membres seulement', async () => {
  const r = await call(admin, 'GET', orphans);
  const orphan = r.body.find((i) => i.id === orphanId);
  assert.deepEqual(Object.keys(orphan).sort(), ['code', 'id', 'members', 'name']);
  assert.equal(orphan.code, `${code}O`);
  assert.deepEqual(
    orphan.members.map((m) => [m.userId, m.role, m.active]),
    [[alice.sub, 'owner', false], [bruno.sub, 'contributor', true], [chloe.sub, 'reader', true]],
  );
});
await check('admin (non-membre) n’accède toujours pas au contenu : 404', async () => {
  assert.equal((await call(admin, 'GET', `/initiatives/${orphanId}`)).status, 404);
  assert.equal((await call(admin, 'GET', `/initiatives/${orphanId}/members`)).status, 404);
  assert.equal((await call(admin, 'GET', `/initiatives/${orphanId}/owner-designations`)).status, 404);
});
await check('admin ne désigne pas un membre au compte désactivé : 409', async () => {
  assert.equal((await designate(orphanId, alice)).body.refusal, 'inactiveAccount');
});
await check('admin ne désigne pas un non-membre : 404', async () => {
  assert.equal((await designate(orphanId, admin)).status, 404);
});
await check('compte désactivé : bruno (propriétaire) n’invite pas alice : 409', async () => {
  const r = await call(bruno, 'POST', `/initiatives/${otherInitiativeId}/members`, { email: 'alice@exemple.test', role: 'reader' });
  assert.equal(r.status, 409);
  assert.equal(r.body.refusal, 'inactiveAccount');
});
await check('compte désactivé : invitation d’alice refusée en base', async () => {
  await assert.rejects(
    asUserInDb(bruno.sub, `INSERT INTO initiative_member (initiative_id, user_id, role) VALUES ($1, $2, 'reader')`, [otherInitiativeId, alice.sub]),
    /compte désactivé/,
  );
});

console.log('\nAdministration — barrière 2 : base de données (fonctions admin_*, RLS)');
export const asAdminInDb = (sub, query, params) => asUserInDb(sub, query, params, { admin: true });
await check('bruno (non administrateur) : liste des initiatives sans propriétaire refusée', async () => {
  await assert.rejects(asUserInDb(bruno.sub, `SELECT * FROM admin_orphan_initiative_members()`), /réservé à l’administrateur/);
});
await check('bruno (non administrateur) : désignation par l’administrateur refusée', async () => {
  await assert.rejects(
    asUserInDb(bruno.sub, `SELECT admin_designate_owner($1, $2)`, [orphanId, bruno.sub]),
    /réservé à l’administrateur/,
  );
});
await check('bruno (non administrateur) : désactivation d’un compte refusée', async () => {
  await assert.rejects(
    asUserInDb(bruno.sub, `SELECT admin_set_user_deactivated($1, true)`, [chloe.sub]),
    /réservé à l’administrateur/,
  );
});
await check('admin : aucune ligne de contenu visible, même en transaction administrateur', async () => {
  const fiche = await asAdminInDb(admin.sub, `SELECT * FROM initiative WHERE id = $1`, [orphanId]);
  assert.equal(fiche.rowCount, 0);
  const team = await asAdminInDb(admin.sub, `SELECT * FROM initiative_member WHERE initiative_id = $1`, [orphanId]);
  assert.equal(team.rowCount, 0);
});
await check('admin : modification directe de l’équipe sans effet', async () => {
  const r = await asAdminInDb(admin.sub, `UPDATE initiative_member SET role = 'owner' WHERE initiative_id = $1 AND user_id = $2`, [orphanId, bruno.sub]);
  assert.equal(r.rowCount, 0);
});
await check('admin : désignation d’un membre au compte désactivé refusée', async () => {
  await assert.rejects(
    asAdminInDb(admin.sub, `SELECT admin_designate_owner($1, $2)`, [orphanId, alice.sub]),
    /membre au compte actif/,
  );
});
await check('admin : sa propre désactivation refusée', async () => {
  await assert.rejects(
    asAdminInDb(admin.sub, `SELECT admin_set_user_deactivated($1, true)`, [admin.sub]),
    /propre compte/,
  );
});

console.log('\nAdministration — désignation d’un propriétaire');
await check('admin désigne chloé (lectrice) propriétaire : 204', async () => {
  assert.equal((await designate(orphanId, chloe)).status, 204);
  assert.equal((await call(chloe, 'GET', `/initiatives/${orphanId}`)).body.myRole, 'owner');
  assert.equal(await isOrphan(orphanId), false);
});
await check('la désignation par admin est tracée et lisible par les membres', async () => {
  const [latest] = (await call(bruno, 'GET', `/initiatives/${orphanId}/owner-designations`)).body;
  assert.equal(latest.user.userId, chloe.sub);
  assert.equal(latest.designatedBy.userId, admin.sub);
});
await check('propriétaire actif présent : admin ne désigne plus (404, refus en base)', async () => {
  assert.equal((await designate(orphanId, bruno)).status, 404);
  await assert.rejects(
    asAdminInDb(admin.sub, `SELECT admin_designate_owner($1, $2)`, [orphanId, bruno.sub]),
    /propriétaire actif/,
  );
});
await check('archivée et sans propriétaire actif : admin désigne bruno : 204', async () => {
  assert.equal((await call(chloe, 'PUT', `/initiatives/${orphanId}/archive`)).status, 200);
  assert.equal((await call(admin, 'PATCH', account(chloe), { enabled: false })).status, 200);
  assert.equal(await isOrphan(orphanId), true);
  assert.equal((await designate(orphanId, bruno)).status, 204);
  assert.equal((await call(bruno, 'GET', `/initiatives/${orphanId}`)).body.myRole, 'owner');
});
await check('admin réactive alice et chloé : alice se connecte de nouveau', async () => {
  assert.equal((await call(admin, 'PATCH', account(alice), { enabled: true })).body.enabled, true);
  assert.equal((await call(admin, 'PATCH', account(chloe), { enabled: true })).body.enabled, true);
  assert.ok((await login('alice')).token);
});
