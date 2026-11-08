// Types, statuts et règles propres à chaque type de ticket (ticket 18, décisions 01, 03 et 11).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ACRONYMS, REFERENCE_CATEGORIES } from './references.js';
import { ticketStatusTone } from './status-tones.js';
import { translate } from './i18n.js';
import {
  checkTicketFields,
  createTicketSchema,
  epicProgress,
  groupTicketsByEpic,
  isOpenTicket,
  isTicketStatusOf,
  QUICK_CREATE_TICKET_TYPES,
  selectTickets,
  DEFAULT_TICKET_FILTERS,
  newTicketTypes,
  TICKET_STATUSES,
  TICKET_TYPES,
  ticketEpicOptions,
  ticketHasField,
  ticketHistory,
  ticketStatusLabelKey,
  type TicketRow,
  type TicketSnapshot,
  type TicketStatus,
  type TicketType,
} from './tickets.js';

const row = (reference: string, fields: Partial<TicketRow> = {}): TicketRow => ({
  id: reference,
  type: 'question',
  reference,
  title: `Titre de ${reference}`,
  status: 'open',
  assignee: null,
  dueDate: null,
  epic: null,
  createdAt: '2026-01-01T00:00:00Z',
  ...fields,
});
const epicRow = (reference: string, fields: Partial<TicketRow> = {}) => row(reference, { type: 'epic', status: 'todo', ...fields });
const epicOf = (epic: TicketRow) => ({ id: epic.id, reference: epic.reference, title: epic.title });

test('six types livrés, chacun avec son acronyme de référence (décision 01, point 3)', () => {
  assert.deepEqual(TICKET_TYPES, ['action', 'question', 'decision', 'risk', 'change_request', 'epic']);
  assert.deepEqual(
    TICKET_TYPES.map((type) => DEFAULT_ACRONYMS[type]),
    ['AC', 'QU', 'DE', 'RI', 'DC', 'EP'],
  );
  assert.deepEqual([...REFERENCE_CATEGORIES], ['need', 'requirement', ...TICKET_TYPES, 'page']);
});

// Listes de la décision 03, point 2, écrites ici à la main.
const LABELS: Record<TicketType, { fr: string[]; en: string[] }> = {
  action: {
    fr: ['À faire', 'En cours', 'En attente', 'Terminée', 'Annulée'],
    en: ['To do', 'In progress', 'On hold', 'Done', 'Cancelled'],
  },
  question: {
    fr: ['Ouverte', 'En attente', 'Répondue', 'Close', 'Refusée'],
    en: ['Open', 'On hold', 'Answered', 'Closed', 'Rejected'],
  },
  decision: { fr: ['Proposée', 'En attente', 'Actée', 'Refusée'], en: ['Proposed', 'On hold', 'Agreed', 'Rejected'] },
  risk: { fr: ['Identifié', 'En attente', 'Traité', 'Clos'], en: ['Identified', 'On hold', 'Addressed', 'Closed'] },
  change_request: {
    fr: ['Soumise', 'Analysée', 'En attente', 'Acceptée', 'Refusée'],
    en: ['Submitted', 'Analysed', 'On hold', 'Accepted', 'Rejected'],
  },
  epic: {
    fr: ['À faire', 'En cours', 'En attente', 'Terminé', 'Annulé'],
    en: ['To do', 'In progress', 'On hold', 'Done', 'Cancelled'],
  },
};

test('statuts de chaque type, dans l’ordre, dans les deux langues (décision 03, point 2)', () => {
  for (const type of TICKET_TYPES) {
    const labels = (locale: 'fr' | 'en') =>
      TICKET_STATUSES[type].map((status: TicketStatus) => translate(locale, ticketStatusLabelKey(type, status)));
    assert.deepEqual(labels('fr'), LABELS[type].fr, type);
    assert.deepEqual(labels('en'), LABELS[type].en, type);
  }
});

test('libellé de chaque type et de chaque catégorie de référence, dans les deux langues', () => {
  const names = (locale: 'fr' | 'en') => TICKET_TYPES.map((type) => translate(locale, `ticketType.${type}`));
  assert.deepEqual(names('fr'), ['Action', 'Question', 'Décision', 'Risque', 'Demande de changement', 'Epic']);
  assert.deepEqual(names('en'), ['Action', 'Question', 'Decision', 'Risk', 'Change request', 'Epic']);
  assert.deepEqual(TICKET_TYPES.map((type) => translate('fr', `referenceCategory.${type}`)), names('fr'));
  assert.deepEqual(TICKET_TYPES.map((type) => translate('en', `referenceCategory.${type}`)), names('en'));
});

