import { assert, check, call, asUserInDb, API, alice, bruno, chloe, admin, code } from './commun.mjs';

// Administration de la limite de pièces jointes (phase 2, ticket 31, décision 14
// point 4). Valable pour toute l'application : la limite est remise à 500 Mo à la
// fin, quoi qu'il arrive, pour ne rien changer à la base de développement.
// alice propriétaire, bruno contributeur, chloé lectrice ; admin n'est pas membre.
console.log('\nLimite de pièces jointes — barrière 1 : API (guards NestJS)');
export let lpInitiativeId;
export let lpOtherInitiativeId;
let ticketId;
let otherTicketId;
const MB = 1024 * 1024;
const quotaPath = '/admin/attachment-quota';
const files = (initiativeId, id) => `/initiatives/${initiativeId}/tickets/${id}/attachments`;

/** Envoi brut d'un fichier, comme le web. */
async function upload(user, initiativeId, id, name, bytes) {
  const response = await fetch(`${API}${files(initiativeId, id)}?name=${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/octet-stream' },
    body: bytes,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : undefined };
}

await check('alice crée deux initiatives avec chacune une question, invite bruno (contributeur) et chloé (lectrice)', async () => {
  let r = await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}QL`, name: 'Limite de pièces jointes' });
  assert.equal(r.status, 201);
  lpInitiativeId = r.body.id;
  assert.equal((await call(alice, 'POST', `/initiatives/${lpInitiativeId}/members`, { email: 'bruno@exemple.test', role: 'contributor' })).status, 204);
  assert.equal((await call(alice, 'POST', `/initiatives/${lpInitiativeId}/members`, { email: 'chloe@exemple.test', role: 'reader' })).status, 204);
  ticketId = (await call(alice, 'POST', `/initiatives/${lpInitiativeId}/tickets`, { type: 'question', title: 'Question' })).body.id;
  r = await call(alice, 'POST', '/initiatives', { code: `${code.slice(0, 8)}QM`, name: 'Autre limite' });
  lpOtherInitiativeId = r.body.id;
  otherTicketId = (await call(alice, 'POST', `/initiatives/${lpOtherInitiativeId}/tickets`, { type: 'question', title: 'Ailleurs' })).body.id;
});
await check('alice, bruno, chloé (non administrateurs) : limite ni lue ni réglée (403)', async () => {
  for (const u of [alice, bruno, chloe]) {
    assert.equal((await call(u, 'GET', quotaPath)).status, 403);
    assert.equal((await call(u, 'PUT', quotaPath, { quotaMb: 1024 })).status, 403);
  }
});
await check('admin lit la limite : 500 Mo par défaut, sans l’occupation d’aucune initiative', async () => {
  const r = await call(admin, 'GET', quotaPath);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { quotaMb: 500 });
});
await check('admin : hors de 10 à 1 024 Mo, non entier, texte ou absent (schéma partagé) : 400, limite inchangée', async () => {
  for (const quotaMb of [9, 0, -1, 1025, 12.5, '500', null]) {
    assert.equal((await call(admin, 'PUT', quotaPath, { quotaMb })).status, 400, `${quotaMb}`);
  }
  assert.equal((await call(admin, 'PUT', quotaPath, {})).status, 400);
  assert.deepEqual((await call(admin, 'GET', quotaPath)).body, { quotaMb: 500 });
});

