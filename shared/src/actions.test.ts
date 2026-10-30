import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTION_DESCRIPTION_MAX_LENGTH,
  type ActionDto,
  canBeAssignee,
  createActionSchema,
  selectMyActions,
  techniqueChoices,
  updateActionSchema,
} from './actions.js';
import type { BabokDto } from './babok.js';

const person = (userId: string) => ({ userId, email: `${userId}@exemple.test`, displayName: userId });

/** Action d'exemple ; seuls les champs utiles au test changent. */
function action(fields: Partial<ActionDto> & { id: string }): ActionDto {
  return {
    initiative: { id: 'crm', code: 'CRM', name: 'CRM', archived: false, myRole: 'contributor' },
    title: fields.id,
    description: null,
    taskId: '4.1',
    techniqueId: null,
    assignee: { ...person('alice'), eligible: true },
    dueDate: null,
    status: 'todo',
    stakeholders: [],
    createdAt: '2026-10-01T08:00:00.000Z',
    createdBy: person('alice'),
    updatedAt: '2026-10-01T08:00:00.000Z',
    updatedBy: person('alice'),
    ...fields,
  };
}

const ids = (actions: ActionDto[]) => actions.map((a) => a.id);

test('« Mes actions » par défaut : À faire et En cours seulement', () => {
  const actions = [
    action({ id: 'a', status: 'todo' }),
    action({ id: 'b', status: 'in_progress' }),
    action({ id: 'c', status: 'done' }),
    action({ id: 'd', status: 'cancelled' }),
  ];
  assert.deepEqual(ids(selectMyActions(actions)), ['a', 'b']);
});

const archivedInitiative = { id: 'old', code: 'OLD', name: 'Ancienne', archived: true, myRole: 'contributor' as const };

test('« Mes actions » : initiative archivée masquée, sauf filtre sur cette initiative', () => {
  const actions = [action({ id: 'a' }), action({ id: 'b', initiative: archivedInitiative })];
  assert.deepEqual(ids(selectMyActions(actions)), ['a']);
  assert.deepEqual(ids(selectMyActions(actions, { initiativeId: 'old' })), ['b']);
});

test('« Mes actions » : filtre par initiative et par statuts choisis', () => {
  const other = { id: 'erp', code: 'ERP', name: 'ERP', archived: false, myRole: 'owner' as const };
  const actions = [
    action({ id: 'a', status: 'done' }),
    action({ id: 'b', status: 'done', initiative: other }),
    action({ id: 'c', status: 'todo' }),
  ];
  assert.deepEqual(ids(selectMyActions(actions, { initiativeId: 'crm', statuses: ['done'] })), ['a']);
});

test('« Mes actions » : triées par échéance la plus proche, sans échéance en dernier', () => {
  const actions = [
    action({ id: 'sans', dueDate: null }),
    action({ id: 'decembre', dueDate: '2026-12-01' }),
    action({ id: 'novembre', dueDate: '2026-11-15' }),
    action({ id: 'passee', dueDate: '2026-09-30' }),
  ];
  assert.deepEqual(ids(selectMyActions(actions)), ['passee', 'novembre', 'decembre', 'sans']);
});

test('« Mes actions » : même échéance, la plus ancienne créée d’abord', () => {
  const actions = [
    action({ id: 'recente', dueDate: '2026-11-15', createdAt: '2026-10-20T08:00:00.000Z' }),
    action({ id: 'ancienne', dueDate: '2026-11-15', createdAt: '2026-10-02T08:00:00.000Z' }),
  ];
  assert.deepEqual(ids(selectMyActions(actions)), ['ancienne', 'recente']);
});

test('responsable : propriétaire ou contributeur, jamais lecteur', () => {
  assert.equal(canBeAssignee('owner'), true);
  assert.equal(canBeAssignee('contributor'), true);
  assert.equal(canBeAssignee('reader'), false);
  assert.equal(canBeAssignee(null), false);
});

