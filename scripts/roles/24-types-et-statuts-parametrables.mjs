import { assert, check, call, asUserInDb, inDbTransaction, alice, bruno, chloe, admin, code } from './commun.mjs';

// Types de ticket et statuts paramétrables (phase 2, ticket 29). Liste commune à
// toute l'application : les types et statuts ajoutés par l'API ne sont jamais
// portés par un ticket et sont supprimés avant la fin ; ceux qu'un ticket porte
// ne sont créés qu'en base, dans une transaction annulée, pour ne rien laisser
// dans la base de développement. Seul l'acronyme du type ajouté reste réservé,
// comme le veut la règle. alice propriétaire, bruno contributeur, chloé
// lectrice ; admin n'est pas membre.
console.log('\nTypes et statuts paramétrables — barrière 1 : API (guards NestJS)');
const tpCode = `${code.slice(0, 8)}TP`;
export let tpInitiativeId;
let riskId;
const types = '/ticket-types';
const adminTypes = '/admin/ticket-types';
const adminType = (type) => `${adminTypes}/${type}`;
const adminStatuses = (type) => `${adminType(type)}/statuses`;
const adminStatus = (type, status) => `${adminStatuses(type)}/${status}`;
const tickets = () => `/initiatives/${tpInitiativeId}/tickets`;
// Quatre lettres propres à cette exécution : un acronyme reste réservé à vie.
const letters = (n) => [...Array(4)].map((_, i) => String.fromCharCode(65 + (Math.floor(n / 26 ** i) % 26))).join('');
const acronym = letters(Date.now() % 26 ** 4);
const dbAcronym = letters((Date.now() + 7919) % 26 ** 4);
const sqlAcronym = letters((Date.now() + 104729) % 26 ** 4);
const labels = { fr: `Hypothèse ${code}`, en: `Assumption ${code}` };
const status = (fr, closed = false, tone = 'neutral') => ({ labels: { fr: `${fr} ${code}`, en: `${fr} (en) ${code}` }, tone, closed });
const newType = { labels, acronym, statuses: [status('À vérifier'), status('Confirmée', true, 'positive'), status('Infirmée', true, 'negative')] };
const byLabel = (list, fr) => list.find((t) => t.labels.fr === fr);
let typeCode;
let riskStatusCode;

