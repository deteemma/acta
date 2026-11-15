import { assert, check, call, asUserInDb, inDbTransaction, savePage, alice, bruno, chloe, admin, code } from './commun.mjs';

// Liens et commentaires des pages (phase 2, ticket 25, décisions 04 et 05).
// alice propriétaire, bruno contributeur, chloé lectrice ; admin n'est pas membre.
console.log('\nLiens et commentaires des pages — barrière 1 : API (guards NestJS)');
export let plInitiativeId;
export let plOtherInitiativeId;
let pageId;
let otherPageId;
let questionId;
let actionId;
let needId;
let requirementId;
let otherTicketId;
let otherNeedId;
let elsewherePageId;
let brunoCommentId;
const base = () => `/initiatives/${plInitiativeId}`;
const links = () => `${base()}/links`;
const page = (id = pageId) => `${base()}/pages/${id}`;
const pageLink = (kind, objectId, id = pageId) => `${links()}/pages/${id}/${kind}/${objectId}`;
const thread = (id = pageId) => `${page(id)}/comments`;
const pageLinksOf = async (user) => (await call(user, 'GET', links())).body.pageLinks;
const member = (user) => `${base()}/members/${user.sub}`;

await check('alice crée l’initiative, invite bruno et chloé ; une page, des tickets, un besoin, une exigence ; une autre initiative', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}PL`, name: 'Liens des pages' });
  assert.equal(r.status, 201);
  plInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `${base()}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `${base()}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
  pageId = (await call(alice, 'POST', `${base()}/pages`, { title: 'Cadrage' })).body.id;
  otherPageId = (await call(alice, 'POST', `${base()}/pages`, { title: 'Seconde' })).body.id;
  questionId = (await call(alice, 'POST', `${base()}/tickets`, { type: 'question', title: 'Question' })).body.id;
  actionId = (await call(alice, 'POST', `${base()}/actions`, { title: 'Action', taskId: '4.1' })).body.id;
  needId = (await call(alice, 'POST', `${base()}/needs`, { title: 'Besoin', nature: 'problem' })).body.id;
  requirementId = (
    await call(alice, 'POST', `${base()}/requirements`, { title: 'Exigence', statement: 'Énoncé.', type: 'business', needIds: [needId] })
  ).body.id;
  plOtherInitiativeId = (await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}LP`, name: 'Autre' })).body.id;
  otherTicketId = (await call(alice, 'POST', `/initiatives/${plOtherInitiativeId}/tickets`, { type: 'question', title: 'Ailleurs' })).body.id;
  otherNeedId = (await call(alice, 'POST', `/initiatives/${plOtherInitiativeId}/needs`, { title: 'Ailleurs', nature: 'problem' })).body.id;
  elsewherePageId = (await call(alice, 'POST', `/initiatives/${plOtherInitiativeId}/pages`, { title: 'Ailleurs' })).body.id;
});
await check('bruno (contributeur) lie la page à un ticket, une action, un besoin, une exigence ; vus des deux côtés', async () => {
  for (const object of [
    { kind: 'ticket', id: questionId },
    { kind: 'ticket', id: actionId },
    { kind: 'need', id: needId },
    { kind: 'requirement', id: requirementId },
  ]) {
    const r = await call(bruno, 'POST', `${links()}/pages`, { pageId, object });
    assert.equal(r.status, 201, JSON.stringify(object));
  }
  // Créé depuis l'autre objet : même route, même lien.
  assert.equal((await call(alice, 'POST', `${links()}/pages`, { pageId: otherPageId, object: { kind: 'need', id: needId } })).status, 201);
  const seen = await pageLinksOf(chloe);
  assert.equal(seen.length, 5);
  assert.ok(seen.some((l) => l.pageId === pageId && l.object.kind === 'requirement' && l.object.id === requirementId));
});
await check('sans nature, un seul lien par paire : 409 ; pas de lien entre deux pages : 400', async () => {
  const again = await call(bruno, 'POST', `${links()}/pages`, { pageId, object: { kind: 'need', id: needId } });
  assert.deepEqual([again.status, again.body.refusal], [409, 'alreadyLinked']);
  assert.equal((await call(bruno, 'POST', `${links()}/pages`, { pageId, object: { kind: 'page', id: otherPageId } })).status, 400);
  assert.equal((await call(bruno, 'DELETE', `${links()}/pages/${pageId}/page/${otherPageId}`)).status, 404);
});
await check('pas de lien entre initiatives : ticket, besoin ou page d’ailleurs refusés', async () => {
  const t = await call(bruno, 'POST', `${links()}/pages`, { pageId, object: { kind: 'ticket', id: otherTicketId } });
  assert.deepEqual([t.status, t.body.refusal], [400, 'unknownTicket']);
  const n = await call(bruno, 'POST', `${links()}/pages`, { pageId, object: { kind: 'need', id: otherNeedId } });
  assert.deepEqual([n.status, n.body.refusal], [400, 'unknownNeed']);
  const p = await call(bruno, 'POST', `${links()}/pages`, { pageId: elsewherePageId, object: { kind: 'ticket', id: questionId } });
  assert.deepEqual([p.status, p.body.refusal], [400, 'unknownLinkedPage']);
});
await check('liens hors historique : la page ne gagne aucun enregistrement, ni le ticket d’historique', async () => {
  const shown = (await call(chloe, 'GET', page())).body;
  assert.equal(shown.updatedAt, shown.createdAt);
  assert.equal((await call(chloe, 'GET', `${page()}/revisions`)).body.length, 1);
  assert.equal((await call(chloe, 'GET', `${base()}/tickets/${questionId}/history`)).body.length, 0);
  // L'exigence garde sa seule entrée de création.
  assert.equal((await call(chloe, 'GET', `${base()}/requirements/${requirementId}/history`)).body.length, 1);
});
await check('une page liée ne se supprime pas, un objet lié à une page non plus : 409', async () => {
  const p = await call(bruno, 'DELETE', page());
  assert.deepEqual([p.status, p.body.refusal], [409, 'pageLinked']);
  const q = await call(bruno, 'DELETE', `${base()}/tickets/${questionId}`);
  assert.deepEqual([q.status, q.body.refusal], [409, 'ticketLinked']);
  const a = await call(bruno, 'DELETE', `${base()}/actions/${actionId}`);
  assert.deepEqual([a.status, a.body.refusal], [409, 'linked']);
  const n = await call(bruno, 'DELETE', `${base()}/needs/${needId}`);
  assert.deepEqual([n.status, n.body.refusal], [409, 'needLinked']);
  const e = await call(bruno, 'DELETE', `${base()}/requirements/${requirementId}`);
  assert.deepEqual([e.status, e.body.refusal], [409, 'requirementLinked']);
});
await check('chloé (lectrice) consulte, ne lie ni ne retire : 403 ; admin (non-membre) : 404', async () => {
  assert.equal((await call(chloe, 'POST', `${links()}/pages`, { pageId: otherPageId, object: { kind: 'ticket', id: questionId } })).status, 403);
  assert.equal((await call(chloe, 'DELETE', pageLink('need', needId))).status, 403);
  assert.equal((await call(admin, 'POST', `${links()}/pages`, { pageId, object: { kind: 'ticket', id: questionId } })).status, 404);
  assert.equal((await call(admin, 'GET', links())).status, 404);
});

