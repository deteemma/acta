import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BabokDto } from './babok.js';
import {
  currentSituations,
  requirementStatusSince,
  suggestedActionInput,
  suggestedActionText,
  suggestionKeySchema,
  type SuggestedAction,
  suggestActions,
  type SuggestionContext,
} from './suggested-actions.js';

const text = (en: string, fr: string) => ({ en, fr });
const summary = text('…', '…');
const area = (id: string, en: string, fr: string) => ({ kind: 'knowledgeArea' as const, id, section: id, name: text(en, fr), summary });
const task = (id: string, en: string, fr: string) => ({
  kind: 'task' as const,
  id,
  section: id,
  knowledgeAreaId: id.split('.')[0]!,
  name: text(en, fr),
  summary,
  techniqueIds: [],
});

const babok: BabokDto = {
  knowledgeAreas: [
    area('3', 'Business Analysis Planning and Monitoring', 'Planification et surveillance de l’analyse métier'),
    area('4', 'Elicitation and Collaboration', 'Élicitation et collaboration'),
    area('5', 'Requirements Life Cycle Management', 'Gestion du cycle de vie des exigences'),
    area('6', 'Strategy Analysis', 'Analyse de la stratégie'),
    area('7', 'Requirements Analysis and Design Definition', 'Analyse des exigences et spécification de la conception'),
    area('8', 'Solution Evaluation', 'Évaluation de la solution'),
  ],
  tasks: [
    task('3.1', 'Plan Business Analysis Approach', 'Planifier l’approche de l’analyse métier'),
    task('3.2', 'Plan Stakeholder Engagement', 'Planifier l’engagement des parties prenantes'),
    task('3.5', 'Identify Business Analysis Performance Improvements', 'Améliorer la performance de l’analyse métier'),
    task('4.1', 'Prepare for Elicitation', 'Préparer l’élicitation'),
    task('4.5', 'Manage Stakeholder Collaboration', 'Gérer la collaboration avec les parties prenantes'),
    task('5.1', 'Trace Requirements', 'Tracer les exigences'),
    task('5.5', 'Approve Requirements', 'Approuver les exigences'),
    task('6.1', 'Analyze Current State', 'Analyser la situation actuelle'),
    task('7.1', 'Specify and Model Requirements', 'Spécifier et modéliser les exigences'),
    task('7.2', 'Verify Requirements', 'Vérifier les exigences'),
    task('7.3', 'Validate Requirements', 'Valider les exigences'),
    task('8.1', 'Measure Solution Performance', 'Mesurer la performance de la solution'),
  ],
  techniques: [],
};

/** Initiative d'exemple, le 31.10.2026 ; seuls les champs utiles au test changent. */
function context(fields: Partial<SuggestionContext> = {}): SuggestionContext {
  return {
    now: '2026-10-31T10:00:00.000Z',
    today: '2026-10-31',
    initiative: { archived: false, analysisApproach: 'predictive', plannedEndDate: null },
    actions: [],
    stakeholders: [],
    needs: [],
    requirements: [],
    dismissedKeys: [],
    ...fields,
  };
}

const keys = (suggestions: SuggestedAction[]) => suggestions.map((s) => s.key);

test('initiative vide : une suggestion par tâche, dans l’ordre du référentiel', () => {
  const suggestions = suggestActions(babok, context({ initiative: { archived: false, analysisApproach: null, plannedEndDate: null } }));
  // 3.1 : R1 l'emporte sur R2 et R14 (toute l'initiative, plus petit numéro) ;
  // 3.2 : R3 sur R4 ; 6.1 : R7 sur R14.
  assert.deepEqual(keys(suggestions), ['R1', 'R3', 'R14:4', 'R14:5', 'R7', 'R14:7', 'R14:8']);
  assert.deepEqual(
    suggestions.map((s) => s.taskId),
    ['3.1', '3.2', '4.1', '5.1', '6.1', '7.1', '8.1'],
  );
});