await check('alice crée l’initiative, invite bruno (contributeur) et chloé (lectrice) ; bruno crée un Risque', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: tpCode, name: 'Types paramétrables' });
  assert.equal(r.status, 201);
  tpInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `/initiatives/${tpInitiativeId}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `/initiatives/${tpInitiativeId}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
  const risk = await call(bruno, 'POST', tickets(), { type: 'risk', title: 'Retard du fournisseur' });
  assert.equal(risk.status, 201);
  riskId = risk.body.id;
});
await check('tout utilisateur connecté (chloé, admin) lit la liste : les six types livrés en tête, avec familles et fermés', async () => {
  for (const u of [chloe, admin]) {
    const r = await call(u, 'GET', types);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.slice(0, 6).map((t) => [t.code, t.delivered, t.active]), [
      ['action', true, true],
      ['question', true, true],
      ['decision', true, true],
      ['risk', true, true],
      ['change_request', true, true],
      ['epic', true, true],
    ]);
    const risk = r.body[3];
    assert.deepEqual(risk.statuses.map((s) => [s.code, s.tone, s.closed]), [
      ['identified', 'attention', false],
      ['on_hold', 'attention', false],
      ['addressed', 'progress', false],
      ['closed', 'positive', true],
    ]);
    assert.deepEqual(risk.labels, { fr: 'Risque', en: 'Risk' });
    assert.equal('used' in risk, false);
  }
});
await check('alice, bruno, chloé (non administrateurs) : administration des types refusée (403)', async () => {
  for (const u of [alice, bruno, chloe]) {
    assert.equal((await call(u, 'GET', adminTypes)).status, 403);
    assert.equal((await call(u, 'POST', adminTypes, newType)).status, 403);
    assert.equal((await call(u, 'PATCH', adminType('risk'), { active: false })).status, 403);
    assert.equal((await call(u, 'DELETE', adminType('risk'))).status, 403);
    assert.equal((await call(u, 'POST', adminStatuses('risk'), status('Transféré'))).status, 403);
    assert.equal((await call(u, 'PATCH', adminStatus('risk', 'closed'), { active: false })).status, 403);
    assert.equal((await call(u, 'DELETE', adminStatus('risk', 'closed'))).status, 403);
  }
});
await check('admin : moins de deux statuts, acronyme invalide, libellé de plus de 50 caractères (schéma partagé) : 400', async () => {
  assert.equal((await call(admin, 'POST', adminTypes, { ...newType, statuses: [status('Seul', true)] })).status, 400);
  assert.equal((await call(admin, 'POST', adminTypes, { ...newType, acronym: 'H1' })).status, 400);
  assert.equal((await call(admin, 'POST', adminTypes, { ...newType, labels: { fr: 'x'.repeat(51), en: 'X' } })).status, 400);
  const muted = { ...newType, statuses: [{ ...status('A'), tone: 'muted' }, status('B', true)] };
  assert.equal((await call(admin, 'POST', adminTypes, muted)).status, 400);
});
await check('admin : libellé d’un type livré, acronyme d’une autre catégorie, aucun statut fermé : 409', async () => {
  let r = await call(admin, 'POST', adminTypes, { ...newType, labels: { fr: 'RISQUE', en: 'Other' } });
  assert.deepEqual([r.status, r.body.refusal], [409, 'labelTaken']);
  r = await call(admin, 'POST', adminTypes, { ...newType, acronym: 'RI' });
  assert.deepEqual([r.status, r.body.refusal], [409, 'acronymTaken']);
  r = await call(admin, 'POST', adminTypes, { ...newType, statuses: [status('A'), status('B')] });
  assert.deepEqual([r.status, r.body.refusal], [409, 'noClosedStatus']);
  r = await call(admin, 'POST', adminTypes, { ...newType, statuses: [status('A'), status('A', true)] });
  assert.deepEqual([r.status, r.body.refusal], [409, 'statusLabelTaken']);
});
await check('admin ajoute un type : actif, après les types livrés, statuts dans l’ordre ; proposé à tous, catégorie de référence', async () => {
  const r = await call(admin, 'POST', adminTypes, newType);
  assert.equal(r.status, 201);
  const added = byLabel(r.body, labels.fr);
  assert.deepEqual([added.delivered, added.active, added.used, added.acronym], [false, true, false, acronym]);
  assert.ok(r.body.indexOf(added) >= 6);
  assert.deepEqual(added.statuses.map((s) => [s.labels.fr, s.closed, s.active, s.used]), [
    [`À vérifier ${code}`, false, true, false],
    [`Confirmée ${code}`, true, true, false],
    [`Infirmée ${code}`, true, true, false],
  ]);
  typeCode = added.code;
  assert.ok(byLabel((await call(chloe, 'GET', types)).body, labels.fr));
  const categories = (await call(admin, 'GET', '/admin/reference-categories')).body;
  assert.deepEqual(categories.find((c) => c.category === typeCode)?.usedAcronyms, [acronym]);
  const again = await call(admin, 'POST', adminTypes, { ...newType, labels: { fr: labels.fr.toUpperCase(), en: 'Autre' }, acronym: 'ZZZQ' });
  assert.deepEqual([again.status, again.body.refusal], [409, 'labelTaken']);
});
await check('admin : types et statuts livrés ni renommés, ni désactivés, ni supprimés (409) ; inconnus (404)', async () => {
  let r = await call(admin, 'PATCH', adminType('risk'), { active: false });
  assert.deepEqual([r.status, r.body.refusal], [409, 'deliveredTypeLocked']);
  r = await call(admin, 'DELETE', adminType('epic'));
  assert.deepEqual([r.status, r.body.refusal], [409, 'deliveredTypeLocked']);
  r = await call(admin, 'PATCH', adminStatus('risk', 'closed'), { labels: { fr: 'Fermé', en: 'Shut' } });
  assert.deepEqual([r.status, r.body.refusal], [409, 'deliveredStatusLocked']);
  r = await call(admin, 'DELETE', adminStatus('question', 'open'));
  assert.deepEqual([r.status, r.body.refusal], [409, 'deliveredStatusLocked']);
  assert.equal((await call(admin, 'PATCH', adminType('inconnu'), { active: false })).status, 404);
  assert.equal((await call(admin, 'PATCH', adminStatus('risk', 'inconnu'), { active: false })).status, 404);
});
await check('admin ajoute un statut au Risque (type livré), après ses statuts livrés ; libellé déjà dans le type refusé', async () => {
  let r = await call(admin, 'POST', adminStatuses('risk'), status('Transféré', false, 'progress'));
  assert.equal(r.status, 201);
  const risk = r.body.find((t) => t.code === 'risk');
  const added = risk.statuses.at(-1);
  assert.deepEqual([risk.statuses.length, added.labels.fr, added.tone, added.closed, added.delivered], [5, `Transféré ${code}`, 'progress', false, false]);
  riskStatusCode = added.code;
  r = await call(admin, 'POST', adminStatuses('risk'), { labels: { fr: 'traite', en: 'Other' }, closed: false });
  assert.deepEqual([r.status, r.body.refusal], [409, 'statusLabelTaken']);
});
await check('admin : le statut initial et le dernier statut fermé actif ne se désactivent ni ne se suppriment (409)', async () => {
  const [initial, confirmed, refuted] = byLabel((await call(admin, 'GET', adminTypes)).body, labels.fr).statuses;
  let r = await call(admin, 'PATCH', adminStatus(typeCode, initial.code), { active: false });
  assert.deepEqual([r.status, r.body.refusal], [409, 'initialStatus']);
  r = await call(admin, 'DELETE', adminStatus(typeCode, initial.code));
  assert.deepEqual([r.status, r.body.refusal], [409, 'initialStatus']);
  assert.equal((await call(admin, 'PATCH', adminStatus(typeCode, refuted.code), { active: false })).status, 200);
  r = await call(admin, 'PATCH', adminStatus(typeCode, confirmed.code), { active: false });
  assert.deepEqual([r.status, r.body.refusal], [409, 'noClosedStatus']);
  r = await call(admin, 'DELETE', adminStatus(typeCode, confirmed.code));
  assert.deepEqual([r.status, r.body.refusal], [409, 'noClosedStatus']);
  // Infirmée, désactivée et jamais portée, se supprime.
  r = await call(admin, 'DELETE', adminStatus(typeCode, refuted.code));
  assert.deepEqual([r.status, byLabel(r.body, labels.fr).statuses.length], [200, 2]);
});
await check('admin renomme le type et un statut ajouté, puis désactive le type : listé, inactif', async () => {
  const renamed = { fr: `${labels.fr} bis`, en: `${labels.en} bis` };
  let r = await call(admin, 'PATCH', adminType(typeCode), { labels: renamed });
  assert.deepEqual(r.body.find((t) => t.code === typeCode).labels, renamed);
  r = await call(admin, 'PATCH', adminStatus('risk', riskStatusCode), { labels: { fr: `Transmis ${code}`, en: `Handed over ${code}` } });
  assert.equal(r.body.find((t) => t.code === 'risk').statuses.at(-1).labels.fr, `Transmis ${code}`);
  r = await call(admin, 'PATCH', adminType(typeCode), { active: false });
  assert.equal(r.body.find((t) => t.code === typeCode).active, false);
  assert.equal((await call(chloe, 'GET', types)).body.find((t) => t.code === typeCode).active, false);
});
await check('bruno (contributeur) : type désactivé ou inconnu refusé à la création (400) ; l’Action garde sa route', async () => {
  let r = await call(bruno, 'POST', tickets(), { type: typeCode, title: 'Non' });
  assert.deepEqual([r.status, r.body.refusal], [400, 'inactiveType']);
  r = await call(bruno, 'POST', tickets(), { type: 'inconnu', title: 'Non' });
  assert.deepEqual([r.status, r.body.refusal], [400, 'unknownType']);
  assert.equal((await call(bruno, 'POST', tickets(), { type: 'action', title: 'Non' })).status, 400);
});
await check('bruno : statut ajouté désactivé ou statut d’un autre type refusé sur un Risque (400)', async () => {
  assert.equal((await call(admin, 'PATCH', adminStatus('risk', riskStatusCode), { active: false })).status, 200);
  let r = await call(bruno, 'PATCH', `${tickets()}/${riskId}`, { status: riskStatusCode });
  assert.deepEqual([r.status, r.body.refusal], [400, 'inactiveStatus']);
  r = await call(bruno, 'PATCH', `${tickets()}/${riskId}`, { status: 'open' });
  assert.deepEqual([r.status, r.body.refusal], [400, 'statusNotOfType']);
  assert.equal((await call(bruno, 'GET', `${tickets()}/${riskId}`)).body.status, 'identified');
});
await check('chloé (lectrice) : changement de statut refusé (403)', async () => {
  assert.equal((await call(chloe, 'PATCH', `${tickets()}/${riskId}`, { status: 'closed' })).status, 403);
});
await check('initiative archivée : création d’un ticket et changement de statut refusés à alice et bruno (403)', async () => {
  assert.equal((await call(alice, 'PUT', `/initiatives/${tpInitiativeId}/archive`)).status, 200);
  try {
    for (const u of [alice, bruno]) {
      assert.equal((await call(u, 'POST', tickets(), { type: 'question', title: 'Non' })).status, 403);
      assert.equal((await call(u, 'PATCH', `${tickets()}/${riskId}`, { status: 'closed' })).status, 403);
    }
  } finally {
    assert.equal((await call(alice, 'DELETE', `/initiatives/${tpInitiativeId}/archive`)).status, 200);
  }
});
await check('admin change l’acronyme du type ajouté dans l’onglet des références, comme celui d’un type livré', async () => {
  const r = await call(admin, 'PATCH', `/admin/reference-categories/${typeCode}`, { acronym: dbAcronym });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.find((c) => c.category === typeCode).usedAcronyms.sort(), [acronym, dbAcronym].sort());
  assert.equal((await call(admin, 'PATCH', '/admin/reference-categories/inconnu', { acronym: 'QQQQ' })).status, 404);
});
await check('admin supprime le statut ajouté au Risque et le type, jamais portés : ils disparaissent ; acronymes réservés', async () => {
  let r = await call(admin, 'DELETE', adminStatus('risk', riskStatusCode));
  assert.deepEqual([r.status, r.body.find((t) => t.code === 'risk').statuses.length], [200, 4]);
  r = await call(admin, 'DELETE', adminType(typeCode));
  assert.equal(r.status, 200);
  assert.equal(r.body.some((t) => t.code === typeCode), false);
  assert.equal((await call(chloe, 'GET', types)).body.some((t) => t.code === typeCode), false);
  r = await call(admin, 'POST', adminTypes, { ...newType, labels: { fr: `Autre ${code}`, en: `Other ${code}` } });
  assert.deepEqual([r.status, r.body.refusal], [409, 'acronymTaken']);
});