await check('bruno commente la page entière ; tout membre lit le fil ; chloé et admin n’écrivent pas', async () => {
  const r = await call(bruno, 'POST', thread(), { body: 'Voir **CR** du comité' });
  assert.equal(r.status, 201);
  assert.equal(r.body.length, 1);
  brunoCommentId = r.body[0].id;
  assert.equal((await call(alice, 'POST', thread(), { body: 'Merci' })).status, 201);
  assert.deepEqual((await call(chloe, 'GET', thread())).body.map((c) => c.body), ['Voir **CR** du comité', 'Merci']);
  assert.equal((await call(chloe, 'POST', thread(), { body: 'Non' })).status, 403);
  assert.equal((await call(admin, 'GET', thread())).status, 404);
  assert.equal((await call(bruno, 'POST', thread(), { body: ' ' })).status, 400);
  assert.equal((await call(bruno, 'POST', thread(), { body: 'a'.repeat(5001) })).status, 400);
  // Page d'une autre initiative : introuvable par ce chemin.
  assert.equal((await call(bruno, 'GET', `${base()}/pages/${elsewherePageId}/comments`)).status, 404);
});
await check('le fil reste après un nouvel enregistrement, sans rattachement ; la page n’en gagne pas d’enregistrement', async () => {
  const before = (await call(chloe, 'GET', `${page()}/revisions`)).body.length;
  assert.equal(before, 1);
  assert.equal((await savePage(alice, page(), { title: 'Cadrage 2' })).status, 200);
  assert.equal((await call(chloe, 'GET', `${page()}/revisions`)).body.length, 2);
  assert.equal((await call(chloe, 'GET', thread())).body.length, 2);
});
await check('mêmes droits qu’au ticket 20 : l’auteur modifie, alice supprime, l’auteur devenu lecteur ne modifie plus', async () => {
  const comment = `${base()}/comments/${brunoCommentId}`;
  assert.equal((await call(alice, 'PATCH', comment, { body: 'Pas à moi' })).status, 403);
  const edited = await call(bruno, 'PATCH', comment, { body: 'Voir le CR' });
  assert.equal(edited.status, 200);
  assert.notEqual(edited.body.editedAt, null);
  assert.equal((await call(alice, 'PATCH', member(bruno), { role: 'reader' })).status, 204);
  try {
    assert.equal((await call(bruno, 'PATCH', comment, { body: 'Encore' })).status, 403);
    // Seconde barrière : la base refuse aussi l'auteur devenu lecteur.
    const inDb = await asUserInDb(bruno.sub, `UPDATE comment SET body = 'En base' WHERE id = $1`, [brunoCommentId]);
    assert.equal(inDb.rowCount, 0);
  } finally {
    assert.equal((await call(alice, 'PATCH', member(bruno), { role: 'contributor' })).status, 204);
  }
  const removed = await call(alice, 'DELETE', comment);
  assert.deepEqual([removed.status, removed.body.body, removed.body.deletedBy.userId], [200, null, alice.sub]);
});

