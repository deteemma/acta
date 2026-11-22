import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BABOK_TABS, isAgileBabokTab, parseScreenPath, sameScreen, screenInitiativeId, screenPath } from './screens.js';

const ID = '3f2b8c1e-5a7d-4e21-9c44-0d1e2f3a4b5c';

test('l’adresse de l’écran Tickets désigne son initiative ; « Mes actions » est l’accueil', () => {
  assert.equal(screenPath({ kind: 'tickets', initiativeId: ID }), `/initiatives/${ID}/tickets`);
  assert.equal(screenPath({ kind: 'myActions' }), '/');
});

test('une adresse redonne son écran, ce qui permet de recharger la page au même endroit', () => {
  assert.deepEqual(parseScreenPath(`/initiatives/${ID}/tickets`), { kind: 'tickets', initiativeId: ID });
  assert.deepEqual(parseScreenPath(`/initiatives/${ID}/tickets/`), { kind: 'tickets', initiativeId: ID });
  assert.deepEqual(parseScreenPath('/'), { kind: 'myActions' });
});

test('une adresse inconnue ou mal formée mène à l’accueil', () => {
  for (const path of ['/inconnue', '/initiatives', `/initiatives/${ID}/inconnu`, '/initiatives/pas-un-id/tickets', '//autre.example/x']) {
    assert.deepEqual(parseScreenPath(path), { kind: 'myActions' }, path);
  }
});

test('deux écrans sont les mêmes s’ils ont la même nature et la même initiative', () => {
  const other = '00000000-0000-4000-8000-000000000000';
  assert.equal(sameScreen({ kind: 'tickets', initiativeId: ID }, { kind: 'tickets', initiativeId: ID }), true);
  assert.equal(sameScreen({ kind: 'tickets', initiativeId: ID }, { kind: 'tickets', initiativeId: other }), false);
  assert.equal(sameScreen({ kind: 'myActions' }, { kind: 'tickets', initiativeId: ID }), false);
  assert.equal(sameScreen({ kind: 'myActions' }, { kind: 'myActions' }), true);
});

const PAGE = '7a6b5c4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d';

test('le nœud Pages a son adresse, et chaque page la sienne, onglet par onglet : le lien d’une page peut être envoyé', () => {
  assert.equal(screenPath({ kind: 'pages', initiativeId: ID }), `/initiatives/${ID}/pages`);
  assert.equal(screenPath({ kind: 'page', initiativeId: ID, pageId: PAGE, tab: 'content' }), `/initiatives/${ID}/pages/${PAGE}`);
  assert.equal(screenPath({ kind: 'page', initiativeId: ID, pageId: PAGE, tab: 'history' }), `/initiatives/${ID}/pages/${PAGE}/history`);
  assert.deepEqual(parseScreenPath(`/initiatives/${ID}/pages`), { kind: 'pages', initiativeId: ID });
  // L'adresse d'une page d'avant les onglets ouvre son Contenu.
  assert.deepEqual(parseScreenPath(`/initiatives/${ID}/pages/${PAGE}/`), { kind: 'page', initiativeId: ID, pageId: PAGE, tab: 'content' });
  for (const tab of ['links', 'comments', 'attachments', 'history'] as const) {
    assert.deepEqual(parseScreenPath(`/initiatives/${ID}/pages/${PAGE}/${tab}`), { kind: 'page', initiativeId: ID, pageId: PAGE, tab });
  }
  for (const path of [`/initiatives/${ID}/pages/pas-un-id`, `/initiatives/${ID}/pages/${PAGE}/inconnu`, `/initiatives/${ID}/pages/${PAGE}/links/x`]) {
    assert.deepEqual(parseScreenPath(path), { kind: 'myActions' }, path);
  }
});

