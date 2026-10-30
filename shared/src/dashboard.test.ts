import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ActionDto } from './actions.js';
import type { BabokDto } from './babok.js';
import { initiativeDashboard } from './dashboard.js';

const text = (en: string, fr: string) => ({ en, fr });
const summary = text('…', '…');

const babok: BabokDto = {
  knowledgeAreas: [
    { kind: 'knowledgeArea', id: '3', section: '3', name: text('Business Analysis Planning and Monitoring', 'Planification et suivi de l’analyse métier'), summary },
    { kind: 'knowledgeArea', id: '4', section: '4', name: text('Elicitation and Collaboration', 'Élicitation et collaboration'), summary },
  ],
  tasks: [
    { kind: 'task', id: '3.1', section: '3.1', knowledgeAreaId: '3', name: text('Plan Business Analysis Approach', 'Planifier l’approche de l’analyse métier'), summary, techniqueIds: [] },
    { kind: 'task', id: '3.2', section: '3.2', knowledgeAreaId: '3', name: text('Plan Stakeholder Engagement', 'Planifier l’engagement des parties prenantes'), summary, techniqueIds: [] },
    { kind: 'task', id: '4.1', section: '4.1', knowledgeAreaId: '4', name: text('Prepare for Elicitation', 'Préparer l’élicitation'), summary, techniqueIds: [] },
  ],
  techniques: [],
};

const person = { userId: 'alice', email: 'alice@exemple.test', displayName: 'alice' };

/** Action d'exemple ; seuls les champs utiles au test changent. */
function action(fields: Partial<ActionDto> & { id: string }): ActionDto {
  return {
    initiative: { id: 'crm', code: 'CRM', name: 'CRM', archived: false, myRole: 'contributor' },
    title: fields.id,
    description: null,
    taskId: '3.1',
    techniqueId: null,
    assignee: { ...person, eligible: true },
    dueDate: null,
    status: 'todo',
    stakeholders: [],
    needs: [],
    requirements: [],
    createdAt: '2026-10-01T08:00:00.000Z',
    createdBy: person,
    updatedAt: '2026-10-01T08:00:00.000Z',
    updatedBy: person,
    ...fields,
  };
}

test('le tableau de bord présente chaque domaine et ses tâches, dans l’ordre du référentiel', () => {
  const dashboard = initiativeDashboard(babok, []);
  assert.deepEqual(
    dashboard.map((area) => [area.knowledgeArea.id, area.tasks.map((t) => t.task.id)]),
    [
      ['3', ['3.1', '3.2']],
      ['4', ['4.1']],
    ],
  );
});

test('chaque tâche compte ses actions par statut', () => {
  const dashboard = initiativeDashboard(babok, [
    action({ id: 'a', status: 'todo' }),
    action({ id: 'b', status: 'todo' }),
    action({ id: 'c', status: 'done' }),
    action({ id: 'd', status: 'cancelled', taskId: '4.1' }),
  ]);
  const [plan] = dashboard[0]!.tasks;
  assert.deepEqual(plan!.countByStatus, { todo: 2, in_progress: 0, done: 1, cancelled: 0 });
  assert.deepEqual(dashboard[1]!.tasks[0]!.countByStatus, { todo: 0, in_progress: 0, done: 0, cancelled: 1 });
});

test('une tâche sans aucune action n’est pas couverte ; une seule action, de tout statut, la couvre', () => {
  const dashboard = initiativeDashboard(babok, [action({ id: 'a', taskId: '4.1', status: 'cancelled' })]);
  const covered = dashboard.flatMap((area) => area.tasks.map((t) => [t.task.id, t.covered]));
  assert.deepEqual(covered, [
    ['3.1', false],
    ['3.2', false],
    ['4.1', true],
  ]);
  assert.deepEqual(
    dashboard.map((area) => area.coveredTaskCount),
    [0, 1],
  );
});

test('les actions d’une tâche sont listées par échéance, sans échéance en dernier', () => {
  const dashboard = initiativeDashboard(babok, [
    action({ id: 'sans' }),
    action({ id: 'tard', dueDate: '2026-12-01' }),
    action({ id: 'tot', dueDate: '2026-11-01' }),
    action({ id: 'autre', taskId: '3.2' }),
  ]);
  assert.deepEqual(
    dashboard[0]!.tasks[0]!.actions.map((a) => a.id),
    ['tot', 'tard', 'sans'],
  );
});
