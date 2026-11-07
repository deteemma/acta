import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  changeTicketFilters,
  DEFAULT_TICKET_FILTERS,
  DEFAULT_TICKET_SORT,
  isOverdueTicket,
  selectTickets,
  sortTickets,
  ticketAssigneeOptions,
  ticketEpicOptions,
  type TicketFilters,
  type TicketRow,
  type TicketSort,
  toggleTicketSort,
} from './tickets.js';

const alice = { userId: 'a', email: null, displayName: 'Alice', eligible: true };
const bruno = { userId: 'b', email: null, displayName: 'Bruno', eligible: false };

const row = (reference: string, fields: Partial<TicketRow> = {}): TicketRow => ({
  id: reference,
  type: 'action',
  reference,
  title: `Titre de ${reference}`,
  status: 'todo',
  assignee: alice,
  dueDate: null,
  epic: null,
  createdAt: '2026-01-01T00:00:00Z',
  ...fields,
});

const references = (rows: readonly TicketRow[]) => rows.map((r) => r.reference);
const filtered = (rows: readonly TicketRow[], change: Partial<TicketFilters>) =>
  references(selectTickets(rows, { ...DEFAULT_TICKET_FILTERS, ...change }));

test('par défaut, seuls les tickets ouverts sont montrés ; En attente est ouvert', () => {
  const rows = [
    row('CRM-AC-001'),
    row('CRM-AC-002', { status: 'on_hold' }),
    row('CRM-AC-003', { status: 'done' }),
    row('CRM-AC-004', { status: 'cancelled' }),
  ];
  assert.deepEqual(filtered(rows, {}), ['CRM-AC-001', 'CRM-AC-002']);
  assert.deepEqual(filtered(rows, { state: 'closed' }), ['CRM-AC-003', 'CRM-AC-004']);
  assert.equal(filtered(rows, { state: 'all' }).length, 4);
});

test('la recherche porte sur le titre et la référence, sans tenir compte des majuscules ni des accents', () => {
  const rows = [row('CRM-AC-001', { title: 'Préparer l’atelier' }), row('CRM-AC-002', { title: 'Relire' })];
  assert.deepEqual(filtered(rows, { text: 'preparer' }), ['CRM-AC-001']);
  assert.deepEqual(filtered(rows, { text: 'crm-ac-002' }), ['CRM-AC-002']);
  assert.deepEqual(filtered(rows, { text: 'relire 002' }), ['CRM-AC-002']);
  assert.deepEqual(filtered(rows, { text: 'absent' }), []);
});

test('filtre par responsable, dont « sans responsable »', () => {
  const rows = [row('CRM-AC-001'), row('CRM-AC-002', { assignee: bruno }), row('CRM-AC-003', { assignee: null })];
  assert.deepEqual(filtered(rows, { assignee: 'b' }), ['CRM-AC-002']);
  assert.deepEqual(filtered(rows, { assignee: 'none' }), ['CRM-AC-003']);
  assert.equal(filtered(rows, { assignee: '' }).length, 3);
});

test('filtre par Epic, dont « sans Epic »', () => {
  const epic = { id: 'e1', reference: 'CRM-EP-001', title: 'Lot 1' };
  const rows = [row('CRM-AC-001', { epic }), row('CRM-AC-002')];
  assert.deepEqual(filtered(rows, { epic: 'e1' }), ['CRM-AC-001']);
  assert.deepEqual(filtered(rows, { epic: 'none' }), ['CRM-AC-002']);
});

test('filtre par type et par statut', () => {
  const rows = [row('CRM-AC-001'), row('CRM-AC-002', { status: 'in_progress' })];
  assert.deepEqual(filtered(rows, { type: 'action', status: 'in_progress' }), ['CRM-AC-002']);
});

test('changer de type ou d’état efface le statut choisi ; choisir un statut passe à « ouverts et fermés »', () => {
  const withStatus: TicketFilters = { ...DEFAULT_TICKET_FILTERS, type: 'action', state: 'all', status: 'done' };
  assert.equal(changeTicketFilters(withStatus, { type: '' }).status, '');
  assert.equal(changeTicketFilters(withStatus, { state: 'open' }).status, '');
  assert.equal(changeTicketFilters(withStatus, { state: 'open' }).state, 'open');
  const chosen = changeTicketFilters({ ...DEFAULT_TICKET_FILTERS, type: 'action' }, { status: 'done' });
  assert.deepEqual([chosen.status, chosen.state], ['done', 'all']);
  assert.equal(changeTicketFilters(withStatus, { text: 'x' }).status, 'done');
});

test('une échéance est dépassée à partir du lendemain, pour un ticket ouvert seulement', () => {
  assert.equal(isOverdueTicket(row('A', { dueDate: '2026-11-05' }), '2026-11-06'), true);
  assert.equal(isOverdueTicket(row('A', { dueDate: '2026-11-06' }), '2026-11-06'), false);
  assert.equal(isOverdueTicket(row('A', { dueDate: '2026-11-05', status: 'on_hold' }), '2026-11-06'), true);
  assert.equal(isOverdueTicket(row('A', { dueDate: '2026-11-05', status: 'done' }), '2026-11-06'), false);
  assert.equal(isOverdueTicket(row('A'), '2026-11-06'), false);
});