test('ouvrir une autre page, ou un autre onglet de la page, est un autre écran, pour « Précédent »', () => {
  const page = { kind: 'page', initiativeId: ID, pageId: PAGE, tab: 'content' } as const;
  assert.equal(sameScreen({ kind: 'pages', initiativeId: ID }, page), false);
  assert.equal(sameScreen(page, { ...page, tab: 'comments' }), false);
  assert.equal(sameScreen(page, { ...page }), true);
  assert.equal(sameScreen({ kind: 'pages', initiativeId: ID }, { kind: 'tickets', initiativeId: ID }), false);
});

test('l’initiative a son adresse, et chacun de ses onglets ; l’onglet Aperçu est celui de l’adresse nue', () => {
  assert.equal(screenPath({ kind: 'initiative', initiativeId: ID, tab: 'overview' }), `/initiatives/${ID}`);
  assert.equal(screenPath({ kind: 'initiative', initiativeId: ID, tab: 'members' }), `/initiatives/${ID}/members`);
  assert.equal(screenPath({ kind: 'initiative', initiativeId: ID, tab: 'settings' }), `/initiatives/${ID}/settings`);
  assert.deepEqual(parseScreenPath(`/initiatives/${ID}`), { kind: 'initiative', initiativeId: ID, tab: 'overview' });
  assert.deepEqual(parseScreenPath(`/initiatives/${ID}/designations/`), { kind: 'initiative', initiativeId: ID, tab: 'designations' });
  assert.deepEqual(parseScreenPath(`/initiatives/${ID}/overview`), { kind: 'initiative', initiativeId: ID, tab: 'overview' });
});

test('le tableau de bord, l’équipe et les branches ont leur adresse, onglets compris', () => {
  const cases = [
    [{ kind: 'dashboard', initiativeId: ID, tab: 'tasks' }, `/initiatives/${ID}/dashboard`],
    [{ kind: 'dashboard', initiativeId: ID, tab: 'suggested' }, `/initiatives/${ID}/dashboard/suggested`],
    [{ kind: 'team', initiativeId: ID, tab: 'members' }, `/initiatives/${ID}/team`],
    [{ kind: 'team', initiativeId: ID, tab: 'designations' }, `/initiatives/${ID}/team/designations`],
    [{ kind: 'stakeholders', initiativeId: ID, tab: 'matrix' }, `/initiatives/${ID}/stakeholders/matrix`],
    [{ kind: 'needs', initiativeId: ID }, `/initiatives/${ID}/needs`],
    [{ kind: 'requirements', initiativeId: ID }, `/initiatives/${ID}/requirements`],
  ] as const;
  for (const [screen, path] of cases) {
    assert.equal(screenPath(screen), path);
    assert.deepEqual(parseScreenPath(path), screen, path);
  }
});

test('un onglet inconnu ou en trop mène à l’accueil', () => {
  for (const path of [`/initiatives/${ID}/dashboard/inconnu`, `/initiatives/${ID}/team/designations/x`, `/initiatives/${ID}/needs/x`, `/initiatives/${ID}/members/settings`]) {
    assert.deepEqual(parseScreenPath(path), { kind: 'myActions' }, path);
  }
});

test('changer d’onglet est un autre écran, pour « Précédent »', () => {
  const overview = { kind: 'initiative', initiativeId: ID, tab: 'overview' } as const;
  assert.equal(sameScreen(overview, { ...overview, tab: 'members' }), false);
  assert.equal(sameScreen(overview, parseScreenPath(`/initiatives/${ID}/overview`)), true);
});

const ELEMENT = '9c8b7a6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

