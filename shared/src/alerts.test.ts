import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ActionDto } from './actions.js';
import { type Alert, alertKey, myAlerts } from './alerts.js';

const alice = { userId: 'alice', email: 'alice@exemple.test', displayName: 'Alice' };
const bruno = { userId: 'bruno', email: 'bruno@exemple.test', displayName: 'Bruno' };

/** Action d'alice, attribuée par bruno le 20.10.2026 ; seuls les champs utiles au test changent. */
function action(fields: Partial<ActionDto> & { id: string }): ActionDto {
  return {
    initiative: { id: 'crm', code: 'CRM', name: 'CRM', archived: false, myRole: 'contributor' },
    title: fields.id,
    description: null,
    taskId: '3.1',
    techniqueId: null,
    assignee: { ...alice, eligible: true },
    assignedBy: bruno,
    assignedAt: '2026-10-20T12:00:00.000Z',
    dueDate: null,
    status: 'todo',
    stakeholders: [],
    needs: [],
    requirements: [],
    createdAt: '2026-10-20T12:00:00.000Z',
    createdBy: bruno,
    updatedAt: '2026-10-20T12:00:00.000Z',
    updatedBy: bruno,
    ...fields,
  };
}

const me = { id: 'alice', alertsSeenAt: '2026-10-01T12:00:00.000Z', alertsSeenKeys: null };
const today = '2026-10-31';
const summary = (alerts: Alert[]) => alerts.map((a) => `${a.kind}:${a.action.id}`);

test('une action attribuée par un autre membre donne une alerte ; aucune si je me l’attribue moi-même', () => {
  const alerts = myAlerts([action({ id: 'a1' }), action({ id: 'a2', assignedBy: alice })], me, today);
  assert.deepEqual(summary(alerts), ['assigned:a1']);
});

test('une de mes actions dont l’échéance est dépassée donne une alerte, même si je me la suis attribuée', () => {
  const alerts = myAlerts(
    [
      action({ id: 'hier', assignedBy: alice, dueDate: '2026-10-30' }),
      action({ id: 'aujourdhui', assignedBy: alice, dueDate: '2026-10-31' }),
      action({ id: 'demain', assignedBy: alice, dueDate: '2026-11-01' }),
    ],
    me,
    today,
  );
  assert.deepEqual(summary(alerts), ['overdue:hier']);
});

test('aucune alerte pour une action Terminée ou Annulée, ni pour une action d’un autre membre', () => {
  const alerts = myAlerts(
    [
      action({ id: 'terminee', status: 'done', dueDate: '2026-10-01' }),
      action({ id: 'annulee', status: 'cancelled', dueDate: '2026-10-01' }),
      action({ id: 'en-cours', status: 'in_progress', dueDate: '2026-10-01' }),
      action({ id: 'de-bruno', assignee: { ...bruno, eligible: true }, assignedBy: alice, dueDate: '2026-10-01' }),
    ],
    me,
    today,
  );
  assert.deepEqual(summary(alerts), ['overdue:en-cours', 'assigned:en-cours']);
});

test('aucune alerte pour une action d’une initiative archivée', () => {
  const archived = { id: 'crm', code: 'CRM', name: 'CRM', archived: true, myRole: 'contributor' as const };
  assert.deepEqual(myAlerts([action({ id: 'a1', initiative: archived, dueDate: '2026-10-01' })], me, today), []);
});

test('nouvelle : absente de la liste à la dernière ouverture du panneau, même si elle y avait déjà figuré', () => {
  const actions = [
    action({ id: 'vue' }),
    // Rouverte, désarchivée ou réattribuée depuis : elle revient, nouvelle.
    action({ id: 'revenue', assignedAt: '2026-10-01T12:00:00.000Z' }),
    action({ id: 'en-retard', assignedBy: alice, dueDate: '2026-10-01' }),
  ];
  const seen = { alertsSeenAt: '2026-10-25T12:00:00.000Z', alertsSeenKeys: ['assigned:vue', 'overdue:en-retard'] };
  assert.deepEqual(
    myAlerts(actions, { id: 'alice', ...seen }, today).map((a) => [alertKey(a), a.isNew]),
    [
      ['overdue:en-retard', false],
      ['assigned:vue', false],
      ['assigned:revenue', true],
    ],
  );
});

test('avant la première ouverture du panneau : nouvelle si apparue depuis la date de référence (déploiement ou création du compte)', () => {
  const actions = [
    action({ id: 'attribuee-avant', assignedAt: '2026-10-20T12:00:00.000Z' }),
    action({ id: 'attribuee-apres', assignedAt: '2026-10-28T12:00:00.000Z' }),
    // Dépassée depuis le 25 : déjà dépassée à la date de référence, le 25.
    action({ id: 'depassee-avant', assignedBy: alice, dueDate: '2026-10-24' }),
    // Dépassée depuis le 26.
    action({ id: 'depassee-apres', assignedBy: alice, dueDate: '2026-10-25' }),
    // Reçue déjà en retard après la date de référence.
    action({ id: 'recue-en-retard', dueDate: '2026-10-20', assignedAt: '2026-10-28T12:00:00.000Z' }),
  ];
  const fresh = myAlerts(actions, { id: 'alice', alertsSeenAt: '2026-10-25T12:00:00.000Z', alertsSeenKeys: null }, today)
    .filter((a) => a.isNew)
    .map(alertKey);
  assert.deepEqual(fresh, ['overdue:recue-en-retard', 'overdue:depassee-apres', 'assigned:attribuee-apres', 'assigned:recue-en-retard']);
});