const text = (en: string, fr: string) => ({ en, fr });
const technique = (id: string) => ({ kind: 'technique' as const, id, section: id, name: text(id, id), summary: text('…', '…') });
const babok: BabokDto = {
  knowledgeAreas: [],
  tasks: [
    { kind: 'task', id: '4.1', section: '4.1', knowledgeAreaId: '4', name: text('Prepare for Elicitation', 'Préparer l’élicitation'), summary: text('…', '…'), techniqueIds: ['10.5', '10.25'] },
  ],
  techniques: [technique('10.1'), technique('10.5'), technique('10.25'), technique('10.37')],
};

test('techniques proposées : les 50, celles de la tâche en tête, chaque groupe dans l’ordre du référentiel', () => {
  const choices = techniqueChoices(babok, '4.1');
  assert.deepEqual(choices.ofTask.map((t) => t.id), ['10.5', '10.25']);
  assert.deepEqual(choices.others.map((t) => t.id), ['10.1', '10.37']);
});

test('techniques proposées : tâche inconnue, toutes dans les autres', () => {
  const choices = techniqueChoices(babok, '9.9');
  assert.deepEqual(choices.ofTask, []);
  assert.equal(choices.others.length, 4);
});

test('création rapide : titre et tâche BABOK suffisent', () => {
  const parsed = createActionSchema.parse({ title: '  Préparer les entretiens ', taskId: '4.1' });
  assert.deepEqual(parsed, { title: 'Préparer les entretiens', taskId: '4.1' });
});

test('création : la tâche BABOK est obligatoire, le titre non vide', () => {
  assert.equal(createActionSchema.safeParse({ title: 'Sans tâche' }).success, false);
  assert.equal(createActionSchema.safeParse({ title: '   ', taskId: '4.1' }).success, false);
  assert.equal(createActionSchema.safeParse({ title: 'x'.repeat(201), taskId: '4.1' }).success, false);
});

test('modification : seuls les champs fournis, statuts connus seulement', () => {
  assert.deepEqual(updateActionSchema.parse({ status: 'in_progress' }), { status: 'in_progress' });
  assert.equal(updateActionSchema.safeParse({ status: 'blocked' }).success, false);
  assert.equal(updateActionSchema.safeParse({ taskId: null }).success, false);
});

test('modification : technique et échéance facultatives, vidables', () => {
  assert.deepEqual(updateActionSchema.parse({ techniqueId: null, dueDate: null }), { techniqueId: null, dueDate: null });
  assert.deepEqual(updateActionSchema.parse({ dueDate: '2026-11-15' }), { dueDate: '2026-11-15' });
  assert.equal(updateActionSchema.safeParse({ dueDate: '15.11.2026' }).success, false);
});

test('description : 20 000 caractères au plus ; vide = pas de description', () => {
  assert.equal(ACTION_DESCRIPTION_MAX_LENGTH, 20000);
  assert.deepEqual(updateActionSchema.parse({ description: '  ' }), { description: null });
  assert.equal(updateActionSchema.safeParse({ description: 'x'.repeat(20000) }).success, true);
  assert.equal(updateActionSchema.safeParse({ description: 'x'.repeat(20001) }).success, false);
});

test('parties prenantes liées : une liste d’identifiants, chacun une seule fois, vidable', () => {
  const id = '6f1c2e0a-9b1d-4c3e-8f6a-2d4b5c6e7f80';
  assert.deepEqual(updateActionSchema.parse({ stakeholderIds: [id, id] }), { stakeholderIds: [id] });
  assert.deepEqual(updateActionSchema.parse({ stakeholderIds: [] }), { stakeholderIds: [] });
  assert.equal(updateActionSchema.safeParse({ stakeholderIds: ['Direction'] }).success, false);
  assert.deepEqual(createActionSchema.parse({ title: 'Atelier', taskId: '4.2', stakeholderIds: [id] }).stakeholderIds, [id]);
});