test('une partie prenante et un besoin ont leur adresse, et chacun de leurs onglets ; la Fiche est celle de l’adresse nue', () => {
  const cases = [
    [{ kind: 'stakeholder', initiativeId: ID, stakeholderId: ELEMENT, tab: 'sheet' }, `/initiatives/${ID}/stakeholders/${ELEMENT}`],
    [{ kind: 'stakeholder', initiativeId: ID, stakeholderId: ELEMENT, tab: 'origin' }, `/initiatives/${ID}/stakeholders/${ELEMENT}/origin`],
    [{ kind: 'need', initiativeId: ID, needId: ELEMENT, tab: 'sheet' }, `/initiatives/${ID}/needs/${ELEMENT}`],
    [{ kind: 'need', initiativeId: ID, needId: ELEMENT, tab: 'requirements' }, `/initiatives/${ID}/needs/${ELEMENT}/requirements`],
    [{ kind: 'need', initiativeId: ID, needId: ELEMENT, tab: 'links' }, `/initiatives/${ID}/needs/${ELEMENT}/links`],
  ] as const;
  for (const [screen, path] of cases) {
    assert.equal(screenPath(screen), path);
    assert.deepEqual(parseScreenPath(path), screen, path);
  }
  // La matrice reste l'onglet du nœud Parties prenantes.
  assert.deepEqual(parseScreenPath(`/initiatives/${ID}/stakeholders/matrix`), { kind: 'stakeholders', initiativeId: ID, tab: 'matrix' });
});

test('un onglet inconnu d’une partie prenante ou d’un besoin mène à l’accueil', () => {
  for (const path of [
    `/initiatives/${ID}/stakeholders/${ELEMENT}/inconnu`,
    `/initiatives/${ID}/needs/${ELEMENT}/origin`,
    `/initiatives/${ID}/needs/${ELEMENT}/links/x`,
    `/initiatives/${ID}/stakeholders/pas-un-id`,
  ]) {
    assert.deepEqual(parseScreenPath(path), { kind: 'myActions' }, path);
  }
});

const SCENARIO = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

test('une exigence a son adresse, et chacun de ses onglets ; la Fiche est celle de l’adresse nue', () => {
  const base = `/initiatives/${ID}/requirements/${ELEMENT}`;
  const cases = [
    [{ kind: 'requirement', initiativeId: ID, requirementId: ELEMENT, tab: 'sheet' }, base],
    [{ kind: 'requirement', initiativeId: ID, requirementId: ELEMENT, tab: 'scenarios' }, `${base}/scenarios`],
    [{ kind: 'requirement', initiativeId: ID, requirementId: ELEMENT, tab: 'trace' }, `${base}/trace`],
    [{ kind: 'requirement', initiativeId: ID, requirementId: ELEMENT, tab: 'links' }, `${base}/links`],
    [{ kind: 'requirement', initiativeId: ID, requirementId: ELEMENT, tab: 'history' }, `${base}/history`],
  ] as const;
  for (const [screen, path] of cases) {
    assert.equal(screenPath(screen), path);
    assert.deepEqual(parseScreenPath(path), screen, path);
  }
});

test('un scénario a son adresse : l’onglet Scénarios de son exigence, le scénario mis en évidence', () => {
  const screen = { kind: 'scenario', initiativeId: ID, requirementId: ELEMENT, scenarioId: SCENARIO } as const;
  const path = `/initiatives/${ID}/requirements/${ELEMENT}/scenarios/${SCENARIO}`;
  assert.equal(screenPath(screen), path);
  assert.deepEqual(parseScreenPath(path), screen);
  assert.equal(sameScreen(screen, { kind: 'requirement', initiativeId: ID, requirementId: ELEMENT, tab: 'scenarios' }), false);
});

test('un onglet inconnu d’une exigence ou un scénario mal formé mène à l’accueil', () => {
  for (const path of [
    `/initiatives/${ID}/requirements/${ELEMENT}/inconnu`,
    `/initiatives/${ID}/requirements/${ELEMENT}/origin`,
    `/initiatives/${ID}/requirements/${ELEMENT}/scenarios/pas-un-id`,
    `/initiatives/${ID}/requirements/${ELEMENT}/scenarios/${SCENARIO}/x`,
    `/initiatives/${ID}/requirements/${ELEMENT}/trace/${SCENARIO}`,
    `/initiatives/${ID}/requirements/pas-un-id`,
  ]) {
    assert.deepEqual(parseScreenPath(path), { kind: 'myActions' }, path);
  }
});