console.log('\nTypes et statuts paramétrables — barrière 2 : base de données (RLS, compte applicatif)');
const statusesJson = JSON.stringify([
  { code: 's-init', labelFr: 'À vérifier', labelEn: 'To check', tone: 'neutral', closed: false },
  { code: 's-ok', labelFr: 'Confirmée', labelEn: 'Confirmed', tone: 'positive', closed: true },
]);
const addType = {
  sub: admin.sub,
  admin: true,
  query: `SELECT admin_add_ticket_type('test-type', $1, $2, $3, $4::jsonb)`,
  params: [`Base ${code}`, `Database ${code}`, sqlAcronym, statusesJson],
};
const adminSql = (query) => ({ sub: admin.sub, admin: true, query });
const insertTicket = (id = 'gen_random_uuid()') => ({
  sub: bruno.sub,
  query: `INSERT INTO ticket (id, type, initiative_id, title) VALUES (${id}, 'test-type', $1, 'Via SQL') RETURNING reference, status`,
  params: [tpInitiativeId],
});
const fixedId = `'00000000-0000-4000-8000-0000000000a1'::uuid`;
const setStatus = (statusCode) => ({
  sub: bruno.sub,
  query: `UPDATE ticket SET status = $1 WHERE id = ${fixedId} RETURNING status`,
  params: [statusCode],
});
const addStatus = (closed) =>
  adminSql(`SELECT admin_add_ticket_status('test-type', 's-plus', 'En revue ${code}', 'In review ${code}', 'progress', ${closed})`);

