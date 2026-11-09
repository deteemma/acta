import { assert, check, call, asUserInDb, inDbTransaction, alice, bruno, chloe, admin, code } from './commun.mjs';

// Enregistrements et versions de page (phase 2, ticket 23). alice propriétaire,
// bruno contributeur, chloé lectrice ; admin n'est pas membre.
console.log('\nEnregistrements de page — barrière 1 : API (guards NestJS)');
export let rvInitiativeId;
let pageId;
const page = () => `/initiatives/${rvInitiativeId}/pages/${pageId}`;
const revisions = () => `${page()}/revisions`;
const revision = (id) => `${revisions()}/${id}`;
const doc = (text) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
/** Historique du plus ancien au plus récent. */
const history = async (user = alice) => (await call(user, 'GET', revisions())).body.slice().reverse();

await check('alice crée l’initiative et invite bruno (contributeur) et chloé (lectrice)', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}RV`, name: 'Enregistrements' });
  assert.equal(r.status, 201);
  rvInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `/initiatives/${rvInitiativeId}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `/initiatives/${rvInitiativeId}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
});
await check('la création est le premier enregistrement, sans version', async () => {
  const r = await call(bruno, 'POST', `/initiatives/${rvInitiativeId}/pages`, { title: 'Budget', content: doc('un') });
  pageId = r.body.id;
  assert.deepEqual(r.body.versions, { lastVersion: null, modifiedSinceLastVersion: false, nextVersion: 1 });
  const list = await history();
  assert.equal(list.length, 1);
  assert.deepEqual([list[0].id, list[0].versionNumber, list[0].createdBy.email], [r.body.revisionId, null, 'bruno@exemple.test']);
});
await check('enregistrer le titre ou le contenu conserve un enregistrement ; déplacer ou ne rien changer, non', async () => {
  await call(bruno, 'PATCH', page(), { content: doc('deux') });
  await call(bruno, 'PATCH', page(), { title: 'Budget 2027' });
  await call(bruno, 'PATCH', page(), { title: 'Budget 2027' });
  await call(bruno, 'PUT', `${page()}/placement`, { parentId: null, index: 0 });
  assert.equal((await history()).length, 3);
});
await check('« Enregistrer comme version 1 » avec une note ; chloé (lectrice) voit l’historique et ouvre un enregistrement', async () => {
  const r = await call(bruno, 'PATCH', page(), { content: doc('trois'), version: { note: 'Relue' } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.versions, { lastVersion: 1, modifiedSinceLastVersion: false, nextVersion: 2 });
  const list = await history(chloe);
  assert.deepEqual(list.map((x) => x.versionNumber), [null, null, null, 1]);
  assert.equal(list[3].versionNote, 'Relue');
  const opened = await call(chloe, 'GET', revision(list[0].id));
  assert.deepEqual([opened.status, opened.body.title, opened.body.content], [200, 'Budget', doc('un')]);
});
await check('après coup : seulement après la dernière version (409), puis numéro suivant ; note de 500 caractères au plus', async () => {
  const before = (await history())[1].id;
  const refused = await call(alice, 'POST', `${revision(before)}/version`, {});
  assert.deepEqual([refused.status, refused.body.refusal], [409, 'pageVersionNotAfterLast']);
  await call(bruno, 'PATCH', page(), { content: doc('quatre') });
  const last = (await history()).at(-1).id;
  assert.equal((await call(alice, 'POST', `${revision(last)}/version`, { note: 'x'.repeat(501) })).status, 400);
  const declared = await call(alice, 'POST', `${revision(last)}/version`, { note: 'Validée' });
  assert.equal(declared.status, 201);
  assert.equal(declared.body[0].versionNumber, 2);
  const again = await call(alice, 'POST', `${revision(last)}/version`, {});
  assert.deepEqual([again.status, again.body.refusal], [409, 'alreadyPageVersion']);
});
await check('note corrigée par un contributeur ; refusée sur un simple enregistrement', async () => {
  const list = await history();
  const fixed = await call(bruno, 'PATCH', `${revision(list[3].id)}/version`, { note: 'Relue par Alice' });
  assert.equal(fixed.status, 200);
  assert.equal((await history())[3].versionNote, 'Relue par Alice');
  const plain = await call(bruno, 'PATCH', `${revision(list[0].id)}/version`, { note: 'Non' });
  assert.deepEqual([plain.status, plain.body.refusal], [409, 'notPageVersion']);
});
await check('restaurer crée un nouvel enregistrement, sans version, et signale les modifications depuis la version 2', async () => {
  const first = (await history())[0].id;
  const r = await call(bruno, 'POST', `${revision(first)}/restore`);
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.title, r.body.content], ['Budget', doc('un')]);
  assert.deepEqual(r.body.versions, { lastVersion: 2, modifiedSinceLastVersion: true, nextVersion: 3 });
  const list = await history();
  assert.deepEqual([list.length, list.at(-1).versionNumber], [6, null]);
  const current = await call(bruno, 'POST', `${revision(list.at(-1).id)}/restore`);
  assert.deepEqual([current.status, current.body.refusal], [409, 'currentPageRevision']);
});
await check('supprimer : sauf le dernier (409) ; la trace reste, sans contenu ; le numéro de version n’est pas réattribué', async () => {
  const list = await history();
  const lastRefused = await call(bruno, 'DELETE', revision(list.at(-1).id));
  assert.deepEqual([lastRefused.status, lastRefused.body.refusal], [409, 'lastPageRevision']);
  const version2 = list.find((x) => x.versionNumber === 2);
  const r = await call(bruno, 'DELETE', revision(version2.id));
  assert.equal(r.status, 200);
  const trace = r.body.find((x) => x.id === version2.id);
  assert.deepEqual([trace.deletedBy?.userId != null, trace.deletedAt != null, trace.versionNote], [true, true, null]);
  const opened = (await call(chloe, 'GET', revision(version2.id))).body;
  assert.deepEqual([opened.title, opened.content], [null, null]);
  const p = (await call(chloe, 'GET', page())).body;
  assert.deepEqual(p.versions, { lastVersion: 1, modifiedSinceLastVersion: true, nextVersion: 3 });
  const deletedAgain = await call(bruno, 'DELETE', revision(version2.id));
  assert.deepEqual([deletedAgain.status, deletedAgain.body.refusal], [409, 'pageRevisionDeleted']);
  const saved = await call(bruno, 'PATCH', page(), { content: doc('cinq'), version: { note: null } });
  assert.equal(saved.body.versions.lastVersion, 3);
});
await check('chloé (lectrice) ne déclare, ne corrige, ne restaure ni ne supprime : 403 ; admin (non-membre) : 404', async () => {
  const first = (await history())[0].id;
  assert.equal((await call(chloe, 'POST', `${revision(first)}/version`, {})).status, 403);
  assert.equal((await call(chloe, 'PATCH', `${revision(first)}/version`, { note: 'Non' })).status, 403);
  assert.equal((await call(chloe, 'POST', `${revision(first)}/restore`)).status, 403);
  assert.equal((await call(chloe, 'DELETE', revision(first))).status, 403);
  assert.equal((await call(admin, 'GET', revisions())).status, 404);
  assert.equal((await call(admin, 'GET', revision(first))).status, 404);
});
await check('initiative archivée : historique consultable, aucune écriture', async () => {
  const first = (await history())[0].id;
  assert.equal((await call(alice, 'PUT', `/initiatives/${rvInitiativeId}/archive`)).status, 200);
  try {
    assert.equal((await call(chloe, 'GET', revisions())).status, 200);
    assert.equal((await call(alice, 'POST', `${revision(first)}/restore`)).status, 403);
    assert.equal((await call(alice, 'DELETE', revision(first))).status, 403);
    assert.equal((await call(alice, 'POST', `${revision(first)}/version`, {})).status, 403);
  } finally {
    assert.equal((await call(alice, 'DELETE', `/initiatives/${rvInitiativeId}/archive`)).status, 200);
  }
});

console.log('\nEnregistrements de page — barrière 2 : base de données (RLS, déclencheurs)');
const db = (user, text, params = []) => asUserInDb(user.sub, text, params);
const oldest = async () => (await history())[0].id;

await check('la base conserve l’enregistrement d’une modification faite en SQL ; aucune écriture directe', async () => {
  const count = (await history()).length;
  const r = await inDbTransaction([
    { sub: bruno.sub, query: `UPDATE page SET title = 'Via SQL' WHERE id = $1`, params: [pageId] },
    { sub: bruno.sub, query: `UPDATE page SET position = 3 WHERE id = $1`, params: [pageId] },
    { sub: alice.sub, query: 'SELECT count(*)::int AS n FROM page_revision WHERE page_id = $1', params: [pageId] },
  ]);
  assert.equal(r.rows[0].n, count + 1);
  await assert.rejects(
    db(alice, `INSERT INTO page_revision (initiative_id, page_id, title, created_by, created_at) VALUES ($1, $2, 'Faux', 'x', now())`, [rvInitiativeId, pageId]),
    /row-level security/,
  );
  assert.equal((await db(alice, 'DELETE FROM page_revision WHERE page_id = $1', [pageId])).rowCount, 0);
});
await check('le contenu d’un enregistrement est figé ; la base refuse le dernier, une version antidatée ou mal numérotée', async () => {
  const first = await oldest();
  const kept = await inDbTransaction([
    { sub: bruno.sub, query: `UPDATE page_revision SET title = 'Faux', content = NULL WHERE id = $1`, params: [first] },
    { sub: alice.sub, query: 'SELECT title, content FROM page_revision WHERE id = $1', params: [first] },
  ]);
  assert.deepEqual([kept.rows[0].title, kept.rows[0].content], ['Budget', doc('un')]);
  const last = (await history()).at(-1).id;
  await assert.rejects(db(bruno, 'UPDATE page_revision SET deleted_at = now() WHERE id = $1', [last]), /dernier enregistrement/);
  await assert.rejects(db(bruno, 'UPDATE page_revision SET version_number = 9 WHERE id = $1', [first]), /postérieur/);
  await assert.rejects(
    inDbTransaction([
      { sub: bruno.sub, query: `UPDATE page SET title = 'Nouveau' WHERE id = $1`, params: [pageId] },
      {
        sub: bruno.sub,
        query: 'UPDATE page_revision SET version_number = 9 WHERE sequence = (SELECT max(sequence) FROM page_revision WHERE page_id = $1)',
        params: [pageId],
      },
    ]),
    /numéro 4/,
  );
  const version1 = (await history()).find((x) => x.versionNumber === 1).id;
  await assert.rejects(db(bruno, 'UPDATE page_revision SET version_number = NULL WHERE id = $1', [version1]), /ne redevient pas/);
});
await check('supprimer en base : auteur et date posés, contenu retiré, plus rien ne change ensuite', async () => {
  const first = await oldest();
  const deleteFirst = { sub: bruno.sub, query: 'UPDATE page_revision SET deleted_at = now() WHERE id = $1', params: [first] };
  const r = await inDbTransaction([
    deleteFirst,
    { sub: alice.sub, query: 'SELECT title, content, deleted_by = $2 AS by_bruno FROM page_revision WHERE id = $1', params: [first, bruno.sub] },
  ]);
  assert.deepEqual([r.rows[0].title, r.rows[0].content, r.rows[0].by_bruno], [null, null, true]);
  await assert.rejects(
    inDbTransaction([deleteFirst, { sub: bruno.sub, query: `UPDATE page_revision SET version_note = 'x' WHERE id = $1`, params: [first] }]),
    /supprimé ne change plus/,
  );
});
await check('lectrice et non-membre n’écrivent pas ; non-membre ne lit rien', async () => {
  const any = (await history()).at(-2).id;
  assert.equal((await db(chloe, `UPDATE page_revision SET deleted_at = now() WHERE id = $1`, [any])).rowCount, 0);
  assert.equal((await db(chloe, 'SELECT 1 FROM page_revision WHERE page_id = $1', [pageId])).rowCount > 0, true);
  assert.equal((await db(admin, 'SELECT 1 FROM page_revision WHERE page_id = $1', [pageId])).rowCount, 0);
});
await check('initiative archivée : la base refuse toute écriture, même au propriétaire', async () => {
  const any = (await history()).at(-2).id;
  assert.equal((await call(alice, 'PUT', `/initiatives/${rvInitiativeId}/archive`)).status, 200);
  try {
    assert.equal((await db(alice, `UPDATE page_revision SET deleted_at = now() WHERE id = $1`, [any])).rowCount, 0);
  } finally {
    assert.equal((await call(alice, 'DELETE', `/initiatives/${rvInitiativeId}/archive`)).status, 200);
  }
});
await check('supprimer la page emporte ses enregistrements', async () => {
  assert.equal((await call(alice, 'DELETE', page())).status, 204);
  assert.equal((await db(alice, 'SELECT 1 FROM page_revision WHERE page_id = $1', [pageId])).rowCount, 0);
});