test('un ticket, de tout type, a son adresse, et chacun de ses onglets ; la Fiche est celle de l’adresse nue', () => {
  const base = `/initiatives/${ID}/tickets/${ELEMENT}`;
  const cases = [
    [{ kind: 'ticket', initiativeId: ID, ticketId: ELEMENT, tab: 'sheet' }, base],
    [{ kind: 'ticket', initiativeId: ID, ticketId: ELEMENT, tab: 'epic' }, `${base}/epic`],
    [{ kind: 'ticket', initiativeId: ID, ticketId: ELEMENT, tab: 'links' }, `${base}/links`],
    [{ kind: 'ticket', initiativeId: ID, ticketId: ELEMENT, tab: 'comments' }, `${base}/comments`],
    [{ kind: 'ticket', initiativeId: ID, ticketId: ELEMENT, tab: 'attachments' }, `${base}/attachments`],
    [{ kind: 'ticket', initiativeId: ID, ticketId: ELEMENT, tab: 'history' }, `${base}/history`],
  ] as const;
  for (const [screen, path] of cases) {
    assert.equal(screenPath(screen), path);
    assert.deepEqual(parseScreenPath(path), screen, path);
  }
  assert.equal(sameScreen(cases[0][0], { kind: 'tickets', initiativeId: ID }), false);
});

test('un onglet inconnu d’un ticket ou un identifiant mal formé mène à l’accueil', () => {
  for (const path of [
    `/initiatives/${ID}/tickets/${ELEMENT}/inconnu`,
    `/initiatives/${ID}/tickets/${ELEMENT}/scenarios`,
    `/initiatives/${ID}/tickets/${ELEMENT}/links/x`,
    `/initiatives/${ID}/tickets/pas-un-id`,
  ]) {
    assert.deepEqual(parseScreenPath(path), { kind: 'myActions' }, path);
  }
});

test('les alertes et le référentiel BABOK ont leur adresse, hors de toute initiative ; Domaines et tâches est l’onglet de l’adresse nue', () => {
  const cases = [
    [{ kind: 'alerts' }, '/alerts'],
    [{ kind: 'babok', tab: 'areas' }, '/babok'],
    [{ kind: 'babok', tab: 'techniques' }, '/babok/techniques'],
  ] as const;
  for (const [screen, path] of cases) {
    assert.equal(screenPath(screen), path);
    assert.deepEqual(parseScreenPath(path), screen, path);
    assert.equal(screenInitiativeId(screen), null);
  }
});

test('un domaine, une tâche ou une technique du référentiel a sa propre adresse, par sa section', () => {
  for (const elementId of ['3', '3.1', '10.12']) {
    const screen = { kind: 'babokElement', elementId } as const;
    assert.equal(screenPath(screen), `/babok/${elementId}`);
    assert.deepEqual(parseScreenPath(`/babok/${elementId}`), screen);
    assert.equal(screenInitiativeId(screen), null);
  }
  for (const path of ['/babok/inconnu', '/babok/3.1/x', '/babok/3.', '/babok/techniques/x', '/alerts/x']) {
    assert.deepEqual(parseScreenPath(path), { kind: 'myActions' }, path);
  }
});

test('les onglets du référentiel agile ont leur adresse, après Domaines et tâches et Techniques', () => {
  assert.deepEqual(BABOK_TABS, ['areas', 'techniques', 'principles', 'horizons', 'agile-techniques']);
  assert.deepEqual(BABOK_TABS.filter(isAgileBabokTab), ['principles', 'horizons', 'agile-techniques']);
  const cases = [
    [{ kind: 'babok', tab: 'principles' }, '/babok/principles'],
    [{ kind: 'babok', tab: 'horizons' }, '/babok/horizons'],
    [{ kind: 'babok', tab: 'agile-techniques' }, '/babok/agile-techniques'],
  ] as const;
  for (const [screen, path] of cases) {
    assert.equal(screenPath(screen), path);
    assert.deepEqual(parseScreenPath(path), screen, path);
    assert.equal(screenInitiativeId(screen), null);
  }
});

