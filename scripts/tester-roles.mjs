// Test de bout en bout des permissions (ADR-0006), double barrière :
//   1. par l'API (guards NestJS) ;
//   2. directement en base avec le compte applicatif (RLS PostgreSQL).
// Exige les comptes de test (ajouter-application.sh … --comptes-test).
// Lancé par scripts/tester-roles.sh, dans l'image de l'application.
// Une section par fichier dans scripts/roles/, exécutées dans l'ordre ci-dessous :
// une section peut s'appuyer sur les objets créés par les précédentes.
import { admin, alice, assert, bruno, call, check, chloe, failures } from './roles/commun.mjs';

const SECTIONS = [
  '01-initiatives',
  '02-equipe',
  '03-administration',
  '04-referentiel-babok',
  '05-actions',
  '06-parties-prenantes',
  '07-references-et-besoins',
  '08-exigences',
  '09-usage-des-techniques',
  '10-actions-suggerees',
  '11-alertes',
];
const run = {};
for (const section of SECTIONS) run[section] = await import(`./roles/${section}.mjs`);
const { initiativeId, otherInitiativeId } = run['01-initiatives'];
const { account, orphanId } = run['03-administration'];
const { actionsInitiativeId } = run['05-actions'];
const { shInitiativeId, otherShInitiativeId } = run['06-parties-prenantes'];
const { rbInitiativeId, otherRbInitiativeId } = run['07-references-et-besoins'];
const { exInitiativeId, otherExInitiativeId } = run['08-exigences'];
const { usageInitiativeId } = run['09-usage-des-techniques'];
const { saInitiativeId } = run['10-actions-suggerees'];
const { alInitiativeId } = run['11-alertes'];

console.log('\nNettoyage');
await check('alice (propriétaire) supprime l’initiative des actions, et ses actions : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${actionsInitiativeId}`)).status, 204);
});
await check('alice supprime l’initiative des parties prenantes, avec actions et liens : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${shInitiativeId}`)).status, 204);
});
await check('bruno (propriétaire) supprime l’autre initiative des parties prenantes : 204', async () => {
  assert.equal((await call(bruno, 'DELETE', `/initiatives/${otherShInitiativeId}`)).status, 204);
});
await check('alice supprime l’initiative des besoins, avec besoins, actions et liens : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${rbInitiativeId}`)).status, 204);
});
await check('bruno (propriétaire) supprime l’autre initiative des besoins : 204', async () => {
  assert.equal((await call(bruno, 'DELETE', `/initiatives/${otherRbInitiativeId}`)).status, 204);
});
await check('alice supprime l’initiative des exigences, avec exigences, parentés, liens et historique : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${exInitiativeId}`)).status, 204);
});
await check('bruno (propriétaire) supprime l’autre initiative des exigences : 204', async () => {
  assert.equal((await call(bruno, 'DELETE', `/initiatives/${otherExInitiativeId}`)).status, 204);
});
await check('alice supprime l’initiative de l’usage des techniques, et ses actions : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${usageInitiativeId}`)).status, 204);
});
await check('alice supprime l’initiative des actions suggérées, archivée, avec actions et écarts : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${saInitiativeId}`)).status, 204);
});
await check('alice supprime l’initiative des alertes, et ses actions : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${alInitiativeId}`)).status, 204);
});
// Quoi qu'il soit arrivé plus haut, les comptes de test restent actifs.
for (const u of [alice, chloe]) await call(admin, 'PATCH', account(u), { enabled: true });
await check('bruno (propriétaire) supprime l’initiative de l’administration : 204', async () => {
  assert.equal((await call(bruno, 'DELETE', `/initiatives/${orphanId}`)).status, 204);
});
await check('bruno (propriétaire) supprime l’initiative archivée : 204', async () => {
  assert.equal((await call(bruno, 'DELETE', `/initiatives/${initiativeId}`)).status, 204);
  assert.equal((await call(bruno, 'GET', `/initiatives/${initiativeId}`)).status, 404);
});
await check('bruno (propriétaire) supprime son initiative, même archivée : 204', async () => {
  assert.equal((await call(bruno, 'PUT', `/initiatives/${otherInitiativeId}/archive`)).status, 200);
  assert.equal((await call(bruno, 'DELETE', `/initiatives/${otherInitiativeId}`)).status, 204);
});

console.log(failures ? `\n${failures} échec(s).` : '\nTous les contrôles sont passés.');
process.exit(failures ? 1 : 0);
