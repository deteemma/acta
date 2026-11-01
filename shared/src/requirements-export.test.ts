import { test } from 'node:test';
import assert from 'node:assert/strict';
import { babokRequirementStatuses } from './requirement-statuses.js';
import { requirementsSheet } from './requirements-export.js';
import type { RequirementDto } from './requirements.js';

const statuses = babokRequirementStatuses();
const alice = { userId: 'alice', email: 'alice@exemple.test', displayName: 'Alice' };

/** Exigence de CRM ; seuls les champs utiles au test changent. */
function requirement(fields: Partial<RequirementDto> & { reference: string }): RequirementDto {
  return {
    id: fields.reference,
    initiativeId: 'crm',
    title: 'Titre',
    statement: 'Énoncé',
    type: 'business',
    subtype: null,
    status: 'proposed',
    stakeholders: [],
    needs: [],
    parent: null,
    createdAt: '2026-10-20T12:00:00.000Z',
    createdBy: alice,
    updatedAt: '2026-10-20T12:00:00.000Z',
    updatedBy: alice,
    ...fields,
  };
}

test('la première ligne porte les en-têtes dans la langue de l’utilisateur', () => {
  assert.deepEqual(requirementsSheet([], statuses, 'fr'), [
    ['Référence', 'Titre', 'Énoncé', 'Type', 'Sous-type', 'Statut', 'Sources', 'Besoins liés', 'Exigence parente'],
  ]);
  assert.deepEqual(requirementsSheet([], statuses, 'en'), [
    ['Reference', 'Title', 'Statement', 'Type', 'Subtype', 'Status', 'Sources', 'Linked needs', 'Parent requirement'],
  ]);
});

test('une ligne par exigence, avec ses champs ; le contenu saisi est gardé tel quel', () => {
  const crm012 = requirement({
    reference: 'CRM-EX-012',
    title: 'Saisie unique du client',
    statement: 'Le client est saisi une seule fois.',
    type: 'solution',
    subtype: 'non_functional',
    status: 'approved',
    stakeholders: [
      { id: 's1', name: 'Alice Martin' },
      { id: 's2', name: 'Bruno Keller' },
    ],
    needs: [
      { id: 'n3', reference: 'CRM-BE-003', title: 'Réduire les ressaisies' },
      { id: 'n4', reference: 'CRM-BE-004', title: 'Fiabiliser les adresses' },
    ],
    parent: { id: 'p1', reference: 'CRM-EX-001', title: 'Vision client unique' },
  });
  const [, row] = requirementsSheet([crm012], statuses, 'en');
  assert.deepEqual(row, [
    'CRM-EX-012',
    'Saisie unique du client',
    'Le client est saisi une seule fois.',
    'Solution requirement',
    'Non-functional',
    'Approved',
    'Alice Martin\nBruno Keller',
    'CRM-BE-003 Réduire les ressaisies\nCRM-BE-004 Fiabiliser les adresses',
    'CRM-EX-001 Vision client unique',
  ]);
});

test('sous-type, sources, besoins et parente absents : cellules vides', () => {
  const [, row] = requirementsSheet([requirement({ reference: 'CRM-EX-002' })], statuses, 'fr');
  assert.deepEqual(row, ['CRM-EX-002', 'Titre', 'Énoncé', 'Exigence métier', '', 'Proposée', '', '', '']);
});

test('statut ajouté par l’administration : son libellé dans la langue de l’utilisateur', () => {
  const custom = [...statuses, { code: 'c1', labels: { fr: 'En revue', en: 'In review' }, active: false, babok: false, createdAt: '2026-10-31T09:00:00.000Z' }];
  const [, row] = requirementsSheet([requirement({ reference: 'CRM-EX-003', status: 'c1' })], custom, 'fr');
  assert.equal(row?.[5], 'En revue');
});

test('énoncé en texte brut : mise en forme retirée, lignes, puces, numéros et liens gardés', () => {
  const statement = [
    '## Contexte',
    'Le **client** est saisi *une seule* fois,',
    'voir CRM-BE-003 et [la charte](https://exemple.test/charte).',
    '',
    '- par l’accueil',
    '* par le **support**',
    '',
    '3. créer',
    '7) valider',
  ].join('\n');
  const [, row] = requirementsSheet([requirement({ reference: 'CRM-EX-004', statement })], statuses, 'fr');
  assert.equal(
    row?.[2],
    [
      'Contexte',
      '',
      'Le client est saisi une seule fois,',
      'voir CRM-BE-003 et la charte (https://exemple.test/charte).',
      '',
      '- par l’accueil',
      '- par le support',
      '',
      '1. créer',
      '2. valider',
    ].join('\n'),
  );
});
