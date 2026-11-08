import { assert, check, call, asUserInDb, alice, bruno, chloe, admin, code } from './commun.mjs';

// Pages : arborescence et écriture (phase 2, ticket 22). alice propriétaire, bruno
// contributeur, chloé lectrice ; admin n'est pas membre.
console.log('\nPages — barrière 1 : API (guards NestJS)');
const pagesCode = `${code.slice(0, 8)}PG`;
export let pgInitiativeId;
export let pgOtherInitiativeId;
let rootId;
let childId;
let grandChildId;
let otherPageId;
const pages = () => `/initiatives/${pgInitiativeId}/pages`;
const page = (id) => `${pages()}/${id}`;
const reference = (n) => `${pagesCode}-PA-00${n}`;
const doc = (...texts) => ({ type: 'doc', content: texts.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })) });

await check('alice crée l’initiative et invite bruno (contributeur) et chloé (lectrice)', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: pagesCode, name: 'Pages' });
  assert.equal(r.status, 201);
  pgInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `/initiatives/${pgInitiativeId}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `/initiatives/${pgInitiativeId}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
  pgOtherInitiativeId = (await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}PX`, name: 'Autre' })).body.id;
  otherPageId = (await call(alice, 'POST', `/initiatives/${pgOtherInitiativeId}/pages`, { title: 'Ailleurs' })).body.id;
});
await check('administration : la catégorie « page » a l’acronyme PA', async () => {
  const list = (await call(admin, 'GET', '/admin/reference-categories')).body;
  assert.equal(list.find((c) => c.category === 'page')?.acronym, 'PA');
});
await check('bruno (contributeur) crée une page au premier enregistrement : référence PA, contenu JSON gardé tel quel', async () => {
  const content = doc('# Budget 2027', '2026. Une année', 'a < b & c');
  const r = await call(bruno, 'POST', pages(), { title: 'Budget', content });
  assert.equal(r.status, 201);
  assert.deepEqual([r.body.reference, r.body.parentId, r.body.position], [reference(1), null, 0]);
  assert.deepEqual(r.body.content, content);
  rootId = r.body.id;
  assert.deepEqual((await call(chloe, 'GET', page(rootId))).body.content, content);
});
await check('alice (propriétaire) crée des sous-pages, chacune en dernier parmi ses sœurs', async () => {
  childId = (await call(alice, 'POST', pages(), { title: 'Sous-page', parentId: rootId })).body.id;
  grandChildId = (await call(alice, 'POST', pages(), { title: 'Sous-sous-page', parentId: childId })).body.id;
  const second = await call(alice, 'POST', pages(), { title: 'Seconde', parentId: rootId });
  assert.deepEqual([second.body.position, second.body.reference], [1, reference(4)]);
  assert.equal((await call(alice, 'DELETE', page(second.body.id))).status, 204);
});
await check('titre obligatoire, 200 000 caractères de texte au plus, mise en forme prévue seulement : 400', async () => {
  assert.equal((await call(bruno, 'POST', pages(), { title: ' ' })).status, 400);
  const long = 'x'.repeat(100_000);
  assert.equal((await call(bruno, 'PATCH', page(rootId), { content: doc(long, long) })).status, 200);
  assert.equal((await call(bruno, 'PATCH', page(rootId), { content: doc(long, `${long}x`) })).status, 400);
  const code = { type: 'doc', content: [{ type: 'codeBlock', content: [{ type: 'text', text: 'x' }] }] };
  assert.equal((await call(bruno, 'PATCH', page(rootId), { content: code })).status, 400);
});
await check('liste et palette : chloé (lectrice) voit l’arborescence et trouve la page ; admin (non-membre) : 404', async () => {
  const r = await call(chloe, 'GET', pages());
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.map((p) => p.id).sort(), [rootId, childId, grandChildId].sort());
  assert.equal(r.body[0].content, undefined);
  const found = (await call(chloe, 'GET', '/references')).body.find((x) => x.id === rootId);
  assert.deepEqual([found?.category, found?.reference], ['page', reference(1)]);
  assert.equal((await call(admin, 'GET', pages())).status, 404);
  assert.equal((await call(admin, 'GET', page(rootId))).status, 404);
});
await check('chloé (lectrice) ne crée, ne modifie, ne déplace ni ne supprime : 403', async () => {
  assert.equal((await call(chloe, 'POST', pages(), { title: 'Non' })).status, 403);
  assert.equal((await call(chloe, 'PATCH', page(rootId), { title: 'Non' })).status, 403);
  assert.equal((await call(chloe, 'PUT', `${page(childId)}/placement`, { parentId: null, index: 0 })).status, 403);
  assert.equal((await call(chloe, 'DELETE', page(grandChildId))).status, 403);
});
await check('déplacer une page avec ses sous-pages ; pas sous elle-même ni sous l’une d’elles ; pas d’une autre initiative', async () => {
  const moved = await call(bruno, 'PUT', `${page(childId)}/placement`, { parentId: null, index: 0 });
  assert.equal(moved.status, 200);
  const byId = new Map(moved.body.map((p) => [p.id, p]));
  assert.deepEqual([byId.get(childId).parentId, byId.get(childId).position, byId.get(rootId).position], [null, 0, 1]);
  assert.equal(byId.get(grandChildId).parentId, childId);
  const under = await call(bruno, 'PUT', `${page(childId)}/placement`, { parentId: grandChildId, index: 0 });
  assert.deepEqual([under.status, under.body.refusal], [400, 'pageUnderItself']);
  const elsewhere = await call(bruno, 'PUT', `${page(childId)}/placement`, { parentId: otherPageId, index: 0 });
  assert.deepEqual([elsewhere.status, elsewhere.body.refusal], [400, 'unknownPage']);
  assert.equal((await call(bruno, 'POST', pages(), { title: 'Non', parentId: otherPageId })).body.refusal, 'unknownPage');
  assert.equal((await call(bruno, 'PUT', `${page(childId)}/placement`, { parentId: rootId, index: 0 })).status, 200);
});
await check('déplacer ne change pas l’auteur ni la date de la dernière modification', async () => {
  const before = (await call(alice, 'GET', page(childId))).body;
  await call(bruno, 'PUT', `${page(childId)}/placement`, { parentId: null, index: 5 });
  const after = (await call(alice, 'GET', page(childId))).body;
  assert.deepEqual([after.updatedBy.userId, after.updatedAt], [before.updatedBy.userId, before.updatedAt]);
  await call(bruno, 'PUT', `${page(childId)}/placement`, { parentId: rootId, index: 0 });
});
await check('une page qui a des sous-pages ne se supprime pas : 409 ; supprimée, sa référence n’est pas réutilisée', async () => {
  const r = await call(bruno, 'DELETE', page(childId));
  assert.deepEqual([r.status, r.body.refusal], [409, 'pageHasSubpages']);
  const temporary = await call(bruno, 'POST', pages(), { title: 'Temporaire' });
  assert.equal((await call(bruno, 'DELETE', page(temporary.body.id))).status, 204);
  assert.equal((await call(bruno, 'GET', page(temporary.body.id))).status, 404);
  const next = await call(bruno, 'POST', pages(), { title: 'Suivante' });
  assert.equal(next.body.reference, reference(6));
  assert.equal((await call(bruno, 'DELETE', page(next.body.id))).status, 204);
});
await check('initiative archivée : lecture seule pour tous, consultation possible', async () => {
  assert.equal((await call(alice, 'PUT', `/initiatives/${pgInitiativeId}/archive`)).status, 200);
  try {
    assert.equal((await call(alice, 'POST', pages(), { title: 'Non' })).status, 403);
    assert.equal((await call(alice, 'PATCH', page(rootId), { title: 'Non' })).status, 403);
    assert.equal((await call(bruno, 'PUT', `${page(childId)}/placement`, { parentId: null, index: 0 })).status, 403);
    assert.equal((await call(alice, 'DELETE', page(grandChildId))).status, 403);
    assert.equal((await call(chloe, 'GET', page(rootId))).status, 200);
  } finally {
    assert.equal((await call(alice, 'DELETE', `/initiatives/${pgInitiativeId}/archive`)).status, 200);
  }
});

console.log('\nPages — barrière 2 : base de données (RLS, compte applicatif)');
const insertPage = (sub, extra = '', values = '') =>
  asUserInDb(
    sub,
    `INSERT INTO page (id, initiative_id, title, position${extra}) VALUES (gen_random_uuid(), $1, 'Via SQL', 0${values}) RETURNING id, reference`,
    [pgInitiativeId],
  );

await check('contributeur : la référence est posée par la base, pas par la requête', async () => {
  const r = await asUserInDb(
    bruno.sub,
    `INSERT INTO page (id, initiative_id, title, position, reference) VALUES (gen_random_uuid(), $1, 'Via SQL', 0, 'FAUX') RETURNING reference`,
    [pgInitiativeId],
  );
  assert.match(r.rows[0].reference, new RegExp(`^${pagesCode}-PA-\\d{3}$`));
});
await check('propriétaire et contributeur écrivent en base', async () => {
  for (const u of [alice, bruno]) {
    assert.equal((await insertPage(u.sub)).rowCount, 1);
    assert.equal((await asUserInDb(u.sub, `UPDATE page SET title = 'Oui' WHERE id = $1`, [rootId])).rowCount, 1);
  }
});
await check('la base refuse une page sous elle-même ou sous sa sous-page, et une parente d’une autre initiative', async () => {
  await assert.rejects(asUserInDb(bruno.sub, 'UPDATE page SET parent_id = $1 WHERE id = $2', [grandChildId, rootId]), /sous elle-même/);
  await assert.rejects(asUserInDb(bruno.sub, 'UPDATE page SET parent_id = id WHERE id = $1', [rootId]), /sous elle-même/);
  await assert.rejects(asUserInDb(bruno.sub, 'UPDATE page SET parent_id = $1 WHERE id = $2', [otherPageId, rootId]), /page_parent_fkey/);
});
await check('la base refuse une page qui a des sous-pages, et un texte de plus de 200 000 caractères', async () => {
  await assert.rejects(asUserInDb(alice.sub, 'DELETE FROM page WHERE id = $1', [childId]), /page_parent_fkey/);
  const long = JSON.stringify(doc('x'.repeat(200_001)));
  await assert.rejects(asUserInDb(alice.sub, 'UPDATE page SET content = $1 WHERE id = $2', [long, rootId]), /page_text_length/);
});
await check('lectrice et non-membre n’écrivent pas ; non-membre ne lit rien', async () => {
  await assert.rejects(insertPage(chloe.sub), /row-level security/);
  await assert.rejects(insertPage(admin.sub), /row-level security/);
  assert.equal((await asUserInDb(chloe.sub, `UPDATE page SET title = 'Non' WHERE id = $1`, [rootId])).rowCount, 0);
  assert.equal((await asUserInDb(chloe.sub, 'DELETE FROM page WHERE id = $1', [grandChildId])).rowCount, 0);
  assert.equal((await asUserInDb(chloe.sub, 'SELECT 1 FROM page WHERE id = $1', [rootId])).rowCount, 1);
  assert.equal((await asUserInDb(admin.sub, 'SELECT 1 FROM page WHERE id = $1', [rootId])).rowCount, 0);
});
await check('initiative archivée : la base refuse toute écriture, même au propriétaire', async () => {
  assert.equal((await call(alice, 'PUT', `/initiatives/${pgInitiativeId}/archive`)).status, 200);
  try {
    await assert.rejects(insertPage(alice.sub), /row-level security/);
    assert.equal((await asUserInDb(alice.sub, `UPDATE page SET title = 'Non' WHERE id = $1`, [rootId])).rowCount, 0);
    assert.equal((await asUserInDb(alice.sub, 'DELETE FROM page WHERE id = $1', [grandChildId])).rowCount, 0);
  } finally {
    assert.equal((await call(alice, 'DELETE', `/initiatives/${pgInitiativeId}/archive`)).status, 200);
  }
});