test('un principe, un horizon ou une technique agile a sa propre adresse, par son identifiant stable', () => {
  for (const elementId of ['ae-4.1', 'ae-5.2', 'ae-7.17']) {
    const screen = { kind: 'babokElement', elementId } as const;
    assert.equal(screenPath(screen), `/babok/${elementId}`);
    assert.deepEqual(parseScreenPath(`/babok/${elementId}`), screen);
  }
  for (const path of ['/babok/ae-', '/babok/ae-7.', '/babok/ea-7.17', '/babok/ae-7.17/x']) {
    assert.deepEqual(parseScreenPath(path), { kind: 'myActions' }, path);
  }
});

test('l’administration a son adresse, et chacun de ses onglets ; Comptes est l’onglet de l’adresse nue', () => {
  const cases = [
    [{ kind: 'admin', tab: 'accounts' }, '/admin'],
    [{ kind: 'admin', tab: 'orphans' }, '/admin/orphans'],
    [{ kind: 'admin', tab: 'references' }, '/admin/references'],
    [{ kind: 'admin', tab: 'statuses' }, '/admin/statuses'],
    [{ kind: 'admin', tab: 'ticket-types' }, '/admin/ticket-types'],
    [{ kind: 'admin', tab: 'page-templates' }, '/admin/page-templates'],
    [{ kind: 'admin', tab: 'attachments' }, '/admin/attachments'],
  ] as const;
  for (const [screen, path] of cases) {
    assert.equal(screenPath(screen), path);
    assert.deepEqual(parseScreenPath(path), screen, path);
    assert.equal(screenInitiativeId(screen), null);
  }
});

test('un modèle de page de l’administration a son adresse, et l’ajout d’un modèle la sienne', () => {
  const existing = { kind: 'pageTemplate', templateId: ELEMENT } as const;
  const added = { kind: 'pageTemplate', templateId: null } as const;
  assert.equal(screenPath(existing), `/admin/page-templates/${ELEMENT}`);
  assert.equal(screenPath(added), '/admin/page-templates/new');
  assert.deepEqual(parseScreenPath(`/admin/page-templates/${ELEMENT}`), existing);
  assert.deepEqual(parseScreenPath('/admin/page-templates/new'), added);
  assert.equal(sameScreen(existing, added), false);
  for (const path of ['/admin/inconnu', '/admin/accounts/x', '/admin/page-templates/pas-un-id', `/admin/page-templates/${ELEMENT}/x`]) {
    assert.deepEqual(parseScreenPath(path), { kind: 'myActions' }, path);
  }
});

test('un membre de l’équipe a son adresse, sous l’onglet Membres de l’équipe', () => {
  const screen = { kind: 'member', initiativeId: ID, userId: ELEMENT } as const;
  assert.equal(screenPath(screen), `/initiatives/${ID}/team/members/${ELEMENT}`);
  assert.deepEqual(parseScreenPath(`/initiatives/${ID}/team/members/${ELEMENT}`), screen);
  assert.equal(screenInitiativeId(screen), ID);
  assert.equal(sameScreen(screen, { kind: 'team', initiativeId: ID, tab: 'members' }), false);
  // L'identifiant du compte vient de Keycloak : il est repris tel quel, encodé dans l'adresse.
  const other = { kind: 'member', initiativeId: ID, userId: 'compte local/1' } as const;
  assert.deepEqual(parseScreenPath(screenPath(other)), other);
  for (const path of [`/initiatives/${ID}/team/designations/${ELEMENT}`, `/initiatives/${ID}/team/members/${ELEMENT}/x`]) {
    assert.deepEqual(parseScreenPath(path), { kind: 'myActions' }, path);
  }
});
