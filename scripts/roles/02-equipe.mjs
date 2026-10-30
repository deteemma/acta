import { assert, check, call, asUserInDb, alice, bruno, chloe, admin } from './commun.mjs';
import { initiativeId } from './01-initiatives.mjs';

// Équipe de l'initiative (ticket 04, ADR-0015). État de départ : alice
// propriétaire et BA de l'équipe, bruno contributeur, chloé lectrice.
export const members = `/initiatives/${initiativeId}/members`;
export const member = (u) => `${members}/${u.sub}`;
export const designations = `/initiatives/${initiativeId}/owner-designations`;

console.log('\nÉquipe — barrière 1 : API (guards NestJS)');
await check('invitation d’un courriel inconnu : 404', async () => {
  const r = await call(alice, 'POST', members, { email: 'inconnu@exemple.test', role: 'reader' });
  assert.equal(r.status, 404);
  assert.equal(r.body.refusal, 'userNotFound');
});
await check('invitation d’un membre déjà présent : 409', async () => {
  const r = await call(alice, 'POST', members, { email: 'bruno@exemple.test', role: 'reader' });
  assert.equal(r.status, 409);
  assert.equal(r.body.refusal, 'alreadyMember');
});
await check('invitation d’un lecteur BA de l’équipe : 409', async () => {
  const r = await call(alice, 'POST', members, { email: 'admin@exemple.test', role: 'reader', isTeamBa: true });
  assert.equal(r.body.refusal, 'readerCannotBeTeamBa');
});
await check('bruno (contributeur, non BA) ne désigne pas de propriétaire : 403', async () => {
  assert.equal((await call(bruno, 'PATCH', member(chloe), { role: 'owner' })).status, 403);
});
await check('bruno (contributeur, non BA) ne retire pas l’indication BA : 403', async () => {
  assert.equal((await call(bruno, 'PATCH', member(alice), { isTeamBa: false })).status, 403);
});
await check('chloé (lectrice) ne change pas un rôle : 403', async () => {
  assert.equal((await call(chloe, 'PATCH', member(bruno), { role: 'reader' })).status, 403);
});
await check('chloé (lectrice) ne retire pas un membre : 403', async () => {
  assert.equal((await call(chloe, 'DELETE', member(bruno))).status, 403);
});
await check('admin (non-membre) ne touche pas à l’équipe : 404', async () => {
  assert.equal((await call(admin, 'PATCH', member(bruno), { role: 'owner' })).status, 404);
  assert.equal((await call(admin, 'DELETE', member(bruno))).status, 404);
  assert.equal((await call(admin, 'GET', designations)).status, 404);
});
await check('modification de membre invalide (rôle et indication ensemble) : 400', async () => {
  assert.equal((await call(alice, 'PATCH', member(bruno), { role: 'owner', isTeamBa: true })).status, 400);
});
await check('un lecteur ne peut pas être BA de l’équipe : 409', async () => {
  const r = await call(alice, 'PATCH', member(chloe), { isTeamBa: true });
  assert.equal(r.status, 409);
  assert.equal(r.body.refusal, 'readerCannotBeTeamBa');
});
await check('alice (dernière propriétaire) ne se rétrograde pas : 409', async () => {
  assert.equal((await call(alice, 'PATCH', member(alice), { role: 'contributor' })).body.refusal, 'lastOwner');
});
await check('alice (dernière propriétaire) ne quitte pas l’initiative : 409', async () => {
  assert.equal((await call(alice, 'DELETE', member(alice))).body.refusal, 'lastOwner');
});
await check('alice (dernière BA) ne se retire pas l’indication : 409', async () => {
  assert.equal((await call(alice, 'PATCH', member(alice), { isTeamBa: false })).body.refusal, 'lastTeamBa');
});

