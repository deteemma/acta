// Types et statuts de ticket paramétrables (ticket 29, décision 03).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type AdminTicketStatusDto,
  type AdminTicketTypeDto,
  checkTicketStatusCreation,
  checkTicketStatusDeletion,
  checkTicketStatusUpdate,
  checkTicketTypeCreation,
  checkTicketTypeDeletion,
  checkTicketTypeUpdate,
  createTicketTypeSchema,
  deliveredTicketTypes,
  initialTicketStatus,
  isClosedTicketStatus,
  ticketStatusLabel,
  ticketTypeLabel,
  referenceCategoryLabel,
  selectableTicketStatuses,
  sortTicketTypes,
} from './ticket-type-catalog.js';
import {
  checkTicketCreation,
  checkTicketFields,
  DEFAULT_TICKET_FILTERS,
  epicProgress,
  isOpenTicket,
  newTicketTypes,
  quickCreateTicketTypes,
  selectTickets,
  sortTickets,
  TICKET_TYPES,
  ticketHasField,
  type TicketRow,
} from './tickets.js';
import { defaultMyActionsStatuses, isOpenAction, toggleActionStatus } from './actions.js';

const delivered = deliveredTicketTypes();

test('six types livrés, actifs, avec leurs statuts dans l’ordre, leur famille et « fermé » (décision 03, points 2, 3 et 6)', () => {
  assert.deepEqual(
    delivered.map((t) => [t.code, t.delivered, t.active, t.labels.fr]),
    [
      ['action', true, true, 'Action'],
      ['question', true, true, 'Question'],
      ['decision', true, true, 'Décision'],
      ['risk', true, true, 'Risque'],
      ['change_request', true, true, 'Demande de changement'],
      ['epic', true, true, 'Epic'],
    ],
  );
  const risk = delivered.find((t) => t.code === 'risk')!;
  assert.deepEqual(
    risk.statuses.map((s) => [s.labels.fr, s.labels.en, s.tone, s.closed, s.delivered, s.active]),
    [
      ['Identifié', 'Identified', 'attention', false, true, true],
      ['En attente', 'On hold', 'attention', false, true, true],
      ['Traité', 'Addressed', 'progress', false, true, true],
      ['Clos', 'Closed', 'positive', true, true, true],
    ],
  );
  const epic = delivered.find((t) => t.code === 'epic')!;
  assert.deepEqual(
    epic.statuses.map((s) => [s.labels.fr, s.tone, s.closed]),
    [
      ['À faire', 'neutral', false],
      ['En cours', 'progress', false],
      ['En attente', 'attention', false],
      ['Terminé', 'positive', true],
      ['Annulé', 'muted', true],
    ],
  );
});

test('statut initial : le premier du type ; libellés et « fermé » lus dans la liste', () => {
  assert.equal(initialTicketStatus(delivered, 'decision'), 'proposed');
  assert.equal(initialTicketStatus(delivered, 'action'), 'todo');
  assert.equal(isClosedTicketStatus(delivered, 'question', 'rejected'), true);
  assert.equal(isClosedTicketStatus(delivered, 'question', 'on_hold'), false);
  assert.equal(ticketTypeLabel(delivered, 'change_request', 'en'), 'Change request');
  assert.equal(ticketStatusLabel(delivered, 'action', 'done', 'fr'), 'Terminée');
  assert.equal(ticketStatusLabel(delivered, 'epic', 'done', 'fr'), 'Terminé');
  // Type ou statut inconnu (pas encore lu) : son code, et jamais fermé.
  assert.equal(ticketTypeLabel(delivered, 'x-1', 'fr'), 'x-1');
  assert.equal(ticketStatusLabel(delivered, 'x-1', 's-1', 'fr'), 's-1');
  assert.equal(isClosedTicketStatus(delivered, 'x-1', 's-1'), false);
});

const status = (fr: string, closed = false) => ({ labels: { fr, en: `${fr} (en)` }, tone: 'neutral' as const, closed });
const newType = {
  labels: { fr: 'Hypothèse', en: 'Assumption' },
  acronym: 'HY',
  statuses: [status('À vérifier'), status('Confirmée', true)],
};
// Acronymes réservés : ceux que chaque catégorie a portés (onglet des références).
const categories = [
  { category: 'need', usedAcronyms: ['BE'] },
  { category: 'risk', usedAcronyms: ['RI', 'RS'] },
];

