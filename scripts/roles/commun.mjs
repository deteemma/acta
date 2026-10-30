// Outils communs aux contrôles de permissions (scripts/tester-roles.mjs) :
// appels à l'API, requêtes en base « en tant que » un utilisateur, comptes de test.
import assert from 'node:assert/strict';
export { assert };
import { createRequire } from 'node:module';

const require = createRequire('/app/api/package.json');
export const pg = require('pg');

export const env = process.env;
export const API = `http://${env.APP_NAME}-api:3000/api`;
const TOKEN_URL = env.OIDC_JWKS_URL.replace(/\/certs$/, '/token');
export let failures = 0;
export async function check(label, fn) {
  try {
    await fn();
    console.log(`  ✔ ${label}`);
  } catch (error) {
    failures++;
    console.log(`  ✘ ${label}\n      ${error.message}`);
  }
}

export async function login(username) {
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

export async function call(user, method, path, body) {
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
export async function asUserInDb(sub, query, params, { admin = false } = {}) {
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

export const [alice, bruno, chloe, admin] = await Promise.all(['alice', 'bruno', 'chloe', 'admin'].map(login));
// Première connexion à l'application de chacun (enregistrement dans app_user).
for (const u of [bruno, chloe, admin]) await call(u, 'GET', '/initiatives');

// Code unique à chaque exécution : 2 à 10 caractères, commence par une lettre.
export const code = `T${Date.now().toString(36).toUpperCase().slice(-8)}`;

/** Plusieurs requêtes dans une même transaction annulée, chacune « en tant que » son utilisateur. */
export async function inDbTransaction(steps) {
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    let result;
    for (const { sub, admin: isAdmin = false, query, params } of steps) {
      await client.query(`SELECT set_config('app.user_id', $1, true), set_config('app.is_admin', $2, true)`, [sub, String(isAdmin)]);
      result = await client.query(query, params);
    }
    return result;
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }
}
