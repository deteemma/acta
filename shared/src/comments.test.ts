import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canDeleteComment, canEditComment, canWriteComment, commentBodySchema, sortThread } from './comments.js';

test('le texte d’un commentaire est obligatoire : vide ou blanc refusé', () => {
  assert.equal(commentBodySchema.safeParse('').success, false);
  assert.equal(commentBodySchema.safeParse('  \n ').success, false);
  assert.equal(commentBodySchema.parse('  **Vu** avec CRM-EX-012  '), '**Vu** avec CRM-EX-012');
});

test('5 000 caractères au plus', () => {
  assert.equal(commentBodySchema.safeParse('a'.repeat(5000)).success, true);
  assert.equal(commentBodySchema.safeParse('a'.repeat(5001)).success, false);
});

const mine = { authorId: 'u1', deleted: false };
const as = (userId: string, role: 'owner' | 'contributor' | 'reader' | null, archived = false) => ({ userId, role, archived });

test('modification : par son auteur seul, tant qu’il est propriétaire ou contributeur', () => {
  assert.equal(canEditComment(mine, as('u1', 'contributor')), true);
  assert.equal(canEditComment(mine, as('u1', 'owner')), true);
  // Auteur devenu lecteur, ou parti.
  assert.equal(canEditComment(mine, as('u1', 'reader')), false);
  assert.equal(canEditComment(mine, as('u1', null)), false);
  // Même un propriétaire ne modifie pas le texte d'un autre.
  assert.equal(canEditComment(mine, as('u2', 'owner')), false);
});

test('suppression : par son auteur encore propriétaire ou contributeur, ou par un propriétaire', () => {
  assert.equal(canDeleteComment(mine, as('u1', 'contributor')), true);
  assert.equal(canDeleteComment(mine, as('u2', 'owner')), true);
  assert.equal(canDeleteComment(mine, as('u2', 'contributor')), false);
  assert.equal(canDeleteComment(mine, as('u1', 'reader')), false);
});

test('commentaire supprimé : la ligne de trace ne se modifie ni ne se supprime', () => {
  const gone = { authorId: 'u1', deleted: true };
  assert.equal(canEditComment(gone, as('u1', 'owner')), false);
  assert.equal(canDeleteComment(gone, as('u1', 'owner')), false);
});

test('initiative archivée : ni ajout, ni modification, ni suppression', () => {
  assert.equal(canWriteComment(as('u1', 'owner', true)), false);
  assert.equal(canEditComment(mine, as('u1', 'owner', true)), false);
  assert.equal(canDeleteComment(mine, as('u2', 'owner', true)), false);
  assert.equal(canWriteComment(as('u1', 'contributor')), true);
  assert.equal(canWriteComment(as('u1', 'reader')), false);
});

test('fil simple, du plus ancien au plus récent ; la ligne de trace garde sa place', () => {
  const thread = sortThread([
    { id: 'c', createdAt: '2026-11-09T10:00:00.000Z', deletedAt: null },
    { id: 'a', createdAt: '2026-11-08T09:00:00.000Z', deletedAt: '2026-11-09T11:00:00.000Z' },
    { id: 'b', createdAt: '2026-11-08T17:30:00.000Z', deletedAt: null },
  ]);
  assert.deepEqual(thread.map((c) => c.id), ['a', 'b', 'c']);
});
