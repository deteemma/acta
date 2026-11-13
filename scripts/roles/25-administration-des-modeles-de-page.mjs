import { assert, check, call, asUserInDb, inDbTransaction, alice, bruno, chloe, admin, code } from './commun.mjs';

// Administration des modèles de page (phase 2, ticket 30). Liste commune à toute
// l'application : le modèle ajouté par l'API ne sert à aucune page et est
// supprimé avant la fin ; un modèle livré désactivé est réactivé aussitôt. Ce
// qui ferait « servir » un modèle ajouté (il ne se supprimerait plus) n'est fait
// qu'en base, dans une transaction annulée, pour ne rien laisser dans la base de
// développement. alice propriétaire, bruno contributeur, chloé lectrice ; admin
// n'est pas membre.
console.log('\nAdministration des modèles de page — barrière 1 : API (guards NestJS)');
export let amInitiativeId;
const offered = '/page-templates';
const adminList = '/admin/page-templates';
const adminOne = (id) => `${adminList}/${id}`;
const pages = () => `/initiatives/${amInitiativeId}/pages`;
const unknownId = '00000000-0000-4000-8000-000000000000';
const doc = (text) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
const newTemplate = {
  name: { fr: `Compte rendu ${code}`, en: `Minutes ${code}` },
  content: { fr: doc('Participants'), en: doc('Attendees') },
  taskId: null,
};
const byNameFr = (list, fr) => list.find((t) => t.name.fr === fr);
let approach;
let addedId;

