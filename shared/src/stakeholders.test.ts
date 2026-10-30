import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStakeholderSchema, linkableMembers, type StakeholderDto, stakeholderMatrix } from './stakeholders.js';

const person = (userId: string) => ({ userId, email: null, displayName: userId });

const valid = { name: 'Direction commerciale', kind: 'group', roles: ['sponsor'] };

test('une fiche porte au moins un rôle BABOK, chacun une seule fois', () => {
  assert.equal(createStakeholderSchema.safeParse({ ...valid, roles: [] }).success, false);
  assert.equal(createStakeholderSchema.safeParse({ ...valid, roles: ['chef'] }).success, false);
  const parsed = createStakeholderSchema.parse({ ...valid, roles: ['sponsor', 'end_user', 'sponsor'] });
  assert.deepEqual(parsed.roles, ['sponsor', 'end_user']);
});

/** Partie prenante d'exemple ; seuls les champs utiles au test changent. */
function stakeholder(fields: Partial<StakeholderDto> & { name: string }): StakeholderDto {
  return {
    id: fields.name,
    initiativeId: 'crm',
    kind: 'person',
    roles: ['end_user'],
    influence: null,
    interest: null,
    contact: null,
    notes: null,
    user: null,
    createdAt: '2026-10-01T08:00:00.000Z',
    createdBy: person('alice'),
    updatedAt: '2026-10-01T08:00:00.000Z',
    updatedBy: person('alice'),
    ...fields,
  };
}

test('la matrice place chaque partie prenante évaluée dans sa case, par ordre alphabétique', () => {
  const { cells, unpositioned } = stakeholderMatrix([
    stakeholder({ name: 'Zoé', influence: 'high', interest: 'low' }),
    stakeholder({ name: 'Élodie', influence: 'high', interest: 'low' }),
    stakeholder({ name: 'Marc', influence: 'low', interest: 'high' }),
  ]);
  assert.deepEqual(cells.high.low.map((s) => s.name), ['Élodie', 'Zoé']);
  assert.deepEqual(cells.low.high.map((s) => s.name), ['Marc']);
  assert.deepEqual(cells.medium.medium, []);
  assert.deepEqual(unpositioned, []);
});

test('une partie prenante sans influence ou sans intérêt figure à part, sous la matrice', () => {
  const { cells, unpositioned } = stakeholderMatrix([
    stakeholder({ name: 'Sans intérêt', influence: 'high' }),
    stakeholder({ name: 'Non évaluée' }),
  ]);
  assert.deepEqual(unpositioned.map((s) => s.name), ['Non évaluée', 'Sans intérêt']);
  assert.deepEqual(cells.high.high, []);
});

test('compte reliable : tout membre, lecteur compris, pas encore relié à une autre fiche de l’initiative', () => {
  const members = [
    { userId: 'alice', role: 'owner' as const },
    { userId: 'bruno', role: 'contributor' as const },
    { userId: 'chloe', role: 'reader' as const },
  ];
  const linked = (userId: string) => ({ ...person(userId), member: true });
  const stakeholders = [
    stakeholder({ name: 'Alice', user: linked('alice') }),
    stakeholder({ name: 'Bruno', user: linked('bruno') }),
  ];
  assert.deepEqual(linkableMembers(members, stakeholders, null).map((m) => m.userId), ['chloe']);
  // La fiche de Bruno garde son compte parmi les choix.
  assert.deepEqual(linkableMembers(members, stakeholders, 'Bruno').map((m) => m.userId), ['bruno', 'chloe']);
});