const stakeholder = (id: string, fields: Partial<SuggestionContext['stakeholders'][number]> = {}) => ({
  id,
  roles: ['sponsor' as const],
  influence: 'high' as const,
  interest: 'high' as const,
  ...fields,
});
const action = (fields: Partial<SuggestionContext['actions'][number]> = {}) => ({
  taskId: '3.1',
  status: 'todo' as const,
  suggestionKey: null,
  stakeholderIds: [],
  ...fields,
});
const find = (suggestions: SuggestedAction[], key: string) => suggestions.find((s) => s.key === key);

test('R5 : une seule suggestion qui compte les parties prenantes sans influence ou sans intérêt, liées à l’action', () => {
  const r5 = find(
    suggestActions(
      babok,
      context({
        stakeholders: [stakeholder('s1', { influence: null }), stakeholder('s2', { interest: null }), stakeholder('s3')],
      }),
    ),
    'R5',
  );
  assert.deepEqual(r5, {
    key: 'R5',
    rule: 'R5',
    taskId: '3.2',
    techniqueId: '10.43',
    count: 2,
    knowledgeAreaId: null,
    daysLeft: null,
    links: { stakeholderIds: ['s1', 's2'], needIds: [], requirementIds: [] },
  });
});

test('R5 l’emporte sur R4 (même tâche 3.2, porte sur des objets)', () => {
  const suggestions = suggestActions(babok, context({ stakeholders: [stakeholder('s1', { roles: ['tester'], influence: null })] }));
  assert.equal(find(suggestions, 'R4'), undefined);
  assert.ok(find(suggestions, 'R5'));
});

test('R6 : les parties prenantes liées à aucune action, quel que soit le statut des actions', () => {
  const r6 = find(
    suggestActions(
      babok,
      context({
        stakeholders: [stakeholder('s1'), stakeholder('s2'), stakeholder('s3')],
        actions: [action({ status: 'cancelled', stakeholderIds: ['s2'] })],
      }),
    ),
    'R6',
  );
  assert.equal(r6?.taskId, '4.5');
  assert.equal(r6?.techniqueId, null);
  assert.equal(r6?.count, 2);
  assert.deepEqual(r6?.links.stakeholderIds, ['s1', 's3']);
});

test('R5 et R6 disparaissent quand plus aucune partie prenante n’est concernée', () => {
  const suggestions = suggestActions(
    babok,
    context({ stakeholders: [stakeholder('s1')], actions: [action({ stakeholderIds: ['s1'] })] }),
  );
  assert.equal(find(suggestions, 'R5'), undefined);
  assert.equal(find(suggestions, 'R6'), undefined);
});

const need = (id: string, stakeholderIds: string[] = ['s1']) => ({ id, stakeholderIds });
const requirement = (id: string, fields: Partial<SuggestionContext['requirements'][number]> = {}) => ({
  id,
  status: 'approved' as const,
  statusSince: '2026-10-30T10:00:00.000Z',
  stakeholderIds: ['s1'],
  needIds: ['n1'],
  ...fields,
});

test('R8 : les besoins sans partie prenante d’origine, liés à l’action', () => {
  const r8 = find(suggestActions(babok, context({ needs: [need('n1', []), need('n2')] })), 'R8');
  assert.equal(r8?.taskId, '5.1');
  assert.equal(r8?.count, 1);
  assert.deepEqual(r8?.links, { stakeholderIds: [], needIds: ['n1'], requirementIds: [] });
});

test('R9 : les besoins sans exigence liée', () => {
  const r9 = find(
    suggestActions(babok, context({ needs: [need('n1'), need('n2')], requirements: [requirement('e1', { needIds: ['n1'] })] })),
    'R9',
  );
  assert.equal(r9?.taskId, '7.1');
  assert.deepEqual(r9?.links.needIds, ['n2']);
});

