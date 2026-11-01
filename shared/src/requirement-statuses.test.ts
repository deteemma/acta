import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type AdminRequirementStatusDto,
  BABOK_REQUIREMENT_STATUSES,
  babokRequirementStatuses,
  checkRequirementStatus,
  checkStatusDeletion,
  checkStatusLabels,
  checkStatusUpdate,
  requirementStatusLabel,
  selectableStatuses,
  sortRequirementStatuses,
  requirementStatusLabelsSchema,
  type RequirementStatusDto,
} from './requirement-statuses.js';

const added = (code: string, fr: string, en: string, active = true): RequirementStatusDto => ({
  code,
  babok: false,
  labels: { fr, en },
  active,
  createdAt: `2026-10-0${code.length}T00:00:00.000Z`,
});

const statuses: RequirementStatusDto[] = [...babokRequirementStatuses(), added('s1', 'En recette', 'In testing')];

test('un statut ajouté a un libellé obligatoire en français et en anglais, de 50 caractères au plus', () => {
  assert.equal(requirementStatusLabelsSchema.safeParse({ fr: 'Gelée', en: 'On hold' }).success, true);
  assert.equal(requirementStatusLabelsSchema.safeParse({ fr: '  ', en: 'On hold' }).success, false);
  assert.equal(requirementStatusLabelsSchema.safeParse({ fr: 'Gelée' }).success, false);
  assert.equal(requirementStatusLabelsSchema.safeParse({ fr: 'Gelée', en: 'x'.repeat(51) }).success, false);
  assert.deepEqual(requirementStatusLabelsSchema.parse({ fr: ' Gelée ', en: 'x'.repeat(50) }), { fr: 'Gelée', en: 'x'.repeat(50) });
});

test('les libellés des statuts du BABOK sont ceux de l’interface, en français et en anglais', () => {
  assert.deepEqual(
    babokRequirementStatuses().map((s) => [s.code, s.labels.fr, s.labels.en]),
    [
      ['proposed', 'Proposée', 'Proposed'],
      ['verified', 'Vérifiée', 'Verified'],
      ['validated', 'Validée', 'Validated'],
      ['approved', 'Approuvée', 'Approved'],
      ['deferred', 'Différée', 'Deferred'],
      ['rejected', 'Rejetée', 'Rejected'],
    ],
  );
});

test('un libellé ne reprend pas celui d’un autre statut dans la même langue, majuscules et accents ignorés', () => {
  assert.equal(checkStatusLabels(statuses, null, { fr: 'Gelée', en: 'On hold' }), null);
  assert.equal(checkStatusLabels(statuses, null, { fr: 'en RECETTE', en: 'On hold' }), 'labelTaken');
  assert.equal(checkStatusLabels(statuses, null, { fr: 'Gelée', en: 'in testing' }), 'labelTaken');
  // Statuts du BABOK compris.
  assert.equal(checkStatusLabels(statuses, null, { fr: 'Verifiee', en: 'On hold' }), 'labelTaken');
  assert.equal(checkStatusLabels(statuses, null, { fr: 'Gelée', en: 'APPROVED' }), 'labelTaken');
});

test('le même libellé dans l’autre langue, ou celui du statut lui-même, est permis', () => {
  assert.equal(checkStatusLabels(statuses, null, { fr: 'In testing', en: 'En recette' }), null);
  assert.equal(checkStatusLabels(statuses, 's1', { fr: 'En Recette', en: 'In testing' }), null);
});

const adminStatuses: AdminRequirementStatusDto[] = [
  ...babokRequirementStatuses().map((s) => ({ ...s, used: s.code === 'proposed' })),
  { ...added('s1', 'En recette', 'In testing'), used: true },
  { ...added('s22', 'Gelée', 'On hold', false), used: false },
];

test('les statuts du BABOK ne sont ni renommés, ni désactivés, ni supprimés', () => {
  const labels = { fr: 'Soumise', en: 'Submitted' };
  for (const code of BABOK_REQUIREMENT_STATUSES) {
    assert.equal(checkStatusUpdate(adminStatuses, code, { labels }), 'babokStatusLocked');
    assert.equal(checkStatusUpdate(adminStatuses, code, { active: false }), 'babokStatusLocked');
    assert.equal(checkStatusDeletion(adminStatuses, code), 'babokStatusLocked');
  }
});

test('un statut ajouté se renomme, se désactive et se réactive', () => {
  assert.equal(checkStatusUpdate(adminStatuses, 's1', { labels: { fr: 'En test', en: 'Testing' } }), null);
  assert.equal(checkStatusUpdate(adminStatuses, 's1', { active: false }), null);
  assert.equal(checkStatusUpdate(adminStatuses, 's22', { active: true }), null);
  assert.equal(checkStatusUpdate(adminStatuses, 's1', { labels: { fr: 'Gelée', en: 'Testing' } }), 'labelTaken');
});

test('un statut ajouté ne se supprime que s’il n’a jamais été utilisé', () => {
  assert.equal(checkStatusDeletion(adminStatuses, 's1'), 'statusUsed');
  assert.equal(checkStatusDeletion(adminStatuses, 's22'), null);
});

test('un statut désactivé n’est plus attribué, mais reste sur l’exigence qui le porte', () => {
  assert.equal(checkRequirementStatus(adminStatuses, 'proposed', 's22'), 'inactiveStatus');
  assert.equal(checkRequirementStatus(adminStatuses, 's22', 's22'), null);
  assert.equal(checkRequirementStatus(adminStatuses, 's22', 'approved'), null);
  assert.equal(checkRequirementStatus(adminStatuses, 'proposed', 's1'), null);
  assert.equal(checkRequirementStatus(adminStatuses, 'proposed', 'nope'), 'unknownStatus');
});

test('les statuts proposés : ceux du BABOK puis les ajoutés par date d’ajout, les désactivés sauf l’actuel exclus', () => {
  const later = { ...added('s333', 'Archivée', 'Archived'), createdAt: '2026-10-20T00:00:00.000Z' };
  const earlier = { ...added('s4444', 'Chiffrée', 'Estimated'), createdAt: '2026-10-10T00:00:00.000Z' };
  const unordered = [later, added('s22', 'Gelée', 'On hold', false), ...babokRequirementStatuses().reverse(), earlier];
  const sorted = sortRequirementStatuses(unordered);
  assert.deepEqual(
    sorted.map((s) => s.code),
    [...BABOK_REQUIREMENT_STATUSES, 's22', 's4444', 's333'],
  );
  assert.deepEqual(
    selectableStatuses(sorted, 'proposed').map((s) => s.code),
    [...BABOK_REQUIREMENT_STATUSES, 's4444', 's333'],
  );
  assert.deepEqual(
    selectableStatuses(sorted, 's22').map((s) => s.code),
    [...BABOK_REQUIREMENT_STATUSES, 's22', 's4444', 's333'],
  );
});

test('le libellé d’un statut suit la langue de l’utilisateur', () => {
  assert.equal(requirementStatusLabel(adminStatuses, 's1', 'fr'), 'En recette');
  assert.equal(requirementStatusLabel(adminStatuses, 's1', 'en'), 'In testing');
  assert.equal(requirementStatusLabel(adminStatuses, 'deferred', 'fr'), 'Différée');
});

test('un statut inconnu est refusé', () => {
  assert.equal(checkStatusUpdate(adminStatuses, 'nope', { active: false }), 'unknownStatus');
  assert.equal(checkStatusDeletion(adminStatuses, 'nope'), 'unknownStatus');
});
