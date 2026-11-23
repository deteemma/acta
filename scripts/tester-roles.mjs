// Test de bout en bout des permissions (ADR-0006), double barrière :
//   1. par l'API (guards NestJS) ;
//   2. directement en base avec le compte applicatif (RLS PostgreSQL).
// Exige les comptes de test (ajouter-application.sh … --comptes-test).
// Lancé par scripts/tester-roles.sh, dans l'image de l'application.
// Une section par fichier dans scripts/roles/, exécutées dans l'ordre ci-dessous :
// une section peut s'appuyer sur les objets créés par les précédentes.
import { admin, alice, assert, bruno, call, check, chloe, failedLabels, failures } from './roles/commun.mjs';

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
  '12-statuts-d-exigence',
  '13-ticket-et-historique',
  '14-types-de-ticket-et-epics',
  '15-pages',
  '16-enregistrements-de-page',
  '17-liens',
  '18-commentaires',
  '19-pieces-jointes',
  '20-modeles-de-page',
  '21-modification-simultanee',
  '22-liens-et-commentaires-des-pages',
  '23-images-des-pages',
  '24-types-et-statuts-parametrables',
  '25-administration-des-modeles-de-page',
  '26-limite-de-pieces-jointes',
  '27-scenarios',
  '28-contexte-et-langue',
  '29-historique-des-scenarios',
  '30-scenarios-dans-la-palette',
  '31-referentiel-agile',
  '32-activation-extension-agile',
  '33-technique-agile-d-une-action',
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
const { stInitiativeId } = run['12-statuts-d-exigence'];
const { tkInitiativeId } = run['13-ticket-et-historique'];
const { ttInitiativeId, ttOtherInitiativeId } = run['14-types-de-ticket-et-epics'];
const { pgInitiativeId, pgOtherInitiativeId } = run['15-pages'];
const { rvInitiativeId } = run['16-enregistrements-de-page'];
const { lkInitiativeId, lkOtherInitiativeId } = run['17-liens'];
const { cmInitiativeId, cmOtherInitiativeId } = run['18-commentaires'];
const { ajInitiativeId, ajOtherInitiativeId } = run['19-pieces-jointes'];
const { mpInitiativeId } = run['20-modeles-de-page'];
const { msInitiativeId } = run['21-modification-simultanee'];
const { plInitiativeId, plOtherInitiativeId } = run['22-liens-et-commentaires-des-pages'];
const { ipInitiativeId, ipOtherInitiativeId } = run['23-images-des-pages'];
const { tpInitiativeId } = run['24-types-et-statuts-parametrables'];
const { amInitiativeId } = run['25-administration-des-modeles-de-page'];
const { lpInitiativeId, lpOtherInitiativeId } = run['26-limite-de-pieces-jointes'];
const { scInitiativeId } = run['27-scenarios'];
const { clInitiativeId } = run['28-contexte-et-langue'];
const { hsInitiativeId } = run['29-historique-des-scenarios'];
const { spInitiativeId } = run['30-scenarios-dans-la-palette'];
const { aeInitiativeId } = run['32-activation-extension-agile'];
const { taInitiativeId } = run['33-technique-agile-d-une-action'];

console.log('\nNettoyage');
await check('alice supprime l’initiative de la technique agile d’une action : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${taInitiativeId}`)).status, 204);
});
await check('alice supprime l’initiative de l’activation de l’Extension Agile : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${aeInitiativeId}`)).status, 204);
});
await check('alice supprime l’initiative des scénarios dans la palette : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${spInitiativeId}`)).status, 204);
});
await check('alice supprime l’initiative de l’historique des scénarios : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${hsInitiativeId}`)).status, 204);
});
await check('alice supprime l’initiative du Contexte et de la langue, avec ses exigences : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${clInitiativeId}`)).status, 204);
});
await check('alice supprime l’initiative des scénarios, avec ses exigences et leurs scénarios : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${scInitiativeId}`)).status, 204);
});
await check('alice supprime les initiatives de la limite de pièces jointes, avec leurs fichiers : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${lpOtherInitiativeId}`)).status, 204);
  assert.equal((await call(alice, 'DELETE', `/initiatives/${lpInitiativeId}`)).status, 204);
});
await check('alice supprime l’initiative de l’administration des modèles, avec sa page : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${amInitiativeId}`)).status, 204);
});
await check('alice supprime l’initiative des types et statuts paramétrables, avec son Risque : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${tpInitiativeId}`)).status, 204);
});
await check('alice supprime les initiatives des images des pages, avec leurs fichiers : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${ipOtherInitiativeId}`)).status, 204);
  assert.equal((await call(alice, 'DELETE', `/initiatives/${ipInitiativeId}`)).status, 204);
});
await check('alice supprime les initiatives des liens et commentaires des pages, avec leurs objets liés : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${plOtherInitiativeId}`)).status, 204);
  assert.equal((await call(alice, 'DELETE', `/initiatives/${plInitiativeId}`)).status, 204);
});
await check('alice supprime l’initiative de la modification simultanée, avec sa page : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${msInitiativeId}`)).status, 204);
});
await check('alice supprime l’initiative des modèles de page, avec ses pages : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${mpInitiativeId}`)).status, 204);
});
await check('alice supprime les initiatives des pièces jointes, avec leurs fichiers : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${ajOtherInitiativeId}`)).status, 204);
  assert.equal((await call(alice, 'DELETE', `/initiatives/${ajInitiativeId}`)).status, 204);
});
await check('alice supprime les initiatives des commentaires, avec leurs tickets commentés : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${cmOtherInitiativeId}`)).status, 204);
  assert.equal((await call(alice, 'DELETE', `/initiatives/${cmInitiativeId}`)).status, 204);
});
await check('alice supprime les initiatives des liens, avec leurs tickets liés : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${lkOtherInitiativeId}`)).status, 204);
  assert.equal((await call(alice, 'DELETE', `/initiatives/${lkInitiativeId}`)).status, 204);
});
await check('alice supprime l’initiative des enregistrements de page : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${rvInitiativeId}`)).status, 204);
});
await check('alice supprime les initiatives des pages, avec toute leur arborescence : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${pgOtherInitiativeId}`)).status, 204);
  assert.equal((await call(alice, 'DELETE', `/initiatives/${pgInitiativeId}`)).status, 204);
});
await check('alice supprime les initiatives des types de ticket, avec leurs Epics et leurs tickets : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${ttOtherInitiativeId}`)).status, 204);
  assert.equal((await call(alice, 'DELETE', `/initiatives/${ttInitiativeId}`)).status, 204);
});
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
await check('alice supprime l’initiative des statuts d’exigence, avec son exigence : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${stInitiativeId}`)).status, 204);
});
await check('alice supprime l’initiative des tickets, avec références et historique : 204', async () => {
  assert.equal((await call(alice, 'DELETE', `/initiatives/${tkInitiativeId}`)).status, 204);
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

console.log(
  failures
    ? `\n${failures} échec(s) :\n${failedLabels.map((label) => `  ✘ ${label}`).join('\n')}`
    : '\nTous les contrôles sont passés.',
);
process.exit(failures ? 1 : 0);
