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
async function asUserInDb(sub, query, params) {
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.user_id', $1, true)`, [sub]);
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

console.log('\nBarrière 2 : base de données (RLS, compte applicatif)');
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
await check('admin (non-membre) : aucune ligne visible', async () => {
  const r = await asUserInDb(admin.sub, `SELECT * FROM initiative WHERE id = $1`, [initiativeId]);
  assert.equal(r.rowCount, 0);
});
await check('sans utilisateur courant : aucune ligne visible', async () => {
  const r = await asUserInDb('', `SELECT count(*)::int AS n FROM initiative`);
  assert.equal(r.rows[0].n, 0);
});

console.log('\nNettoyage');
await check('alice (propriétaire) supprime l’initiative : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${initiativeId}`)).status, 204);
});

console.log(failures ? `\n${failures} échec(s).` : '\nTous les contrôles sont passés.');
process.exit(failures ? 1 : 0);
