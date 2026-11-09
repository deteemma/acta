import { assert, check, call, asUserInDb, alice, bruno, chloe, admin, code } from './commun.mjs';

// Commentaires (phase 2, ticket 20, décision 05). alice propriétaire, bruno
// contributeur, chloé lectrice ; admin n'est pas membre.
console.log('\nCommentaires — barrière 1 : API (guards NestJS)');
export let cmInitiativeId;
export let cmOtherInitiativeId;
let questionId;
let actionId;
let otherTicketId;
let brunoCommentId;
let aliceCommentId;
const tickets = () => `/initiatives/${cmInitiativeId}/tickets`;
const thread = (ticketId) => `${tickets()}/${ticketId}/comments`;
const comment = (id) => `/initiatives/${cmInitiativeId}/comments/${id}`;
const member = (user) => `/initiatives/${cmInitiativeId}/members/${user.sub}`;

await check('alice crée l’initiative, invite bruno et chloé ; une question, une action ; une autre initiative', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}CM`, name: 'Commentaires' });
  assert.equal(r.status, 201);
  cmInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `/initiatives/${cmInitiativeId}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `/initiatives/${cmInitiativeId}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
  questionId = (await call(alice, 'POST', tickets(), { type: 'question', title: 'Question' })).body.id;
  actionId = (await call(alice, 'POST', `/initiatives/${cmInitiativeId}/actions`, { title: 'Action', taskId: '4.1' })).body.id;
  cmOtherInitiativeId = (await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}CX`, name: 'Autre' })).body.id;
  otherTicketId = (await call(alice, 'POST', `/initiatives/${cmOtherInitiativeId}/tickets`, { type: 'question', title: 'Ailleurs' })).body.id;
});
await check('bruno (contributeur) commente la question : texte mis en forme, sans « modifié »', async () => {
  const r = await call(bruno, 'POST', thread(questionId), { body: '  **Vu** avec CM-QU-001  ' });
  assert.equal(r.status, 201);
  assert.equal(r.body.length, 1);
  const [c] = r.body;
  assert.deepEqual([c.body, c.author.userId, c.editedAt, c.deletedAt], ['**Vu** avec CM-QU-001', bruno.sub, null, null]);
  brunoCommentId = c.id;
});
await check('texte obligatoire, 5 000 caractères au plus : 400', async () => {
  assert.equal((await call(bruno, 'POST', thread(questionId), { body: '   ' })).status, 400);
  assert.equal((await call(bruno, 'POST', thread(questionId), { body: 'a'.repeat(5001) })).status, 400);
  assert.equal((await call(bruno, 'POST', thread(questionId), { body: 'a'.repeat(5000) })).status, 201);
});
await check('ticket fermé : toujours commentable ; fil du plus ancien au plus récent', async () => {
  assert.equal((await call(alice, 'PATCH', `${tickets()}/${questionId}`, { status: 'closed' })).status, 200);
  const r = await call(alice, 'POST', thread(questionId), { body: 'Réponse de la propriétaire.' });
  assert.equal(r.status, 201);
  assert.deepEqual(r.body.map((c) => c.author.userId), [bruno.sub, bruno.sub, alice.sub]);
  aliceCommentId = r.body[2].id;
});
await check('tout type de ticket, Action comprise ; hors historique : ni modification ni entrée nouvelle', async () => {
  const before = (await call(bruno, 'GET', `/initiatives/${cmInitiativeId}/actions/${actionId}`)).body;
  assert.equal((await call(bruno, 'POST', thread(actionId), { body: 'Sur l’action.' })).status, 201);
  const after = (await call(bruno, 'GET', `/initiatives/${cmInitiativeId}/actions/${actionId}`)).body;
  assert.deepEqual([after.updatedAt, after.updatedBy.userId], [before.updatedAt, before.updatedBy.userId]);
  assert.equal((await call(bruno, 'GET', `/initiatives/${cmInitiativeId}/actions/${actionId}/history`)).body.length, 0);
  const history = (await call(bruno, 'GET', `${tickets()}/${questionId}/history`)).body;
  assert.equal(history.length, 1); // la fermeture seule
});
await check('chloé (lectrice) lit le fil, ne commente pas : 403 ; admin (non-membre) : 404', async () => {
  const seen = await call(chloe, 'GET', thread(questionId));
  assert.deepEqual([seen.status, seen.body.length], [200, 3]);
  assert.equal((await call(chloe, 'POST', thread(questionId), { body: 'Lectrice' })).status, 403);
  assert.equal((await call(chloe, 'PATCH', comment(brunoCommentId), { body: 'Lectrice' })).status, 403);
  assert.equal((await call(chloe, 'DELETE', comment(brunoCommentId))).status, 403);
  assert.equal((await call(admin, 'GET', thread(questionId))).status, 404);
});
await check('pas de commentaire sur un ticket d’une autre initiative : 404', async () => {
  assert.equal((await call(bruno, 'POST', thread(otherTicketId), { body: 'Ailleurs' })).status, 404);
  assert.equal((await call(bruno, 'GET', thread(otherTicketId))).status, 404);
});
await check('modification par son auteur seul, avec « modifié le » ; même une propriétaire ne modifie pas : 403', async () => {
  const r = await call(bruno, 'PATCH', comment(brunoCommentId), { body: 'Texte corrigé' });
  assert.equal(r.status, 200);
  assert.equal(r.body.body, 'Texte corrigé');
  assert.ok(r.body.editedAt);
  const other = await call(alice, 'PATCH', comment(brunoCommentId), { body: 'Par alice' });
  assert.deepEqual([other.status, other.body.refusal], [403, 'notCommentAuthor']);
});
await check('auteur devenu lecteur : ne modifie ni ne supprime plus son commentaire (403)', async () => {
  assert.equal((await call(alice, 'PATCH', member(bruno), { role: 'reader' })).status, 204);
  try {
    assert.equal((await call(bruno, 'PATCH', comment(brunoCommentId), { body: 'Lecteur' })).status, 403);
    assert.equal((await call(bruno, 'DELETE', comment(brunoCommentId))).status, 403);
    assert.equal((await call(bruno, 'GET', thread(questionId))).body.length, 3);
  } finally {
    assert.equal((await call(alice, 'PATCH', member(bruno), { role: 'contributor' })).status, 204);
  }
});
await check('suppression : pas par un autre contributeur (403) ; par une propriétaire, en laissant une ligne de trace', async () => {
  const refused = await call(bruno, 'DELETE', comment(aliceCommentId));
  assert.deepEqual([refused.status, refused.body.refusal], [403, 'cannotDeleteComment']);
  const r = await call(alice, 'DELETE', comment(brunoCommentId));
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.body, r.body.deletedBy.userId, r.body.author.userId], [null, alice.sub, bruno.sub]);
  assert.ok(r.body.deletedAt);
  const seen = (await call(chloe, 'GET', thread(questionId))).body;
  assert.deepEqual(seen.map((c) => c.id === brunoCommentId && c.body === null), [true, false, false]);
});
await check('une ligne de trace ne se modifie ni ne se supprime : 409', async () => {
  const edit = await call(bruno, 'PATCH', comment(brunoCommentId), { body: 'Retour' });
  assert.deepEqual([edit.status, edit.body.refusal], [409, 'commentDeleted']);
  const again = await call(alice, 'DELETE', comment(brunoCommentId));
  assert.deepEqual([again.status, again.body.refusal], [409, 'commentDeleted']);
});
await check('l’auteur supprime son propre commentaire', async () => {
  const mine = (await call(bruno, 'POST', thread(actionId), { body: 'À retirer' })).body.at(-1).id;
  const r = await call(bruno, 'DELETE', comment(mine));
  assert.deepEqual([r.status, r.body.deletedBy.userId], [200, bruno.sub]);
});
await check('supprimer le ticket emporte ses commentaires', async () => {
  const decision = (await call(bruno, 'POST', tickets(), { type: 'decision', title: 'Éphémère' })).body.id;
  assert.equal((await call(bruno, 'POST', thread(decision), { body: 'Disparaîtra' })).status, 201);
  assert.equal((await call(bruno, 'DELETE', `${tickets()}/${decision}`)).status, 204);
  assert.equal((await asUserInDb(alice.sub, 'SELECT 1 FROM comment WHERE ticket_id = $1', [decision])).rowCount, 0);
});