test('ajout d’un type : libellés uniques parmi les types, acronyme jamais porté par une autre catégorie (point 7)', () => {
  assert.equal(checkTicketTypeCreation(delivered, categories, newType), null);
  // Accents, majuscules et espaces ignorés ; types livrés compris, dans chaque langue.
  assert.equal(checkTicketTypeCreation(delivered, categories, { ...newType, labels: { fr: ' decision ', en: 'Other' } }), 'labelTaken');
  assert.equal(checkTicketTypeCreation(delivered, categories, { ...newType, labels: { fr: 'Autre', en: 'RISK' } }), 'labelTaken');
  // Un ancien acronyme d'une catégorie lui reste réservé.
  assert.equal(checkTicketTypeCreation(delivered, categories, { ...newType, acronym: 'RS' }), 'acronymTaken');
});

test('ajout d’un type : au moins deux statuts, dont un fermé, aux libellés distincts (point 7 et choix du 13.11.2026)', () => {
  const parsed = createTicketTypeSchema.safeParse({ ...newType, statuses: [status('Seul', true)] });
  assert.equal(parsed.success, false);
  assert.equal(createTicketTypeSchema.safeParse({ ...newType, acronym: 'H1' }).success, false);
  assert.equal(createTicketTypeSchema.safeParse({ ...newType, labels: { fr: 'x'.repeat(51), en: 'X' } }).success, false);
  // Famille neutre par défaut ; « neutre atténué » est réservé aux statuts livrés.
  const defaulted = createTicketTypeSchema.parse({ ...newType, statuses: [{ labels: { fr: 'A', en: 'A' }, closed: false }, status('B', true)] });
  assert.equal(defaulted.statuses[0]!.tone, 'neutral');
  assert.equal(createTicketTypeSchema.safeParse({ ...newType, statuses: [{ ...status('A'), tone: 'muted' }, status('B', true)] }).success, false);
  const noClosed = { ...newType, statuses: [status('A'), status('B')] };
  assert.equal(checkTicketTypeCreation(delivered, categories, noClosed), 'noClosedStatus');
  const twice = { ...newType, statuses: [status('Ouverte'), status('ouverte', true)] };
  assert.equal(checkTicketTypeCreation(delivered, categories, twice), 'statusLabelTaken');
});

// Un type ajouté (Hypothèse) et un statut ajouté au Risque (Accepté, fermé).
const addedStatus = (code: string, fr: string, fields: Partial<AdminTicketStatusDto> = {}): AdminTicketStatusDto => ({
  code,
  delivered: false,
  labels: { fr, en: `${fr} (en)` },
  tone: 'neutral',
  closed: false,
  active: true,
  used: false,
  ...fields,
});
const admin = (statusFields: Partial<AdminTicketStatusDto> = {}, typeFields: Partial<AdminTicketTypeDto> = {}): AdminTicketTypeDto[] => [
  ...delivered.map((t) => ({
    ...t,
    acronym: 'XX',
    used: true,
    statuses: [
      ...t.statuses.map((s) => ({ ...s, used: true })),
      ...(t.code === 'risk' ? [addedStatus('r-acc', 'Accepté', { closed: true })] : []),
    ],
  })),
  {
    code: 'hyp',
    delivered: false,
    labels: { fr: 'Hypothèse', en: 'Assumption' },
    active: true,
    acronym: 'HY',
    used: false,
    statuses: [
      addedStatus('h-1', 'À vérifier'),
      addedStatus('h-2', 'Confirmée', { closed: true, ...statusFields }),
      addedStatus('h-3', 'Infirmée', { closed: true, active: false }),
    ],
    ...typeFields,
  },
];

test('type ajouté : se renomme, se désactive ; un type livré ne change pas (points 1 et 9)', () => {
  const types = admin();
  assert.equal(checkTicketTypeUpdate(types, 'hyp', { labels: { fr: 'Postulat', en: 'Premise' } }), null);
  assert.equal(checkTicketTypeUpdate(types, 'hyp', { labels: { fr: 'Hypothèse', en: 'Assumption' } }), null);
  assert.equal(checkTicketTypeUpdate(types, 'hyp', { labels: { fr: 'Epic', en: 'Premise' } }), 'labelTaken');
  assert.equal(checkTicketTypeUpdate(types, 'hyp', { active: false }), null);
  assert.equal(checkTicketTypeUpdate(types, 'risk', { active: false }), 'deliveredTypeLocked');
  assert.equal(checkTicketTypeUpdate(types, 'nope', { active: false }), 'unknownType');
});

test('type ajouté : ne se supprime que si aucun ticket de ce type n’a jamais été créé (point 9)', () => {
  assert.equal(checkTicketTypeDeletion(admin(), 'hyp'), null);
  assert.equal(checkTicketTypeDeletion(admin({}, { used: true }), 'hyp'), 'typeUsed');
  assert.equal(checkTicketTypeDeletion(admin(), 'epic'), 'deliveredTypeLocked');
});