await check('alice crée l’initiative et invite bruno (contributeur) et chloé (lectrice)', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}AM`, name: 'Administration des modèles' });
  assert.equal(r.status, 201);
  amInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `/initiatives/${amInitiativeId}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `/initiatives/${amInitiativeId}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
});
await check('alice, bruno, chloé (non administrateurs) : administration des modèles refusée (403)', async () => {
  for (const u of [alice, bruno, chloe]) {
    assert.equal((await call(u, 'GET', adminList)).status, 403);
    assert.equal((await call(u, 'POST', adminList, newTemplate)).status, 403);
    assert.equal((await call(u, 'PATCH', adminOne(unknownId), { active: false })).status, 403);
    assert.equal((await call(u, 'DELETE', adminOne(unknownId))).status, 403);
  }
});
await check('admin liste tous les modèles : les 22 livrés, mention « livré », état, et s’ils ont servi', async () => {
  const r = await call(admin, 'GET', adminList);
  assert.equal(r.status, 200);
  const delivered = r.body.filter((t) => t.origin === 'delivered' && t.active);
  assert.equal(delivered.length, 22);
  approach = byNameFr(r.body, 'Approche de l’analyse métier');
  assert.deepEqual([approach.origin, approach.active, typeof approach.used, approach.taskId], ['delivered', true, 'boolean', '3.1']);
});
await check('admin : nom vide, contenu vide ou sans mot, image, tâche mal formée (schéma partagé) : 400', async () => {
  const bad = [
    { ...newTemplate, name: { fr: ' ', en: 'X' } },
    { ...newTemplate, content: { fr: { type: 'doc', content: [{ type: 'paragraph' }] }, en: doc('X') } },
    { ...newTemplate, content: { fr: doc('   '), en: doc('X') } },
    {
      ...newTemplate,
      content: { fr: { type: 'doc', content: [{ type: 'image', attrs: { attachmentId: unknownId } }, ...doc('X').content] }, en: doc('X') },
    },
    { ...newTemplate, name: { fr: 'x'.repeat(201), en: 'X' } },
    { name: newTemplate.name, content: newTemplate.content },
  ];
  for (const body of bad) assert.equal((await call(admin, 'POST', adminList, body)).status, 400);
});
await check('admin : nom d’un modèle livré (accents et majuscules ignorés), tâche inconnue : 409', async () => {
  let r = await call(admin, 'POST', adminList, { ...newTemplate, name: { fr: 'APPROCHE DE L’ANALYSE METIER', en: 'Other' } });
  assert.deepEqual([r.status, r.body.refusal], [409, 'nameTaken']);
  r = await call(admin, 'POST', adminList, { ...newTemplate, name: { fr: 'Autre', en: ' business analysis approach ' } });
  assert.deepEqual([r.status, r.body.refusal], [409, 'nameTaken']);
  r = await call(admin, 'POST', adminList, { ...newTemplate, taskId: '9.9' });
  assert.deepEqual([r.status, r.body.refusal], [409, 'unknownTask']);
});
await check('admin ajoute un modèle sans tâche : « ajouté », actif, n’a pas servi ; proposé à tous', async () => {
  const r = await call(admin, 'POST', adminList, newTemplate);
  assert.equal(r.status, 201);
  const added = byNameFr(r.body, newTemplate.name.fr);
  assert.deepEqual([added.origin, added.active, added.used, added.taskId], ['added', true, false, null]);
  assert.deepEqual(added.content, newTemplate.content);
  addedId = added.id;
  const seen = byNameFr((await call(chloe, 'GET', offered)).body, newTemplate.name.fr);
  assert.deepEqual([seen?.origin, seen?.active, 'used' in seen], ['added', true, false]);
});
await check('admin modifie le modèle ajouté : nom, contenu et tâche ; son propre nom reste permis', async () => {
  const change = { name: { fr: `Compte rendu de réunion ${code}`, en: `Meeting minutes ${code}` }, content: { fr: doc('Décisions'), en: doc('Decisions') }, taskId: '4.2' };
  const r = await call(admin, 'PATCH', adminOne(addedId), change);
  assert.equal(r.status, 200);
  const updated = r.body.find((t) => t.id === addedId);
  assert.deepEqual([updated.name, updated.content, updated.taskId], [change.name, change.content, '4.2']);
  const same = await call(admin, 'PATCH', adminOne(addedId), change);
  assert.equal(same.status, 200);
  const taken = await call(admin, 'PATCH', adminOne(addedId), { ...change, name: { fr: 'Approche de l’analyse métier', en: 'X' } });
  assert.deepEqual([taken.status, taken.body.refusal], [409, 'nameTaken']);
});
await check('admin désactive le modèle ajouté : plus proposé à la création d’une page (400) ; réactivé, il l’est de nouveau', async () => {
  let r = await call(admin, 'PATCH', adminOne(addedId), { active: false });
  assert.deepEqual([r.status, r.body.find((t) => t.id === addedId).active], [200, false]);
  const added = r.body.find((t) => t.id === addedId);
  const body = { title: added.name.fr, content: added.content.fr, template: { id: addedId, locale: 'fr' } };
  r = await call(bruno, 'POST', pages(), body);
  assert.deepEqual([r.status, r.body.refusal], [400, 'unknownPageTemplate']);
  r = await call(admin, 'PATCH', adminOne(addedId), { active: true });
  assert.deepEqual([r.status, r.body.find((t) => t.id === addedId).active], [200, true]);
});
await check('modèle livré : ni modifié ni supprimé (409) ; désactivé, il n’est plus proposé et les pages créées avec lui ne changent pas', async () => {
  const page = await call(bruno, 'POST', pages(), { title: 'Approche', content: approach.content.fr, template: { id: approach.id, locale: 'fr' } });
  assert.equal(page.status, 201);
  let r = await call(admin, 'PATCH', adminOne(approach.id), { ...newTemplate, name: { fr: 'Renommé', en: 'Renamed' } });
  assert.deepEqual([r.status, r.body.refusal], [409, 'deliveredTemplateLocked']);
  r = await call(admin, 'DELETE', adminOne(approach.id));
  assert.deepEqual([r.status, r.body.refusal], [409, 'deliveredTemplateLocked']);
  r = await call(admin, 'PATCH', adminOne(approach.id), { active: false });
  try {
    assert.deepEqual([r.status, r.body.find((t) => t.id === approach.id).active], [200, false]);
    const refused = await call(bruno, 'POST', pages(), { title: 'Non', content: approach.content.fr, template: { id: approach.id, locale: 'fr' } });
    assert.deepEqual([refused.status, refused.body.refusal], [400, 'unknownPageTemplate']);
    const kept = await call(alice, 'GET', `${pages()}/${page.body.id}`);
    assert.deepEqual([kept.body.template, kept.body.taskId, kept.body.content], [{ id: approach.id, name: approach.name.fr }, '3.1', approach.content.fr]);
  } finally {
    r = await call(admin, 'PATCH', adminOne(approach.id), { active: true });
    assert.deepEqual([r.status, r.body.find((t) => t.id === approach.id).active], [200, true]);
  }
});
await check('admin : modèle inconnu (404), identifiant mal formé (400)', async () => {
  let r = await call(admin, 'PATCH', adminOne(unknownId), { active: false });
  assert.deepEqual([r.status, r.body.refusal], [404, 'unknownTemplate']);
  r = await call(admin, 'DELETE', adminOne(unknownId));
  assert.deepEqual([r.status, r.body.refusal], [404, 'unknownTemplate']);
  assert.equal((await call(admin, 'DELETE', adminOne('pas-un-uuid'))).status, 400);
});
await check('admin supprime le modèle ajouté qui n’a jamais servi : il disparaît de la liste', async () => {
  const r = await call(admin, 'DELETE', adminOne(addedId));
  assert.equal(r.status, 200);
  assert.equal(r.body.find((t) => t.id === addedId), undefined);
  assert.equal((await call(chloe, 'GET', offered)).body.find((t) => t.id === addedId), undefined);
});

console.log('\nAdministration des modèles de page — barrière 2 : base de données (RLS, compte applicatif)');
const templateId = '5f1e2d3c-0030-4a00-8000-000000000001';
const adminSql = (query, params = []) => ({ sub: admin.sub, admin: true, query, params });
const addTemplate = (taskId = null, fr = `Modèle SQL ${code}`, contentFr = doc('Contexte')) =>
  adminSql(`SELECT admin_add_page_template($1, $2, $3, $4::jsonb, $5::jsonb, $6)`, [
    templateId,
    fr,
    `SQL template ${code}`,
    JSON.stringify(contentFr),
    JSON.stringify(doc('Context')),
    taskId,
  ]);
const insertPage = (pageId = null) => ({
  sub: bruno.sub,
  query: `INSERT INTO page (id, initiative_id, title, position, template_id, template_name)
          VALUES (coalesce($3::uuid, gen_random_uuid()), $1, 'Via SQL', 0, $2, $4) RETURNING id, template_name, task_id`,
  params: [amInitiativeId, templateId, pageId, `Modèle SQL ${code}`],
});
const pageId = '5f1e2d3c-0030-4a00-8000-0000000000a1';

await check('alice, admin : aucune écriture directe dans les modèles, même en transaction d’administrateur', async () => {
  for (const [u, isAdmin] of [[alice, false], [admin, true]]) {
    assert.equal((await asUserInDb(u.sub, `UPDATE page_template SET active = false WHERE id = $1`, [approach.id], { admin: isAdmin })).rowCount, 0);
    assert.equal((await asUserInDb(u.sub, `DELETE FROM page_template WHERE id = $1`, [approach.id], { admin: isAdmin })).rowCount, 0);
  }
});
await check('alice (hors transaction d’administrateur) : fonctions d’administration des modèles refusées', async () => {
  for (const query of [
    `SELECT admin_add_page_template(gen_random_uuid(), 'A', 'A', '${JSON.stringify(doc('A'))}', '${JSON.stringify(doc('A'))}', NULL)`,
    `SELECT admin_update_page_template('${approach.id}', 'A', 'A', '${JSON.stringify(doc('A'))}', '${JSON.stringify(doc('A'))}', NULL)`,
    `SELECT admin_set_page_template_active('${approach.id}', false)`,
    `SELECT admin_delete_page_template('${approach.id}')`,
  ]) {
    await assert.rejects(asUserInDb(alice.sub, query, []), /réservé à l’administrateur/);
  }
});
await check('admin : un modèle livré n’est ni modifié ni supprimé par la base', async () => {
  for (const query of [
    `SELECT admin_update_page_template('${approach.id}', 'A', 'A', '${JSON.stringify(doc('A'))}', '${JSON.stringify(doc('A'))}', NULL)`,
    `SELECT admin_delete_page_template('${approach.id}')`,
  ]) {
    await assert.rejects(asUserInDb(admin.sub, query, [], { admin: true }), /livré/);
  }
});
await check('base : contenu sans mot ou avec image, nom déjà pris, refusés', async () => {
  await assert.rejects(inDbTransaction([addTemplate(null, `Modèle SQL ${code}`, doc('  '))]), /page_template_content_words/);
  const image = { type: 'doc', content: [{ type: 'image', attrs: { attachmentId: unknownId } }, ...doc('X').content] };
  await assert.rejects(inDbTransaction([addTemplate(null, `Modèle SQL ${code}`, image)]), /page_template_no_image/);
  await assert.rejects(inDbTransaction([addTemplate(null, 'approche de l’analyse métier')]), /page_template_name_fr_key/);
});
await check('base : un modèle ajouté qui a servi ne se supprime plus, même après la suppression de la page', async () => {
  await inDbTransaction([addTemplate(), adminSql(`SELECT admin_delete_page_template($1)`, [templateId])]);
  await assert.rejects(
    inDbTransaction([addTemplate(), insertPage(), adminSql(`SELECT admin_delete_page_template($1)`, [templateId])]),
    /déjà été créée/,
  );
  await assert.rejects(
    inDbTransaction([
      addTemplate(),
      insertPage(pageId),
      { sub: bruno.sub, query: `DELETE FROM page WHERE id = $1`, params: [pageId] },
      adminSql(`SELECT admin_delete_page_template($1)`, [templateId]),
    ]),
    /déjà été créée/,
  );
});
await check('base : modifier ou désactiver le modèle ne touche pas les pages créées ; désactivé, il ne sert plus', async () => {
  const r = await inDbTransaction([
    addTemplate('3.1'),
    insertPage(pageId),
    adminSql(`SELECT admin_update_page_template($1, 'Renommé ${code}', 'Renamed ${code}', $2::jsonb, $2::jsonb, '6.1')`, [
      templateId,
      JSON.stringify(doc('Autre')),
    ]),
    adminSql(`SELECT admin_set_page_template_active($1, false)`, [templateId]),
    { sub: bruno.sub, query: `SELECT template_name, task_id FROM page WHERE id = $1`, params: [pageId] },
  ]);
  assert.deepEqual(r.rows[0], { template_name: `Modèle SQL ${code}`, task_id: '3.1' });
  await assert.rejects(
    inDbTransaction([addTemplate(), adminSql(`SELECT admin_set_page_template_active($1, false)`, [templateId]), insertPage()]),
    /inconnu ou désactivé/,
  );
});
