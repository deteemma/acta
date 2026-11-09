import { assert, check, call, asUserInDb, alice, bruno, chloe, admin, code, API, pg, env } from './commun.mjs';

// Pièces jointes (phase 2, ticket 21, décision 10). alice propriétaire, bruno
// contributeur, chloé lectrice ; admin n'est pas membre.
console.log('\nPièces jointes — barrière 1 : API (guards NestJS)');
export let ajInitiativeId;
export let ajOtherInitiativeId;
let questionId;
let actionId;
let otherTicketId;
let pdfId;
let docxId;
let aliceFileId;
const MB = 1024 * 1024;
const tickets = () => `/initiatives/${ajInitiativeId}/tickets`;
const files = (ticketId) => `${tickets()}/${ticketId}/attachments`;
const file = (id) => `/initiatives/${ajInitiativeId}/attachments/${id}`;

/** Envoi brut d'un fichier, comme le web. */
async function upload(user, ticketId, name, bytes, initiativeId = ajInitiativeId) {
  const response = await fetch(`${API}/initiatives/${initiativeId}/tickets/${ticketId}/attachments?name=${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/octet-stream' },
    body: bytes,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : undefined };
}

/** Téléchargement : statut, en-têtes et octets. */
async function download(user, id) {
  const response = await fetch(`${API}${file(id)}/content`, { headers: { Authorization: `Bearer ${user.token}` } });
  return { status: response.status, headers: response.headers, bytes: Buffer.from(await response.arrayBuffer()) };
}

/** Écriture validée en base « en tant que » l'utilisateur (asUserInDb annule la sienne). */
async function commitAsUser(sub, query, params) {
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.user_id', $1, true)`, [sub]);
    const result = await client.query(query, params);
    await client.query('COMMIT');
    return result;
  } finally {
    await client.end();
  }
}

const pdf = Buffer.from('%PDF-1.4\n% pièce jointe de test\n');