test('R10 : les exigences sans source, liées à l’action', () => {
  const situations = currentSituations(
    babok,
    context({ needs: [need('n1')], requirements: [requirement('e1', { stakeholderIds: [] }), requirement('e2')] }),
  );
  const r10 = find(situations, 'R10');
  assert.equal(r10?.taskId, '5.1');
  assert.deepEqual(r10?.links, { stakeholderIds: [], needIds: [], requirementIds: ['e1'] });
});

test('R8 l’emporte sur R10 (même tâche 5.1, toutes deux sur des objets : plus petit numéro)', () => {
  const suggestions = suggestActions(
    babok,
    context({ needs: [need('n1', [])], requirements: [requirement('e1', { stakeholderIds: [] })] }),
  );
  assert.ok(find(suggestions, 'R8'));
  assert.equal(find(suggestions, 'R10'), undefined);
});

test('R11 à R13 : exigences à ce statut depuis plus de 14 jours, avec la technique 10.37', () => {
  const old = '2026-10-16T09:59:00.000Z'; // 14 jours et 1 minute avant `now`
  const recent = '2026-10-17T10:00:00.000Z'; // 14 jours tout juste
  const situations = currentSituations(
    babok,
    context({
      requirements: [
        requirement('p1', { status: 'proposed', statusSince: old }),
        requirement('p2', { status: 'proposed', statusSince: recent }),
        requirement('v1', { status: 'verified', statusSince: old }),
        requirement('a1', { status: 'validated', statusSince: old }),
        requirement('x1', { status: 'approved', statusSince: old }),
      ],
    }),
  );
  assert.deepEqual(
    situations.filter((s) => ['R11', 'R12', 'R13'].includes(s.rule)).map((s) => [s.key, s.taskId, s.techniqueId, s.links.requirementIds]),
    [
      ['R11', '7.2', '10.37', ['p1']],
      ['R12', '7.3', '10.37', ['v1']],
      ['R13', '5.5', '10.37', ['a1']],
    ],
  );
});

test('dernier passage au statut actuel : début de la dernière suite de versions à ce statut', () => {
  assert.equal(
    requirementStatusSince([
      { changedAt: '2026-09-01T00:00:00.000Z', status: 'proposed' },
      { changedAt: '2026-09-05T00:00:00.000Z', status: 'verified' },
      { changedAt: '2026-09-10T00:00:00.000Z', status: 'proposed' },
      { changedAt: '2026-09-12T00:00:00.000Z', status: 'proposed' },
    ]),
    '2026-09-10T00:00:00.000Z',
  );
});

test('R15 : date de fin prévue dans 30 jours ou moins, ou dépassée', () => {
  const r15 = (plannedEndDate: string | null) =>
    find(
      currentSituations(babok, context({ initiative: { archived: false, analysisApproach: 'adaptive', plannedEndDate } })),
      'R15',
    );
  assert.equal(r15('2026-12-01'), undefined);
  assert.equal(r15(null), undefined);
  assert.deepEqual([r15('2026-11-30')?.daysLeft, r15('2026-11-30')?.taskId], [30, '3.5']);
  assert.equal(r15('2026-10-31')?.daysLeft, 0);
  assert.equal(r15('2026-10-29')?.daysLeft, -2);
});

test('G4 : aucune suggestion sur une initiative archivée', () => {
  assert.deepEqual(suggestActions(babok, context({ initiative: { archived: true, analysisApproach: null, plannedEndDate: null } })), []);
});

test('G6 : masquée tant qu’une Action créée depuis elle est À faire ou En cours, de retour si Terminée ou Annulée', () => {
  const withAction = (status: 'todo' | 'in_progress' | 'done' | 'cancelled') =>
    find(
      suggestActions(babok, context({ needs: [need('n1', [])], actions: [action({ taskId: '5.1', status, suggestionKey: 'R8' })] })),
      'R8',
    );
  assert.equal(withAction('todo'), undefined);
  assert.equal(withAction('in_progress'), undefined);
  assert.ok(withAction('done'));
  assert.ok(withAction('cancelled'));
});

