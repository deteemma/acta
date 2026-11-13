import { assert, check, call, asUserInDb, inDbTransaction, alice, bruno, chloe, admin, code, API } from './commun.mjs';

// Images et pièces jointes des pages (phase 2, ticket 26, décision 10 points 7 à 9).
// alice propriétaire, bruno contributeur, chloé lectrice ; admin n'est pas membre.
console.log('\nImages et pièces jointes des pages — barrière 1 : API (guards NestJS)');
export let ipInitiativeId;
export let ipOtherInitiativeId;
let pageId;
let otherPageId;
let firstImageId;
let secondImageId;
let pdfId;
let removedRevisionId;
const MB = 1024 * 1024;
const base = () => `/initiatives/${ipInitiativeId}`;
const page = (id = pageId) => `${base()}/pages/${id}`;
const files = (id = pageId) => `${page(id)}/attachments`;
const file = (id) => `${base()}/attachments/${id}`;
const image = (attachmentId) => ({ type: 'image', attrs: { attachmentId } });
const paragraph = (text) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const doc = (...content) => ({ type: 'doc', content });
const png = Buffer.from('\x89PNG\r\n\x1a\n image de test', 'latin1');
const pdf = Buffer.from('%PDF-1.4\n% pièce jointe de test\n');

/**
 * Enregistrement avec images, comme le web : longueur de l'en-tête, en-tête JSON,
 * puis les fichiers. `declared` : tailles annoncées, si elles diffèrent des fichiers.
 */
