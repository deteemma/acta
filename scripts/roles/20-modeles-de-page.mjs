import { assert, check, call, asUserInDb, alice, bruno, chloe, admin, code } from './commun.mjs';
// Calcul de la couverture du tableau de bord, tel que le web l'affiche.
const { initiativeDashboard } = await import('/app/api/node_modules/@app/shared/dist/index.js');

// Modèles de page (phase 2, ticket 27). Initiative propre à cette section : alice
// propriétaire, bruno contributeur, chloé lectrice ; admin n'en est pas membre.
console.log('\nModèles de page — barrière 1 : API (guards NestJS)');
export let mpInitiativeId;
const pages = () => `/initiatives/${mpInitiativeId}/pages`;
const suggestionKeys = async () => (await call(alice, 'GET', `/initiatives/${mpInitiativeId}/suggested-actions`)).body.map((s) => s.key);
const unknownId = '00000000-0000-4000-8000-000000000000';
let approach;
let current;
let firstPageId;
let suggestionsBefore;

await check('alice crée l’initiative et invite bruno (contributeur) et chloé (lectrice)', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}MP`, name: 'Modèles de page' });
  assert.equal(r.status, 201);
  mpInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `/initiatives/${mpInitiativeId}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `/initiatives/${mpInitiativeId}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
  suggestionsBefore = await suggestionKeys();
});
await check('tout utilisateur connecté, même non membre, consulte les deux modèles d’essai livrés, en deux langues', async () => {
  for (const u of [alice, chloe, admin]) {
    const r = await call(u, 'GET', '/page-templates');
    assert.equal(r.status, 200);
    approach = r.body.find((t) => t.taskId === '3.1');
    current = r.body.find((t) => t.taskId === '6.1');
    assert.ok(approach && current, 'modèles d’essai 3.1 et 6.1');
  }
  assert.deepEqual([approach.origin, approach.active], ['delivered', true]);
  assert.ok(approach.name.fr && approach.name.en && approach.name.fr !== approach.name.en);
  assert.equal(approach.content.fr.type, 'doc');
  assert.notDeepEqual(approach.content.fr, approach.content.en);
});
await check('bruno (contributeur) crée une page depuis un modèle, en français : mention du modèle, tâche, contenu copié tel quel', async () => {
  const r = await call(bruno, 'POST', pages(), {
    title: 'Notre approche',
    content: approach.content.fr,
    template: { id: approach.id, locale: 'fr' },
  });
  assert.equal(r.status, 201);
  firstPageId = r.body.id;
  assert.deepEqual(r.body.template, { id: approach.id, name: approach.name.fr });
  assert.equal(r.body.taskId, '3.1');
  assert.deepEqual(r.body.content, approach.content.fr);
});
await check('alice (propriétaire) reprend le même modèle, en anglais : un modèle sert autant de fois qu’on veut', async () => {
  const r = await call(alice, 'POST', pages(), {
    title: approach.name.en,
    content: approach.content.en,
    template: { id: approach.id, locale: 'en' },
    parentId: firstPageId,
  });
  assert.equal(r.status, 201);
  assert.deepEqual([r.body.template.name, r.body.taskId], [approach.name.en, '3.1']);
  const second = await call(alice, 'POST', pages(), { title: 'État actuel', content: current.content.fr, template: { id: current.id, locale: 'fr' } });
  assert.deepEqual([second.status, second.body.taskId], [201, '6.1']);
});
await check('une page vide n’a ni modèle ni tâche', async () => {
  const r = await call(bruno, 'POST', pages(), { title: 'Vide' });
  assert.deepEqual([r.status, r.body.template, r.body.taskId], [201, null, null]);
});
await check('modifier la page ne change ni son modèle ni sa tâche', async () => {
  const r = await call(bruno, 'PATCH', `${pages()}/${firstPageId}`, { title: 'Approche révisée', template: { id: current.id, locale: 'en' }, taskId: '6.1' });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.template, r.body.taskId], [{ id: approach.id, name: approach.name.fr }, '3.1']);
});
await check('modèle inconnu : 400 unknownPageTemplate ; langue inconnue : 400', async () => {
  const r = await call(bruno, 'POST', pages(), { title: 'Non', template: { id: unknownId, locale: 'fr' } });
  assert.deepEqual([r.status, r.body.refusal], [400, 'unknownPageTemplate']);
  assert.equal((await call(bruno, 'POST', pages(), { title: 'Non', template: { id: approach.id, locale: 'de' } })).status, 400);
});
await check('chloé (lectrice) ne crée pas de page depuis un modèle : 403 ; admin (non-membre) : 404', async () => {
  const body = { title: 'Non', content: approach.content.fr, template: { id: approach.id, locale: 'fr' } };
  assert.equal((await call(chloe, 'POST', pages(), body)).status, 403);
  assert.equal((await call(admin, 'POST', pages(), body)).status, 404);
});
await check('la fiche de la tâche 3.1 retrouve les pages de mes initiatives ; un non-membre n’en voit aucune', async () => {
  const mine = (await call(chloe, 'GET', '/babok/tasks/3.1/pages')).body.filter((p) => p.initiativeId === mpInitiativeId);
  assert.equal(mine.length, 2);
  assert.ok(mine.some((p) => p.id === firstPageId && p.title === 'Approche révisée'));
  const theirs = (await call(admin, 'GET', '/babok/tasks/3.1/pages')).body.filter((p) => p.initiativeId === mpInitiativeId);
  assert.deepEqual(theirs, []);
  assert.equal((await call(chloe, 'GET', '/babok/tasks/6.1/pages')).body.filter((p) => p.initiativeId === mpInitiativeId).length, 1);
});
await check('une page créée depuis un modèle ne rend pas la tâche couverte et ne change pas les suggestions', async () => {
  // Couverture du tableau de bord, calculée sur ce que l'API renvoie après la création des pages.
  const babok = (await call(alice, 'GET', '/babok')).body;
  const actions = (await call(alice, 'GET', `/initiatives/${mpInitiativeId}/actions`)).body;
  const covered = initiativeDashboard(babok, actions).flatMap((area) => area.tasks.filter((t) => t.covered).map((t) => t.task.id));
  assert.deepEqual(covered, []);
  assert.ok(suggestionsBefore.includes('R1'), 'R1 (tâche 3.1) proposée avant les pages');
  assert.deepEqual(await suggestionKeys(), suggestionsBefore);
});
await check('initiative archivée : pas de page depuis un modèle, même pour la propriétaire', async () => {
  assert.equal((await call(alice, 'PUT', `/initiatives/${mpInitiativeId}/archive`)).status, 200);
  try {
    const r = await call(alice, 'POST', pages(), { title: 'Non', content: approach.content.fr, template: { id: approach.id, locale: 'fr' } });
    assert.equal(r.status, 403);
  } finally {
    assert.equal((await call(alice, 'DELETE', `/initiatives/${mpInitiativeId}/archive`)).status, 200);
  }
});

console.log('\nModèles de page — barrière 2 : base de données (RLS, compte applicatif)');
const insertFromTemplate = (sub, templateId, name, extra = '', values = '') =>
  asUserInDb(
    sub,
    `INSERT INTO page (id, initiative_id, title, position, template_id, template_name${extra})
     VALUES (gen_random_uuid(), $1, 'Via SQL', 0, $2, $3${values}) RETURNING template_name, task_id`,
    [mpInitiativeId, templateId, name],
  );

await check('la base pose la tâche du modèle, quelle que soit celle demandée', async () => {
  const r = await insertFromTemplate(bruno.sub, approach.id, approach.name.en, ', task_id', `, '6.1'`);
  assert.deepEqual(r.rows[0], { template_name: approach.name.en, task_id: '3.1' });
});
await check('la base refuse un nom qui n’est pas celui du modèle, et un modèle inconnu', async () => {
  await assert.rejects(insertFromTemplate(bruno.sub, approach.id, 'Autre nom'), /nom du modèle/);
  await assert.rejects(insertFromTemplate(bruno.sub, unknownId, 'X'), /inconnu ou désactivé/);
});
await check('page vide : la base retire toute tâche demandée', async () => {
  const r = await asUserInDb(
    bruno.sub,
    `INSERT INTO page (id, initiative_id, title, position, task_id) VALUES (gen_random_uuid(), $1, 'Vide', 0, '3.1') RETURNING task_id`,
    [mpInitiativeId],
  );
  assert.equal(r.rows[0].task_id, null);
});
await check('modèle d’origine, nom et tâche d’une page sont figés en base', async () => {
  const r = await asUserInDb(
    bruno.sub,
    `UPDATE page SET template_id = $2, template_name = $3, task_id = '6.1' WHERE id = $1 RETURNING template_id, template_name, task_id`,
    [firstPageId, current.id, current.name.fr],
  );
  assert.deepEqual(r.rows[0], { template_id: approach.id, template_name: approach.name.fr, task_id: '3.1' });
});
await check('les modèles se lisent par tout utilisateur connecté ; le compte applicatif ne les écrit pas, même administrateur', async () => {
  assert.equal((await asUserInDb(chloe.sub, 'SELECT 1 FROM page_template WHERE id = $1', [approach.id])).rowCount, 1);
  for (const [sub, isAdmin] of [[alice.sub, false], [admin.sub, true]]) {
    const options = { admin: isAdmin };
    assert.equal((await asUserInDb(sub, `UPDATE page_template SET name_fr = 'Non' WHERE id = $1`, [approach.id], options)).rowCount, 0);
    assert.equal((await asUserInDb(sub, 'DELETE FROM page_template WHERE id = $1', [approach.id], options)).rowCount, 0);
    await assert.rejects(
      asUserInDb(sub, `INSERT INTO page_template (name_fr, name_en, content_fr, content_en, origin) VALUES ('a', 'a', '{"type":"doc"}', '{"type":"doc"}', 'added')`, [], options),
      /row-level security/,
    );
  }
});