test('le statut initial est le premier de la liste du type (décision 03, point 4)', () => {
  assert.deepEqual(
    TICKET_TYPES.map((type) => TICKET_STATUSES[type][0]),
    ['todo', 'open', 'proposed', 'identified', 'submitted', 'todo'],
  );
});

test('statuts fermés de chaque type ; En attente n’est jamais fermé (décision 03, point 6)', () => {
  const closed = (type: TicketType) => TICKET_STATUSES[type].filter((status: TicketStatus) => !isOpenTicket({ type, status }));
  assert.deepEqual(closed('action'), ['done', 'cancelled']);
  assert.deepEqual(closed('question'), ['closed', 'rejected']);
  assert.deepEqual(closed('decision'), ['agreed', 'rejected']);
  assert.deepEqual(closed('risk'), ['closed']);
  assert.deepEqual(closed('change_request'), ['accepted', 'rejected']);
  assert.deepEqual(closed('epic'), ['done', 'cancelled']);
});

test('familles des statuts livrés (décision 03, point 3)', () => {
  const tones: Record<string, TicketStatus[]> = {
    neutral: ['todo', 'open', 'proposed', 'submitted'],
    progress: ['in_progress', 'answered', 'addressed', 'analysed'],
    positive: ['done', 'closed', 'agreed', 'accepted'],
    attention: ['on_hold', 'identified'],
    negative: ['rejected'],
    muted: ['cancelled'],
  };
  for (const [tone, statuses] of Object.entries(tones)) {
    for (const status of statuses) assert.equal(ticketStatusTone(status), tone, status);
  }
});

test('un statut n’est valable que pour son type', () => {
  assert.equal(isTicketStatusOf('risk', 'identified'), true);
  assert.equal(isTicketStatusOf('risk', 'open'), false);
  assert.equal(isTicketStatusOf('question', 'done'), false);
});

test('création rapide : pour tous les types sans autre champ obligatoire, donc pas l’Action (décision 11, point 7)', () => {
  assert.deepEqual(QUICK_CREATE_TICKET_TYPES, ['question', 'decision', 'risk', 'change_request', 'epic']);
});

test('« Nouveau ticket » propose tous les types ; dans un Epic, pas l’Epic', () => {
  assert.deepEqual(newTicketTypes(false), TICKET_TYPES);
  assert.ok(!newTicketTypes(true).includes('epic'));
  assert.ok(newTicketTypes(true).includes('action'));
});

test('création par la route générique : l’Action garde sa route, type et titre suffisent aux autres', () => {
  assert.equal(createTicketSchema.safeParse({ type: 'question', title: 'Qui valide ?' }).success, true);
  assert.equal(createTicketSchema.safeParse({ type: 'action', title: 'À faire' }).success, false);
  assert.equal(createTicketSchema.safeParse({ type: 'question', title: '  ' }).success, false);
  assert.equal(createTicketSchema.safeParse({ type: 'question', title: 'x'.repeat(201) }).success, false);
});

test('champs selon le type (décision 01, point 2) : l’Epic seul n’a pas d’Epic', () => {
  const having = (field: Parameters<typeof ticketHasField>[1]) => TICKET_TYPES.filter((type) => ticketHasField(type, field));
  assert.deepEqual(having('babok'), ['action']);
  assert.deepEqual(having('questionedStakeholders'), ['question']);
  assert.deepEqual(having('riskLevels'), ['risk']);
  assert.deepEqual(having('epic'), ['action', 'question', 'decision', 'risk', 'change_request']);
});

test('champs propres : parties prenantes interrogées pour la Question, probabilité et impact pour le Risque', () => {
  assert.equal(checkTicketFields('question', { questionedStakeholderIds: ['s1'] }), null);
  assert.equal(checkTicketFields('risk', { probability: 'high', impact: 'low' }), null);
  assert.equal(checkTicketFields('decision', { questionedStakeholderIds: ['s1'] }), 'fieldNotOfType');
  assert.equal(checkTicketFields('question', { probability: 'high' }), 'fieldNotOfType');
  assert.equal(checkTicketFields('epic', { impact: 'low' }), 'fieldNotOfType');
});

test('un champ propre vide ne gêne pas : le formulaire commun l’envoie pour tous les types', () => {
  assert.equal(checkTicketFields('decision', { questionedStakeholderIds: [], probability: null, impact: null }), null);
});

