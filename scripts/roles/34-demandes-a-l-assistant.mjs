// Demandes à l'assistant (carte « assistant », ticket 12 ; spécification AS1, AS3,
// AS9, AS40). alice propriétaire, bruno contributeur, chloé lectrice ; admin non membre.
// Aucune demande n'est créée par l'API : le traitement de fond l'enverrait à
// l'instance Hermes. Les créations se font en base, dans des transactions annulées.
import { admin, alice, assert, bruno, call, check, chloe, code, env, pg } from './commun.mjs';

console.log('\nDemandes à l’assistant — barrière 1 : API (guards NestJS)');
export let asInitiativeId;
const requests = () => `/initiatives/${asInitiativeId}/assistant-requests`;
const installed = (await call(alice, 'GET', '/config')).body?.assistant === true;

await check('alice crée l’initiative et invite bruno (contributeur) et chloé (lectrice)', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}AS`, name: 'Assistant' });
  assert.equal(r.status, 201);
  asInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `/initiatives/${asInitiativeId}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `/initiatives/${asInitiativeId}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
});

if (installed) {
  await check('chloé (lectrice) lit ses demandes : 200, liste vide', async () => {
    const r = await call(chloe, 'GET', requests());
    assert.deepEqual([r.status, r.body], [200, []]);
  });
  await check('admin (non-membre) ne lit ni ne pose aucune demande : 404 (AS9, AS40)', async () => {
    assert.equal((await call(admin, 'GET', requests())).status, 404);
    assert.equal((await call(admin, 'POST', requests(), { usage: 'status_review', mode: 'quick', locale: 'fr' })).status, 404);
  });
  await check('usage pas encore proposé, mode ou langue inconnus : 400', async () => {
    assert.equal((await call(chloe, 'POST', requests(), { usage: 'next_steps', mode: 'quick', locale: 'fr' })).status, 400);
    assert.equal((await call(chloe, 'POST', requests(), { usage: 'status_review', mode: 'lent', locale: 'fr' })).status, 400);
    assert.equal((await call(chloe, 'POST', requests(), { usage: 'status_review', mode: 'quick', locale: 'de' })).status, 400);
  });
} else {
  await check('assistant non installé : aucune route de l’assistant (AS25)', async () => {
    assert.equal((await call(chloe, 'GET', requests())).status, 404);
    assert.equal((await call(chloe, 'POST', requests(), { usage: 'status_review', mode: 'quick', locale: 'fr' })).status, 404);
  });
}
console.log('\nDemandes à l’assistant — barrière 2 : base (RLS PostgreSQL)');

/**
 * Une transaction annulée ; `as(user, query, params, { admin, worker })` joue la
 * requête « en tant que » l'utilisateur, l'administrateur ou le traitement de fond.
 * Une requête refusée est jouée dans un point de sauvegarde, pour continuer.
 */
async function inTransaction(steps) {
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  const as = async (user, query, params = [], { admin: isAdmin = false, worker = false } = {}) => {
    await client.query(
      `SELECT set_config('app.user_id', $1, true), set_config('app.is_admin', $2, true),
              set_config('app.is_assistant_worker', $3, true)`,
      [user?.sub ?? '', String(isAdmin), String(worker)],
    );
    await client.query('SAVEPOINT step');
    try {
      const result = await client.query(query, params);
      await client.query('RELEASE SAVEPOINT step');
      return result;
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT step');
      throw error;
    }
  };
  try {
    await client.query('BEGIN');
    await steps(as);
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }
}

const insert = `INSERT INTO assistant_request (id, initiative_id, usage, mode, locale)
  VALUES (gen_random_uuid(), $1, 'status_review', 'quick', 'fr') RETURNING id`;
const rejects = async (promise, pattern) => assert.rejects(promise, pattern);

await check('bruno retiré de l’initiative ne voit plus sa demande ; elle réapparaît à son retour (AS9)', () =>
  inTransaction(async (as) => {
    const id = (await as(bruno, insert, [asInitiativeId])).rows[0].id;
    const visible = async () => (await as(bruno, 'SELECT id FROM assistant_request WHERE id = $1', [id])).rowCount;
    await as(alice, 'DELETE FROM initiative_member WHERE initiative_id = $1 AND user_id = $2', [asInitiativeId, bruno.sub]);
    assert.equal(await visible(), 0);
    assert.equal((await as(null, 'SELECT id FROM assistant_request WHERE id = $1', [id], { worker: true })).rowCount, 1, 'la demande est gardée');
    await as(alice, `INSERT INTO initiative_member (initiative_id, user_id, role) VALUES ($1, $2, 'contributor')`, [asInitiativeId, bruno.sub]);
    assert.equal(await visible(), 1);
  }),
);
await check('alice archive l’initiative : les membres peuvent encore demander (AS1)', async () => {
  assert.equal((await call(alice, 'PUT', `/initiatives/${asInitiativeId}/archive`)).status, 200);
  if (installed) assert.equal((await call(chloe, 'GET', requests())).status, 200);
});

await check('chloé (lectrice) pose une demande sur l’initiative archivée ; elle seule la voit (AS1, AS9, AS40)', () =>
  inTransaction(async (as) => {
    const { rows } = await as(chloe, insert, [asInitiativeId]);
    const id = rows[0].id;
    const visible = (user, options) => as(user, 'SELECT id FROM assistant_request WHERE id = $1', [id], options);
    assert.equal((await visible(chloe)).rowCount, 1);
    assert.equal((await visible(alice)).rowCount, 0, 'la propriétaire ne voit pas la demande de chloé');
    assert.equal((await visible(bruno)).rowCount, 0, 'un autre membre ne voit pas la demande de chloé');
    assert.equal((await visible(admin, { admin: true })).rowCount, 0, 'l’administrateur ne voit aucune demande');
    assert.equal((await visible(null, { worker: true })).rowCount, 1, 'le traitement de fond lit la file');
  }),
);
await check('position dans la file et demande non terminée : pour l’auteur seul (AS3, AS4, AS40)', () =>
  inTransaction(async (as) => {
    const id = (await as(chloe, insert, [asInitiativeId])).rows[0].id;
    const ahead = async (user, options) =>
      (await as(user, 'SELECT assistant_queue_ahead($1) AS n', [id], options)).rows[0].n;
    assert.equal(typeof (await ahead(chloe)), 'number');
    assert.equal(await ahead(bruno), null, 'un autre membre ne compte pas la demande de chloé');
    assert.equal(await ahead(admin, { admin: true }), null, 'l’administrateur ne compte pas la demande de chloé');
    const unfinished = (user) => as(user, 'SELECT usage, status FROM my_unfinished_assistant_request()');
    assert.deepEqual((await unfinished(chloe)).rows, [{ usage: 'status_review', status: 'pending' }]);
    assert.equal((await unfinished(bruno)).rowCount, 0);
  }),
);
await check('une seule demande non terminée par personne (AS3)', () =>
  inTransaction(async (as) => {
    await as(chloe, insert, [asInitiativeId]);
    await rejects(as(chloe, insert, [asInitiativeId]), /assistant_request_one_unfinished/);
    // Un autre membre garde sa propre demande.
    await as(bruno, insert, [asInitiativeId]);
  }),
);
await check('ni pour un autre, ni hors de l’initiative, ni déjà avancée, ni compte désactivé : refusé (AS40)', () =>
  inTransaction(async (as) => {
    await rejects(
      as(chloe, `INSERT INTO assistant_request (id, initiative_id, author_id, usage, mode, locale)
        VALUES (gen_random_uuid(), $1, $2, 'status_review', 'quick', 'fr')`, [asInitiativeId, bruno.sub]),
      /row-level security/,
    );
    await rejects(as(admin, insert, [asInitiativeId], { admin: true }), /row-level security/);
    await rejects(
      as(chloe, `INSERT INTO assistant_request (id, initiative_id, usage, mode, locale, status)
        VALUES (gen_random_uuid(), $1, 'status_review', 'quick', 'fr', 'running')`, [asInitiativeId]),
      /row-level security|assistant_request_state/,
    );
    await as(admin, 'SELECT admin_set_user_deactivated($1, true)', [chloe.sub], { admin: true });
    await rejects(as(chloe, insert, [asInitiativeId]), /row-level security/);
  }),
);
await check('l’auteur ne fait pas avancer sa demande ; le traitement de fond, par les seuls passages permis (AS2)', () =>
  inTransaction(async (as) => {
    const id = (await as(chloe, insert, [asInitiativeId])).rows[0].id;
    const update = (user, set, options) => as(user, `UPDATE assistant_request SET ${set} WHERE id = $1`, [id], options);
    assert.equal((await update(chloe, `status = 'answered', advice = 'x', read_at = now()`)).rowCount, 0);
    await rejects(update(null, `status = 'running'`, { worker: true }), /assistant_request_state/);
    await rejects(update(null, `mode = 'thorough'`, { worker: true }), /ne se modifie pas/);
    await update(null, `status = 'running', read_at = now(), timeout_minutes = 20, hermes_run_id = 'run_x'`, { worker: true });
    await update(null, `status = 'answered', advice = 'Avis'`, { worker: true });
    await rejects(update(null, `status = 'failed', failure_reason = 'timeout', advice = NULL`, { worker: true }), /passage de statut refusé/);
    const { rows } = await as(chloe, 'SELECT status, finished_at FROM assistant_request WHERE id = $1', [id]);
    assert.equal(rows[0].status, 'answered');
    assert.ok(rows[0].finished_at, 'la base pose la date de fin');
  }),
);
await check('l’initiative supprimée emporte ses demandes (AS9)', () =>
  inTransaction(async (as) => {
    const id = (await as(chloe, insert, [asInitiativeId])).rows[0].id;
    await as(alice, 'DELETE FROM initiative WHERE id = $1', [asInitiativeId]);
    assert.equal((await as(null, 'SELECT id FROM assistant_request WHERE id = $1', [id], { worker: true })).rowCount, 0);
  }),
);