try {
  await check('admin règle 10 puis 1 024 Mo (les bornes) : valable dans toutes les initiatives, vu par les membres', async () => {
    let r = await call(admin, 'PUT', quotaPath, { quotaMb: 10 });
    assert.deepEqual([r.status, r.body], [200, { quotaMb: 10 }]);
    assert.equal((await call(chloe, 'GET', files(lpInitiativeId, ticketId))).body.usage.quotaBytes, 10 * MB);
    assert.equal((await call(alice, 'GET', files(lpOtherInitiativeId, otherTicketId))).body.usage.quotaBytes, 10 * MB);
    r = await call(admin, 'PUT', quotaPath, { quotaMb: 1024 });
    assert.deepEqual([r.status, r.body], [200, { quotaMb: 1024 }]);
    assert.equal((await call(chloe, 'GET', files(lpInitiativeId, ticketId))).body.usage.quotaBytes, 1024 * MB);
  });
  await check('la taille maximale d’un fichier reste 10 Mo, quelle que soit la limite', async () => {
    // Fastify répond 413 dès la limite franchie et coupe la connexion (comme en section 19).
    const r = await upload(bruno, lpInitiativeId, ticketId, 'gros.txt', Buffer.alloc(10 * MB + 1)).catch((e) => ({ status: e.message }));
    assert.ok([413, 'fetch failed'].includes(r.status), String(r.status));
    assert.equal((await call(bruno, 'GET', files(lpInitiativeId, ticketId))).body.attachments.length, 0);
  });
  await check('baisser la limite sous l’occupation ne supprime aucun fichier : seuls les ajouts sont refusés', async () => {
    for (const name of ['a.txt', 'b.txt', 'c.txt']) {
      assert.equal((await upload(bruno, lpInitiativeId, ticketId, name, Buffer.alloc(6 * MB))).status, 201, name);
    }
    assert.equal((await call(admin, 'PUT', quotaPath, { quotaMb: 10 })).status, 200);
    let list = (await call(chloe, 'GET', files(lpInitiativeId, ticketId))).body;
    assert.equal(list.attachments.filter((a) => a.deletedAt === null).length, 3);
    assert.deepEqual(list.usage, { usedBytes: 18 * MB, quotaBytes: 10 * MB });
    const refused = await upload(bruno, lpInitiativeId, ticketId, 'vide.txt', Buffer.alloc(0));
    assert.deepEqual([refused.status, refused.body.refusal], [409, 'quotaExceeded']);
    // Les fichiers restent renommables et supprimables ; supprimer libère la place.
    const [first, second] = list.attachments;
    assert.equal((await call(bruno, 'PATCH', `/initiatives/${lpInitiativeId}/attachments/${first.id}`, { baseName: 'renommé' })).status, 200);
    assert.equal((await call(bruno, 'DELETE', `/initiatives/${lpInitiativeId}/attachments/${first.id}`)).status, 200);
    assert.equal((await call(bruno, 'DELETE', `/initiatives/${lpInitiativeId}/attachments/${second.id}`)).status, 200);
    list = (await call(chloe, 'GET', files(lpInitiativeId, ticketId))).body;
    assert.deepEqual(list.usage, { usedBytes: 6 * MB, quotaBytes: 10 * MB });
    assert.equal((await upload(bruno, lpInitiativeId, ticketId, 'petit.txt', Buffer.alloc(1))).status, 201);
  });
  await check('admin remonte la limite : les ajouts reprennent', async () => {
    assert.equal((await call(admin, 'PUT', quotaPath, { quotaMb: 500 })).status, 200);
    assert.equal((await upload(bruno, lpInitiativeId, ticketId, 'd.txt', Buffer.alloc(6 * MB))).status, 201);
  });

  console.log('\nLimite de pièces jointes — barrière 2 : base (RLS et fonction d’administration)');
  await check('seul l’administrateur règle la limite, par sa fonction, entre 10 et 1 024 Mo ; pas d’écriture directe', async () => {
    for (const u of [alice, bruno, chloe]) {
      await assert.rejects(asUserInDb(u.sub, 'SELECT admin_set_attachment_quota(1024)'), /réservé à l’administrateur/);
      assert.equal((await asUserInDb(u.sub, 'UPDATE app_settings SET attachment_quota_mb = 1024')).rowCount, 0);
    }
    await assert.rejects(asUserInDb(admin.sub, 'SELECT admin_set_attachment_quota(9)', [], { admin: true }), /app_settings_attachment_quota/);
    await assert.rejects(asUserInDb(admin.sub, 'SELECT admin_set_attachment_quota(1025)', [], { admin: true }), /app_settings_attachment_quota/);
    // Transaction annulée par asUserInDb : la limite n'est pas changée.
    assert.equal((await asUserInDb(admin.sub, 'SELECT admin_set_attachment_quota(10)', [], { admin: true })).rowCount, 1);
    assert.equal((await asUserInDb(admin.sub, 'UPDATE app_settings SET attachment_quota_mb = 1024', [], { admin: true })).rowCount, 0);
    assert.equal((await asUserInDb(admin.sub, 'SELECT 1 FROM attachment')).rowCount, 0);
  });
} finally {
  await call(admin, 'PUT', quotaPath, { quotaMb: 500 });
}
await check('la limite est revenue à 500 Mo', async () => {
  assert.deepEqual((await call(admin, 'GET', quotaPath)).body, { quotaMb: 500 });
});