console.log('\nLiens et commentaires des pages — barrière 2 : base de données (RLS, compte applicatif)');
const insertPageNeed = (sub, page = otherPageId) =>
  asUserInDb(sub, 'INSERT INTO page_need (initiative_id, page_id, need_id) VALUES ($1, $2, $3)', [plInitiativeId, page, needId]);
const insertPageComment = (sub, page = pageId) =>
  asUserInDb(sub, `INSERT INTO comment (id, initiative_id, page_id, body, created_by) VALUES (gen_random_uuid(), $1, $2, 'En base', $3)`, [plInitiativeId, page, sub]);

await check('propriétaire et contributeur lient et retirent en base ; commentent la page', async () => {
  for (const u of [alice, bruno]) {
    const createThenRemove = await inDbTransaction([
      { sub: u.sub, query: 'INSERT INTO page_ticket (initiative_id, page_id, ticket_id) VALUES ($1, $2, $3)', params: [plInitiativeId, otherPageId, questionId] },
      { sub: u.sub, query: 'DELETE FROM page_ticket WHERE page_id = $1 AND ticket_id = $2', params: [otherPageId, questionId] },
    ]);
    assert.equal(createThenRemove.rowCount, 1);
    assert.equal((await insertPageComment(u.sub)).rowCount, 1);
  }
});
await check('la base refuse : autre initiative, doublon, page ou objet lié supprimé', async () => {
  await assert.rejects(
    asUserInDb(bruno.sub, 'INSERT INTO page_ticket (initiative_id, page_id, ticket_id) VALUES ($1, $2, $3)', [plInitiativeId, pageId, otherTicketId]),
    /page_ticket_ticket_fkey/,
  );
  await assert.rejects(insertPageNeed(bruno.sub, pageId), /page_need_pkey/);
  await assert.rejects(asUserInDb(bruno.sub, 'DELETE FROM page WHERE id = $1', [pageId]), /page_\w+_page_fkey/);
  await assert.rejects(asUserInDb(bruno.sub, 'DELETE FROM need WHERE id = $1', [needId]), /_need_fkey/);
  await assert.rejects(asUserInDb(bruno.sub, 'DELETE FROM requirement WHERE id = $1', [requirementId]), /page_requirement_requirement_fkey/);
});
await check('lectrice et non-membre n’écrivent pas ; non-membre ne lit rien', async () => {
  await assert.rejects(asUserInDb(chloe.sub, 'INSERT INTO page_ticket (initiative_id, page_id, ticket_id) VALUES ($1, $2, $3)', [plInitiativeId, otherPageId, questionId]), /row-level security/);
  await assert.rejects(insertPageComment(chloe.sub), /row-level security/);
  await assert.rejects(insertPageComment(admin.sub), /row-level security/);
  assert.equal((await asUserInDb(chloe.sub, 'DELETE FROM page_need WHERE page_id = $1', [pageId])).rowCount, 0);
  assert.equal((await asUserInDb(chloe.sub, 'SELECT 1 FROM page_need WHERE page_id = $1', [pageId])).rowCount, 1);
  for (const table of ['page_ticket', 'page_need', 'page_requirement']) {
    assert.equal((await asUserInDb(admin.sub, `SELECT 1 FROM ${table}`)).rowCount, 0, table);
  }
  assert.equal((await asUserInDb(admin.sub, 'SELECT 1 FROM comment WHERE page_id = $1', [pageId])).rowCount, 0);
});

