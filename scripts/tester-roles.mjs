// Test de bout en bout des permissions (ADR-0006), double barrière :
//   1. par l'API (guards NestJS) ;
//   2. directement en base avec le compte applicatif (RLS PostgreSQL).
// Exige les comptes de test (ajouter-application.sh … --comptes-test).
// Lancé par scripts/tester-roles.sh, dans l'image de l'application.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire('/app/api/package.json');
const pg = require('pg');

const env = process.env;
const API = `http://${env.APP_NAME}-api:3000/api`;
const TOKEN_URL = env.OIDC_JWKS_URL.replace(/\/certs$/, '/token');

let failures = 0;
async function check(label, fn) {
  try {
    await fn();
    console.log(`  ✔ ${label}`);
  } catch (error) {
    failures++;
    console.log(`  ✘ ${label}\n      ${error.message}`);
  }
}

async function login(username) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', client_id: 'tests', username, password: 'Test1234!' }),
  });
  assert.equal(response.status, 200, `connexion de ${username} impossible`);
  const { access_token } = await response.json();
  const sub = JSON.parse(Buffer.from(access_token.split('.')[1], 'base64url').toString()).sub;
  return { token: access_token, sub };
}

async function call(user, method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${user.token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : undefined };
}

/** Exécute une requête en base « en tant que » l'utilisateur, avec le compte soumis à la RLS. */
async function asUserInDb(sub, query, params, { admin = false } = {}) {
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.user_id', $1, true)`, [sub]);
    // Transaction d'administrateur, comme DatabaseService.asAdmin.
    if (admin) await client.query(`SELECT set_config('app.is_admin', 'true', true)`);
    const result = await client.query(query, params);
    await client.query('ROLLBACK');
    return result;
  } finally {
    await client.end();
  }
}

const [alice, bruno, chloe, admin] = await Promise.all(['alice', 'bruno', 'chloe', 'admin'].map(login));
// Première connexion à l'application de chacun (enregistrement dans app_user).
for (const u of [bruno, chloe, admin]) await call(u, 'GET', '/initiatives');