test('le filtre responsable propose chaque responsable présent une fois, par ordre alphabétique', () => {
  const rows = [row('1', { assignee: bruno }), row('2'), row('3', { assignee: bruno }), row('4', { assignee: null })];
  assert.deepEqual(ticketAssigneeOptions(rows, 'fr').map((a) => a.userId), ['a', 'b']);
});

test('le filtre Epic propose chaque Epic présent une fois, par référence', () => {
  const lot = (n: string) => ({ id: n, reference: `CRM-EP-${n}`, title: `Lot ${n}` });
  const rows = [row('1', { epic: lot('002') }), row('2', { epic: lot('001') }), row('3', { epic: lot('002') }), row('4')];
  assert.deepEqual(ticketEpicOptions(rows).map((e) => e.reference), ['CRM-EP-001', 'CRM-EP-002']);
});

const sorted = (rows: readonly TicketRow[], key: TicketSort['key'], direction: TicketSort['direction'] = 'asc') =>
  references(sortTickets(rows, { key, direction }, 'fr'));

test('tri par défaut : échéance la plus proche d’abord, sans échéance en dernier ; à égalité, la plus ancienne créée', () => {
  const rows = [
    row('D'),
    row('C', { dueDate: '2026-12-01', createdAt: '2026-02-01T00:00:00Z' }),
    row('B', { dueDate: '2026-12-01', createdAt: '2026-01-01T00:00:00Z' }),
    row('A', { dueDate: '2026-11-01' }),
  ];
  assert.deepEqual(references(sortTickets(rows, DEFAULT_TICKET_SORT, 'fr')), ['A', 'B', 'C', 'D']);
});

test('la référence se trie par numéro : 999 avant 1000', () => {
  const rows = [row('CRM-AC-1000'), row('CRM-AC-999')];
  assert.deepEqual(sorted(rows, 'reference'), ['CRM-AC-999', 'CRM-AC-1000']);
  assert.deepEqual(sorted(rows, 'reference', 'desc'), ['CRM-AC-1000', 'CRM-AC-999']);
});

test('titre, responsable et Epic se trient dans l’ordre alphabétique de ce qui est affiché', () => {
  const titles = [row('1', { title: 'Zoom' }), row('2', { title: 'Écrire' }), row('3', { title: 'Atelier' })];
  assert.deepEqual(sorted(titles, 'title'), ['3', '2', '1']);
  const assignees = [row('1', { assignee: bruno }), row('2')];
  assert.deepEqual(sorted(assignees, 'assignee'), ['2', '1']);
  const epicOf = (id: string, title: string) => ({ id, reference: `CRM-EP-${id}`, title });
  const epics = [row('1', { epic: epicOf('001', 'Lot Z') }), row('2', { epic: epicOf('002', 'Lot A') })];
  assert.deepEqual(sorted(epics, 'epic'), ['2', '1']);
});

test('le statut se trie sur son libellé dans la langue de l’écran', () => {
  const rows = [row('1', { status: 'in_progress' }), row('2', { status: 'todo' })];
  assert.deepEqual(references(sortTickets(rows, { key: 'status', direction: 'asc' }, 'fr')), ['2', '1']); // À faire, En cours
  assert.deepEqual(references(sortTickets(rows, { key: 'status', direction: 'asc' }, 'en')), ['1', '2']); // In progress, To do
});

test('un ticket sans valeur reste en dernier, dans les deux sens', () => {
  const rows = [row('1', { assignee: null }), row('2', { assignee: bruno }), row('3')];
  assert.deepEqual(sorted(rows, 'assignee'), ['3', '2', '1']);
  assert.deepEqual(sorted(rows, 'assignee', 'desc'), ['2', '3', '1']);
  const dated = [row('1'), row('2', { dueDate: '2026-11-01' }), row('3', { dueDate: '2026-12-01' })];
  assert.deepEqual(sorted(dated, 'dueDate', 'desc'), ['3', '2', '1']);
});

test('à égalité sur la colonne, l’ordre par défaut départage', () => {
  const rows = [row('1', { dueDate: '2026-12-01' }), row('2', { dueDate: '2026-11-01' })];
  assert.deepEqual(sorted(rows, 'type'), ['2', '1']);
  assert.deepEqual(sorted(rows, 'type', 'desc'), ['2', '1']);
});

test('cliquer une colonne la trie en ordre croissant ; la recliquer inverse le sens', () => {
  assert.deepEqual(toggleTicketSort(DEFAULT_TICKET_SORT, 'title'), { key: 'title', direction: 'asc' });
  assert.deepEqual(toggleTicketSort({ key: 'title', direction: 'asc' }, 'title'), { key: 'title', direction: 'desc' });
  assert.deepEqual(toggleTicketSort({ key: 'title', direction: 'desc' }, 'title'), { key: 'title', direction: 'asc' });
});