console.log('\nCommentaires — barrière 2 : base de données (RLS, compte applicatif)');
const insertComment = (sub, ticketId = questionId, body = 'En base') =>
  asUserInDb(sub, 'INSERT INTO comment (id, initiative_id, ticket_id, body) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING created_by', [cmInitiativeId, ticketId, body]);

await check('propriétaire et contributeur commentent en base ; l’auteur est celui qui écrit', async () => {
  for (const u of [alice, bruno]) assert.equal((await insertComment(u.sub)).rows[0].created_by, u.sub);
  const forged = await asUserInDb(
    bruno.sub,
    'INSERT INTO comment (id, initiative_id, ticket_id, body, created_by) VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING created_by',
    [cmInitiativeId, questionId, 'Usurpé', alice.sub],
  );
  assert.equal(forged.rows[0].created_by, bruno.sub);
});
await check('la base refuse : sans objet, sur deux objets, ticket d’une autre initiative, texte vide ou trop long', async () => {
  await assert.rejects(
    asUserInDb(bruno.sub, 'INSERT INTO comment (id, initiative_id, body) VALUES (gen_random_uuid(), $1, $2)', [cmInitiativeId, 'Rien']),
    /comment_one_subject/,
  );
  const pageId = (await call(bruno, 'POST', `/initiatives/${cmInitiativeId}/pages`, { title: 'Page' })).body.id;
  await assert.rejects(
    asUserInDb(bruno.sub, 'INSERT INTO comment (id, initiative_id, ticket_id, page_id, body) VALUES (gen_random_uuid(), $1, $2, $3, $4)', [cmInitiativeId, questionId, pageId, 'Deux']),
    /comment_one_subject/,
  );
  // La table accueille déjà les commentaires d'une page (ticket 25).
  const onPage = await asUserInDb(bruno.sub, 'INSERT INTO comment (id, initiative_id, page_id, body) VALUES (gen_random_uuid(), $1, $2, $3)', [cmInitiativeId, pageId, 'Page']);
  assert.equal(onPage.rowCount, 1);
  await assert.rejects(insertComment(bruno.sub, otherTicketId), /comment_ticket_fkey/);
  await assert.rejects(insertComment(bruno.sub, questionId, ' '), /comment_body_length/);
  await assert.rejects(insertComment(bruno.sub, questionId, 'a'.repeat(5001)), /comment_body_length/);
});
await check('en base : l’auteur seul modifie ; un autre contributeur ne voit rien à mettre à jour ; une propriétaire ne fait que supprimer', async () => {
  const own = await asUserInDb(bruno.sub, `UPDATE comment SET body = 'En base' WHERE created_by = $1 AND body IS NOT NULL AND initiative_id = $2`, [bruno.sub, cmInitiativeId]);
  assert.ok(own.rowCount > 0);
  assert.equal((await asUserInDb(bruno.sub, `UPDATE comment SET body = 'Par bruno' WHERE id = $1`, [aliceCommentId])).rowCount, 0);
  assert.equal((await asUserInDb(bruno.sub, 'UPDATE comment SET body = NULL WHERE id = $1', [aliceCommentId])).rowCount, 0);
  const otherOwn = (await call(bruno, 'POST', thread(questionId), { body: 'De bruno' })).body.at(-1).id;
  await assert.rejects(asUserInDb(alice.sub, `UPDATE comment SET body = 'Par alice' WHERE id = $1`, [otherOwn]), /comment_edit_allowed|seul son auteur/);
  const trace = await asUserInDb(alice.sub, 'UPDATE comment SET body = NULL WHERE id = $1 RETURNING deleted_by, deleted_at', [otherOwn]);
  assert.equal(trace.rows[0].deleted_by, alice.sub);
  assert.ok(trace.rows[0].deleted_at);
  await assert.rejects(asUserInDb(alice.sub, `UPDATE comment SET body = 'Retour' WHERE id = $1`, [brunoCommentId]), /comment_deleted|supprimé/);
});
await check('aucune ligne ne s’efface en base, même par une propriétaire', async () => {
  assert.equal((await asUserInDb(alice.sub, 'DELETE FROM comment WHERE initiative_id = $1', [cmInitiativeId])).rowCount, 0);
});
await check('auteur devenu lecteur : rien à mettre à jour en base ; lectrice et non-membre n’écrivent pas ; non-membre ne lit rien', async () => {
  assert.equal((await call(alice, 'PATCH', member(bruno), { role: 'reader' })).status, 204);
  try {
    assert.equal((await asUserInDb(bruno.sub, `UPDATE comment SET body = 'Lecteur' WHERE created_by = $1`, [bruno.sub])).rowCount, 0);
    await assert.rejects(insertComment(bruno.sub), /row-level security/);
  } finally {
    assert.equal((await call(alice, 'PATCH', member(bruno), { role: 'contributor' })).status, 204);
  }
  await assert.rejects(insertComment(chloe.sub), /row-level security/);
  await assert.rejects(insertComment(admin.sub), /row-level security/);
  assert.ok((await asUserInDb(chloe.sub, 'SELECT 1 FROM comment WHERE ticket_id = $1', [questionId])).rowCount > 0);
  assert.equal((await asUserInDb(admin.sub, 'SELECT 1 FROM comment')).rowCount, 0);
});

console.log('\nCommentaires — initiative archivée');
await check('initiative archivée : ni ajout, ni modification, ni suppression (403, rien en base) ; tout membre lit', async () => {
  assert.equal((await call(alice, 'PUT', `/initiatives/${cmInitiativeId}/archive`)).status, 200);
  try {
    for (const u of [alice, bruno]) {
      assert.equal((await call(u, 'POST', thread(questionId), { body: 'Archivée' })).status, 403);
      assert.equal((await call(u, 'DELETE', comment(aliceCommentId))).status, 403);
      await assert.rejects(insertComment(u.sub), /row-level security/);
      assert.equal((await asUserInDb(u.sub, 'UPDATE comment SET body = NULL WHERE id = $1', [aliceCommentId])).rowCount, 0);
    }
    assert.equal((await call(alice, 'PATCH', comment(aliceCommentId), { body: 'Archivée' })).status, 403);
    for (const u of [alice, bruno, chloe]) assert.equal((await call(u, 'GET', thread(questionId))).status, 200);
  } finally {
    assert.equal((await call(alice, 'DELETE', `/initiatives/${cmInitiativeId}/archive`)).status, 200);
  }
});