test('G7 : une suggestion écartée disparaît ; sa situation reste connue', () => {
  const ctx = context({ needs: [need('n1', [])], dismissedKeys: ['R8'] });
  assert.equal(find(suggestActions(babok, ctx), 'R8'), undefined);
  assert.ok(find(currentSituations(babok, ctx), 'R8'));
});

test('G2 : écartée ou masquée, la gagnante laisse place à l’autre règle de la même tâche', () => {
  const stakeholders = [stakeholder('s1', { roles: ['tester'], influence: null })];
  assert.ok(find(suggestActions(babok, context({ stakeholders, dismissedKeys: ['R5'] })), 'R4'));
  assert.ok(
    find(suggestActions(babok, context({ stakeholders, actions: [action({ taskId: '3.2', suggestionKey: 'R5' })] })), 'R4'),
  );
});

test('titre et justification dans la langue de l’interface, avec le nombre, le domaine ou les jours', () => {
  const [r5] = suggestActions(babok, context({ stakeholders: [stakeholder('s1', { interest: null })], actions: [action({ stakeholderIds: ['s1'] }), action({ taskId: '4.1' }), action({ taskId: '5.1' }), action({ taskId: '6.1' }), action({ taskId: '7.1' }), action({ taskId: '8.1' })], needs: [need('n1')], requirements: [requirement('e1')] }));
  assert.deepEqual(suggestedActionText(babok, 'fr', r5!), {
    title: 'Évaluer l’influence et l’intérêt des parties prenantes',
    justification: '1 partie(s) prenante(s) sans influence ou sans intérêt renseigné.',
  });
  assert.deepEqual(suggestedActionText(babok, 'en', r5!), {
    title: 'Assess stakeholder influence and interest',
    justification: '1 stakeholder(s) without influence or interest set.',
  });
  const r14 = find(suggestActions(babok, context()), 'R14:4')!;
  assert.deepEqual(suggestedActionText(babok, 'fr', r14), {
    title: 'Préparer l’élicitation',
    justification: 'Aucune action ne couvre le domaine « Élicitation et collaboration ».',
  });
  assert.equal(suggestedActionText(babok, 'en', r14).justification, 'No action covers the "Elicitation and Collaboration" Knowledge Area.');
  const r15 = (plannedEndDate: string) =>
    find(currentSituations(babok, context({ initiative: { archived: false, analysisApproach: null, plannedEndDate } })), 'R15')!;
  assert.equal(suggestedActionText(babok, 'fr', r15('2026-11-10')).justification, 'La date de fin prévue est dans 10 jour(s).');
  assert.equal(suggestedActionText(babok, 'fr', r15('2026-10-28')).justification, 'La date de fin prévue est dépassée depuis 3 jour(s).');
  assert.equal(suggestedActionText(babok, 'en', r15('2026-10-28')).justification, 'The planned end date passed 3 day(s) ago.');
});

test('création en un clic : titre, tâche, technique de la règle, liens vers les objets comptés, origine', () => {
  const r5 = find(suggestActions(babok, context({ stakeholders: [stakeholder('s1', { interest: null })] })), 'R5')!;
  assert.deepEqual(suggestedActionInput(r5, 'Évaluer'), {
    title: 'Évaluer',
    taskId: '3.2',
    techniqueId: '10.43',
    stakeholderIds: ['s1'],
    needIds: [],
    requirementIds: [],
    suggestionKey: 'R5',
  });
});

test('origine d’une action : une clé de suggestion connue', () => {
  for (const key of ['R1', 'R9', 'R13', 'R15', 'R14:3']) assert.ok(suggestionKeySchema.safeParse(key).success, key);
  for (const key of ['R0', 'R14', 'R16', 'R5:3', 'x']) assert.ok(!suggestionKeySchema.safeParse(key).success, key);
});