test('pas d’Epic dans un Epic ; retirer l’Epic reste possible', () => {
  assert.equal(checkTicketFields('epic', { epicId: 'e1' }), 'epicInEpic');
  assert.equal(checkTicketFields('epic', { epicId: null }), null);
  assert.equal(checkTicketFields('question', { epicId: 'e1' }), null);
});

test('un statut d’un autre type est refusé', () => {
  assert.equal(checkTicketFields('risk', { status: 'identified' }), null);
  assert.equal(checkTicketFields('risk', { status: 'open' }), 'statusNotOfType');
});

test('progression d’un Epic : ses tickets fermés sur le total ; lui-même n’y compte pas', () => {
  const epic = epicRow('EP-1');
  const tickets = [
    epic,
    row('QU-1', { epic: epicOf(epic) }),
    row('QU-2', { epic: epicOf(epic), status: 'closed' }),
    row('AC-1', { epic: epicOf(epic), type: 'action', status: 'cancelled' }),
    row('RI-1', { epic: epicOf(epic), type: 'risk', status: 'on_hold' }),
    row('QU-3', { status: 'closed' }),
  ];
  assert.deepEqual(epicProgress(tickets, epic.id), { closed: 2, total: 4 });
  assert.deepEqual(epicProgress(tickets, 'autre'), { closed: 0, total: 0 });
});

test('regroupement : Epics par référence, leurs tickets dans l’ordre reçu, puis « Sans Epic »', () => {
  const lot2 = epicRow('EP-002');
  const lot1 = epicRow('EP-001');
  const tickets = [
    lot2,
    row('QU-3', { epic: epicOf(lot2) }),
    row('QU-2', { epic: epicOf(lot1) }),
    row('QU-1'),
    lot1,
    row('QU-4', { epic: epicOf(lot1) }),
  ];
  const { epics, withoutEpic } = groupTicketsByEpic(tickets, tickets);
  assert.deepEqual(epics.map((g) => [g.epic.reference, g.tickets.map((t) => t.reference)]), [
    ['EP-001', ['QU-2', 'QU-4']],
    ['EP-002', ['QU-3']],
  ]);
  assert.deepEqual(withoutEpic.map((t) => t.reference), ['QU-1']);
});

test('regroupement : un Epic vide reste visible, pour pouvoir y ajouter un ticket', () => {
  const lot = epicRow('EP-001');
  const { epics, withoutEpic } = groupTicketsByEpic([lot], [lot]);
  assert.deepEqual(epics.map((g) => [g.epic.reference, g.tickets.length, g.total]), [['EP-001', 0, 0]]);
  assert.deepEqual(withoutEpic, []);
});

test('regroupement : les filtres s’appliquent aux lignes, la progression compte tous les tickets de l’Epic', () => {
  const lot = epicRow('EP-001');
  const tickets = [lot, row('QU-1', { epic: epicOf(lot) }), row('QU-2', { epic: epicOf(lot), status: 'closed' })];
  const shown = selectTickets(tickets, DEFAULT_TICKET_FILTERS);
  const [group] = groupTicketsByEpic(tickets, shown).epics;
  assert.deepEqual(group!.tickets.map((t) => t.reference), ['QU-1']);
  assert.deepEqual([group!.closed, group!.total], [1, 2]);
});

test('regroupement : un Epic écarté par les filtres reste en-tête tant qu’un de ses tickets est montré', () => {
  const closed = epicRow('EP-001', { status: 'done' });
  const empty = epicRow('EP-002', { status: 'cancelled' });
  const tickets = [closed, empty, row('QU-1', { epic: epicOf(closed) })];
  const shown = selectTickets(tickets, DEFAULT_TICKET_FILTERS);
  assert.deepEqual(groupTicketsByEpic(tickets, shown).epics.map((g) => g.epic.reference), ['EP-001']);
});

test('le filtre « sans Epic » ne montre pas les Epics, qui ne peuvent pas en avoir', () => {
  const lot = epicRow('EP-001');
  const tickets = [lot, row('QU-1'), row('QU-2', { epic: epicOf(lot) })];
  assert.deepEqual(
    selectTickets(tickets, { ...DEFAULT_TICKET_FILTERS, epic: 'none' }).map((t) => t.reference),
    ['QU-1'],
  );
});

test('le filtre Epic propose aussi les Epics encore vides', () => {
  const lot = epicRow('EP-002');
  const empty = epicRow('EP-001');
  const tickets = [lot, empty, row('QU-1', { epic: epicOf(lot) })];
  assert.deepEqual(ticketEpicOptions(tickets).map((e) => e.reference), ['EP-001', 'EP-002']);
});

