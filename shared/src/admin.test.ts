import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAccountChange, checkAdminOwnerDesignation, type AccountMember } from './admin.js';

// alice propriétaire au compte désactivé, bruno contributeur, chloé lectrice.
const alice: AccountMember = { userId: 'alice', role: 'owner', active: false };
const bruno: AccountMember = { userId: 'bruno', role: 'contributor', active: true };
const chloe: AccountMember = { userId: 'chloe', role: 'reader', active: true };

test('l’administrateur désigne un propriétaire seulement si aucun propriétaire actif ne reste', () => {
  assert.equal(checkAdminOwnerDesignation([alice, bruno, chloe], 'chloe'), null);
  const dan: AccountMember = { userId: 'dan', role: 'owner', active: true };
  assert.equal(checkAdminOwnerDesignation([alice, dan, chloe], 'chloe'), 'hasActiveOwner');
});

test('l’administrateur ne se désactive pas lui-même', () => {
  assert.equal(checkAccountChange('admin', 'admin', { enabled: false }), 'self');
  assert.equal(checkAccountChange('admin', 'alice', { enabled: false }), null);
});

test('l’administrateur ne se retire pas le rôle administrateur, mais le retire à un autre', () => {
  assert.equal(checkAccountChange('admin', 'admin', { isAdmin: false }), 'self');
  assert.equal(checkAccountChange('admin', 'alice', { isAdmin: false }), null);
  assert.equal(checkAccountChange('admin', 'alice', { isAdmin: true }), null);
});

test('le nouveau propriétaire est un membre au compte actif, contributeur ou lecteur', () => {
  const team = [alice, bruno, chloe];
  assert.equal(checkAdminOwnerDesignation(team, 'bruno'), null);
  assert.equal(checkAdminOwnerDesignation(team, 'dora'), 'notMember');
  const eve: AccountMember = { userId: 'eve', role: 'reader', active: false };
  assert.equal(checkAdminOwnerDesignation([...team, eve], 'eve'), 'inactiveAccount');
});