await check('alice crée l’initiative, invite bruno et chloé ; une question, une action ; une autre initiative', async () => {
  const r = await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}AJ`, name: 'Pièces jointes' });
  assert.equal(r.status, 201);
  ajInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `/initiatives/${ajInitiativeId}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `/initiatives/${ajInitiativeId}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
  questionId = (await call(alice, 'POST', tickets(), { type: 'question', title: 'Question' })).body.id;
  actionId = (await call(alice, 'POST', `/initiatives/${ajInitiativeId}/actions`, { title: 'Action', taskId: '4.1' })).body.id;
  ajOtherInitiativeId = (await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}AX`, name: 'Autre' })).body.id;
  otherTicketId = (await call(alice, 'POST', `/initiatives/${ajOtherInitiativeId}/tickets`, { type: 'question', title: 'Ailleurs' })).body.id;
});
await check('bruno (contributeur) joint un PDF : nom, format, taille, auteur, date ; occupation de l’initiative et limite de 500 Mo', async () => {
  const r = await upload(bruno, questionId, '  Compte rendu.PDF ', pdf);
  assert.equal(r.status, 201);
  const [a] = r.body.attachments;
  assert.deepEqual([a.name, a.format, a.preview, a.sizeBytes, a.author.userId, a.deletedAt], ['Compte rendu.PDF', 'pdf', true, pdf.length, bruno.sub, null]);
  assert.ok(a.createdAt);
  assert.deepEqual(r.body.usage, { usedBytes: pdf.length, quotaBytes: 500 * MB });
  pdfId = a.id;
});
await check('deux fichiers peuvent porter le même nom ; un Word se joint aussi, de même qu’un fichier vide', async () => {
  assert.equal((await upload(bruno, questionId, 'Compte rendu.PDF', pdf)).status, 201);
  const r = await upload(alice, questionId, 'Note.docx', Buffer.from('PK word'));
  assert.equal(r.status, 201);
  docxId = r.body.attachments.at(-1).id;
  aliceFileId = docxId;
  assert.equal((await upload(bruno, questionId, 'vide.txt', Buffer.alloc(0))).status, 201);
});
await check('formats refusés avec un motif : HTML, SVG, programme, archive, macros, sans extension (400) ; rien n’est gardé', async () => {
  for (const name of ['page.html', 'logo.svg', 'setup.exe', 'tout.zip', 'macro.docm', 'LISEZMOI']) {
    const r = await upload(bruno, questionId, name, Buffer.from('<script>alert(1)</script>'));
    assert.deepEqual([r.status, r.body.refusal], [400, 'formatNotAccepted'], name);
  }
  assert.equal((await upload(bruno, questionId, 'dossier/a.pdf', pdf)).status, 400);
  assert.equal((await call(bruno, 'GET', files(questionId))).body.attachments.length, 4);
});
await check('10 Mo au plus par fichier : 10 Mo acceptés, un octet de plus refusé (413) et rien n’est gardé', async () => {
  const ok = await upload(bruno, questionId, 'dix.png', Buffer.alloc(10 * MB));
  assert.equal(ok.status, 201);
  assert.equal(ok.body.attachments.at(-1).sizeBytes, 10 * MB);
  // Fastify répond 413 dès la limite franchie et coupe la connexion : le client
  // reçoit la réponse, ou voit l'envoi interrompu.
  const refused = await upload(bruno, questionId, 'trop.png', Buffer.alloc(10 * MB + 1)).catch((e) => ({ status: e.message }));
  assert.ok([413, 'fetch failed'].includes(refused.status), String(refused.status));
  assert.equal((await call(bruno, 'GET', files(questionId))).body.attachments.length, 5);
});
await check('chloé (lectrice) liste et ouvre : PDF servi sous son type, Word en téléchargement, jamais deviné ni exécuté', async () => {
  const list = await call(chloe, 'GET', files(questionId));
  assert.deepEqual([list.status, list.body.attachments.length], [200, 5]);
  const opened = await download(chloe, pdfId);
  assert.equal(opened.status, 200);
  assert.ok(opened.bytes.equals(pdf));
  assert.equal(opened.headers.get('content-type'), 'application/pdf');
  assert.match(opened.headers.get('content-disposition'), /^inline;.*filename\*=UTF-8''Compte%20rendu\.PDF/);
  assert.equal(opened.headers.get('x-content-type-options'), 'nosniff');
  assert.match(opened.headers.get('content-security-policy'), /sandbox/);
  const word = await download(chloe, docxId);
  assert.equal(word.headers.get('content-type'), 'application/octet-stream');
  assert.match(word.headers.get('content-disposition'), /^attachment;/);
});
await check('chloé n’ajoute, ne renomme ni ne supprime (403) ; admin (non-membre) : 404', async () => {
  assert.equal((await upload(chloe, questionId, 'a.pdf', pdf)).status, 403);
  assert.equal((await call(chloe, 'PATCH', file(pdfId), { baseName: 'Lectrice' })).status, 403);
  assert.equal((await call(chloe, 'DELETE', file(pdfId))).status, 403);
  assert.equal((await call(admin, 'GET', files(questionId))).status, 404);
  assert.equal((await download(admin, pdfId)).status, 404);
});
await check('pas de fichier sur un ticket d’une autre initiative, ni d’accès par une autre initiative : 404', async () => {
  assert.equal((await upload(bruno, otherTicketId, 'a.pdf', pdf)).status, 404);
  assert.equal((await call(bruno, 'GET', files(otherTicketId))).status, 404);
  const elsewhere = await fetch(`${API}/initiatives/${ajOtherInitiativeId}/attachments/${pdfId}/content`, { headers: { Authorization: `Bearer ${alice.token}` } });
  assert.equal(elsewhere.status, 404);
});
await check('renommer garde l’extension, sans trace ; un nom vide est refusé (400)', async () => {
  const r = await call(bruno, 'PATCH', file(pdfId), { baseName: ' Compte rendu final.exe ' });
  assert.deepEqual([r.status, r.body.name], [200, 'Compte rendu final.exe.PDF']);
  assert.equal((await call(bruno, 'PATCH', file(pdfId), { baseName: '  ' })).status, 400);
  assert.equal((await call(bruno, 'PATCH', file(pdfId), { baseName: 'a/b' })).status, 400);
});
await check('tout type de ticket, Action comprise ; hors historique : le ticket ne change pas', async () => {
  const before = (await call(bruno, 'GET', `/initiatives/${ajInitiativeId}/actions/${actionId}`)).body;
  assert.equal((await upload(bruno, actionId, 'capture.webp', Buffer.from('RIFF'))).status, 201);
  const after = (await call(bruno, 'GET', `/initiatives/${ajInitiativeId}/actions/${actionId}`)).body;
  assert.deepEqual([after.updatedAt, after.updatedBy.userId], [before.updatedAt, before.updatedBy.userId]);
  assert.equal((await call(bruno, 'GET', `/initiatives/${ajInitiativeId}/actions/${actionId}/history`)).body.length, 0);
  assert.equal((await call(bruno, 'GET', `${tickets()}/${questionId}/history`)).body.length, 0);
});
await check('suppression d’un fichier d’un autre membre par un contributeur : ligne de trace, place libérée, contenu perdu', async () => {
  const usedBefore = (await call(bruno, 'GET', files(questionId))).body.usage.usedBytes;
  const r = await call(bruno, 'DELETE', file(aliceFileId));
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.name, r.body.deletedBy.userId, r.body.author.userId], ['Note.docx', bruno.sub, alice.sub]);
  assert.ok(r.body.deletedAt);
  const after = (await call(chloe, 'GET', files(questionId))).body;
  assert.equal(after.usage.usedBytes, usedBefore - 'PK word'.length);
  assert.equal(after.attachments.find((a) => a.id === aliceFileId).deletedBy.userId, bruno.sub);
  assert.equal((await download(chloe, aliceFileId)).status, 409);
});
await check('une ligne de trace ne se renomme ni ne se supprime : 409', async () => {
  const rename = await call(alice, 'PATCH', file(aliceFileId), { baseName: 'Retour' });
  assert.deepEqual([rename.status, rename.body.refusal], [409, 'attachmentDeleted']);
  const again = await call(alice, 'DELETE', file(aliceFileId));
  assert.deepEqual([again.status, again.body.refusal], [409, 'attachmentDeleted']);
});
await check('limite de l’initiative atteinte : ajout refusé avec un motif (409) ; supprimer libère la place', async () => {
  const used = (await call(bruno, 'GET', files(questionId))).body.usage.usedBytes;
  // Remplissage en base par des fichiers de zéros, très peu coûteux une fois compressés.
  const fill = [];
  let remaining = 500 * MB - used - 10;
  while (remaining > 0) {
    const size = Math.min(10 * MB, remaining);
    const r = await commitAsUser(bruno.sub,
      `INSERT INTO attachment (id, initiative_id, ticket_id, name, content) VALUES (gen_random_uuid(), $1, $2, 'remplissage.txt', decode(repeat('00', $3), 'hex')) RETURNING id`,
      [ajInitiativeId, questionId, size]);
    fill.push(r.rows[0].id);
    remaining -= size;
  }
  try {
    assert.equal((await upload(bruno, questionId, 'petit.txt', Buffer.alloc(10))).status, 201);
    const refused = await upload(bruno, questionId, 'un-de-trop.txt', Buffer.alloc(1));
    assert.deepEqual([refused.status, refused.body.refusal], [409, 'quotaExceeded']);
    const usage = (await call(chloe, 'GET', files(questionId))).body.usage;
    assert.deepEqual(usage, { usedBytes: 500 * MB, quotaBytes: 500 * MB });
  } finally {
    await commitAsUser(bruno.sub, 'UPDATE attachment SET content = NULL WHERE id = ANY($1)', [fill]);
  }
  assert.equal((await upload(bruno, questionId, 'après.txt', Buffer.alloc(1))).status, 201);
});
await check('supprimer le ticket emporte ses fichiers', async () => {
  const decision = (await call(bruno, 'POST', tickets(), { type: 'decision', title: 'Éphémère' })).body.id;
  assert.equal((await upload(bruno, decision, 'a.pdf', pdf)).status, 201);
  assert.equal((await call(bruno, 'DELETE', `${tickets()}/${decision}`)).status, 204);
  assert.equal((await asUserInDb(alice.sub, 'SELECT 1 FROM attachment WHERE ticket_id = $1', [decision])).rowCount, 0);
});