test('statut ajouté à tout type, livré ou non : libellés distincts de ceux du type (point 2 et choix du 13.11.2026)', () => {
  const types = admin();
  const input = { labels: { fr: 'Transféré', en: 'Transferred' }, tone: 'progress' as const, closed: false };
  assert.equal(checkTicketStatusCreation(types, 'risk', input), null);
  assert.equal(checkTicketStatusCreation(types, 'hyp', input), null);
  assert.equal(checkTicketStatusCreation(types, 'risk', { ...input, labels: { fr: 'traite', en: 'Other' } }), 'statusLabelTaken');
  // Le même libellé dans un autre type est permis.
  assert.equal(checkTicketStatusCreation(types, 'question', { ...input, labels: { fr: 'Accepté', en: 'Other' } }), null);
  assert.equal(checkTicketStatusCreation(types, 'nope', input), 'unknownType');
});

test('statut ajouté : se renomme et se désactive, sauf le statut initial et le dernier fermé actif (point 8)', () => {
  const types = admin();
  assert.equal(checkTicketStatusUpdate(types, 'risk', 'r-acc', { labels: { fr: 'Assumé', en: 'Owned' } }), null);
  assert.equal(checkTicketStatusUpdate(types, 'risk', 'r-acc', { labels: { fr: 'Clos', en: 'Owned' } }), 'statusLabelTaken');
  // Le Risque garde Clos, fermé et livré.
  assert.equal(checkTicketStatusUpdate(types, 'risk', 'r-acc', { active: false }), null);
  assert.equal(checkTicketStatusUpdate(types, 'risk', 'closed', { active: false }), 'deliveredStatusLocked');
  assert.equal(checkTicketStatusUpdate(types, 'hyp', 'h-1', { active: false }), 'initialStatus');
  // Infirmée est déjà désactivée : Confirmée est le dernier fermé actif.
  assert.equal(checkTicketStatusUpdate(types, 'hyp', 'h-2', { active: false }), 'noClosedStatus');
  assert.equal(checkTicketStatusUpdate(types, 'hyp', 'h-3', { active: true }), null);
  assert.equal(checkTicketStatusUpdate(types, 'hyp', 'nope', { active: false }), 'unknownStatus');
});

test('statut ajouté : ne se supprime que s’il n’a jamais été porté, et jamais le statut initial ni le dernier fermé actif', () => {
  assert.equal(checkTicketStatusDeletion(admin(), 'risk', 'r-acc'), null);
  assert.equal(checkTicketStatusDeletion(admin(), 'hyp', 'h-3'), null);
  assert.equal(checkTicketStatusDeletion(admin({ used: true }), 'hyp', 'h-2'), 'statusUsed');
  assert.equal(checkTicketStatusDeletion(admin(), 'hyp', 'h-2'), 'noClosedStatus');
  assert.equal(checkTicketStatusDeletion(admin(), 'hyp', 'h-1'), 'initialStatus');
  assert.equal(checkTicketStatusDeletion(admin(), 'risk', 'closed'), 'deliveredStatusLocked');
});

const hypRow = (reference: string, status: string, fields: Partial<TicketRow> = {}): TicketRow => ({
  id: reference,
  type: 'hyp',
  reference,
  title: reference,
  status,
  assignee: null,
  dueDate: null,
  epic: null,
  createdAt: '2026-01-01T00:00:00Z',
  ...fields,
});

test('type ajouté : champs communs seulement, Epic compris (décision 01, point 2)', () => {
  const types = admin();
  assert.equal(ticketHasField('hyp', 'epic'), true);
  assert.equal(checkTicketFields(types, 'hyp', { epicId: 'e1', status: 'h-2' }, 'h-1'), null);
  assert.equal(checkTicketFields(types, 'hyp', { probability: 'high' }, 'h-1'), 'fieldNotOfType');
  assert.equal(checkTicketFields(types, 'hyp', { questionedStakeholderIds: ['s1'] }, 'h-1'), 'fieldNotOfType');
});

test('statut désactivé : plus attribué, mais le ticket qui le porte le garde (point 8)', () => {
  const types = admin();
  assert.equal(checkTicketFields(types, 'hyp', { status: 'h-3' }, 'h-1'), 'inactiveStatus');
  assert.equal(checkTicketFields(types, 'hyp', { status: 'h-3' }, 'h-3'), null);
  assert.equal(checkTicketFields(types, 'hyp', { status: 'closed' }, 'h-1'), 'statusNotOfType');
  assert.equal(checkTicketFields(types, 'risk', { status: 'r-acc' }, 'identified'), null);
  assert.deepEqual(selectableTicketStatuses(types, 'hyp', 'h-1').map((s) => s.code), ['h-1', 'h-2']);
  assert.deepEqual(selectableTicketStatuses(types, 'hyp', 'h-3').map((s) => s.code), ['h-1', 'h-2', 'h-3']);
});

