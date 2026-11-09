import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ATTACHMENT_QUOTA_DEFAULT_MB,
  attachmentBaseName,
  attachmentFormat,
  attachmentNameSchema,
  attachmentQuotaBytes,
  checkAttachmentUpload,
  fileSize,
  sortAttachments,
  renamedAttachment,
} from './attachments.js';

test('formats acceptés : documents, images, schémas, courriels, extension en majuscules comprise', () => {
  assert.equal(attachmentFormat('Compte rendu.PDF')?.format, 'pdf');
  assert.equal(attachmentFormat('note.docx')?.format, 'word');
  assert.equal(attachmentFormat('budget.xls')?.format, 'excel');
  assert.equal(attachmentFormat('cadrage.pptx')?.format, 'powerpoint');
  assert.equal(attachmentFormat('texte.odt')?.format, 'opendocument');
  assert.equal(attachmentFormat('lisez-moi.txt')?.format, 'text');
  assert.equal(attachmentFormat('export.csv')?.format, 'csv');
  assert.equal(attachmentFormat('notes.md')?.format, 'markdown');
  assert.equal(attachmentFormat('photo.jpeg')?.format, 'jpeg');
  assert.equal(attachmentFormat('photo.JPG')?.format, 'jpeg');
  assert.equal(attachmentFormat('anim.gif')?.format, 'gif');
  assert.equal(attachmentFormat('écran.webp')?.format, 'webp');
  assert.equal(attachmentFormat('écran.png')?.format, 'png');
  assert.equal(attachmentFormat('processus.bpmn')?.format, 'bpmn');
  assert.equal(attachmentFormat('schéma.drawio')?.format, 'drawio');
  assert.equal(attachmentFormat('plan.vsdx')?.format, 'visio');
  assert.equal(attachmentFormat('réponse.eml')?.format, 'email');
  assert.equal(attachmentFormat('réponse.msg')?.format, 'email');
});

test('formats refusés : HTML, SVG, programmes, archives, macros, sans extension', () => {
  for (const name of ['page.html', 'page.htm', 'logo.svg', 'setup.exe', 'script.js', 'lot.bat', 'tout.zip', 'macro.docm', 'macro.xlsm', 'LISEZMOI', 'rapport.', '.pdf']) {
    assert.equal(attachmentFormat(name), null, name);
  }
});

test('seuls les images et le PDF s’ouvrent dans l’application ; le reste se télécharge', () => {
  for (const name of ['a.png', 'a.jpg', 'a.gif', 'a.webp', 'a.pdf']) assert.equal(attachmentFormat(name)?.preview, true, name);
  for (const name of ['a.docx', 'a.txt', 'a.md', 'a.bpmn', 'a.eml']) assert.equal(attachmentFormat(name)?.preview, false, name);
});

const MB = 1024 * 1024;

test('envoi : format accepté, 10 Mo au plus par fichier', () => {
  const usage = { usedBytes: 0, quotaBytes: 500 * MB };
  assert.equal(checkAttachmentUpload({ name: 'a.pdf', sizeBytes: 10 * MB }, usage), null);
  assert.equal(checkAttachmentUpload({ name: 'a.pdf', sizeBytes: 10 * MB + 1 }, usage), 'fileTooLarge');
  assert.equal(checkAttachmentUpload({ name: 'a.svg', sizeBytes: 10 }, usage), 'formatNotAccepted');
  assert.equal(checkAttachmentUpload({ name: 'vide.txt', sizeBytes: 0 }, usage), null);
});

test('envoi : refusé s’il ferait dépasser la limite de l’initiative', () => {
  const usage = { usedBytes: 495 * MB, quotaBytes: 500 * MB };
  assert.equal(checkAttachmentUpload({ name: 'a.pdf', sizeBytes: 5 * MB }, usage), null);
  assert.equal(checkAttachmentUpload({ name: 'a.pdf', sizeBytes: 5 * MB + 1 }, usage), 'quotaExceeded');
  // Limite baissée sous l'occupation : aucun fichier supprimé, tout ajout refusé.
  assert.equal(checkAttachmentUpload({ name: 'vide.txt', sizeBytes: 0 }, { usedBytes: 600 * MB, quotaBytes: 500 * MB }), 'quotaExceeded');
});

test('limite par initiative réglée en Mo : 500 par défaut', () => {
  assert.equal(attachmentQuotaBytes(ATTACHMENT_QUOTA_DEFAULT_MB), 500 * MB);
});

test('nom d’un fichier : 255 caractères au plus, sans chemin ni caractère de contrôle', () => {
  assert.equal(attachmentNameSchema.parse('  Compte rendu.pdf '), 'Compte rendu.pdf');
  assert.equal(attachmentNameSchema.safeParse(`${'a'.repeat(251)}.pdf`).success, true);
  assert.equal(attachmentNameSchema.safeParse(`${'a'.repeat(252)}.pdf`).success, false);
  for (const name of ['', '  ', 'dossier/a.pdf', 'dossier\\a.pdf', 'a\u0000.pdf', 'a\n.pdf']) {
    assert.equal(attachmentNameSchema.safeParse(name).success, false, JSON.stringify(name));
  }
});

test('renommer garde l’extension : on saisit le nom sans elle', () => {
  assert.equal(attachmentBaseName('Compte.rendu.PDF'), 'Compte.rendu');
  assert.equal(renamedAttachment('Rapport.PDF', '  Compte rendu final '), 'Compte rendu final.PDF');
  // L'extension saisie n'en remplace pas une autre : elle fait partie du nom.
  assert.equal(renamedAttachment('Rapport.pdf', 'Rapport.exe'), 'Rapport.exe.pdf');
  assert.equal(renamedAttachment('Rapport.pdf', ' '), null);
  assert.equal(renamedAttachment('Rapport.pdf', 'a/b'), null);
  assert.equal(renamedAttachment('Rapport.pdf', 'a'.repeat(252)), null);
});

test('taille affichée : octets, Ko, Mo ou Go, à une décimale', () => {
  assert.deepEqual(fileSize(0), { value: 0, unit: 'B' });
  assert.deepEqual(fileSize(1023), { value: 1023, unit: 'B' });
  assert.deepEqual(fileSize(1536), { value: 1.5, unit: 'KB' });
  assert.deepEqual(fileSize(1234567), { value: 1.2, unit: 'MB' });
  assert.deepEqual(fileSize(10 * MB), { value: 10, unit: 'MB' });
  assert.deepEqual(fileSize(1024 * MB), { value: 1, unit: 'GB' });
});

test('liste : du plus ancien au plus récent, les lignes de trace à leur place', () => {
  const list = sortAttachments([
    { id: 'b', createdAt: '2026-11-09T10:00:00Z' },
    { id: 'c', createdAt: '2026-11-08T10:00:00Z' },
    { id: 'a', createdAt: '2026-11-09T10:00:00Z' },
  ]);
  assert.deepEqual(list.map((a) => a.id), ['c', 'a', 'b']);
});