console.log('\nPièces jointes — barrière 2 : base de données (RLS, compte applicatif)');
const insertFile = (sub, { ticketId = questionId, name = 'base.pdf', initiativeId = ajInitiativeId } = {}) =>
  asUserInDb(
    sub,
    `INSERT INTO attachment (id, initiative_id, ticket_id, name, content) VALUES (gen_random_uuid(), $1, $2, $3, '\\x2550444621'::bytea) RETURNING created_by, size_bytes`,
    [initiativeId, ticketId, name],
  );

await check('propriétaire et contributeur ajoutent en base ; auteur et taille écrits par la base', async () => {
  for (const u of [alice, bruno]) assert.deepEqual((await insertFile(u.sub)).rows[0], { created_by: u.sub, size_bytes: 5 });
  const forged = await asUserInDb(
    bruno.sub,
    `INSERT INTO attachment (id, initiative_id, ticket_id, name, content, created_by, size_bytes) VALUES (gen_random_uuid(), $1, $2, 'a.pdf', '\\x00'::bytea, $3, 1) RETURNING created_by, size_bytes`,
    [ajInitiativeId, questionId, alice.sub],
  );
  assert.deepEqual(forged.rows[0], { created_by: bruno.sub, size_bytes: 1 });
});
await check('la base refuse : format non accepté, nom avec chemin, plus de 10 Mo, sans objet, ticket d’une autre initiative', async () => {
  for (const name of ['page.html', 'logo.svg', 'setup.exe', 'tout.zip', '.pdf']) {
    await assert.rejects(insertFile(bruno.sub, { name }), /attachment_format/, name);
  }
  await assert.rejects(insertFile(bruno.sub, { name: 'dossier/a.pdf' }), /attachment_name_valid/);
  await assert.rejects(
    asUserInDb(bruno.sub, `INSERT INTO attachment (id, initiative_id, ticket_id, name, content) VALUES (gen_random_uuid(), $1, $2, 'a.png', decode(repeat('00', 10485761), 'hex'))`, [ajInitiativeId, questionId]),
    /attachment_size/,
  );
  await assert.rejects(
    asUserInDb(bruno.sub, `INSERT INTO attachment (id, initiative_id, name, content) VALUES (gen_random_uuid(), $1, 'a.pdf', '\\x00'::bytea)`, [ajInitiativeId]),
    /attachment_one_subject/,
  );
  await assert.rejects(insertFile(bruno.sub, { ticketId: otherTicketId }), /attachment_ticket_fkey/);
});
await check('en base : renommer garde l’extension ; le contenu ne se remplace pas ; aucune ligne ne s’efface', async () => {
  await assert.rejects(asUserInDb(bruno.sub, `UPDATE attachment SET name = 'a.html' WHERE id = $1`, [pdfId]), /garde l’extension|attachment_format/);
  await assert.rejects(asUserInDb(bruno.sub, `UPDATE attachment SET name = 'a.png' WHERE id = $1`, [pdfId]), /garde l’extension/);
  const kept = await asUserInDb(bruno.sub, `UPDATE attachment SET content = '\\x00'::bytea, name = 'Autre.pdf' WHERE id = $1 RETURNING content, name`, [pdfId]);
  assert.ok(kept.rows[0].content.equals(pdf));
  assert.equal(kept.rows[0].name, 'Autre.pdf');
  await assert.rejects(asUserInDb(bruno.sub, `UPDATE attachment SET name = 'Retour.docx' WHERE id = $1`, [aliceFileId]), /a été supprimée/);
  assert.equal((await asUserInDb(alice.sub, 'DELETE FROM attachment WHERE initiative_id = $1', [ajInitiativeId])).rowCount, 0);
});
await check('lectrice et non-membre n’écrivent pas ; non-membre ne lit rien ; personne ne règle la limite en base', async () => {
  await assert.rejects(insertFile(chloe.sub), /row-level security/);
  await assert.rejects(insertFile(admin.sub), /row-level security/);
  assert.equal((await asUserInDb(chloe.sub, `UPDATE attachment SET content = NULL WHERE id = $1`, [pdfId])).rowCount, 0);
  assert.ok((await asUserInDb(chloe.sub, 'SELECT content FROM attachment WHERE id = $1', [pdfId])).rows[0].content.equals(pdf));
  assert.equal((await asUserInDb(admin.sub, 'SELECT 1 FROM attachment')).rowCount, 0);
  assert.equal((await asUserInDb(alice.sub, 'UPDATE app_settings SET attachment_quota_mb = 1024')).rowCount, 0);
  assert.equal((await asUserInDb(admin.sub, 'UPDATE app_settings SET attachment_quota_mb = 1024', [], { admin: true })).rowCount, 0);
});

console.log('\nPièces jointes — initiative archivée');
await check('initiative archivée : ni ajout, ni renommage, ni suppression (403, rien en base) ; tout membre ouvre et télécharge', async () => {
  assert.equal((await call(alice, 'PUT', `/initiatives/${ajInitiativeId}/archive`)).status, 200);
  try {
    for (const u of [alice, bruno]) {
      assert.equal((await upload(u, questionId, 'a.pdf', pdf)).status, 403);
      assert.equal((await call(u, 'PATCH', file(pdfId), { baseName: 'Archivée' })).status, 403);
      assert.equal((await call(u, 'DELETE', file(pdfId))).status, 403);
      await assert.rejects(insertFile(u.sub), /row-level security/);
      assert.equal((await asUserInDb(u.sub, 'UPDATE attachment SET content = NULL WHERE id = $1', [pdfId])).rowCount, 0);
    }
    for (const u of [alice, bruno, chloe]) {
      assert.equal((await call(u, 'GET', files(questionId))).status, 200);
      assert.equal((await download(u, pdfId)).status, 200);
    }
  } finally {
    assert.equal((await call(alice, 'DELETE', `/initiatives/${ajInitiativeId}/archive`)).status, 200);
  }
});
