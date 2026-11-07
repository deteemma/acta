import { assert, check, call, asUserInDb, alice, bruno, chloe, admin, code } from './commun.mjs';

// Types de ticket livrés et Epics (phase 2, ticket 18). alice propriétaire, bruno
// contributeur, chloé lectrice ; admin n'est pas membre.
console.log('\nTypes de ticket et Epics — barrière 1 : API (guards NestJS)');
const typesCode = `${code.slice(0, 8)}TT`;
export let ttInitiativeId;
let otherEpicId;
export let ttOtherInitiativeId;
let stakeholderId;
let needId;
let epicId;
let questionId;
let riskId;
let decisionId;
let actionId;
const tickets = () => `/initiatives/${ttInitiativeId}/tickets`;
const ticket = (id) => `${tickets()}/${id}`;
const actions = () => `/initiatives/${ttInitiativeId}/actions`;
const reference = (acronym, n) => `${typesCode}-${acronym}-00${n}`;

await check('alice crée l’initiative et invite bruno (contributeur) et chloé (lectrice)', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: typesCode, name: 'Types de ticket' });
  assert.equal(r.status, 201);
  ttInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `/initiatives/${ttInitiativeId}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `/initiatives/${ttInitiativeId}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
  stakeholderId = (await call(alice, 'POST', `/initiatives/${ttInitiativeId}/stakeholders`, { name: 'Sponsor', kind: 'person', roles: ['sponsor'] })).body.id;
  needId = (await call(alice, 'POST', `/initiatives/${ttInitiativeId}/needs`, { title: 'Besoin', nature: 'problem' })).body.id;
  const other = await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}TX`, name: 'Autre' });
  ttOtherInitiativeId = other.body.id;
  otherEpicId = (await call(alice, 'POST', `/initiatives/${ttOtherInitiativeId}/tickets`, { type: 'epic', title: 'Epic ailleurs' })).body.id;
});
await check('administration : les six catégories de ticket ont leur acronyme', async () => {
  const list = (await call(admin, 'GET', '/admin/reference-categories')).body;
  const acronym = (category) => list.find((c) => c.category === category)?.acronym;
  assert.deepEqual(['question', 'decision', 'risk', 'change_request', 'epic'].map(acronym), ['QU', 'DE', 'RI', 'DC', 'EP']);
});
await check('bruno (contributeur) crée chaque type avec son seul titre : référence du type, statut initial', async () => {
  const expected = [
    ['question', 'QU', 'open'],
    ['decision', 'DE', 'proposed'],
    ['risk', 'RI', 'identified'],
    ['change_request', 'DC', 'submitted'],
    ['epic', 'EP', 'todo'],
  ];
  for (const [type, acronym, status] of expected) {
    const r = await call(bruno, 'POST', tickets(), { type, title: `Un ${type}` });
    assert.equal(r.status, 201, type);
    assert.deepEqual([r.body.reference, r.body.status, r.body.assignee], [reference(acronym, 1), status, null]);
    if (type === 'question') questionId = r.body.id;
    if (type === 'decision') decisionId = r.body.id;
    if (type === 'risk') riskId = r.body.id;
    if (type === 'epic') epicId = r.body.id;
  }
});
await check('l’Action garde sa route : tâche obligatoire, refusée par la route générique', async () => {
  assert.equal((await call(bruno, 'POST', tickets(), { type: 'action', title: 'Sans tâche' })).status, 400);
  const r = await call(bruno, 'POST', actions(), { title: 'Une action', taskId: '4.1' });
  assert.equal(r.status, 201);
  actionId = r.body.id;
  assert.equal(r.body.epic, null);
  assert.equal((await call(bruno, 'GET', ticket(actionId))).status, 404);
});
await check('liste : chloé (lectrice) voit tous les types ; admin (non-membre) : 404', async () => {
  const r = await call(chloe, 'GET', tickets());
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.map((t) => t.type).sort(), ['action', 'change_request', 'decision', 'epic', 'question', 'risk']);
  assert.equal((await call(admin, 'GET', tickets())).status, 404);
});
await check('palette : le ticket est trouvé avec sa catégorie', async () => {
  const found = (await call(chloe, 'GET', '/references')).body.find((r) => r.id === riskId);
  assert.deepEqual([found?.category, found?.reference], ['risk', reference('RI', 1)]);
});
await check('alice (propriétaire) crée, modifie et supprime un ticket ; le responsable peut être attribué à sa création', async () => {
  const r = await call(alice, 'POST', tickets(), { type: 'change_request', title: 'Du propriétaire', assigneeId: bruno.sub });
  assert.deepEqual([r.status, r.body.assignee?.userId], [201, bruno.sub]);
  assert.equal((await call(alice, 'PATCH', ticket(r.body.id), { status: 'accepted' })).body.status, 'accepted');
  assert.equal((await call(alice, 'DELETE', ticket(r.body.id))).status, 204);
});
await check('chloé (lectrice) ne crée, ne modifie ni ne supprime rien ; admin non plus : 403, 404', async () => {
  assert.equal((await call(chloe, 'POST', tickets(), { type: 'risk', title: 'Non' })).status, 403);
  assert.equal((await call(chloe, 'PATCH', ticket(riskId), { title: 'Non' })).status, 403);
  assert.equal((await call(chloe, 'DELETE', ticket(riskId))).status, 403);
  assert.equal((await call(admin, 'POST', tickets(), { type: 'risk', title: 'Non' })).status, 404);
  assert.equal((await call(chloe, 'GET', ticket(riskId))).status, 200);
});
await check('le type ne change plus : champ ignoré à la modification', async () => {
  const r = await call(bruno, 'PATCH', ticket(riskId), { type: 'question', title: 'Un risque' });
  assert.equal(r.status, 200);
  assert.equal(r.body.type, 'risk');
});
await check('tout statut du type est permis, sans enchaînement ; celui d’un autre type est refusé : 400', async () => {
  const closed = await call(bruno, 'PATCH', ticket(riskId), { status: 'closed' });
  assert.equal(closed.body.status, 'closed');
  assert.equal((await call(bruno, 'PATCH', ticket(riskId), { status: 'identified' })).body.status, 'identified');
  const r = await call(bruno, 'PATCH', ticket(riskId), { status: 'open' });
  assert.deepEqual([r.status, r.body.refusal], [400, 'statusNotOfType']);
});
await check('champs propres : probabilité et impact pour le Risque, pas pour les autres ; valeurs bornées', async () => {
  const r = await call(bruno, 'PATCH', ticket(riskId), { probability: 'high', impact: 'low' });
  assert.deepEqual([r.body.probability, r.body.impact], ['high', 'low']);
  assert.equal((await call(bruno, 'PATCH', ticket(riskId), { impact: 'extreme' })).status, 400);
  const other = await call(bruno, 'PATCH', ticket(decisionId), { probability: 'high' });
  assert.deepEqual([other.status, other.body.refusal], [400, 'fieldNotOfType']);
});
await check('responsable facultatif : attribué à un contributeur, retiré ; un lecteur est refusé', async () => {
  const set = await call(bruno, 'PATCH', ticket(riskId), { assigneeId: bruno.sub });
  assert.equal(set.body.assignee.userId, bruno.sub);
  const reader = await call(bruno, 'PATCH', ticket(riskId), { assigneeId: chloe.sub });
  assert.deepEqual([reader.status, reader.body.refusal], [400, 'assigneeNotEligible']);
  assert.equal((await call(bruno, 'PATCH', ticket(riskId), { assigneeId: null })).body.assignee, null);
});
await check('Question : parties prenantes interrogées, de la même initiative, pour ce seul type', async () => {
  const r = await call(bruno, 'PATCH', ticket(questionId), { questionedStakeholderIds: [stakeholderId] });
  assert.deepEqual(r.body.questionedStakeholders, [{ id: stakeholderId, name: 'Sponsor' }]);
  const other = await call(bruno, 'PATCH', ticket(decisionId), { questionedStakeholderIds: [stakeholderId] });
  assert.deepEqual([other.status, other.body.refusal], [400, 'fieldNotOfType']);
  const unknown = await call(bruno, 'PATCH', ticket(questionId), { questionedStakeholderIds: ['00000000-0000-4000-8000-000000000000'] });
  assert.deepEqual([unknown.status, unknown.body.refusal], [400, 'unknownStakeholder']);
});
await check('une partie prenante interrogée ne se supprime pas ; retirée de la question, si', async () => {
  const stakeholder = `/initiatives/${ttInitiativeId}/stakeholders/${stakeholderId}`;
  const r = await call(alice, 'DELETE', stakeholder);
  assert.deepEqual([r.status, r.body.refusal], [409, 'stakeholderLinked']);
  const temporary = (await call(alice, 'POST', `/initiatives/${ttInitiativeId}/stakeholders`, { name: 'Temporaire', kind: 'person', roles: ['sponsor'] })).body.id;
  await call(bruno, 'PATCH', ticket(questionId), { questionedStakeholderIds: [temporary] });
  const path = `/initiatives/${ttInitiativeId}/stakeholders/${temporary}`;
  assert.equal((await call(alice, 'DELETE', path)).status, 409);
  await call(bruno, 'PATCH', ticket(questionId), { questionedStakeholderIds: [stakeholderId] });
  assert.equal((await call(alice, 'DELETE', path)).status, 204);
});
await check('Epic : un ticket de tout type y entre, en change et en sort', async () => {
  const entered = await call(bruno, 'PATCH', ticket(questionId), { epicId });
  assert.deepEqual([entered.status, entered.body.epic?.id, entered.body.epic?.reference], [200, epicId, reference('EP', 1)]);
  const action = await call(bruno, 'PATCH', `${actions()}/${actionId}`, { epicId });
  assert.equal(action.body.epic?.id, epicId);
  const second = await call(bruno, 'POST', tickets(), { type: 'epic', title: 'Second Epic' });
  assert.equal((await call(bruno, 'PATCH', ticket(questionId), { epicId: second.body.id })).body.epic.id, second.body.id);
  assert.equal((await call(bruno, 'PATCH', ticket(questionId), { epicId: null })).body.epic, null);
  assert.equal((await call(bruno, 'DELETE', ticket(second.body.id))).status, 204);
  await call(bruno, 'PATCH', ticket(questionId), { epicId });
});
await check('la création peut placer le ticket dans un Epic, Action comprise', async () => {
  const q = await call(bruno, 'POST', tickets(), { type: 'decision', title: 'Dans l’Epic', epicId });
  assert.equal(q.body.epic.id, epicId);
  const a = await call(bruno, 'POST', actions(), { title: 'Action dans l’Epic', taskId: '4.1', epicId });
  assert.equal(a.body.epic.id, epicId);
  assert.equal((await call(bruno, 'DELETE', ticket(q.body.id))).status, 204);
  assert.equal((await call(bruno, 'DELETE', `${actions()}/${a.body.id}`)).status, 204);
});
await check('pas d’Epic dans un Epic ; pas d’Epic d’une autre initiative ; la cible doit être un Epic', async () => {
  const second = await call(bruno, 'POST', tickets(), { type: 'epic', title: 'Epic parent ?' });
  const inEpic = await call(bruno, 'PATCH', ticket(second.body.id), { epicId });
  assert.deepEqual([inEpic.status, inEpic.body.refusal], [400, 'epicInEpic']);
  assert.equal((await call(bruno, 'POST', tickets(), { type: 'epic', title: 'Non', epicId })).body.refusal, 'epicInEpic');
  assert.equal((await call(bruno, 'DELETE', ticket(second.body.id))).status, 204);
  const elsewhere = await call(bruno, 'PATCH', ticket(riskId), { epicId: otherEpicId });
  assert.deepEqual([elsewhere.status, elsewhere.body.refusal], [400, 'unknownEpic']);
  assert.equal((await call(bruno, 'PATCH', `${actions()}/${actionId}`, { epicId: otherEpicId })).body.refusal, 'unknownEpic');
  assert.equal((await call(bruno, 'PATCH', ticket(riskId), { epicId: decisionId })).body.refusal, 'unknownEpic');
});
await check('un Epic qui contient des tickets ne se supprime pas : 409', async () => {
  const r = await call(bruno, 'DELETE', ticket(epicId));
  assert.deepEqual([r.status, r.body.refusal], [409, 'epicHasTickets']);
});
await check('suppression définitive : avec ses parties prenantes interrogées, référence jamais réutilisée', async () => {
  const q = await call(bruno, 'POST', tickets(), { type: 'question', title: 'À supprimer', questionedStakeholderIds: [stakeholderId] });
  assert.equal(q.body.reference, reference('QU', 2));
  assert.equal((await call(bruno, 'DELETE', ticket(q.body.id))).status, 204);
  assert.equal((await call(bruno, 'GET', ticket(q.body.id))).status, 404);
  const next = await call(bruno, 'POST', tickets(), { type: 'question', title: 'Suivante' });
  assert.equal(next.body.reference, reference('QU', 3));
  assert.equal((await call(bruno, 'DELETE', ticket(next.body.id))).status, 204);
});
await check('historique pour tous les types : statut, champs propres, Epic ; chloé (lectrice) le consulte', async () => {
  const risk = (await call(chloe, 'GET', `${ticket(riskId)}/history`)).body;
  assert.ok(risk.some((v) => v.before.probability === null && v.after.probability === 'high'));
  assert.ok(risk.some((v) => v.before.status === 'identified' && v.after.status === 'closed'));
  const question = (await call(chloe, 'GET', `${ticket(questionId)}/history`)).body;
  assert.ok(question.some((v) => v.before.epic === null && v.after.epic?.id === epicId));
  assert.ok(question.some((v) => v.after.questionedStakeholders?.length === 1));
  const action = (await call(chloe, 'GET', `${actions()}/${actionId}/history`)).body;
  assert.ok(action.some((v) => v.before.epic === null && v.after.epic?.id === epicId));
  assert.equal((await call(admin, 'GET', `${ticket(riskId)}/history`)).status, 404);
});
await check('enregistrer sans rien changer n’ajoute rien à l’historique', async () => {
  const before = (await call(chloe, 'GET', `${ticket(questionId)}/history`)).body.length;
  await call(bruno, 'PATCH', ticket(questionId), { epicId, questionedStakeholderIds: [stakeholderId] });
  assert.equal((await call(chloe, 'GET', `${ticket(questionId)}/history`)).body.length, before);
});
await check('« Mes actions » et la liste des actions, d’où viennent tableau de bord et alertes, ne voient que les Actions', async () => {
  await call(bruno, 'PATCH', ticket(riskId), { assigneeId: bruno.sub, dueDate: '2020-01-01' });
  const mine = (await call(bruno, 'GET', '/actions/mine')).body;
  assert.ok(mine.some((a) => a.id === actionId));
  assert.ok(!mine.some((a) => a.id === riskId));
  const list = (await call(bruno, 'GET', actions())).body;
  assert.deepEqual(list.map((a) => a.id), [actionId]);
});

console.log('\nTypes de ticket et Epics — barrière 2 : base de données (RLS, compte applicatif)');
let riskQuestionId;
await check('une seconde question, sans partie prenante interrogée', async () => {
  riskQuestionId = (await call(bruno, 'POST', tickets(), { type: 'question', title: 'Seconde question' })).body.id;
});
const insertTicket = (sub, type, extra = '', values = '') =>
  asUserInDb(
    sub,
    `INSERT INTO ticket (id, initiative_id, type, title${extra}) VALUES (gen_random_uuid(), $1, '${type}', 'Via SQL'${values}) RETURNING reference, status`,
    [ttInitiativeId],
  );

await check('contributeur : le statut initial et la référence sont posés par la base', async () => {
  const r = await asUserInDb(
    bruno.sub,
    `INSERT INTO ticket (id, initiative_id, type, title, status, reference) VALUES (gen_random_uuid(), $1, 'risk', 'Via SQL', 'closed', 'FAUX') RETURNING reference, status`,
    [ttInitiativeId],
  );
  assert.equal(r.rows[0].status, 'identified');
  assert.notEqual(r.rows[0].reference, 'FAUX');
});
await check('propriétaire et contributeur écrivent en base, parties prenantes interrogées comprises', async () => {
  for (const u of [alice, bruno]) {
    assert.equal((await insertTicket(u.sub, 'decision')).rowCount, 1);
    assert.equal((await asUserInDb(u.sub, `UPDATE ticket SET title = 'Oui' WHERE id = $1`, [decisionId])).rowCount, 1);
    assert.equal((await asUserInDb(u.sub, 'DELETE FROM question_stakeholder WHERE ticket_id = $1', [questionId])).rowCount, 1);
    const other = await asUserInDb(
      u.sub,
      'INSERT INTO question_stakeholder (initiative_id, ticket_id, stakeholder_id) SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM question_stakeholder WHERE ticket_id = $2 AND stakeholder_id = $3)',
      [ttInitiativeId, riskQuestionId, stakeholderId],
    );
    assert.equal(other.rowCount, 1);
  }
});
await check('lectrice et non-membre n’ajoutent pas de partie prenante interrogée', async () => {
  for (const u of [chloe, admin]) {
    await assert.rejects(
      asUserInDb(u.sub, 'INSERT INTO question_stakeholder (initiative_id, ticket_id, stakeholder_id) VALUES ($1, $2, $3)', [ttInitiativeId, riskQuestionId, stakeholderId]),
      /row-level security/,
    );
  }
});
await check('lectrice et non-membre n’écrivent pas ; non-membre ne lit rien', async () => {
  await assert.rejects(insertTicket(chloe.sub, 'risk'), /row-level security/);
  await assert.rejects(insertTicket(admin.sub, 'risk'), /row-level security/);
  assert.equal((await asUserInDb(chloe.sub, `UPDATE ticket SET title = 'Non' WHERE id = $1`, [riskId])).rowCount, 0);
  assert.equal((await asUserInDb(chloe.sub, 'DELETE FROM ticket WHERE id = $1', [decisionId])).rowCount, 0);
  assert.equal((await asUserInDb(chloe.sub, 'SELECT 1 FROM ticket WHERE id = $1', [riskId])).rowCount, 1);
  assert.equal((await asUserInDb(admin.sub, 'SELECT 1 FROM ticket WHERE id = $1', [riskId])).rowCount, 0);
  assert.equal((await asUserInDb(admin.sub, 'SELECT 1 FROM question_stakeholder WHERE ticket_id = $1', [questionId])).rowCount, 0);
});
await check('le type ne change pas ; un statut d’un autre type est refusé', async () => {
  await assert.rejects(asUserInDb(bruno.sub, `UPDATE ticket SET type = 'question' WHERE id = $1`, [riskId]), /ne change pas de type/);
  await assert.rejects(asUserInDb(bruno.sub, `UPDATE ticket SET status = 'open' WHERE id = $1`, [riskId]), /ticket_status_check/);
});
await check('une Action exige sa tâche et son responsable ; les autres types n’ont pas de tâche', async () => {
  await assert.rejects(insertTicket(bruno.sub, 'action'), /ticket_action_fields/);
  await assert.rejects(insertTicket(bruno.sub, 'risk', ', task_id', `, '4.1'`), /ticket_action_fields/);
});
await check('probabilité et impact : Risque seulement, valeurs bornées', async () => {
  await assert.rejects(insertTicket(bruno.sub, 'decision', ', impact', `, 'low'`), /ticket_risk_fields/);
  await assert.rejects(asUserInDb(bruno.sub, `UPDATE ticket SET impact = 'extreme' WHERE id = $1`, [riskId]), /check constraint/);
});
await check('Epic : ni dans un Epic, ni d’une autre initiative, ni un ticket d’un autre type', async () => {
  await assert.rejects(asUserInDb(bruno.sub, 'UPDATE ticket SET epic_id = $1 WHERE id = $1', [epicId]), /ticket_no_epic_in_epic|Epic/);
  await assert.rejects(asUserInDb(bruno.sub, 'UPDATE ticket SET epic_id = $2 WHERE id = $1', [riskId, otherEpicId]), /même initiative/);
  await assert.rejects(asUserInDb(bruno.sub, 'UPDATE ticket SET epic_id = $2 WHERE id = $1', [riskId, decisionId]), /même initiative/);
});
await check('un Epic qui contient des tickets ne se supprime pas (contrainte en base)', async () => {
  await assert.rejects(asUserInDb(bruno.sub, 'DELETE FROM ticket WHERE id = $1', [epicId]), /ticket_epic_fkey/);
});
await check('parties prenantes interrogées : Question seulement ; lectrice refusée ; suppression bloquée', async () => {
  const link = (sub, id) =>
    asUserInDb(sub, 'INSERT INTO question_stakeholder (initiative_id, ticket_id, stakeholder_id) VALUES ($1, $2, $3)', [ttInitiativeId, id, stakeholderId]);
  await assert.rejects(link(bruno.sub, decisionId), /question_stakeholder_ticket_fkey/);
  assert.equal((await asUserInDb(chloe.sub, 'DELETE FROM stakeholder WHERE id = $1', [stakeholderId])).rowCount, 0);
  assert.equal((await asUserInDb(chloe.sub, 'DELETE FROM question_stakeholder WHERE ticket_id = $1', [questionId])).rowCount, 0);
  assert.equal((await asUserInDb(chloe.sub, 'SELECT 1 FROM question_stakeholder WHERE ticket_id = $1', [questionId])).rowCount, 1);
  await assert.rejects(asUserInDb(bruno.sub, 'DELETE FROM stakeholder WHERE id = $1', [stakeholderId]), /question_stakeholder_stakeholder_fkey/);
});

console.log('\nTypes de ticket et Epics — liens et initiative archivée');
await check('une action liée à un besoin reste refusée à la suppression', async () => {
  const a = await call(bruno, 'POST', actions(), { title: 'Liée', taskId: '4.1', needIds: [needId] });
  const r = await call(bruno, 'DELETE', `${actions()}/${a.body.id}`);
  assert.deepEqual([r.status, r.body.refusal], [409, 'linked']);
  await call(bruno, 'PATCH', `${actions()}/${a.body.id}`, { needIds: [] });
  assert.equal((await call(bruno, 'DELETE', `${actions()}/${a.body.id}`)).status, 204);
});
await check('initiative archivée : lecture seule pour tous (403, aucune ligne en base), lecture et historique permis', async () => {
  assert.equal((await call(alice, 'PUT', `/initiatives/${ttInitiativeId}/archive`)).status, 200);
  for (const u of [alice, bruno]) {
    assert.equal((await call(u, 'POST', tickets(), { type: 'risk', title: 'Non' })).status, 403);
    assert.equal((await call(u, 'PATCH', ticket(riskId), { title: 'Non' })).status, 403);
    assert.equal((await call(u, 'DELETE', ticket(decisionId))).status, 403);
    assert.equal((await asUserInDb(u.sub, `UPDATE ticket SET title = 'Non' WHERE id = $1`, [riskId])).rowCount, 0);
    assert.equal((await asUserInDb(u.sub, 'DELETE FROM question_stakeholder WHERE ticket_id = $1', [questionId])).rowCount, 0);
    await assert.rejects(insertTicket(u.sub, 'risk'), /row-level security/);
    await assert.rejects(
      asUserInDb(u.sub, 'INSERT INTO question_stakeholder (initiative_id, ticket_id, stakeholder_id) VALUES ($1, $2, $3)', [ttInitiativeId, riskQuestionId, stakeholderId]),
      /row-level security/,
    );
  }
  for (const u of [alice, bruno, chloe]) {
    assert.equal((await call(u, 'GET', tickets())).status, 200);
    assert.equal((await call(u, 'GET', `${ticket(riskId)}/history`)).status, 200);
  }
  assert.equal((await call(alice, 'DELETE', `/initiatives/${ttInitiativeId}/archive`)).status, 200);
});
