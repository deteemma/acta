import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can, hasAtLeast } from './roles.js';

test('le lecteur peut consulter mais pas modifier', () => {
  assert.equal(can('reader', 'view'), true);
  assert.equal(can('reader', 'edit'), false);
});

test('le contributeur peut modifier mais pas gérer les membres', () => {
  assert.equal(can('contributor', 'edit'), true);
  assert.equal(can('contributor', 'manageMembers'), false);
});

test('le propriétaire a tous les droits', () => {
  assert.equal(can('owner', 'delete'), true);
  assert.equal(can('owner', 'manageMembers'), true);
});

test('un non-membre n’a aucun droit', () => {
  assert.equal(hasAtLeast(null, 'reader'), false);
});

test('seul le propriétaire modifie le code et archive l’initiative', () => {
  assert.equal(can('contributor', 'editCode'), false);
  assert.equal(can('contributor', 'archive'), false);
  assert.equal(can('owner', 'editCode'), true);
  assert.equal(can('owner', 'archive'), true);
});

test('une initiative archivée est en lecture seule pour tous ses membres', () => {
  const archived = { archived: true };
  assert.equal(can('reader', 'view', archived), true);
  assert.equal(can('contributor', 'edit', archived), false);
  assert.equal(can('owner', 'edit', archived), false);
  assert.equal(can('owner', 'editCode', archived), false);
  assert.equal(can('owner', 'manageMembers', archived), false);
});

test('le propriétaire peut encore désarchiver ou supprimer une initiative archivée', () => {
  const archived = { archived: true };
  assert.equal(can('owner', 'archive', archived), true);
  assert.equal(can('owner', 'delete', archived), true);
  assert.equal(can('contributor', 'archive', archived), false);
});

test('tout membre peut demander un changement de l’équipe, même sur une initiative archivée', () => {
  // Le détail (qui peut faire quoi, et seulement quitter une initiative
  // archivée) est vérifié par checkTeamChange (team.ts).
  assert.equal(can('reader', 'changeTeam'), true);
  assert.equal(can(null, 'changeTeam'), false);
  assert.equal(can('reader', 'changeTeam', { archived: true }), true);
});

test('actions : propriétaire et contributeurs les gèrent, le lecteur consulte ; archivée, plus personne', () => {
  assert.equal(can('owner', 'editActions'), true);
  assert.equal(can('contributor', 'editActions'), true);
  assert.equal(can('reader', 'editActions'), false);
  assert.equal(can('owner', 'editActions', { archived: true }), false);
});

test('parties prenantes : propriétaire et contributeurs les gèrent, le lecteur consulte ; archivée, plus personne', () => {
  assert.equal(can('owner', 'editStakeholders'), true);
  assert.equal(can('contributor', 'editStakeholders'), true);
  assert.equal(can('reader', 'editStakeholders'), false);
  assert.equal(can('contributor', 'editStakeholders', { archived: true }), false);
});

test('propriétaire et contributeurs écrivent les besoins ; lecteurs consultent ; archivée : lecture seule', () => {
  assert.equal(can('owner', 'editNeeds'), true);
  assert.equal(can('contributor', 'editNeeds'), true);
  assert.equal(can('reader', 'editNeeds'), false);
  assert.equal(can('contributor', 'editNeeds', { archived: true }), false);
});
