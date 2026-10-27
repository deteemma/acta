import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMemberSchema, updateInitiativeSchema, updateMemberSchema } from './schemas.js';

const valid = (input: unknown) => updateInitiativeSchema.safeParse(input).success;

test('on peut ne modifier que le nom (mobile hors ligne)', () => {
  assert.deepEqual(updateInitiativeSchema.parse({ name: ' CRM ' }), { name: 'CRM' });
});

test('la fiche complète est acceptée', () => {
  assert.equal(
    valid({
      code: 'CRM2',
      name: 'Refonte du CRM',
      description: 'Ligne 1\nLigne 2',
      analysisApproach: 'adaptive',
      startDate: '2026-11-01',
      plannedEndDate: '2027-03-31',
    }),
    true,
  );
});

test('l’approche d’analyse vaut prédictive, adaptative ou rien', () => {
  assert.equal(valid({ analysisApproach: 'predictive' }), true);
  assert.equal(valid({ analysisApproach: null }), true);
  assert.equal(valid({ analysisApproach: 'agile' }), false);
});

test('la description est facultative et limitée à 4 000 caractères', () => {
  assert.equal(updateInitiativeSchema.parse({ description: '   ' }).description, null);
  assert.equal(valid({ description: 'x'.repeat(4000) }), true);
  assert.equal(valid({ description: 'x'.repeat(4001) }), false);
});

test('les dates sont facultatives et au format AAAA-MM-JJ', () => {
  assert.equal(valid({ startDate: null, plannedEndDate: null }), true);
  assert.equal(valid({ startDate: '01.11.2026' }), false);
  assert.equal(valid({ startDate: '2026-02-30' }), false);
});

test('la fin prévue ne précède pas le début', () => {
  assert.equal(valid({ startDate: '2026-11-01', plannedEndDate: '2026-11-01' }), true);
  assert.equal(valid({ startDate: '2026-11-02', plannedEndDate: '2026-11-01' }), false);
});

test('le code suit la règle du code d’initiative', () => {
  assert.equal(valid({ code: '1AB' }), false);
});

test('l’invitation porte un courriel, un rôle et, au choix, l’indication « BA de l’équipe »', () => {
  assert.deepEqual(addMemberSchema.parse({ email: 'eve@exemple.test', role: 'reader' }), {
    email: 'eve@exemple.test',
    role: 'reader',
    isTeamBa: false,
  });
  assert.equal(addMemberSchema.parse({ email: 'eve@exemple.test', role: 'owner', isTeamBa: true }).isTeamBa, true);
});

test('une modification de membre porte soit le rôle, soit l’indication « BA de l’équipe »', () => {
  assert.equal(updateMemberSchema.safeParse({ role: 'owner' }).success, true);
  assert.equal(updateMemberSchema.safeParse({ isTeamBa: false }).success, true);
  assert.equal(updateMemberSchema.safeParse({ role: 'owner', isTeamBa: true }).success, false);
  assert.equal(updateMemberSchema.safeParse({}).success, false);
  assert.equal(updateMemberSchema.safeParse({ role: 'admin' }).success, false);
});