test('type ajouté proposé à la création et à la création rapide tant qu’il est actif (point 9)', () => {
  assert.deepEqual(newTicketTypes(admin(), false).map((t) => t.code), [...TICKET_TYPES, 'hyp']);
  assert.ok(newTicketTypes(admin(), true).some((t) => t.code === 'hyp'));
  assert.deepEqual(quickCreateTicketTypes(admin()).map((t) => t.code), ['question', 'decision', 'risk', 'change_request', 'epic', 'hyp']);
  const inactive = admin({}, { active: false });
  assert.ok(!newTicketTypes(inactive, false).some((t) => t.code === 'hyp'));
  assert.ok(!quickCreateTicketTypes(inactive).some((t) => t.code === 'hyp'));
  assert.equal(checkTicketCreation(inactive, 'hyp'), 'inactiveType');
  assert.equal(checkTicketCreation(admin(), 'hyp'), null);
  assert.equal(checkTicketCreation(admin(), 'nope'), 'unknownType');
});

test('statuts fermés ajoutés : rangés parmi les « fermés », comptés par la progression d’un Epic', () => {
  const types = admin();
  const lot = { id: 'EP-1', reference: 'EP-1', title: 'Lot' };
  const tickets = [
    hypRow('HY-1', 'h-1', { epic: lot }),
    hypRow('HY-2', 'h-2', { epic: lot }),
    hypRow('RI-1', 'r-acc', { type: 'risk', epic: lot }),
  ];
  assert.equal(isOpenTicket(types, tickets[2]!), false);
  assert.deepEqual(selectTickets(types, tickets, DEFAULT_TICKET_FILTERS).map((t) => t.reference), ['HY-1']);
  assert.deepEqual(
    selectTickets(types, tickets, { ...DEFAULT_TICKET_FILTERS, state: 'closed' }).map((t) => t.reference),
    ['HY-2', 'RI-1'],
  );
  assert.deepEqual(epicProgress(types, tickets, 'EP-1'), { closed: 2, total: 3 });
});

test('tri par type et par statut : selon leurs libellés', () => {
  const types = admin();
  const tickets = [hypRow('HY-1', 'h-2'), hypRow('QU-1', 'open', { type: 'question' }), hypRow('HY-2', 'h-1')];
  const by = (key: 'type' | 'status') => sortTickets(types, tickets, { key, direction: 'asc' }, 'fr').map((t) => t.reference);
  assert.deepEqual(by('type'), ['HY-1', 'HY-2', 'QU-1']);
  assert.deepEqual(by('status'), ['HY-2', 'HY-1', 'QU-1']);
});

// Statuts ajoutés à l'Action : À valider (ouvert) et Abandonnée (fermé).
const withActionStatuses = () =>
  admin().map((t) =>
    t.code === 'action'
      ? { ...t, statuses: [...t.statuses, addedStatus('a-val', 'À valider'), addedStatus('a-abd', 'Abandonnée', { closed: true })] }
      : t,
  );

test('statut ajouté à l’Action : fermé, l’action est terminée ; ouvert, elle reste dans « Mes actions » par défaut', () => {
  const types = withActionStatuses();
  assert.equal(isOpenAction(types, { status: 'a-abd' }), false);
  assert.equal(isOpenAction(types, { status: 'a-val' }), true);
  assert.equal(isOpenAction(types, { status: 'on_hold' }), true);
  assert.deepEqual(defaultMyActionsStatuses(types), ['todo', 'in_progress', 'on_hold', 'a-val']);
  // Le filtre suit l'ordre des statuts : livrés, puis ajoutés.
  assert.deepEqual(toggleActionStatus(types, ['a-abd'], 'done'), ['done', 'a-abd']);
});

test('catégorie de référence d’un type ajouté : son libellé ; les autres, ceux de l’interface', () => {
  const types = admin();
  assert.equal(referenceCategoryLabel(types, 'hyp', 'en'), 'Assumption');
  assert.equal(referenceCategoryLabel(types, 'risk', 'fr'), 'Risque');
  assert.equal(referenceCategoryLabel(types, 'need', 'fr'), 'Besoin');
  assert.equal(referenceCategoryLabel(types, 'page', 'en'), 'Page');
});

test('ordre des types : livrés dans leur ordre, puis ajoutés par date d’ajout (point 10)', () => {
  const rows = [
    { code: 'b-added', createdAt: '2026-11-02T00:00:00Z' },
    { code: 'epic', createdAt: null },
    { code: 'a-added', createdAt: '2026-11-03T00:00:00Z' },
    { code: 'action', createdAt: null },
  ];
  assert.deepEqual(sortTicketTypes(rows).map((r) => r.code), ['action', 'epic', 'b-added', 'a-added']);
});
