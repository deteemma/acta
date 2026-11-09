import { assert, check, call, asUserInDb, inDbTransaction, alice, bruno, chloe, admin, code } from './commun.mjs';

// Liens (phase 2, ticket 19, décision 04). alice propriétaire, bruno contributeur,
// chloé lectrice ; admin n'est pas membre.
console.log('\nLiens — barrière 1 : API (guards NestJS)');
export let lkInitiativeId;
export let lkOtherInitiativeId;
let questionId;
let riskId;
let epicId;
let actionId;
let otherTicketId;
let needId;
let requirementId;
const links = () => `/initiatives/${lkInitiativeId}/links`;
const tickets = () => `/initiatives/${lkInitiativeId}/tickets`;
const ticketLink = (a, b) => `${links()}/tickets/${a}/${b}`;
const linksOf = async (user) => (await call(user, 'GET', links())).body;

await check('alice crée l’initiative, invite bruno et chloé ; tickets, besoin, exigence ; une autre initiative', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}LK`, name: 'Liens' });
  assert.equal(r.status, 201);
  lkInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `/initiatives/${lkInitiativeId}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `/initiatives/${lkInitiativeId}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
  questionId = (await call(alice, 'POST', tickets(), { type: 'question', title: 'Question' })).body.id;
  riskId = (await call(alice, 'POST', tickets(), { type: 'risk', title: 'Risque' })).body.id;
  epicId = (await call(alice, 'POST', tickets(), { type: 'epic', title: 'Epic' })).body.id;
  actionId = (await call(alice, 'POST', `/initiatives/${lkInitiativeId}/actions`, { title: 'Action', taskId: '4.1' })).body.id;
  needId = (await call(alice, 'POST', `/initiatives/${lkInitiativeId}/needs`, { title: 'Besoin', nature: 'problem' })).body.id;
  requirementId = (
    await call(alice, 'POST', `/initiatives/${lkInitiativeId}/requirements`, { title: 'Exigence', statement: 'Énoncé.', type: 'business', needIds: [needId] })
  ).body.id;
  lkOtherInitiativeId = (await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}LX`, name: 'Autre' })).body.id;
  otherTicketId = (await call(alice, 'POST', `/initiatives/${lkOtherInitiativeId}/tickets`, { type: 'question', title: 'Ailleurs' })).body.id;
});
await check('bruno (contributeur) : « est bloqué par » depuis la question ; chaque côté retrouve son sens', async () => {
  const r = await call(bruno, 'POST', `${links()}/tickets`, { ticketId: questionId, otherTicketId: riskId, side: 'blocked_by' });
  assert.equal(r.status, 201);
  assert.deepEqual(r.body.ticketLinks, [{ sourceId: riskId, targetId: questionId, kind: 'blocks' }]);
});
await check('un seul lien par paire, dans un sens comme dans l’autre : 409 ; pas de lien vers soi-même : 400', async () => {
  const again = await call(bruno, 'POST', `${links()}/tickets`, { ticketId: riskId, otherTicketId: questionId, side: 'relates_to' });
  assert.deepEqual([again.status, again.body.refusal], [409, 'alreadyLinked']);
  const self = await call(bruno, 'POST', `${links()}/tickets`, { ticketId: riskId, otherTicketId: riskId, side: 'relates_to' });
  assert.deepEqual([self.status, self.body.refusal], [400, 'selfLink']);
  const kind = await call(bruno, 'POST', `${links()}/tickets`, { ticketId: riskId, otherTicketId: epicId, side: 'depends_on' });
  assert.equal(kind.status, 400);
});
await check('pas de lien entre initiatives : ticket, besoin ou exigence d’ailleurs refusés', async () => {
  const r = await call(bruno, 'POST', `${links()}/tickets`, { ticketId: riskId, otherTicketId, side: 'relates_to' });
  assert.deepEqual([r.status, r.body.refusal], [400, 'unknownTicket']);
  const otherNeed = (await call(alice, 'POST', `/initiatives/${lkOtherInitiativeId}/needs`, { title: 'Ailleurs', nature: 'problem' })).body.id;
  const n = await call(bruno, 'POST', `${links()}/needs`, { ticketId: riskId, needId: otherNeed });
  assert.deepEqual([n.status, n.body.refusal], [400, 'unknownNeed']);
  const t = await call(bruno, 'POST', `${links()}/needs`, { ticketId: otherTicketId, needId });
  assert.deepEqual([t.status, t.body.refusal], [400, 'unknownTicket']);
});
await check('tout type de ticket se lie aux besoins et aux exigences, Epic et Action compris ; doublon : 409', async () => {
  for (const ticketId of [epicId, actionId, riskId]) {
    assert.equal((await call(bruno, 'POST', `${links()}/needs`, { ticketId, needId })).status, 201);
  }
  assert.equal((await call(alice, 'POST', `${links()}/requirements`, { ticketId: questionId, requirementId })).status, 201);
  const again = await call(bruno, 'POST', `${links()}/requirements`, { ticketId: questionId, requirementId });
  assert.deepEqual([again.status, again.body.refusal], [409, 'alreadyLinked']);
  // Le lien de l'Action reste celui de la phase 1 : la fiche de l'action le montre.
  const action = (await call(chloe, 'GET', `/initiatives/${lkInitiativeId}/actions/${actionId}`)).body;
  assert.deepEqual(action.needs.map((n) => n.id), [needId]);
});
await check('chloé (lectrice) consulte les liens, n’en crée ni n’en retire : 403 ; admin (non-membre) : 404', async () => {
  const seen = await linksOf(chloe);
  assert.deepEqual([seen.ticketLinks.length, seen.needLinks.length, seen.requirementLinks.length], [1, 3, 1]);
  assert.equal((await call(chloe, 'POST', `${links()}/tickets`, { ticketId: riskId, otherTicketId: epicId, side: 'relates_to' })).status, 403);
  assert.equal((await call(chloe, 'DELETE', ticketLink(questionId, riskId))).status, 403);
  assert.equal((await call(chloe, 'DELETE', `${links()}/needs/${riskId}/${needId}`)).status, 403);
  assert.equal((await call(admin, 'GET', links())).status, 404);
  assert.equal((await call(admin, 'POST', `${links()}/needs`, { ticketId: questionId, needId })).status, 404);
});
await check('liens hors historique : ni le ticket, ni l’exigence ne gagnent de modification', async () => {
  const history = (await call(chloe, 'GET', `${tickets()}/${questionId}/history`)).body;
  assert.equal(history.length, 0);
  const question = (await call(chloe, 'GET', `${tickets()}/${questionId}`)).body;
  assert.equal(question.updatedAt, question.createdAt);
  const requirementHistory = (await call(chloe, 'GET', `/initiatives/${lkInitiativeId}/requirements/${requirementId}/history`)).body;
  assert.equal(requirementHistory.length, 1);
});
await check('un objet lié ne se supprime pas : ticket, Action, besoin, exigence : 409', async () => {
  const q = await call(bruno, 'DELETE', `${tickets()}/${questionId}`);
  assert.deepEqual([q.status, q.body.refusal], [409, 'ticketLinked']);
  const r = await call(bruno, 'DELETE', `${tickets()}/${riskId}`);
  assert.deepEqual([r.status, r.body.refusal], [409, 'ticketLinked']);
  const a = await call(bruno, 'DELETE', `/initiatives/${lkInitiativeId}/actions/${actionId}`);
  assert.deepEqual([a.status, a.body.refusal], [409, 'linked']);
  const n = await call(bruno, 'DELETE', `/initiatives/${lkInitiativeId}/needs/${needId}`);
  assert.deepEqual([n.status, n.body.refusal], [409, 'needLinked']);
  const e = await call(bruno, 'DELETE', `/initiatives/${lkInitiativeId}/requirements/${requirementId}`);
  assert.deepEqual([e.status, e.body.refusal], [409, 'requirementLinked']);
});
await check('l’ancien chemin de l’Action (besoins dans PATCH) ne modifie pas l’action non plus', async () => {
  const path = `/initiatives/${lkInitiativeId}/actions/${actionId}`;
  const before = (await call(bruno, 'GET', path)).body;
  const unlinked = await call(bruno, 'PATCH', path, { needIds: [] });
  assert.deepEqual([unlinked.body.needs, unlinked.body.updatedAt], [[], before.updatedAt]);
  assert.equal((await call(bruno, 'GET', `${path}/history`)).body.length, 0);
  assert.equal((await call(bruno, 'POST', `${links()}/needs`, { ticketId: actionId, needId })).status, 201);
});
await check('retirer depuis l’un ou l’autre bout ; le ticket se supprime ensuite', async () => {
  // Créé depuis la question, retiré depuis le risque.
  assert.equal((await call(bruno, 'DELETE', ticketLink(riskId, questionId))).status, 204);
  assert.equal((await call(bruno, 'DELETE', `${links()}/needs/${riskId}/${needId}`)).status, 204);
  assert.equal((await linksOf(bruno)).ticketLinks.length, 0);
  assert.equal((await call(bruno, 'DELETE', `${tickets()}/${riskId}`)).status, 204);
  // Un lien déjà retiré n'est pas une erreur.
  assert.equal((await call(bruno, 'DELETE', ticketLink(riskId, questionId))).status, 204);
});