await check('alice, admin : aucune écriture directe dans les types et statuts, même en transaction d’administrateur', async () => {
  for (const [u, isAdmin] of [[alice, false], [admin, true]]) {
    await assert.rejects(
      asUserInDb(u.sub, `INSERT INTO ticket_type (code, label_fr, label_en, created_at) VALUES ('x', 'X', 'X', now())`, [], { admin: isAdmin }),
      /row-level security/,
    );
    assert.equal((await asUserInDb(u.sub, `UPDATE ticket_status SET closed = false WHERE type = 'risk'`, [], { admin: isAdmin })).rowCount, 0);
    assert.equal((await asUserInDb(u.sub, `DELETE FROM ticket_type WHERE code = 'risk'`, [], { admin: isAdmin })).rowCount, 0);
  }
});
await check('alice (hors transaction d’administrateur) : fonctions d’administration des types refusées', async () => {
  for (const query of [
    `SELECT admin_update_ticket_type('risk', NULL, NULL, false)`,
    `SELECT admin_delete_ticket_type('risk')`,
    `SELECT admin_add_ticket_status('risk', 'x', 'X', 'X', 'neutral', false)`,
    `SELECT admin_delete_ticket_status('risk', 'closed')`,
  ]) {
    await assert.rejects(asUserInDb(alice.sub, query, []), /réservé à l’administrateur/);
  }
});
await check('admin : type et statut livrés ni désactivés, ni renommés, ni supprimés par la base', async () => {
  for (const query of [
    `SELECT admin_update_ticket_type('risk', NULL, NULL, false)`,
    `SELECT admin_delete_ticket_type('epic')`,
    `SELECT admin_update_ticket_status('risk', 'closed', NULL, NULL, false)`,
    `SELECT admin_delete_ticket_status('question', 'open')`,
  ]) {
    await assert.rejects(asUserInDb(admin.sub, query, [], { admin: true }), /livré/);
  }
});
await check('base : un type ajouté a au moins deux statuts dont un fermé, et un acronyme libre', async () => {
  const one = JSON.stringify([{ code: 'a', labelFr: 'A', labelEn: 'A', tone: 'neutral', closed: true }]);
  await assert.rejects(inDbTransaction([{ ...addType, params: [...addType.params.slice(0, 3), one] }]), /au moins deux statuts/);
  const noClosed = statusesJson.replace('"closed":true', '"closed":false');
  await assert.rejects(inDbTransaction([{ ...addType, params: [...addType.params.slice(0, 3), noClosed] }]), /statut fermé actif/);
  await assert.rejects(inDbTransaction([{ ...addType, params: [...addType.params.slice(0, 2), 'RI', statusesJson] }]), /autre catégorie/);
});
await check('base : un ticket du type ajouté prend sa référence et son statut initial ; le type ne se supprime plus', async () => {
  const r = await inDbTransaction([addType, insertTicket()]);
  assert.deepEqual([r.rows[0].reference, r.rows[0].status], [`${tpCode}-${sqlAcronym}-001`, 's-init']);
  await assert.rejects(inDbTransaction([addType, insertTicket(), adminSql(`SELECT admin_delete_ticket_type('test-type')`)]), /déjà été créé/);
  // Même supprimé, un ticket créé a rendu le type définitivement « utilisé ».
  await assert.rejects(
    inDbTransaction([
      addType,
      insertTicket(fixedId),
      { sub: bruno.sub, query: `DELETE FROM ticket WHERE id = ${fixedId}` },
      adminSql(`SELECT admin_delete_ticket_type('test-type')`),
    ]),
    /déjà été créé/,
  );
});
await check('base : un type désactivé n’est plus proposé à la création, mais ses tickets restent modifiables', async () => {
  const deactivate = adminSql(`SELECT admin_update_ticket_type('test-type', NULL, NULL, false)`);
  await assert.rejects(inDbTransaction([addType, deactivate, insertTicket()]), /désactivé/);
  const r = await inDbTransaction([addType, insertTicket(fixedId), deactivate, setStatus('s-ok')]);
  assert.equal(r.rows[0].status, 's-ok');
});
await check('base : un statut désactivé n’est plus attribué, mais le ticket qui le porte le garde', async () => {
  const deactivate = adminSql(`SELECT admin_update_ticket_status('test-type', 's-plus', NULL, NULL, false)`);
  await assert.rejects(inDbTransaction([addType, addStatus(false), insertTicket(fixedId), deactivate, setStatus('s-plus')]), /désactivé/);
  const r = await inDbTransaction([
    addType,
    addStatus(false),
    insertTicket(fixedId),
    setStatus('s-plus'),
    deactivate,
    { sub: bruno.sub, query: `UPDATE ticket SET title = 'Suite' WHERE id = ${fixedId} RETURNING status` },
  ]);
  assert.equal(r.rows[0].status, 's-plus');
});
await check('base : un statut porté, même une seule fois, ne se supprime pas', async () => {
  const remove = adminSql(`SELECT admin_delete_ticket_status('test-type', 's-plus')`);
  await assert.rejects(
    inDbTransaction([addType, addStatus(false), insertTicket(fixedId), setStatus('s-plus'), setStatus('s-init'), remove]),
    /déjà porté/,
  );
});
await check('base : ni le statut initial, ni le dernier statut fermé actif ne se désactivent ou ne se suppriment', async () => {
  for (const query of [
    `SELECT admin_update_ticket_status('test-type', 's-init', NULL, NULL, false)`,
    `SELECT admin_delete_ticket_status('test-type', 's-init')`,
  ]) {
    await assert.rejects(inDbTransaction([addType, adminSql(query)]), /statut initial/);
  }
  for (const query of [
    `SELECT admin_update_ticket_status('test-type', 's-ok', NULL, NULL, false)`,
    `SELECT admin_delete_ticket_status('test-type', 's-ok')`,
  ]) {
    await assert.rejects(inDbTransaction([addType, adminSql(query)]), /statut fermé actif/);
  }
  // Avec un second statut fermé actif, le premier se désactive.
  await inDbTransaction([addType, addStatus(true), adminSql(`SELECT admin_update_ticket_status('test-type', 's-ok', NULL, NULL, false)`)]);
});
await check('base : un statut inconnu n’est pas attribué (clé étrangère)', async () => {
  await assert.rejects(inDbTransaction([addType, insertTicket(fixedId), setStatus('inconnu')]), /ticket_status_fkey/);
});
await check('initiative archivée : aucun ticket du type ajouté créé en base, même par alice', async () => {
  await assert.rejects(
    inDbTransaction([
      addType,
      { sub: alice.sub, query: `UPDATE initiative SET archived_at = now() WHERE id = $1`, params: [tpInitiativeId] },
      { ...insertTicket(), sub: alice.sub },
    ]),
    /row-level security/,
  );
});
await check('chloé (lectrice) : aucun ticket du type ajouté créé en base', async () => {
  await assert.rejects(
    inDbTransaction([addType, { ...insertTicket(), sub: chloe.sub }]),
    /row-level security/,
  );
});
