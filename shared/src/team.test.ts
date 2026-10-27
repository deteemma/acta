import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTeamChange, type TeamMember } from './team.js';

// Équipe type : alice propriétaire et BA, bruno contributeur, chloé lectrice.
const alice: TeamMember = { userId: 'alice', role: 'owner', isTeamBa: true };
const bruno: TeamMember = { userId: 'bruno', role: 'contributor', isTeamBa: false };
const chloe: TeamMember = { userId: 'chloe', role: 'reader', isTeamBa: false };

test('le dernier propriétaire ne peut pas quitter l’initiative', () => {
  assert.equal(checkTeamChange([alice, bruno], 'alice', { kind: 'remove', userId: 'alice' }), 'lastOwner');
});

test('seul un propriétaire retire un autre membre', () => {
  const team = [alice, bruno, chloe];
  assert.equal(checkTeamChange(team, 'bruno', { kind: 'remove', userId: 'chloe' }), 'forbidden');
  assert.equal(checkTeamChange(team, 'alice', { kind: 'remove', userId: 'chloe' }), null);
});

test('tout membre peut quitter l’initiative de lui-même', () => {
  const team = [alice, bruno, chloe];
  assert.equal(checkTeamChange(team, 'chloe', { kind: 'remove', userId: 'chloe' }), null);
  assert.equal(checkTeamChange(team, 'bruno', { kind: 'remove', userId: 'bruno' }), null);
});

// Second propriétaire, sans l'indication « BA de l'équipe ».
const dan: TeamMember = { userId: 'dan', role: 'owner', isTeamBa: false };

test('le dernier BA de l’équipe ne peut ni quitter ni être retiré', () => {
  const team = [alice, dan, bruno];
  assert.equal(checkTeamChange(team, 'alice', { kind: 'remove', userId: 'alice' }), 'lastTeamBa');
  assert.equal(checkTeamChange(team, 'dan', { kind: 'remove', userId: 'alice' }), 'lastTeamBa');
  // Un autre propriétaire part librement.
  assert.equal(checkTeamChange(team, 'dan', { kind: 'remove', userId: 'dan' }), null);
});

test('tout propriétaire et tout BA de l’équipe attribue l’indication à un autre membre', () => {
  const brunoBa: TeamMember = { ...bruno, isTeamBa: true };
  const eve: TeamMember = { userId: 'eve', role: 'contributor', isTeamBa: false };
  assert.equal(checkTeamChange([alice, bruno], 'alice', { kind: 'setTeamBa', userId: 'bruno', isTeamBa: true }), null);
  assert.equal(checkTeamChange([dan, brunoBa, eve], 'dan', { kind: 'setTeamBa', userId: 'eve', isTeamBa: true }), null);
  assert.equal(checkTeamChange([dan, brunoBa, eve], 'bruno', { kind: 'setTeamBa', userId: 'eve', isTeamBa: true }), null);
  // Contributeur sans l'indication : refusé.
  assert.equal(checkTeamChange([alice, bruno, eve], 'bruno', { kind: 'setTeamBa', userId: 'eve', isTeamBa: true }), 'forbidden');
});

test('un lecteur ne peut pas porter l’indication « BA de l’équipe »', () => {
  assert.equal(
    checkTeamChange([alice, chloe], 'alice', { kind: 'setTeamBa', userId: 'chloe', isTeamBa: true }),
    'readerCannotBeTeamBa',
  );
});

test('sur soi-même, l’indication se retire mais ne s’attribue pas', () => {
  const brunoBa: TeamMember = { ...bruno, isTeamBa: true };
  assert.equal(checkTeamChange([alice, brunoBa], 'bruno', { kind: 'setTeamBa', userId: 'bruno', isTeamBa: false }), null);
  assert.equal(checkTeamChange([alice, dan], 'dan', { kind: 'setTeamBa', userId: 'dan', isTeamBa: true }), 'forbidden');
});

