import { assert, check, call, alice, bruno, code } from './commun.mjs';

// Modification simultanée d'une page (phase 2, ticket 24) : deux sessions, alice
// (propriétaire) et bruno (contributeur), ouvrent la même page. Pas de verrou : le
// refus est décidé par l'API, à partir de l'enregistrement sur lequel la saisie est basée.
console.log('\nModification simultanée d’une page — deux sessions');
export let msInitiativeId;
let pageId;
const page = () => `/initiatives/${msInitiativeId}/pages/${pageId}`;
const doc = (text) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
/** Ouvrir la page : l'enregistrement sur lequel la saisie sera basée. */
const open = async (user) => (await call(user, 'GET', page())).body.revisionId;
const history = async () => (await call(alice, 'GET', `${page()}/revisions`)).body.slice().reverse();

await check('alice crée l’initiative et invite bruno (contributeur) ; bruno crée une page', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}MS`, name: 'Modification simultanée' });
  assert.equal(r.status, 201);
  msInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `/initiatives/${msInitiativeId}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  const created = await call(bruno, 'POST', `/initiatives/${msInitiativeId}/pages`, { title: 'Budget', content: doc('un') });
  assert.equal(created.status, 201);
  pageId = created.body.id;
});
await check('sans l’enregistrement sur lequel la saisie est basée : 400', async () => {
  assert.equal((await call(alice, 'PATCH', page(), { title: 'Non' })).status, 400);
  assert.equal((await call(alice, 'PATCH', page(), { baseRevisionId: 'pas-un-id', title: 'Non' })).status, 400);
});

let refused;
await check('les deux ouvrent la page ; bruno enregistre : 200 ; alice enregistre ensuite : 409 pageChangedSince, avec qui et quand', async () => {
  const [aliceBase, brunoBase] = [await open(alice), await open(bruno)];
  assert.equal(aliceBase, brunoBase);
  const saved = await call(bruno, 'PATCH', page(), { baseRevisionId: brunoBase, content: doc('deux de bruno') });
  assert.equal(saved.status, 200);
  refused = await call(alice, 'PATCH', page(), { baseRevisionId: aliceBase, title: 'Budget d’alice', content: doc('deux d’alice') });
  assert.deepEqual([refused.status, refused.body.refusal], [409, 'pageChangedSince']);
  // La page dans son état actuel : celui de bruno, son auteur et son heure.
  assert.deepEqual(
    [refused.body.page.revisionId, refused.body.page.title, refused.body.page.content, refused.body.page.updatedBy.email],
    [saved.body.revisionId, 'Budget', doc('deux de bruno'), 'bruno@exemple.test'],
  );
  assert.equal(refused.body.page.updatedAt, saved.body.updatedAt);
});
await check('le refus n’écrit rien : la page reste celle de bruno, sans enregistrement de plus', async () => {
  const p = (await call(alice, 'GET', page())).body;
  assert.deepEqual([p.title, p.content], ['Budget', doc('deux de bruno')]);
  assert.equal((await history()).length, 2);
});
await check('« Enregistrer ma saisie à la suite » : 200 ; l’enregistrement de bruno reste dans l’historique', async () => {
  const r = await call(alice, 'PATCH', page(), {
    baseRevisionId: refused.body.page.revisionId,
    title: 'Budget d’alice',
    content: doc('deux d’alice'),
  });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.title, r.body.content], ['Budget d’alice', doc('deux d’alice')]);
  const list = await history();
  assert.deepEqual(list.map((x) => x.createdBy.email), ['bruno@exemple.test', 'bruno@exemple.test', 'alice@exemple.test']);
  const kept = await call(alice, 'GET', `${page()}/revisions/${list[1].id}`);
  assert.deepEqual([kept.body.title, kept.body.content], ['Budget', doc('deux de bruno')]);
});
await check('« Enregistrer comme version » sur une saisie dépassée : 409, aucune version déclarée', async () => {
  const base = await open(alice);
  assert.equal((await call(bruno, 'PATCH', page(), { baseRevisionId: base, content: doc('trois de bruno') })).status, 200);
  const r = await call(alice, 'PATCH', page(), { baseRevisionId: base, version: { note: 'Relue' } });
  assert.deepEqual([r.status, r.body.refusal], [409, 'pageChangedSince']);
  assert.equal((await call(alice, 'GET', page())).body.versions.lastVersion, null);
});
await check('une restauration depuis l’ouverture refuse aussi l’enregistrement ; un déplacement, non', async () => {
  let base = await open(alice);
  const first = (await history())[0].id;
  assert.equal((await call(bruno, 'POST', `${page()}/revisions/${first}/restore`)).status, 200);
  assert.equal((await call(alice, 'PATCH', page(), { baseRevisionId: base, content: doc('quatre') })).status, 409);
  base = await open(alice);
  assert.equal((await call(bruno, 'PUT', `${page()}/placement`, { parentId: null, index: 0 })).status, 200);
  assert.equal((await call(alice, 'PATCH', page(), { baseRevisionId: base, content: doc('quatre') })).status, 200);
});
await check('deux enregistrements arrivés en même temps sur la même base : l’un passe (200), l’autre est refusé (409)', async () => {
  for (let round = 0; round < 5; round++) {
    const base = await open(alice);
    const before = (await history()).length;
    const results = await Promise.all([
      call(alice, 'PATCH', page(), { baseRevisionId: base, content: doc(`alice ${round}`) }),
      call(bruno, 'PATCH', page(), { baseRevisionId: base, content: doc(`bruno ${round}`) }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const winner = results.find((r) => r.status === 200).body;
    const loser = results.find((r) => r.status === 409).body;
    // Le refusé reçoit l’enregistrement qui est passé.
    assert.equal(loser.page.revisionId, winner.revisionId);
    assert.equal((await history()).length, before + 1);
  }
});
