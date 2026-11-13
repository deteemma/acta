import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageContentSchema, pageContentWithUploadsSchema } from './pages.js';
import {
  checkPageAttachmentDelete,
  checkPageImages,
  checkPageUploads,
  pageImageIds,
  pageUploadKeys,
  resolvePageUploads,
} from './page-images.js';

const A = '0b6c4d3e-1f2a-4b5c-8d9e-0f1a2b3c4d5e';
const B = '7a6b5c4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d';
const image = (attachmentId: string) => ({ type: 'image', attrs: { attachmentId } });
const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const doc = (...content: object[]) => ({ type: 'doc', content: content as never[] });

test('une image du texte est une pièce jointe de la page, désignée par son identifiant', () => {
  assert.equal(pageContentSchema.safeParse(doc(paragraph('Schéma'), image(A))).success, true);
  // Ni adresse, ni autre attribut, ni contenu : l'image n'est que la pièce jointe.
  assert.equal(pageContentSchema.safeParse(doc({ type: 'image', attrs: { attachmentId: A, src: 'https://x.test/a.png' } })).success, false);
  assert.equal(pageContentSchema.safeParse(doc({ type: 'image', attrs: { src: 'https://x.test/a.png' } })).success, false);
  assert.equal(pageContentSchema.safeParse(doc(image('pas-un-id'))).success, false);
  assert.equal(pageContentSchema.safeParse(doc({ ...image(A), content: [{ type: 'text', text: 'x' }] })).success, false);
});

test('les images du texte, dans l’ordre du document, chacune une fois, y compris dans un tableau', () => {
  const table = {
    type: 'table',
    content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [image(B), paragraph('x')] }] }],
  };
  assert.deepEqual(pageImageIds(doc(image(A), table, image(A))), [A, B]);
  assert.deepEqual(pageImageIds(null), []);
});

const MB = 1024 * 1024;
const usage = { usedBytes: 0, quotaBytes: 500 * MB };
const upload = (key: string, name = 'capture.png', sizeBytes = 1000) => ({ key, name, sizeBytes });

test('une image insérée pendant la saisie désigne le fichier envoyé avec l’enregistrement ; aucun enregistrement n’en garde', () => {
  const pending = doc(image('upload:1'));
  assert.equal(pageContentWithUploadsSchema.safeParse(pending).success, true);
  assert.equal(pageContentSchema.safeParse(pending).success, false);
  assert.equal(pageContentWithUploadsSchema.safeParse(doc(image('upload:Pas Une Clé'))).success, false);
  assert.deepEqual(pageImageIds(doc(image(A), image('upload:1'))), [A]);
  assert.deepEqual(resolvePageUploads(doc(paragraph('x'), image('upload:1'), image(A), image('upload:1')), { '1': B }), doc(paragraph('x'), image(B), image(A), image(B)));
});

test('chaque image insérée a son fichier, et chaque fichier envoyé figure dans le texte : rien ne reste hors de la saisie', () => {
  assert.equal(checkPageUploads(doc(image('upload:1')), [upload('1')], usage), null);
  assert.deepEqual(checkPageUploads(doc(image('upload:1')), [], usage), { refusal: 'unknownUpload', name: null });
  assert.deepEqual(checkPageUploads(doc(), [upload('1')], usage), { refusal: 'unknownUpload', name: 'capture.png' });
  assert.deepEqual(checkPageUploads(doc(image('upload:1')), [upload('1'), upload('1')], usage), { refusal: 'unknownUpload', name: 'capture.png' });
});

test('une image du texte suit les formats et limites des pièces jointes, réservés aux images (PNG, JPEG, GIF, WebP)', () => {
  const one = (name: string, sizeBytes = 1000, used = usage) => checkPageUploads(doc(image('upload:1')), [upload('1', name, sizeBytes)], used);
  for (const name of ['a.png', 'a.JPG', 'a.jpeg', 'a.gif', 'a.webp']) assert.equal(one(name), null);
  assert.deepEqual(one('a.pdf'), { refusal: 'notAnImage', name: 'a.pdf' });
  assert.deepEqual(one('a.svg'), { refusal: 'formatNotAccepted', name: 'a.svg' });
  assert.deepEqual(one('a.png', 10 * MB + 1), { refusal: 'fileTooLarge', name: 'a.png' });
  assert.equal(one('a.png', 10 * MB), null);
  assert.deepEqual(one('a.png', 2, { usedBytes: 500 * MB - 1, quotaBytes: 500 * MB }), { refusal: 'quotaExceeded', name: 'a.png' });
  // Les images d'une même saisie comptent ensemble.
  const both = doc(image('upload:1'), image('upload:2'));
  assert.deepEqual(checkPageUploads(both, [upload('1', 'a.png', 6 * MB), upload('2', 'b.png', 6 * MB)], { usedBytes: 0, quotaBytes: 10 * MB }), {
    refusal: 'quotaExceeded',
    name: 'b.png',
  });
});

test('le texte n’affiche que des images de la page elle-même, même supprimées (restauration d’un ancien enregistrement)', () => {
  const files = [
    { id: A, name: 'schéma.png' },
    { id: B, name: 'note.pdf' },
  ];
  assert.equal(checkPageImages(doc(image(A)), files), null);
  assert.equal(checkPageImages(doc(image(B)), files), 'imageNotOnPage');
  assert.equal(checkPageImages(doc(image('5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a')), files), 'imageNotOnPage');
  assert.equal(checkPageImages(null, files), null);
});

test('une image du dernier enregistrement ne se supprime pas ; retirée du texte, elle se supprime', () => {
  assert.equal(checkPageAttachmentDelete(A, doc(image(A))), 'imageInLastRevision');
  assert.equal(checkPageAttachmentDelete(A, doc(paragraph('retirée'))), null);
  assert.equal(checkPageAttachmentDelete(A, null), null);
});

test('à l’enregistrement, seules les images insérées encore dans le texte partent, chacune une fois', () => {
  assert.deepEqual(pageUploadKeys(doc(image('upload:2'), image(A), image('upload:1'), image('upload:2'))), ['2', '1']);
  assert.deepEqual(pageUploadKeys(null), []);
});
