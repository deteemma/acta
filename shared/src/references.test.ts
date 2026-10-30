import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAcronymChange, formatReference, type ReferenceCategoryDto, type ReferenceDto, searchReferences } from './references.js';

test('une référence s’écrit CODE-ACRONYME-NUMÉRO, le numéro sur 3 chiffres au moins', () => {
  assert.equal(formatReference('CRM', 'BE', 1), 'CRM-BE-001');
  assert.equal(formatReference('CRM', 'EX', 12), 'CRM-EX-012');
  assert.equal(formatReference('CRM', 'BE', 999), 'CRM-BE-999');
  assert.equal(formatReference('CRM', 'BE', 1000), 'CRM-BE-1000');
});

const categories: ReferenceCategoryDto[] = [
  { category: 'need', acronym: 'BS', usedAcronyms: ['BE', 'BS'] },
  { category: 'requirement', acronym: 'EX', usedAcronyms: ['EX'] },
];

test('un acronyme compte 2 à 4 lettres majuscules', () => {
  assert.equal(checkAcronymChange(categories, 'requirement', 'E'), 'invalidAcronym');
  assert.equal(checkAcronymChange(categories, 'requirement', 'EXIGE'), 'invalidAcronym');
  assert.equal(checkAcronymChange(categories, 'requirement', 'E1'), 'invalidAcronym');
  assert.equal(checkAcronymChange(categories, 'requirement', 'ex'), 'invalidAcronym');
  assert.equal(checkAcronymChange(categories, 'requirement', 'EXIG'), null);
});

test('un acronyme déjà utilisé par une autre catégorie, même abandonné, est refusé', () => {
  assert.equal(checkAcronymChange(categories, 'requirement', 'BS'), 'acronymTaken');
  assert.equal(checkAcronymChange(categories, 'requirement', 'BE'), 'acronymTaken');
});

test('une catégorie peut reprendre l’un de ses anciens acronymes', () => {
  assert.equal(checkAcronymChange(categories, 'need', 'BE'), null);
});

const ref = (reference: string, title: string): ReferenceDto => ({
  category: 'need',
  id: reference,
  initiativeId: reference.split('-')[0]!,
  initiativeArchived: false,
  requirement: null,
  reference,
  title,
});

test('chaque mot saisi figure dans la référence ou le titre, sans tenir compte des majuscules ni des accents', () => {
  const items = [ref('CRM-BE-002', 'Délais de réponse'), ref('CRM-BE-001', 'Fiche client unique'), ref('RH-BE-001', 'Congés')];
  assert.deepEqual(searchReferences(items, 'crm-be-001').map((r) => r.reference), ['CRM-BE-001']);
  assert.deepEqual(searchReferences(items, 'crm delais').map((r) => r.reference), ['CRM-BE-002']);
  assert.deepEqual(searchReferences(items, 'be-001').map((r) => r.reference), ['CRM-BE-001', 'RH-BE-001']);
});

test('les références sont rangées par code, acronyme puis numéro', () => {
  const items = [ref('CRM-BE-1000', 'b'), ref('CRM-EX-001', 'c'), ref('CRM-BE-999', 'a'), ref('ADM-BE-002', 'd')];
  assert.deepEqual(
    searchReferences(items, '').map((r) => r.reference),
    ['ADM-BE-002', 'CRM-BE-999', 'CRM-BE-1000', 'CRM-EX-001'],
  );
});
