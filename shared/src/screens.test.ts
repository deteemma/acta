import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScreenPath, sameScreen, screenPath } from './screens.js';

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
  for (const path of ['/inconnue', '/initiatives', `/initiatives/${ID}`, '/initiatives/pas-un-id/tickets', '//autre.example/x']) {
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

test('l’écran Pages a son adresse, et celle de la page ouverte : le lien d’une page peut être envoyé', () => {
  assert.equal(screenPath({ kind: 'pages', initiativeId: ID, pageId: null }), `/initiatives/${ID}/pages`);
  assert.equal(screenPath({ kind: 'pages', initiativeId: ID, pageId: PAGE }), `/initiatives/${ID}/pages/${PAGE}`);
  assert.deepEqual(parseScreenPath(`/initiatives/${ID}/pages`), { kind: 'pages', initiativeId: ID, pageId: null });
  assert.deepEqual(parseScreenPath(`/initiatives/${ID}/pages/${PAGE}/`), { kind: 'pages', initiativeId: ID, pageId: PAGE });
  assert.deepEqual(parseScreenPath(`/initiatives/${ID}/pages/pas-un-id`), { kind: 'myActions' });
});

test('ouvrir une autre page est un autre écran, pour « Précédent »', () => {
  const pages = { kind: 'pages', initiativeId: ID, pageId: null } as const;
  assert.equal(sameScreen(pages, { ...pages, pageId: PAGE }), false);
  assert.equal(sameScreen({ ...pages, pageId: PAGE }, { ...pages, pageId: PAGE }), true);
  assert.equal(sameScreen(pages, { kind: 'tickets', initiativeId: ID }), false);
});