console.log('\nÉquipe — barrière 2 : base de données (RLS et déclencheurs)');
export const memberSql = `WHERE initiative_id = $1 AND user_id = $2`;
await check('bruno (contributeur, non BA) : désignation d’un propriétaire sans effet', async () => {
  const r = await asUserInDb(bruno.sub, `UPDATE initiative_member SET role = 'owner' ${memberSql}`, [initiativeId, chloe.sub]);
  assert.equal(r.rowCount, 0);
});
await check('chloé (lectrice) : retrait d’un autre membre sans effet', async () => {
  const r = await asUserInDb(chloe.sub, `DELETE FROM initiative_member ${memberSql}`, [initiativeId, bruno.sub]);
  assert.equal(r.rowCount, 0);
});
await check('chloé (lectrice) : quitter l’initiative accepté', async () => {
  const r = await asUserInDb(chloe.sub, `DELETE FROM initiative_member ${memberSql}`, [initiativeId, chloe.sub]);
  assert.equal(r.rowCount, 1);
});
await check('alice (dernière propriétaire) : départ refusé', async () => {
  await assert.rejects(
    asUserInDb(alice.sub, `DELETE FROM initiative_member ${memberSql}`, [initiativeId, alice.sub]),
    /au moins un propriétaire/,
  );
});
await check('alice (dernière propriétaire) : rétrogradation refusée', async () => {
  await assert.rejects(
    asUserInDb(alice.sub, `UPDATE initiative_member SET role = 'contributor' ${memberSql}`, [initiativeId, alice.sub]),
    /au moins un propriétaire/,
  );
});
await check('alice (dernière BA) : retrait de l’indication refusé', async () => {
  await assert.rejects(
    asUserInDb(alice.sub, `UPDATE initiative_member SET is_team_ba = false ${memberSql}`, [initiativeId, alice.sub]),
    /au moins un BA/,
  );
});
await check('trace des désignations : écriture directe refusée', async () => {
  await assert.rejects(
    asUserInDb(alice.sub, `INSERT INTO owner_designation (initiative_id, user_id) VALUES ($1, $2)`, [initiativeId, alice.sub]),
    /row-level security/,
  );
});
await check('trace des désignations : lisible par chloé (lectrice), invisible pour admin (non-membre)', async () => {
  const query = `SELECT * FROM owner_designation WHERE initiative_id = $1`;
  assert.ok((await asUserInDb(chloe.sub, query, [initiativeId])).rowCount >= 1);
  assert.equal((await asUserInDb(admin.sub, query, [initiativeId])).rowCount, 0);
});