const person = (userId: string) => ({ userId, email: `${userId}@exemple.test`, displayName: userId });
const snapshot = (fields: Partial<TicketSnapshot> = {}): TicketSnapshot => ({
  title: 'Préparer',
  description: null,
  status: 'todo',
  taskId: null,
  techniqueId: null,
  dueDate: null,
  probability: null,
  impact: null,
  assignee: person('alice'),
  epic: null,
  stakeholders: [],
  questionedStakeholders: [],
  ...fields,
});
const version = (changedAt: string, before: TicketSnapshot, after: TicketSnapshot) => ({
  changedAt,
  changedBy: person('bruno'),
  before,
  after,
});

test('historique : sans version, il est vide (action reprise de la phase 1, aucune entrée reconstituée)', () => {
  assert.deepEqual(ticketHistory([]), []);
});

test('historique : qui, quand et chaque champ modifié, la modification la plus récente en tête', () => {
  const entries = ticketHistory([
    version('2026-11-01T08:00:00.000Z', snapshot(), snapshot({ status: 'on_hold', dueDate: '2026-12-01' })),
    version('2026-11-02T08:00:00.000Z', snapshot({ title: 'Préparer' }), snapshot({ title: 'Préparer les entretiens' })),
  ]);
  assert.deepEqual(entries, [
    {
      changedAt: '2026-11-02T08:00:00.000Z',
      changedBy: person('bruno'),
      changes: [{ field: 'title', from: 'Préparer', to: 'Préparer les entretiens' }],
    },
    {
      changedAt: '2026-11-01T08:00:00.000Z',
      changedBy: person('bruno'),
      changes: [
        { field: 'status', from: 'todo', to: 'on_hold' },
        { field: 'dueDate', from: null, to: '2026-12-01' },
      ],
    },
  ]);
});

test('historique : le responsable et les parties prenantes changent si les personnes changent, pas leur nom', () => {
  const sponsor = { id: 's1', name: 'Sponsor' };
  const entries = ticketHistory([
    version(
      '2026-11-01T08:00:00.000Z',
      snapshot({ assignee: person('alice'), stakeholders: [sponsor] }),
      snapshot({ assignee: { ...person('alice'), displayName: 'Alice D.' }, stakeholders: [{ id: 's1', name: 'Direction' }], taskId: '4.2' }),
    ),
    version('2026-11-02T08:00:00.000Z', snapshot({ assignee: person('alice'), stakeholders: [sponsor] }), snapshot({ assignee: person('bruno'), stakeholders: [] })),
  ]);
  assert.deepEqual(entries.map((e) => e.changes.map((c) => c.field)), [['assignee', 'stakeholders'], ['taskId']]);
});

test('historique : une version sans champ modifié n’apparaît pas', () => {
  assert.deepEqual(ticketHistory([version('2026-11-01T08:00:00.000Z', snapshot(), snapshot())]), []);
});

test('historique : champs propres et Epic ; un Epic renommé ne compte pas comme un changement', () => {
  const lot = { id: 'e1', reference: 'CRM-EP-001', title: 'Lot' };
  const sponsor = { id: 's1', name: 'Sponsor' };
  const [entry] = ticketHistory([
    version(
      '2026-11-01T08:00:00.000Z',
      snapshot({ assignee: null }),
      snapshot({ assignee: person('alice'), probability: 'low', impact: 'high', epic: lot, questionedStakeholders: [sponsor] }),
    ),
  ]);
  assert.deepEqual(entry!.changes.map((c) => c.field), ['probability', 'impact', 'assignee', 'epic', 'questionedStakeholders']);
  assert.deepEqual(
    ticketHistory([version('2026-11-01T08:00:00.000Z', snapshot({ epic: lot }), snapshot({ epic: { ...lot, title: 'Lot 2' } }))]),
    [],
  );
});

test('historique : retirer le responsable ou l’Epic est une modification', () => {
  const lot = { id: 'e1', reference: 'CRM-EP-001', title: 'Lot' };
  const [entry] = ticketHistory([version('2026-11-01T08:00:00.000Z', snapshot({ epic: lot }), snapshot({ assignee: null }))]);
  assert.deepEqual(entry!.changes, [
    { field: 'assignee', from: person('alice'), to: null },
    { field: 'epic', from: lot, to: null },
  ]);
});