console.log('\nBarrière 1 : API (guards NestJS)');
let initiativeId;
// Code unique à chaque exécution : 2 à 10 caractères, commence par une lettre.
const code = `T${Date.now().toString(36).toUpperCase().slice(-8)}`;
await check('sans jeton : 401', async () => {
  assert.equal((await fetch(`${API}/initiatives`)).status, 401);
});
await check('alice crée une initiative et en devient propriétaire', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code, name: `Initiative test ${code}` });
  assert.equal(r.status, 201);
  assert.equal(r.body.myRole, 'owner');
  assert.equal(r.body.code, code);
  initiativeId = r.body.id;
});
await check('nom vide refusé (schéma partagé) : 400', async () => {
  assert.equal((await call(alice, 'POST', '/initiatives', { code: 'X1', name: '  ' })).status, 400);
});
await check('code invalide refusé (schéma partagé) : 400', async () => {
  assert.equal((await call(alice, 'POST', '/initiatives', { code: '1AB', name: 'Code invalide' })).status, 400);
});
await check('code déjà utilisé, même par une initiative invisible : 409', async () => {
  assert.equal((await call(bruno, 'POST', '/initiatives', { code, name: 'Doublon' })).status, 409);
});
await check('alice (créatrice) est BA de l’équipe', async () => {
  const r = await call(alice, 'GET', `/initiatives/${initiativeId}/members`);
  assert.equal(r.status, 200);
  assert.equal(r.body.find((m) => m.userId === alice.sub)?.isTeamBa, true);
});
await check('alice invite bruno (contributeur) et chloé (lectrice)', async () => {
  assert.equal((await call(alice, 'POST', `/initiatives/${initiativeId}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `/initiatives/${initiativeId}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
});
await check('chloé (lectrice) consulte l’initiative : 200', async () => {
  const r = await call(chloe, 'GET', `/initiatives/${initiativeId}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.myRole, 'reader');
});
await check('chloé (lectrice) ne peut pas modifier : 403', async () => {
  assert.equal((await call(chloe, 'PATCH', `/initiatives/${initiativeId}`, { name: 'Piraté' })).status, 403);
});
await check('bruno (contributeur) modifie : 200', async () => {
  assert.equal((await call(bruno, 'PATCH', `/initiatives/${initiativeId}`, { name: 'Renommé par Bruno' })).status, 200);
});
await check('bruno (contributeur) ne gère pas les membres : 403', async () => {
  assert.equal((await call(bruno, 'POST', `/initiatives/${initiativeId}/members`, { email: 'admin@exemple.test', role: 'reader' })).status, 403);
});
await check('bruno (contributeur) ne supprime pas : 403', async () => {
  assert.equal((await call(bruno, 'DELETE', `/initiatives/${initiativeId}`)).status, 403);
});
await check('admin (non-membre) ne voit pas l’initiative : 404', async () => {
  assert.equal((await call(admin, 'GET', `/initiatives/${initiativeId}`)).status, 404);
  const list = await call(admin, 'GET', '/initiatives');
  assert.ok(!list.body.some((p) => p.id === initiativeId));
});
await check('langue du compte : enregistrée puis relue (ADR-0013)', async () => {
  assert.equal((await call(chloe, 'PATCH', '/me', { locale: 'en' })).status, 200);
  assert.equal((await call(chloe, 'GET', '/me')).body.locale, 'en');
});
await check('langue non disponible refusée (schéma partagé) : 400', async () => {
  assert.equal((await call(chloe, 'PATCH', '/me', { locale: 'de' })).status, 400);
});

// Fiche Initiative complète (ticket 03).
let otherInitiativeId;
await check('bruno (contributeur) renseigne la fiche complète : 200', async () => {
  const fiche = {
    description: 'Ligne 1\nLigne 2',
    analysisApproach: 'adaptive',
    startDate: '2026-11-01',
    plannedEndDate: '2027-03-31',
  };
  const r = await call(bruno, 'PATCH', `/initiatives/${initiativeId}`, fiche);
  assert.equal(r.status, 200);
  assert.deepEqual(
    { description: r.body.description, analysisApproach: r.body.analysisApproach, startDate: r.body.startDate, plannedEndDate: r.body.plannedEndDate },
    fiche,
  );
});
await check('approche d’analyse inconnue refusée (schéma partagé) : 400', async () => {
  assert.equal((await call(bruno, 'PATCH', `/initiatives/${initiativeId}`, { analysisApproach: 'agile' })).status, 400);
});
await check('fin prévue avant le début, dans la même demande : 400', async () => {
  const r = await call(bruno, 'PATCH', `/initiatives/${initiativeId}`, { startDate: '2026-11-02', plannedEndDate: '2026-11-01' });
  assert.equal(r.status, 400);
});
await check('fin prévue avant le début déjà enregistré : 400', async () => {
  assert.equal((await call(bruno, 'PATCH', `/initiatives/${initiativeId}`, { plannedEndDate: '2026-10-01' })).status, 400);
});
await check('chloé (lectrice) ne modifie pas la fiche : 403', async () => {
  assert.equal((await call(chloe, 'PATCH', `/initiatives/${initiativeId}`, { description: 'Piraté' })).status, 403);
});
await check('bruno (contributeur) ne change pas le code : 403', async () => {
  assert.equal((await call(bruno, 'PATCH', `/initiatives/${initiativeId}`, { code: `${code}B` })).status, 403);
});
await check('bruno (contributeur) peut renvoyer le code inchangé : 200', async () => {
  assert.equal((await call(bruno, 'PATCH', `/initiatives/${initiativeId}`, { code, name: 'Renommé par Bruno' })).status, 200);
});
await check('alice (propriétaire) change le code : 200', async () => {
  const r = await call(alice, 'PATCH', `/initiatives/${initiativeId}`, { code: `${code}B` });
  assert.equal(r.status, 200);
  assert.equal(r.body.code, `${code}B`);
});
await check('code déjà pris par une autre initiative, même invisible : 409', async () => {
  const other = await call(bruno, 'POST', '/initiatives', { code: `${code}C`, name: 'Autre initiative' });
  assert.equal(other.status, 201);
  otherInitiativeId = other.body.id;
  assert.equal((await call(alice, 'PATCH', `/initiatives/${initiativeId}`, { code: `${code}C` })).status, 409);
});
await check('bruno (contributeur) n’archive pas : 403', async () => {
  assert.equal((await call(bruno, 'PUT', `/initiatives/${initiativeId}/archive`)).status, 403);
});
await check('admin (non-membre) n’archive pas : 404', async () => {
  assert.equal((await call(admin, 'PUT', `/initiatives/${initiativeId}/archive`)).status, 404);
});
await check('alice (propriétaire) archive : 200, visible dans la liste', async () => {
  const r = await call(alice, 'PUT', `/initiatives/${initiativeId}/archive`);
  assert.equal(r.status, 200);
  assert.ok(r.body.archivedAt);
  const list = await call(chloe, 'GET', '/initiatives');
  assert.ok(list.body.find((i) => i.id === initiativeId)?.archivedAt);
});
await check('archivée : chloé (lectrice) consulte toujours : 200', async () => {
  assert.equal((await call(chloe, 'GET', `/initiatives/${initiativeId}`)).status, 200);
});
await check('archivée : bruno (contributeur) ne modifie plus : 403', async () => {
  assert.equal((await call(bruno, 'PATCH', `/initiatives/${initiativeId}`, { name: 'Interdit' })).status, 403);
});
await check('archivée : alice (propriétaire) ne modifie plus : 403', async () => {
  assert.equal((await call(alice, 'PATCH', `/initiatives/${initiativeId}`, { name: 'Interdit' })).status, 403);
});
await check('archivée : alice (propriétaire) ne gère plus les membres : 403', async () => {
  assert.equal((await call(alice, 'POST', `/initiatives/${initiativeId}/members`, { email: 'admin@exemple.test', role: 'reader' })).status, 403);
});
await check('archivée : bruno (contributeur) ne désarchive pas : 403', async () => {
  assert.equal((await call(bruno, 'DELETE', `/initiatives/${initiativeId}/archive`)).status, 403);
});

console.log('\nBarrière 2 : base de données (RLS, compte applicatif)');
// L'initiative est encore archivée (barrière 1).
await check('archivée : alice (propriétaire) : UPDATE de la fiche refusé', async () => {
  await assert.rejects(
    asUserInDb(alice.sub, `UPDATE initiative SET name = 'Interdit' WHERE id = $1`, [initiativeId]),
    /lecture seule/,
  );
});
await check('archivée : alice (propriétaire) : ajout de membre refusé', async () => {
  await assert.rejects(
    asUserInDb(alice.sub, `INSERT INTO initiative_member (initiative_id, user_id, role) VALUES ($1, $2, 'reader')`, [initiativeId, admin.sub]),
    /row-level security/,
  );
});
await check('archivée : alice (propriétaire) : retrait de membre sans effet', async () => {
  const r = await asUserInDb(alice.sub, `DELETE FROM initiative_member WHERE initiative_id = $1 AND user_id = $2`, [initiativeId, chloe.sub]);
  assert.equal(r.rowCount, 0);
});
await check('archivée : bruno (contributeur) : désarchivage refusé', async () => {
  await assert.rejects(
    asUserInDb(bruno.sub, `UPDATE initiative SET archived_at = NULL, archived_by = NULL WHERE id = $1`, [initiativeId]),
    /propriétaire/,
  );
});
await check('archivée : alice (propriétaire) : désarchiver et modifier en même temps refusé', async () => {
  await assert.rejects(
    asUserInDb(alice.sub, `UPDATE initiative SET archived_at = NULL, archived_by = NULL, name = 'Interdit' WHERE id = $1`, [initiativeId]),
    /sans autre modification/,
  );
});
await check('archivée : alice (propriétaire) : désarchivage accepté', async () => {
  const r = await asUserInDb(alice.sub, `UPDATE initiative SET archived_at = NULL, archived_by = NULL WHERE id = $1`, [initiativeId]);
  assert.equal(r.rowCount, 1);
});
await check('alice (propriétaire) désarchive par l’API : 200', async () => {
  const r = await call(alice, 'DELETE', `/initiatives/${initiativeId}/archive`);
  assert.equal(r.status, 200);
  assert.equal(r.body.archivedAt, null);
});
await check('bruno (contributeur) : changement de code refusé', async () => {
  await assert.rejects(
    asUserInDb(bruno.sub, `UPDATE initiative SET code = 'PIRATE' WHERE id = $1`, [initiativeId]),
    /propriétaire/,
  );
});
await check('bruno (contributeur) : archivage refusé', async () => {
  await assert.rejects(
    asUserInDb(bruno.sub, `UPDATE initiative SET archived_at = now() WHERE id = $1`, [initiativeId]),
    /propriétaire/,
  );
});
await check('description de plus de 4 000 caractères refusée (contrainte en base)', async () => {
  await assert.rejects(
    asUserInDb(bruno.sub, `UPDATE initiative SET description = repeat('x', 4001) WHERE id = $1`, [initiativeId]),
    /check constraint/,
  );
});
await check('fin prévue avant le début refusée (contrainte en base)', async () => {
  await assert.rejects(
    asUserInDb(bruno.sub, `UPDATE initiative SET start_date = '2026-11-02', planned_end_date = '2026-11-01' WHERE id = $1`, [initiativeId]),
    /initiative_dates_order/,
  );
});
await check('chloé (lectrice) : UPDATE sans effet', async () => {
  const r = await asUserInDb(chloe.sub, `UPDATE initiative SET name = 'Piraté' WHERE id = $1`, [initiativeId]);
  assert.equal(r.rowCount, 0);
});
await check('bruno (contributeur) : UPDATE accepté', async () => {
  const r = await asUserInDb(bruno.sub, `UPDATE initiative SET name = 'Via SQL' WHERE id = $1`, [initiativeId]);
  assert.equal(r.rowCount, 1);
});
await check('bruno (contributeur) : ajout de membre refusé', async () => {
  await assert.rejects(
    asUserInDb(bruno.sub, `INSERT INTO initiative_member (initiative_id, user_id, role) VALUES ($1, $2, 'owner')`, [initiativeId, bruno.sub]),
    /row-level security/,
  );
});
await check('un lecteur ne peut pas être BA de l’équipe (contrainte en base)', async () => {
  await assert.rejects(
    asUserInDb(alice.sub, `UPDATE initiative_member SET is_team_ba = true WHERE initiative_id = $1 AND user_id = $2`, [initiativeId, chloe.sub]),
    /check constraint/,
  );
});
await check('bruno ne modifie pas la langue de chloé', async () => {
  const r = await asUserInDb(bruno.sub, `UPDATE app_user SET locale = 'fr' WHERE id = $1`, [chloe.sub]);
  assert.equal(r.rowCount, 0);
});
await check('admin (non-membre) : aucune ligne visible', async () => {
  const r = await asUserInDb(admin.sub, `SELECT * FROM initiative WHERE id = $1`, [initiativeId]);
  assert.equal(r.rowCount, 0);
});
await check('sans utilisateur courant : aucune ligne visible', async () => {
  const r = await asUserInDb('', `SELECT count(*)::int AS n FROM initiative`);
  assert.equal(r.rows[0].n, 0);
});

// Équipe de l'initiative (ticket 04, ADR-0015). État de départ : alice
// propriétaire et BA de l'équipe, bruno contributeur, chloé lectrice.
const members = `/initiatives/${initiativeId}/members`;
const member = (u) => `${members}/${u.sub}`;
const designations = `/initiatives/${initiativeId}/owner-designations`;

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
const memberSql = `WHERE initiative_id = $1 AND user_id = $2`;
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

// Administration des comptes (ticket 05, ADR-0005). Initiative propre à cette
// section : alice propriétaire et BA, bruno contributeur, chloé lectrice.
console.log('\nAdministration — barrière 1 : API (guards NestJS)');
const accounts = '/admin/accounts';
const orphans = '/admin/orphan-initiatives';
const account = (u) => `${accounts}/${u.sub}`;
const designate = (id, u) => call(admin, 'POST', `${orphans}/${id}/owner-designations`, { userId: u.sub });
const isOrphan = async (id) => (await call(admin, 'GET', orphans)).body.some((i) => i.id === id);
let orphanId;
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
let dora;
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
const asAdminInDb = (sub, query, params) => asUserInDb(sub, query, params, { admin: true });
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
const babokTables = ['babok_knowledge_area', 'babok_task', 'babok_technique', 'babok_task_technique'];
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

// Actions (ticket 07). Initiative propre à cette section : alice propriétaire
// et BA, bruno contributeur, chloé lectrice ; admin n'en est pas membre.
console.log('\nActions — barrière 1 : API (guards NestJS)');
let actionsInitiativeId;
let aliceActionId;
let brunoActionId;
const actions = () => `/initiatives/${actionsInitiativeId}/actions`;
const actionPath = (id) => `${actions()}/${id}`;
const mine = async (u) => (await call(u, 'GET', '/actions/mine')).body.map((a) => a.id);
await check('alice crée l’initiative et invite bruno (contributeur) et chloé (lectrice)', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}AC`, name: 'Actions' });
  assert.equal(r.status, 201);
  actionsInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `/initiatives/${actionsInitiativeId}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `/initiatives/${actionsInitiativeId}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
});
await check('création rapide (titre, tâche) : alice responsable, À faire, auteur et dates enregistrés', async () => {
  const r = await call(alice, 'POST', actions(), { title: 'Préparer les entretiens', taskId: '4.1' });
  assert.equal(r.status, 201);
  assert.equal(r.body.assignee.userId, alice.sub);
  assert.equal(r.body.status, 'todo');
  assert.equal(r.body.createdBy.userId, alice.sub);
  assert.ok(r.body.createdAt && r.body.updatedAt);
  aliceActionId = r.body.id;
});
await check('bruno (contributeur) crée une action complète dont il est responsable : 201', async () => {
  const r = await call(bruno, 'POST', actions(), {
    title: 'Entretien avec le service client',
    taskId: '4.2',
    techniqueId: '10.25',
    dueDate: '2026-11-15',
    description: '## Compte rendu\n- point **clé**',
  });
  assert.equal(r.status, 201);
  assert.deepEqual([r.body.assignee.userId, r.body.techniqueId, r.body.dueDate], [bruno.sub, '10.25', '2026-11-15']);
  brunoActionId = r.body.id;
});
await check('tâche BABOK manquante (schéma partagé) ou inconnue du référentiel : 400', async () => {
  assert.equal((await call(alice, 'POST', actions(), { title: 'Sans tâche' })).status, 400);
  const r = await call(alice, 'POST', actions(), { title: 'Tâche inconnue', taskId: '9.9' });
  assert.equal(r.status, 400);
  assert.equal(r.body.refusal, 'unknownBabokElement');
});
await check('chloé (lectrice) consulte les actions : 200', async () => {
  const r = await call(chloe, 'GET', actions());
  assert.equal(r.status, 200);
  assert.equal(r.body.length, 2);
  assert.equal((await call(chloe, 'GET', actionPath(aliceActionId))).status, 200);
});
await check('chloé (lectrice) ne crée, ne modifie ni ne supprime : 403', async () => {
  assert.equal((await call(chloe, 'POST', actions(), { title: 'Interdit', taskId: '4.1' })).status, 403);
  assert.equal((await call(chloe, 'PATCH', actionPath(aliceActionId), { status: 'done' })).status, 403);
  assert.equal((await call(chloe, 'DELETE', actionPath(aliceActionId))).status, 403);
});
await check('chloé (lectrice) ne peut pas être responsable : 400', async () => {
  const r = await call(bruno, 'PATCH', actionPath(aliceActionId), { assigneeId: chloe.sub });
  assert.equal(r.status, 400);
  assert.equal(r.body.refusal, 'assigneeNotEligible');
});
await check('admin (non-membre) ne voit ni ne crée d’action : 404', async () => {
  assert.equal((await call(admin, 'GET', actions())).status, 404);
  assert.equal((await call(admin, 'GET', actionPath(aliceActionId))).status, 404);
  assert.equal((await call(admin, 'POST', actions(), { title: 'Interdit', taskId: '4.1' })).status, 404);
  assert.ok(!(await mine(admin)).includes(aliceActionId));
});
await check('bruno (contributeur) fait avancer l’action d’alice : auteur de la modification enregistré', async () => {
  const r = await call(bruno, 'PATCH', actionPath(aliceActionId), { status: 'in_progress' });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'in_progress');
  assert.equal(r.body.createdBy.userId, alice.sub);
  assert.equal(r.body.updatedBy.userId, bruno.sub);
});
await check('statuts libres : une action terminée se rouvre', async () => {
  assert.equal((await call(alice, 'PATCH', actionPath(aliceActionId), { status: 'done' })).body.status, 'done');
  assert.equal((await call(alice, 'PATCH', actionPath(aliceActionId), { status: 'todo' })).body.status, 'todo');
});
await check('« Mes actions » : chacun les siennes, toutes initiatives confondues', async () => {
  const [a, b, c] = [await mine(alice), await mine(bruno), await mine(chloe)];
  assert.ok(a.includes(aliceActionId) && !a.includes(brunoActionId));
  assert.ok(b.includes(brunoActionId) && !b.includes(aliceActionId));
  assert.ok(!c.includes(aliceActionId) && !c.includes(brunoActionId));
});
await check('bruno passe lecteur : il reste responsable, signalé comme ne pouvant plus l’être', async () => {
  assert.equal((await call(alice, 'PATCH', `/initiatives/${actionsInitiativeId}/members/${bruno.sub}`, { role: 'reader' })).status, 204);
  const r = await call(alice, 'GET', actionPath(brunoActionId));
  assert.equal(r.body.assignee.userId, bruno.sub);
  assert.equal(r.body.assignee.eligible, false);
  assert.equal((await call(bruno, 'PATCH', actionPath(brunoActionId), { status: 'done' })).status, 403);
  // Modifier l'action sans changer de responsable reste possible.
  assert.equal((await call(alice, 'PATCH', actionPath(brunoActionId), { title: 'Entretien reporté' })).status, 200);
  assert.equal((await call(alice, 'PATCH', `/initiatives/${actionsInitiativeId}/members/${bruno.sub}`, { role: 'contributor' })).status, 204);
});
await check('initiative archivée : actions en lecture seule, signalées dans « Mes actions »', async () => {
  assert.equal((await call(alice, 'PUT', `/initiatives/${actionsInitiativeId}/archive`)).status, 200);
  assert.equal((await call(chloe, 'GET', actions())).status, 200);
  assert.equal((await call(alice, 'POST', actions(), { title: 'Interdit', taskId: '4.1' })).status, 403);
  assert.equal((await call(bruno, 'PATCH', actionPath(brunoActionId), { status: 'done' })).status, 403);
  assert.equal((await call(alice, 'DELETE', actionPath(aliceActionId))).status, 403);
  const own = (await call(alice, 'GET', '/actions/mine')).body.find((a) => a.id === aliceActionId);
  assert.equal(own?.initiative.archived, true);
});

console.log('\nActions — barrière 2 : base de données (RLS, compte applicatif)');
// L'initiative est encore archivée.
await check('archivée : alice (propriétaire) : UPDATE et DELETE sans effet, INSERT refusé', async () => {
  assert.equal((await asUserInDb(alice.sub, `UPDATE action SET title = 'Interdit' WHERE id = $1`, [aliceActionId])).rowCount, 0);
  assert.equal((await asUserInDb(alice.sub, `DELETE FROM action WHERE id = $1`, [aliceActionId])).rowCount, 0);
  await assert.rejects(
    asUserInDb(alice.sub, `INSERT INTO action (id, initiative_id, title, task_id, assignee_id) VALUES (gen_random_uuid(), $1, 'x', '4.1', $2)`, [actionsInitiativeId, alice.sub]),
    /row-level security/,
  );
});
await check('alice désarchive l’initiative : 200', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${actionsInitiativeId}/archive`)).status, 200);
});
const insertAction = (sub, assignee) =>
  asUserInDb(
    sub,
    `INSERT INTO action (id, initiative_id, title, task_id, assignee_id) VALUES (gen_random_uuid(), $1, 'Via SQL', '4.1', $2) RETURNING created_by`,
    [actionsInitiativeId, assignee],
  );
await check('chloé (lectrice) : INSERT refusé, UPDATE et DELETE sans effet', async () => {
  await assert.rejects(insertAction(chloe.sub, alice.sub), /row-level security/);
  assert.equal((await asUserInDb(chloe.sub, `UPDATE action SET title = 'Piraté' WHERE id = $1`, [aliceActionId])).rowCount, 0);
  assert.equal((await asUserInDb(chloe.sub, `DELETE FROM action WHERE id = $1`, [aliceActionId])).rowCount, 0);
});
await check('admin (non-membre) : aucune action visible, aucune écriture', async () => {
  assert.equal((await asUserInDb(admin.sub, `SELECT 1 FROM action WHERE initiative_id = $1`, [actionsInitiativeId])).rowCount, 0);
  assert.equal((await asUserInDb(admin.sub, `UPDATE action SET title = 'Piraté' WHERE id = $1`, [aliceActionId])).rowCount, 0);
  await assert.rejects(insertAction(admin.sub, alice.sub), /row-level security/);
});
await check('bruno (contributeur) : INSERT accepté, auteur imposé par la base', async () => {
  const r = await insertAction(bruno.sub, bruno.sub);
  assert.equal(r.rows[0].created_by, bruno.sub);
});
await check('responsable lecteur ou non-membre refusé (déclencheur)', async () => {
  await assert.rejects(insertAction(bruno.sub, chloe.sub), /responsable/);
  await assert.rejects(insertAction(bruno.sub, admin.sub), /responsable/);
});
await check('bruno ne falsifie ni l’auteur ni les dates (déclencheur)', async () => {
  const r = await asUserInDb(
    bruno.sub,
    `UPDATE action SET created_by = $2, updated_by = $2, created_at = '2000-01-01' WHERE id = $1 RETURNING created_by, updated_by, created_at`,
    [aliceActionId, chloe.sub],
  );
  assert.equal(r.rows[0].created_by, alice.sub);
  assert.equal(r.rows[0].updated_by, bruno.sub);
  assert.notEqual(r.rows[0].created_at.getFullYear(), 2000);
});
await check('une action ne change pas d’initiative', async () => {
  const r = await call(bruno, 'POST', '/initiatives', { code: `${code.slice(0, 8)}AD`, name: 'Autre' });
  await assert.rejects(
    asUserInDb(bruno.sub, `UPDATE action SET initiative_id = $2 WHERE id = $1`, [brunoActionId, r.body.id]),
    /ne change pas/,
  );
  assert.equal((await call(bruno, 'DELETE', `/initiatives/${r.body.id}`)).status, 204);
});
await check('description de plus de 20 000 caractères refusée (contrainte en base)', async () => {
  await assert.rejects(
    asUserInDb(bruno.sub, `UPDATE action SET description = repeat('x', 20001) WHERE id = $1`, [aliceActionId]),
    /check constraint/,
  );
});
await check('bruno (contributeur) supprime une action liée à rien : 204', async () => {
  assert.equal((await call(bruno, 'DELETE', actionPath(aliceActionId))).status, 204);
  assert.equal((await call(alice, 'GET', actionPath(aliceActionId))).status, 404);
});

console.log('\nNettoyage');
await check('alice (propriétaire) supprime l’initiative des actions, et ses actions : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${actionsInitiativeId}`)).status, 204);
});
// Quoi qu'il soit arrivé plus haut, les comptes de test restent actifs.
for (const u of [alice, chloe]) await call(admin, 'PATCH', account(u), { enabled: true });
await check('bruno (propriétaire) supprime l’initiative de l’administration : 204', async () => {
  assert.equal((await call(bruno, 'DELETE', `/initiatives/${orphanId}`)).status, 204);
});
await check('bruno (propriétaire) supprime l’initiative archivée : 204', async () => {
  assert.equal((await call(bruno, 'DELETE', `/initiatives/${initiativeId}`)).status, 204);
  assert.equal((await call(bruno, 'GET', `/initiatives/${initiativeId}`)).status, 404);
});
await check('bruno (propriétaire) supprime son initiative, même archivée : 204', async () => {
  assert.equal((await call(bruno, 'PUT', `/initiatives/${otherInitiativeId}/archive`)).status, 200);
  assert.equal((await call(bruno, 'DELETE', `/initiatives/${otherInitiativeId}`)).status, 204);
});

console.log(failures ? `\n${failures} échec(s).` : '\nTous les contrôles sont passés.');
process.exit(failures ? 1 : 0);