console.log('\nLiens et commentaires des pages — initiative archivée, puis suppression de la page');
await check('initiative archivée : liens et commentaires en lecture seule pour tous, consultables', async () => {
  assert.equal((await call(alice, 'PUT', `${base()}/archive`)).status, 200);
  try {
    for (const u of [alice, bruno]) {
      assert.equal((await call(u, 'POST', `${links()}/pages`, { pageId: otherPageId, object: { kind: 'ticket', id: questionId } })).status, 403);
      assert.equal((await call(u, 'DELETE', pageLink('need', needId))).status, 403);
      assert.equal((await call(u, 'POST', thread(), { body: 'Archivée' })).status, 403);
      assert.equal((await asUserInDb(u.sub, 'DELETE FROM page_need WHERE page_id = $1', [pageId])).rowCount, 0);
      await assert.rejects(insertPageComment(u.sub), /row-level security/);
    }
    for (const u of [alice, bruno, chloe]) {
      assert.equal((await pageLinksOf(u)).length, 5);
      assert.ok((await call(u, 'GET', thread())).body.length >= 2);
    }
  } finally {
    assert.equal((await call(alice, 'DELETE', `${base()}/archive`)).status, 200);
  }
});
await check('retirer depuis l’un ou l’autre bout ; la page se supprime ensuite, avec ses commentaires', async () => {
  for (const [kind, id] of [['ticket', questionId], ['ticket', actionId], ['need', needId], ['requirement', requirementId]]) {
    assert.equal((await call(bruno, 'DELETE', pageLink(kind, id))).status, 204);
  }
  // Un lien déjà retiré n'est pas une erreur.
  assert.equal((await call(bruno, 'DELETE', pageLink('need', needId))).status, 204);
  assert.equal((await call(bruno, 'DELETE', page())).status, 204);
  assert.equal((await asUserInDb(alice.sub, 'SELECT 1 FROM comment WHERE page_id = $1', [pageId])).rowCount, 0);
  // Les objets ne sont plus liés qu'à la seconde page (le besoin) : la question se supprime.
  assert.equal((await call(bruno, 'DELETE', `${base()}/tickets/${questionId}`)).status, 204);
});