console.log('\nÉquipe — subsidiarité et transmission');
await check('alice (propriétaire) marque bruno BA de l’équipe : 204', async () => {
  assert.equal((await call(alice, 'PATCH', member(bruno), { isTeamBa: true })).status, 204);
});
await check('bruno (BA) ne passe pas en lecteur sans retrait de l’indication : 409', async () => {
  assert.equal((await call(alice, 'PATCH', member(bruno), { role: 'reader' })).body.refusal, 'removeTeamBaFirst');
});
await check('bruno (BA, contributeur) ne rétrograde ni ne retire alice (propriétaire) : 403', async () => {
  assert.equal((await call(bruno, 'PATCH', member(alice), { role: 'contributor' })).status, 403);
  assert.equal((await call(bruno, 'DELETE', member(alice))).status, 403);
});
await check('bruno (BA, contributeur) : rétrogradation d’alice refusée en base', async () => {
  await assert.rejects(
    asUserInDb(bruno.sub, `UPDATE initiative_member SET role = 'contributor' ${memberSql}`, [initiativeId, alice.sub]),
    /réservé au propriétaire/,
  );
});
await check('bruno (BA, contributeur) : retrait d’alice sans effet en base', async () => {
  const r = await asUserInDb(bruno.sub, `DELETE FROM initiative_member ${memberSql}`, [initiativeId, alice.sub]);
  assert.equal(r.rowCount, 0);
});
await check('alice se retire l’indication (bruno reste BA) : 204', async () => {
  assert.equal((await call(alice, 'PATCH', member(alice), { isTeamBa: false })).status, 204);
});
await check('alice (propriétaire, non BA) ne s’attribue pas l’indication : 403', async () => {
  assert.equal((await call(alice, 'PATCH', member(alice), { isTeamBa: true })).status, 403);
});
await check('alice (propriétaire, non BA) : s’attribuer l’indication refusé en base', async () => {
  await assert.rejects(
    asUserInDb(alice.sub, `UPDATE initiative_member SET is_team_ba = true ${memberSql}`, [initiativeId, alice.sub]),
    /soi-même/,
  );
});
await check('bruno (BA, contributeur) rend l’indication à alice : 204', async () => {
  assert.equal((await call(bruno, 'PATCH', member(alice), { isTeamBa: true })).status, 204);
});
await check('bruno (BA, contributeur) se désigne propriétaire : 204', async () => {
  assert.equal((await call(bruno, 'PATCH', member(bruno), { role: 'owner' })).status, 204);
  assert.equal((await call(bruno, 'GET', `/initiatives/${initiativeId}`)).body.myRole, 'owner');
});
await check('chloé (lectrice) consulte la trace : création et désignation de bruno', async () => {
  const r = await call(chloe, 'GET', designations);
  assert.equal(r.status, 200);
  const [latest] = r.body;
  assert.equal(latest.user.userId, bruno.sub);
  assert.equal(latest.designatedBy.userId, bruno.sub);
  assert.ok(latest.designatedAt);
  assert.ok(r.body.some((d) => d.user.userId === alice.sub && d.designatedBy?.userId === alice.sub));
});
await check('alice transmet la propriété puis quitte l’initiative : 204', async () => {
  assert.equal((await call(alice, 'DELETE', member(alice))).status, 204);
  assert.equal((await call(alice, 'GET', `/initiatives/${initiativeId}`)).status, 404);
});
await check('la trace garde le nom d’alice après son départ', async () => {
  const r = await call(chloe, 'GET', designations);
  assert.equal(r.body.find((d) => d.user.userId === alice.sub)?.user.email, 'alice@exemple.test');
});
await check('bruno (dernier propriétaire) ne quitte pas : 409', async () => {
  assert.equal((await call(bruno, 'DELETE', member(bruno))).body.refusal, 'lastOwner');
});
await check('bruno (propriétaire) invite admin en contributeur BA de l’équipe : 204', async () => {
  const r = await call(bruno, 'POST', members, { email: 'admin@exemple.test', role: 'contributor', isTeamBa: true });
  assert.equal(r.status, 204);
  const list = await call(bruno, 'GET', members);
  assert.equal(list.body.find((m) => m.userId === admin.sub)?.isTeamBa, true);
});
await check('bruno (propriétaire) retire admin : 204', async () => {
  assert.equal((await call(bruno, 'DELETE', member(admin))).status, 204);
});

console.log('\nÉquipe — initiative archivée : on peut seulement la quitter');
await check('bruno (propriétaire) archive l’initiative : 200', async () => {
  assert.equal((await call(bruno, 'PUT', `/initiatives/${initiativeId}/archive`)).status, 200);
});
await check('archivée : bruno (propriétaire) ne retire pas chloé : 403', async () => {
  const r = await call(bruno, 'DELETE', member(chloe));
  assert.equal(r.status, 403);
  assert.equal(r.body.refusal, 'archived');
});
await check('archivée : bruno (propriétaire) ne change pas un rôle : 403', async () => {
  assert.equal((await call(bruno, 'PATCH', member(chloe), { role: 'contributor' })).status, 403);
});
await check('archivée : bruno (propriétaire) : retrait de chloé sans effet en base', async () => {
  const r = await asUserInDb(bruno.sub, `DELETE FROM initiative_member ${memberSql}`, [initiativeId, chloe.sub]);
  assert.equal(r.rowCount, 0);
});
await check('archivée : chloé (lectrice) : quitter accepté en base', async () => {
  const r = await asUserInDb(chloe.sub, `DELETE FROM initiative_member ${memberSql}`, [initiativeId, chloe.sub]);
  assert.equal(r.rowCount, 1);
});
await check('archivée : bruno (dernier propriétaire) ne quitte pas : 409', async () => {
  assert.equal((await call(bruno, 'DELETE', member(bruno))).body.refusal, 'lastOwner');
});
await check('archivée : chloé (lectrice) quitte l’initiative : 204', async () => {
  assert.equal((await call(chloe, 'DELETE', member(chloe))).status, 204);
  assert.equal((await call(chloe, 'GET', `/initiatives/${initiativeId}`)).status, 404);
});
