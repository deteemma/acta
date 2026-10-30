import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequirementSchema, createsParentCycle, requirementHistory } from './requirements.js';

const needId = '4d3c2b1a-0000-4000-8000-000000000001';
const valid = {
  title: 'Suivi des réclamations',
  statement: 'Le service client doit suivre chaque réclamation jusqu’à sa clôture.',
  type: 'business',
  needIds: [needId],
};

test('une exigence porte un titre de 200 caractères au plus, un énoncé de 20 000 au plus et un type', () => {
  assert.equal(createRequirementSchema.safeParse(valid).success, true);
  assert.equal(createRequirementSchema.safeParse({ ...valid, title: '  ' }).success, false);
  assert.equal(createRequirementSchema.safeParse({ ...valid, title: 'x'.repeat(201) }).success, false);
  assert.equal(createRequirementSchema.safeParse({ ...valid, statement: ' ' }).success, false);
  assert.equal(createRequirementSchema.safeParse({ ...valid, statement: 'x'.repeat(20001) }).success, false);
  assert.equal(createRequirementSchema.safeParse({ ...valid, type: 'technique' }).success, false);
});

test('le sous-type, fonctionnelle ou non fonctionnelle, est obligatoire pour une exigence de solution, absent sinon', () => {
  const solution = { ...valid, type: 'solution' };
  assert.equal(createRequirementSchema.safeParse({ ...solution, subtype: 'functional' }).success, true);
  assert.equal(createRequirementSchema.safeParse({ ...solution, subtype: 'non_functional' }).success, true);
  assert.equal(createRequirementSchema.safeParse(solution).success, false);
  assert.equal(createRequirementSchema.safeParse({ ...valid, subtype: 'functional' }).success, false);
  assert.equal(createRequirementSchema.parse({ ...valid, subtype: null }).subtype, null);
});

test('une exigence répond à au moins un besoin ou dérive d’une exigence parente', () => {
  const parentId = '4d3c2b1a-0000-4000-8000-000000000002';
  assert.equal(createRequirementSchema.safeParse({ ...valid, needIds: [] }).success, false);
  assert.equal(createRequirementSchema.safeParse({ ...valid, needIds: undefined }).success, false);
  assert.equal(createRequirementSchema.safeParse({ ...valid, needIds: [], parentId }).success, true);
  assert.equal(createRequirementSchema.safeParse({ ...valid, parentId }).success, true);
  assert.deepEqual(createRequirementSchema.parse({ ...valid, needIds: [needId, needId] }).needIds, [needId]);
});

test('une exigence créée est Proposée ; sources : aucune, une ou plusieurs parties prenantes', () => {
  const sourceId = '4d3c2b1a-0000-4000-8000-000000000003';
  assert.equal(createRequirementSchema.safeParse({ ...valid, stakeholderIds: [sourceId] }).success, true);
  assert.equal(createRequirementSchema.safeParse({ ...valid, stakeholderIds: ['pas-un-uuid'] }).success, false);
  assert.equal('status' in createRequirementSchema.parse({ ...valid, status: 'approved' }), false);
});

test('une exigence ne peut pas descendre d’elle-même ; la profondeur est libre', () => {
  // A ← B ← C (C dérive de B, qui dérive de A) ; D sans parente.
  const tree = [
    { id: 'A', parentId: null },
    { id: 'B', parentId: 'A' },
    { id: 'C', parentId: 'B' },
    { id: 'D', parentId: null },
  ];
  assert.equal(createsParentCycle(tree, 'A', 'A'), true);
  assert.equal(createsParentCycle(tree, 'A', 'C'), true);
  assert.equal(createsParentCycle(tree, 'B', 'C'), true);
  assert.equal(createsParentCycle(tree, 'D', 'C'), false);
  assert.equal(createsParentCycle(tree, 'C', 'A'), false);
  assert.equal(createsParentCycle(tree, 'A', null), false);
});

const alice = { userId: 'alice', email: 'alice@exemple.test', displayName: 'Alice' };
const bruno = { userId: 'bruno', email: 'bruno@exemple.test', displayName: 'Bruno' };
const need1 = { id: 'n1', reference: 'CRM-BE-001', title: 'Délais' };
const need2 = { id: 'n2', reference: 'CRM-BE-002', title: 'Vente croisée' };
const created = {
  changedAt: '2026-10-30T09:00:00.000Z',
  changedBy: alice,
  snapshot: {
    title: 'Suivi',
    statement: 'Énoncé',
    type: 'solution' as const,
    subtype: 'functional' as const,
    status: 'proposed' as const,
    parent: null,
    needs: [need1],
    stakeholders: [{ id: 's1', name: 'Service client' }],
  },
};

test('historique : la création, puis chaque modification avec l’ancienne et la nouvelle valeur, la plus récente d’abord', () => {
  const statusChange = {
    changedAt: '2026-10-30T10:00:00.000Z',
    changedBy: bruno,
    snapshot: { ...created.snapshot, status: 'approved' as const, needs: [need2, need1] },
  };
  assert.deepEqual(requirementHistory([created, statusChange]), [
    {
      changedAt: statusChange.changedAt,
      changedBy: bruno,
      kind: 'updated',
      changes: [
        { field: 'status', from: 'proposed', to: 'approved' },
        { field: 'needs', from: [need1], to: [need2, need1] },
      ],
    },
    { changedAt: created.changedAt, changedBy: alice, kind: 'created', changes: [] },
  ]);
});

test('historique : un lien n’est modifié que si l’ensemble change, pas son ordre ni le titre de l’objet lié', () => {
  const renamed = { ...need1, title: 'Délais trop longs' };
  const same = { changedAt: '2026-10-30T11:00:00.000Z', changedBy: bruno, snapshot: { ...created.snapshot, needs: [renamed] } };
  const typeChange = {
    changedAt: '2026-10-30T12:00:00.000Z',
    changedBy: bruno,
    snapshot: {
      ...created.snapshot,
      type: 'business' as const,
      subtype: null,
      parent: { id: 'r1', reference: 'CRM-EX-001', title: 'Parente' },
      stakeholders: [],
    },
  };
  assert.deepEqual(requirementHistory([created, same, typeChange])[0]!.changes, [
    { field: 'type', from: 'solution', to: 'business' },
    { field: 'subtype', from: 'functional', to: null },
    { field: 'stakeholders', from: [{ id: 's1', name: 'Service client' }], to: [] },
    { field: 'parent', from: null, to: { id: 'r1', reference: 'CRM-EX-001', title: 'Parente' } },
  ]);
  // Rien de visible n'a changé : pas d'entrée.
  assert.equal(requirementHistory([created, same]).length, 1);
});