console.log('\nLiens — barrière 2 : base de données (RLS, compte applicatif)');
const insertLink = (sub, source, target, kind = 'relates_to') =>
  asUserInDb(sub, 'INSERT INTO ticket_link (initiative_id, source_id, target_id, kind) VALUES ($1, $2, $3, $4)', [lkInitiativeId, source, target, kind]);

await check('propriétaire et contributeur créent et retirent un lien en base', async () => {
  const createThenRemove = (sub) =>
    inDbTransaction([
      { sub, query: `INSERT INTO ticket_link (initiative_id, source_id, target_id, kind) VALUES ($1, $2, $3, 'blocks')`, params: [lkInitiativeId, questionId, epicId] },
      { sub, query: 'DELETE FROM ticket_link WHERE source_id = $1 AND target_id = $2', params: [questionId, epicId] },
    ]);
  for (const u of [alice, bruno]) {
    assert.equal((await insertLink(u.sub, questionId, epicId)).rowCount, 1);
    assert.equal((await createThenRemove(u.sub)).rowCount, 1);
    assert.equal((await asUserInDb(u.sub, 'DELETE FROM ticket_need WHERE ticket_id = $1', [epicId])).rowCount, 1);
    assert.equal((await asUserInDb(u.sub, 'DELETE FROM ticket_requirement WHERE ticket_id = $1', [questionId])).rowCount, 1);
  }
});
await check('la base refuse : nature hors liste, lien vers soi-même, seconde paire inversée, autre initiative', async () => {
  await assert.rejects(insertLink(bruno.sub, questionId, epicId, 'depends_on'), /check constraint/);
  await assert.rejects(insertLink(bruno.sub, epicId, epicId), /ticket_link_not_self/);
  await assert.rejects(
    asUserInDb(
      bruno.sub,
      `INSERT INTO ticket_link (initiative_id, source_id, target_id, kind) VALUES ($1, $2, $3, 'blocks'), ($1, $3, $2, 'duplicates')`,
      [lkInitiativeId, questionId, epicId],
    ),
    /ticket_link_pair_key/,
  );
  await assert.rejects(insertLink(bruno.sub, questionId, otherTicketId), /ticket_link_target_fkey/);
});
await check('un ticket lié ne se supprime pas en base, ni par un autre ticket, ni par une exigence', async () => {
  const unlinked = (await call(bruno, 'POST', tickets(), { type: 'decision', title: 'Liée en base' })).body.id;
  await assert.rejects(
    inDbTransaction([
      { sub: bruno.sub, query: `INSERT INTO ticket_link (initiative_id, source_id, target_id, kind) VALUES ($1, $2, $3, 'blocks')`, params: [lkInitiativeId, unlinked, epicId] },
      { sub: bruno.sub, query: 'DELETE FROM ticket WHERE id = $1', params: [unlinked] },
    ]),
    /ticket_link_source_fkey/,
  );
  await assert.rejects(asUserInDb(bruno.sub, 'DELETE FROM ticket WHERE id = $1', [questionId]), /ticket_requirement_ticket_fkey/);
  assert.equal((await call(bruno, 'DELETE', `${tickets()}/${unlinked}`)).status, 204);
});
await check('lectrice et non-membre n’écrivent pas ; non-membre ne lit rien', async () => {
  await assert.rejects(insertLink(chloe.sub, questionId, epicId), /row-level security/);
  await assert.rejects(insertLink(admin.sub, questionId, epicId), /row-level security/);
  assert.equal((await asUserInDb(chloe.sub, 'DELETE FROM ticket_need WHERE ticket_id = $1', [epicId])).rowCount, 0);
  assert.equal((await asUserInDb(chloe.sub, 'DELETE FROM ticket_requirement WHERE ticket_id = $1', [questionId])).rowCount, 0);
  const lectrice = await inDbTransaction([
    { sub: bruno.sub, query: `INSERT INTO ticket_link (initiative_id, source_id, target_id, kind) VALUES ($1, $2, $3, 'blocks')`, params: [lkInitiativeId, questionId, epicId] },
    { sub: chloe.sub, query: 'DELETE FROM ticket_link WHERE source_id = $1', params: [questionId] },
  ]);
  assert.equal(lectrice.rowCount, 0);
  assert.equal((await asUserInDb(admin.sub, 'SELECT 1 FROM ticket_link')).rowCount, 0);
  assert.equal((await asUserInDb(chloe.sub, 'SELECT 1 FROM ticket_need WHERE ticket_id = $1', [epicId])).rowCount, 1);
  assert.equal((await asUserInDb(admin.sub, 'SELECT 1 FROM ticket_need WHERE ticket_id = $1', [epicId])).rowCount, 0);
});

console.log('\nLiens — initiative archivée');
await check('initiative archivée : liens en lecture seule pour tous (403, aucune ligne en base), consultables', async () => {
  assert.equal((await call(bruno, 'POST', `${links()}/tickets`, { ticketId: questionId, otherTicketId: epicId, side: 'relates_to' })).status, 201);
  assert.equal((await call(alice, 'PUT', `/initiatives/${lkInitiativeId}/archive`)).status, 200);
  for (const u of [alice, bruno]) {
    assert.equal((await call(u, 'POST', `${links()}/needs`, { ticketId: questionId, needId })).status, 403);
    assert.equal((await call(u, 'DELETE', ticketLink(questionId, epicId))).status, 403);
    assert.equal((await asUserInDb(u.sub, 'DELETE FROM ticket_link WHERE source_id = $1', [questionId])).rowCount, 0);
    await assert.rejects(insertLink(u.sub, epicId, actionId), /row-level security/);
  }
  for (const u of [alice, bruno, chloe]) assert.equal((await linksOf(u)).ticketLinks.length, 1);
  assert.equal((await call(alice, 'DELETE', `/initiatives/${lkInitiativeId}/archive`)).status, 200);
});