async function saveWithImages(user, pathname, method, header, bytes = []) {
  const json = Buffer.from(JSON.stringify(header));
  const length = Buffer.alloc(4);
  length.writeUInt32BE(json.length);
  const response = await fetch(`${API}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/x-acta-page-save' },
    body: Buffer.concat([length, json, ...bytes]),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : undefined };
}
const upload = (key, name, bytes) => ({ key, name, sizeBytes: bytes.length });
const createWithImages = (user, header, bytes) => saveWithImages(user, `${base()}/pages/with-images`, 'POST', header, bytes);
async function updateWithImages(user, header, bytes, id = pageId) {
  const { revisionId } = (await call(user, 'GET', page(id))).body;
  return saveWithImages(user, `${page(id)}/with-images`, 'PATCH', { baseRevisionId: revisionId, ...header }, bytes);
}
async function update(user, body, id = pageId) {
  const { revisionId } = (await call(user, 'GET', page(id))).body;
  return call(user, 'PATCH', page(id), { baseRevisionId: revisionId, ...body });
}
const download = async (user, id) => {
  const response = await fetch(`${API}${file(id)}/content`, { headers: { Authorization: `Bearer ${user.token}` } });
  return { status: response.status, type: response.headers.get('content-type'), bytes: Buffer.from(await response.arrayBuffer()) };
};
const pageFilesInDb = async (id) =>
  (await asUserInDb(alice.sub, 'SELECT count(*)::int AS n FROM attachment WHERE page_id = $1', [id])).rows[0].n;
const pagesInDb = async () =>
  (await asUserInDb(alice.sub, 'SELECT count(*)::int AS n FROM page WHERE initiative_id = $1', [ipInitiativeId])).rows[0].n;

await check('alice crée l’initiative, invite bruno et chloé ; une autre initiative avec une page illustrée', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}IP`, name: 'Images des pages' });
  assert.equal(r.status, 201);
  ipInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `${base()}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `${base()}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
  ipOtherInitiativeId = (await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}PI`, name: 'Autre' })).body.id;
});

await check('bruno crée une page avec une image, en un seul enregistrement : listée « affichée dans le texte »', async () => {
  const r = await createWithImages(
    bruno,
    { title: 'Schéma', content: doc(paragraph('Avant'), image('upload:1')), uploads: [upload('1', 'collé.png', png)] },
    [png],
  );
  assert.equal(r.status, 201, JSON.stringify(r.body));
  pageId = r.body.id;
  firstImageId = r.body.content.content[1].attrs.attachmentId;
  assert.match(firstImageId, /^[0-9a-f-]{36}$/);
  const list = (await call(chloe, 'GET', files())).body;
  assert.deepEqual(
    list.attachments.map((a) => [a.id, a.name, a.sizeBytes, a.author.userId, a.inText]),
    [[firstImageId, 'collé.png', png.length, bruno.sub, true]],
  );
  assert.equal(list.usage.usedBytes, png.length);
});

await check('chloé (lectrice) lit l’image, sous son type d’image ; admin (non-membre) : 404, ni page ni image', async () => {
  const opened = await download(chloe, firstImageId);
  assert.deepEqual([opened.status, opened.type], [200, 'image/png']);
  assert.ok(opened.bytes.equals(png));
  assert.equal((await download(admin, firstImageId)).status, 404);
  assert.equal((await call(admin, 'GET', files())).status, 404);
  const elsewhere = await fetch(`${API}/initiatives/${ipOtherInitiativeId}/attachments/${firstImageId}/content`, {
    headers: { Authorization: `Bearer ${alice.token}` },
  });
  assert.equal(elsewhere.status, 404);
});

await check('rien n’est rattaché hors d’un enregistrement : envoi interrompu, refus ou saisie basée sur un état dépassé ne laissent aucun fichier', async () => {
  const pages = await pagesInDb();
  // Envoi coupé au milieu du fichier (fermeture brutale) : ni page, ni fichier.
  const cut = await createWithImages(bruno, { title: 'Coupée', content: doc(image('upload:1')), uploads: [upload('1', 'a.png', png)] }, [png.subarray(0, 4)]);
  assert.equal(cut.status, 400);
  assert.equal(await pagesInDb(), pages);
  // Page modifiée entre-temps (ticket 24) : refus, l'image n'est pas gardée.
  const filesBefore = await pageFilesInDb(pageId);
  const stale = await saveWithImages(
    bruno,
    `${page()}/with-images`,
    'PATCH',
    { baseRevisionId: '0b6c4d3e-1f2a-4b5c-8d9e-0f1a2b3c4d5e', content: doc(image('upload:1')), uploads: [upload('1', 'a.png', png)] },
    [png],
  );
  assert.deepEqual([stale.status, stale.body.refusal], [409, 'pageChangedSince']);
  assert.equal(await pageFilesInDb(pageId), filesBefore);
});

await check('formats et limites du ticket 21, images seulement ; chaque image a son fichier : refus avec le nom du fichier, rien n’est gardé', async () => {
  const filesBefore = await pageFilesInDb(pageId);
  const one = (name, bytes, sizeBytes = bytes.length) =>
    updateWithImages(bruno, { content: doc(image('upload:1')), uploads: [{ key: '1', name, sizeBytes }] }, [bytes]);
  let r = await one('note.pdf', pdf);
  assert.deepEqual([r.status, r.body.refusal, r.body.name], [400, 'notAnImage', 'note.pdf']);
  r = await one('logo.svg', png);
  assert.deepEqual([r.status, r.body.refusal, r.body.name], [400, 'formatNotAccepted', 'logo.svg']);
  r = await one('grande.png', png, 10 * MB + 1);
  assert.deepEqual([r.status, r.body.refusal, r.body.name], [413, 'fileTooLarge', 'grande.png']);
  r = await updateWithImages(bruno, { content: doc(paragraph('sans image')), uploads: [upload('1', 'hors.png', png)] }, [png]);
  assert.deepEqual([r.status, r.body.refusal], [400, 'unknownUpload']);
  r = await updateWithImages(bruno, { content: doc(image('upload:2')), uploads: [] }, []);
  assert.deepEqual([r.status, r.body.refusal], [400, 'unknownUpload']);
  // Le JSON seul ne désigne pas une image à venir.
  r = await update(bruno, { content: doc(image('upload:1')) });
  assert.equal(r.status, 400);
  assert.equal(await pageFilesInDb(pageId), filesBefore);
});

await check('le texte n’affiche que des images de la page : celle d’une autre page est refusée (400 imageNotOnPage)', async () => {
  const other = await createWithImages(alice, { title: 'Autre page', content: doc(image('upload:a')), uploads: [upload('a', 'b.png', png)] }, [png]);
  otherPageId = other.body.id;
  const foreign = other.body.content.content[0].attrs.attachmentId;
  const r = await update(bruno, { content: doc(image(foreign)) });
  assert.deepEqual([r.status, r.body.refusal], [400, 'imageNotOnPage']);
  const created = await call(bruno, 'POST', `${base()}/pages`, { title: 'Copie', content: doc(image(foreign)) });
  assert.deepEqual([created.status, created.body.refusal], [400, 'imageNotOnPage']);
});

await check('bruno joint un PDF à la page (sans le texte) puis ajoute une seconde image : la liste montre les trois', async () => {
  const r = await fetch(`${API}${files()}?name=${encodeURIComponent('Compte rendu.pdf')}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${bruno.token}`, 'Content-Type': 'application/octet-stream' },
    body: pdf,
  });
  assert.equal(r.status, 201);
  pdfId = (await r.json()).attachments.at(-1).id;
  const current = (await call(bruno, 'GET', page())).body.content;
  const saved = await updateWithImages(bruno, { content: { ...current, content: [...current.content, image('upload:9')] }, uploads: [upload('9', 'deux.webp', png)] }, [png]);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  secondImageId = saved.body.content.content.at(-1).attrs.attachmentId;
  const list = (await call(bruno, 'GET', files())).body.attachments;
  assert.deepEqual(list.map((a) => [a.id, a.inText]), [[firstImageId, true], [pdfId, false], [secondImageId, true]]);
});

await check('une image retirée du texte reste dans la liste et s’affiche dans les anciens enregistrements', async () => {
  const before = (await call(bruno, 'GET', page())).body.revisionId;
  assert.equal((await update(bruno, { content: doc(paragraph('Avant'), image(secondImageId)) })).status, 200);
  const list = (await call(chloe, 'GET', files())).body.attachments;
  assert.deepEqual(list.map((a) => [a.id, a.inText, a.deletedAt]), [[firstImageId, false, null], [pdfId, false, null], [secondImageId, true, null]]);
  const old = (await call(chloe, 'GET', `${page()}/revisions/${before}`)).body;
  assert.ok(JSON.stringify(old.content).includes(firstImageId));
  assert.equal((await download(chloe, firstImageId)).status, 200);
});

await check('suppression refusée pour une image du dernier enregistrement (409) ; sinon les enregistrements touchés sont signalés', async () => {
  const refused = await call(bruno, 'DELETE', file(secondImageId));
  assert.deepEqual([refused.status, refused.body.refusal], [409, 'imageInLastRevision']);
  const shown = await call(chloe, 'GET', `${files()}/${firstImageId}/revisions`);
  assert.equal(shown.status, 200);
  // Les deux enregistrements qui l'affichaient, du plus récent au plus ancien.
  assert.equal(shown.body.length, 2);
  assert.ok(shown.body[0].sequence > shown.body[1].sequence);
  assert.equal((await call(admin, 'GET', `${files()}/${firstImageId}/revisions`)).status, 404);
  removedRevisionId = shown.body[0].id;
});

await check('supprimer l’image : « image supprimée » à sa place, y compris après la restauration d’un ancien enregistrement', async () => {
  const deleted = await call(alice, 'DELETE', file(firstImageId));
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.deletedBy.userId, alice.sub);
  const opened = await download(chloe, firstImageId);
  assert.equal(opened.status, 409);
  const restored = await call(bruno, 'POST', `${page()}/revisions/${removedRevisionId}/restore`);
  assert.equal(restored.status, 200, JSON.stringify(restored.body));
  assert.ok(JSON.stringify(restored.body.content).includes(firstImageId));
  assert.equal((await download(chloe, firstImageId)).status, 409);
  // La trace dans le texte se garde à l'enregistrement suivant.
  assert.equal((await update(bruno, { title: 'Schéma restauré', content: restored.body.content })).status, 200);
});

await check('supprimer un enregistrement ne supprime aucun fichier', async () => {
  const revisions = (await call(bruno, 'GET', `${page()}/revisions`)).body;
  const withSecond = revisions.filter((r) => !r.deletedAt).at(-2);
  const filesBefore = (await call(bruno, 'GET', files())).body.attachments.map((a) => [a.id, a.deletedAt]);
  assert.equal((await call(bruno, 'DELETE', `${page()}/revisions/${withSecond.id}`)).status, 200);
  assert.deepEqual((await call(bruno, 'GET', files())).body.attachments.map((a) => [a.id, a.deletedAt]), filesBefore);
});

await check('chloé (lectrice) n’enregistre ni image ni fichier (403) ; initiative archivée : lecture seule', async () => {
  const r = await updateWithImages(chloe, { content: doc(image('upload:1')), uploads: [upload('1', 'a.png', png)] }, [png]);
  assert.equal(r.status, 403);
  assert.equal((await call(alice, 'PUT', `${base()}/archive`)).status, 200);
  try {
    const archived = await updateWithImages(alice, { content: doc(image('upload:1')), uploads: [upload('1', 'a.png', png)] }, [png]);
    assert.equal(archived.status, 403);
    assert.equal((await call(alice, 'DELETE', file(pdfId))).status, 403);
    assert.equal((await download(chloe, secondImageId)).status, 200);
  } finally {
    assert.equal((await call(alice, 'DELETE', `${base()}/archive`)).status, 200);
  }
});

console.log('\nImages et pièces jointes des pages — barrière 2 : base de données (RLS, compte applicatif)');

await check('la base refuse un texte qui affiche l’image d’une autre page', async () => {
  const foreign = (await call(alice, 'GET', page(otherPageId))).body.content.content[0].attrs.attachmentId;
  await assert.rejects(
    inDbTransaction([
      { sub: bruno.sub, query: `UPDATE page SET content = $2::jsonb WHERE id = $1`, params: [pageId, JSON.stringify(doc(image(foreign)))] },
      { sub: bruno.sub, query: 'SET CONSTRAINTS page_images_on_page IMMEDIATE' },
    ]),
    /page_image_not_on_page|n’affiche que ses propres images/,
  );
});

await check('la base refuse de supprimer une image du dernier enregistrement', async () => {
  await assert.rejects(
    asUserInDb(bruno.sub, 'UPDATE attachment SET content = NULL WHERE id = $1', [secondImageId]),
    /dernier enregistrement/,
  );
});

await check('chloé (lectrice) n’ajoute aucun fichier à la page en base ; admin (non-membre) ne voit aucune image', async () => {
  await assert.rejects(
    asUserInDb(chloe.sub, `INSERT INTO attachment (id, initiative_id, page_id, name, content) VALUES (gen_random_uuid(), $1, $2, 'a.png', '\\x00'::bytea)`, [
      ipInitiativeId,
      pageId,
    ]),
    /row-level security/,
  );
  assert.equal((await asUserInDb(admin.sub, 'SELECT 1 FROM attachment WHERE page_id = $1', [pageId])).rowCount, 0);
  assert.equal((await asUserInDb(chloe.sub, 'SELECT 1 FROM attachment WHERE page_id = $1', [pageId])).rowCount, 3);
});

await check('supprimer la page emporte ses fichiers et ses images', async () => {
  const r = await createWithImages(bruno, { title: 'Éphémère', content: doc(image('upload:1')), uploads: [upload('1', 'a.gif', png)] }, [png]);
  assert.equal(r.status, 201);
  assert.equal((await call(bruno, 'DELETE', page(r.body.id))).status, 204);
  assert.equal(await pageFilesInDb(r.body.id), 0);
});
