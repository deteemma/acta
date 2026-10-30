import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAccountChange, checkAdminOwnerDesignation, type AccountMember, type AccountState } from './admin.js';

// alice propriétaire au compte désactivé, bruno contributeur, chloé lectrice.
const alice: AccountMember = { userId: 'alice', role: 'owner', active: false };
const bruno: AccountMember = { userId: 'bruno', role: 'contributor', active: true };
const chloe: AccountMember = { userId: 'chloe', role: 'reader', active: true };

test('l’administrateur désigne un propriétaire seulement si aucun propriétaire actif ne reste', () => {
  assert.equal(checkAdminOwnerDesignation([alice, bruno, chloe], 'chloe'), null);
  const dan: AccountMember = { userId: 'dan', role: 'owner', active: true };
  assert.equal(checkAdminOwnerDesignation([alice, dan, chloe], 'chloe'), 'hasActiveOwner');
});

// Comptes : admin et zoé administrateurs actifs, alice simple utilisatrice.
const accounts: AccountState[] = [
  { id: 'admin', enabled: true, isAdmin: true },
  { id: 'zoe', enabled: true, isAdmin: true },
  { id: 'alice', enabled: true, isAdmin: false },
];

test('l’administrateur ne se désactive pas lui-même', () => {
  assert.equal(checkAccountChange(accounts, 'admin', 'admin', { enabled: false }), 'self');
  assert.equal(checkAccountChange(accounts, 'admin', 'alice', { enabled: false }), null);
});

test('l’administrateur ne se retire pas le rôle administrateur, mais le retire à un autre', () => {
  assert.equal(checkAccountChange(accounts, 'admin', 'admin', { isAdmin: false }), 'self');
  assert.equal(checkAccountChange(accounts, 'admin', 'zoe', { isAdmin: false }), null);
  assert.equal(checkAccountChange(accounts, 'admin', 'alice', { isAdmin: true }), null);
});

test('l’application garde toujours au moins un administrateur actif', () => {
  // zoé a encore un jeton d'administratrice, mais n'a plus le rôle.
  const withoutZoe = accounts.map((a) => (a.id === 'zoe' ? { ...a, isAdmin: false } : a));
  assert.equal(checkAccountChange(withoutZoe, 'zoe', 'admin', { isAdmin: false }), 'forbidden');
  assert.equal(checkAccountChange(withoutZoe, 'zoe', 'admin', { enabled: false }), 'forbidden');
  // Un administrateur désactivé ne compte pas.
  const zoeDisabled = accounts.map((a) => (a.id === 'zoe' ? { ...a, enabled: false } : a));
  assert.equal(checkAccountChange(zoeDisabled, 'zoe', 'admin', { isAdmin: false }), 'forbidden');
});

test('le nouveau propriétaire est un membre au compte actif, contributeur ou lecteur', () => {
  const team = [alice, bruno, chloe];
  assert.equal(checkAdminOwnerDesignation(team, 'bruno'), null);
  assert.equal(checkAdminOwnerDesignation(team, 'dora'), 'notMember');
  const eve: AccountMember = { userId: 'eve', role: 'reader', active: false };
  assert.equal(checkAdminOwnerDesignation([...team, eve], 'eve'), 'inactiveAccount');
});