test('le dernier BA de l’équipe ne peut pas se retirer l’indication', () => {
  assert.equal(
    checkTeamChange([alice, bruno], 'alice', { kind: 'setTeamBa', userId: 'alice', isTeamBa: false }),
    'lastTeamBa',
  );
});

test('le propriétaire change le rôle d’un membre, y compris d’un autre propriétaire', () => {
  assert.equal(checkTeamChange([alice, bruno], 'alice', { kind: 'setRole', userId: 'bruno', role: 'reader' }), null);
  assert.equal(checkTeamChange([alice, dan], 'alice', { kind: 'setRole', userId: 'dan', role: 'contributor' }), null);
  assert.equal(checkTeamChange([alice, bruno, chloe], 'bruno', { kind: 'setRole', userId: 'chloe', role: 'contributor' }), 'forbidden');
});

test('le dernier propriétaire ne peut pas être rétrogradé', () => {
  assert.equal(checkTeamChange([alice, bruno], 'alice', { kind: 'setRole', userId: 'alice', role: 'contributor' }), 'lastOwner');
  // S'il en reste un autre, un propriétaire peut se rétrograder.
  assert.equal(checkTeamChange([alice, dan], 'dan', { kind: 'setRole', userId: 'dan', role: 'reader' }), null);
});

test('faire passer un BA de l’équipe au rôle de lecteur exige de lui retirer d’abord l’indication', () => {
  const brunoBa: TeamMember = { ...bruno, isTeamBa: true };
  assert.equal(
    checkTeamChange([alice, brunoBa], 'alice', { kind: 'setRole', userId: 'bruno', role: 'reader' }),
    'removeTeamBaFirst',
  );
});

test('tout BA de l’équipe désigne un nouveau propriétaire parmi les membres, y compris lui-même', () => {
  const brunoBa: TeamMember = { ...bruno, isTeamBa: true };
  const team = [alice, brunoBa, chloe];
  assert.equal(checkTeamChange(team, 'bruno', { kind: 'setRole', userId: 'chloe', role: 'owner' }), null);
  assert.equal(checkTeamChange(team, 'bruno', { kind: 'setRole', userId: 'bruno', role: 'owner' }), null);
});

test('un BA de l’équipe non propriétaire ne retire ni ne rétrograde un propriétaire', () => {
  const brunoBa: TeamMember = { ...bruno, isTeamBa: true };
  const team = [alice, dan, brunoBa, chloe];
  assert.equal(checkTeamChange(team, 'bruno', { kind: 'setRole', userId: 'dan', role: 'contributor' }), 'forbidden');
  assert.equal(checkTeamChange(team, 'bruno', { kind: 'remove', userId: 'dan' }), 'forbidden');
  // Ni change un autre rôle que pour désigner un propriétaire.
  assert.equal(checkTeamChange(team, 'bruno', { kind: 'setRole', userId: 'chloe', role: 'contributor' }), 'forbidden');
});

test('seul le propriétaire invite, avec un rôle et éventuellement l’indication « BA de l’équipe »', () => {
  const brunoBa: TeamMember = { ...bruno, isTeamBa: true };
  const invite = { kind: 'invite', userId: 'eve', role: 'contributor', isTeamBa: true } as const;
  assert.equal(checkTeamChange([alice, brunoBa], 'alice', invite), null);
  assert.equal(checkTeamChange([alice, brunoBa], 'bruno', invite), 'forbidden');
  assert.equal(
    checkTeamChange([alice], 'alice', { kind: 'invite', userId: 'eve', role: 'reader', isTeamBa: true }),
    'readerCannotBeTeamBa',
  );
});

test('on n’invite pas un membre deux fois, on ne modifie pas un non-membre', () => {
  assert.equal(
    checkTeamChange([alice, bruno], 'alice', { kind: 'invite', userId: 'bruno', role: 'reader', isTeamBa: false }),
    'alreadyMember',
  );
  assert.equal(checkTeamChange([alice], 'alice', { kind: 'remove', userId: 'eve' }), 'notMember');
  assert.equal(checkTeamChange([alice], 'alice', { kind: 'setRole', userId: 'eve', role: 'owner' }), 'notMember');
});
