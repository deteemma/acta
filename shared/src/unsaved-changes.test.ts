import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chosenValue, hasUnsavedChanges, leavePanels, saveForms, TrackedForm, type UnsavedChoice } from './unsaved-changes.js';

/** Sortie jouée sur des panneaux du dessus vers le dessous, avec les réponses données à l'alerte. */
async function leave(
  panels: { name: string; dirty?: boolean; succeeds?: boolean }[],
  answers: UnsavedChoice[],
) {
  const log: string[] = [];
  const asked: string[] = [];
  const left: string[] = [];
  const result = await leavePanels(
    panels.map((p) => ({ name: p.name, forms: [fakeForm(p.dirty ?? false, p.succeeds ?? true, log, p.name)] })),
    async (panel) => {
      asked.push(panel.name);
      return answers.shift()!;
    },
    (panel) => left.push(panel.name),
  );
  return { result, asked, left, log };
}

test('sans modification, la sortie se fait sans alerte', async () => {
  const { result, asked } = await leave([{ name: 'A' }, { name: 'B' }], []);
  assert.equal(result.outcome, 'left');
  assert.deepEqual(asked, []);
});

test('une alerte par panneau modifié, du dessus vers le dessous', async () => {
  const { result, asked, left, log } = await leave(
    [{ name: 'dessus', dirty: true }, { name: 'milieu' }, { name: 'dessous', dirty: true }],
    ['save', 'discard'],
  );
  assert.equal(result.outcome, 'left');
  assert.deepEqual(asked, ['dessus', 'dessous']);
  assert.deepEqual(left, ['dessus', 'dessous']);
  assert.deepEqual(log, ['enregistre dessus', 'abandon dessous']);
});

test('« Continuer la saisie » arrête tout : ce panneau et ceux du dessous restent ouverts', async () => {
  const { result, asked, left, log } = await leave(
    [{ name: 'dessus', dirty: true }, { name: 'milieu', dirty: true }, { name: 'dessous', dirty: true }],
    ['discard', 'keepEditing'],
  );
  assert.equal(result.outcome, 'keptEditing');
  assert.deepEqual(asked, ['dessus', 'milieu']);
  assert.deepEqual(left, ['dessus']);
  assert.deepEqual(log, ['abandon dessus']);
});

test('un échec d’enregistrement annule la sortie sur ce panneau', async () => {
  const { result, asked, left } = await leave(
    [{ name: 'dessus', dirty: true, succeeds: false }, { name: 'dessous', dirty: true }],
    ['save'],
  );
  assert.equal(result.outcome, 'saveFailed');
  assert.equal(result.outcome === 'saveFailed' && result.panel.name, 'dessus');
  assert.deepEqual(asked, ['dessus']);
  assert.deepEqual(left, []);
});

test('un formulaire enregistré avec succès n’a plus de modification', async () => {
  const form = new TrackedForm({ title: 'A' }, async () => true);
  form.update({ title: 'B' }, async () => true);
  assert.equal(form.isDirty(), true);
  assert.equal(await form.submit(), true);
  assert.equal(form.isDirty(), false);
});

test('un échec d’enregistrement laisse la modification en attente', async () => {
  const form = new TrackedForm({ title: 'A' }, async () => false);
  form.update({ title: 'B' }, async () => false);
  assert.equal(await form.submit(), false);
  assert.equal(form.isDirty(), true);
});

test('ce qui est saisi pendant l’enregistrement reste une modification', async () => {
  const form = new TrackedForm({ title: 'A' }, async () => true);
  let answer = (_: boolean) => {};
  form.update({ title: 'B' }, () => new Promise((resolve) => (answer = resolve)));
  const saving = form.submit();
  form.update({ title: 'BC' }, async () => true);
  answer(true);
  await saving;
  assert.equal(form.isDirty(), true);
});

test('enregistrer pendant un envoi en cours n’envoie pas deux fois', async () => {
  // Réseau lent : « Créer », puis la croix, puis « Enregistrer » de l'alerte.
  let sent = 0;
  let answer = (_: boolean) => {};
  const form = new TrackedForm({ title: 'A' }, async () => true);
  form.update({ title: 'B' }, () => {
    sent++;
    return new Promise((resolve) => (answer = resolve));
  });
  const first = form.submit();
  const second = form.submit();
  answer(true);
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(sent, 1);
  assert.equal(form.isDirty(), false);
});

test('après la fin d’un envoi, un nouvel envoi repart', async () => {
  let sent = 0;
  const form = new TrackedForm({ title: 'A' }, async () => true);
  form.update({ title: 'B' }, async () => {
    sent++;
    return false;
  });
  await form.submit();
  await form.submit();
  assert.equal(sent, 2);
});

test('une valeur proposée d’office n’est pas une saisie, même si elle arrive après l’ouverture', () => {
  assert.equal(chosenValue('tâche-1', 'tâche-1'), null);
  assert.equal(chosenValue('tâche-2', 'tâche-1'), 'tâche-2');
  assert.equal(chosenValue('', undefined), null);
});

test('un formulaire vidé après son envoi repart de ses nouvelles valeurs', async () => {
  // Invitation d'un membre : le formulaire revient à ses valeurs de départ.
  const form = new TrackedForm({ email: '', role: 'contributor' }, async () => true);
  form.update({ email: 'a@b.ch', role: 'reader' }, async () => ({ email: '', role: 'contributor' }));
  assert.equal(await form.submit(), true);
  form.update({ email: '', role: 'contributor' }, async () => true);
  assert.equal(form.isDirty(), false);
});

test('abandonner efface la modification', () => {
  const form = new TrackedForm({ title: 'A' }, async () => true);
  form.update({ title: 'B' }, async () => true);
  form.discard();
  assert.equal(form.isDirty(), false);
});

/** Formulaire de test : modifié ou non, et ce que donne son enregistrement. */
function fakeForm(dirty: boolean, succeeds: boolean, log: string[], name: string) {
  return {
    isDirty: () => dirty,
    discard: () => log.push(`abandon ${name}`),
    submit: async () => {
      log.push(`enregistre ${name}`);
      return succeeds;
    },
  };
}

test('enregistrer un panneau fait le travail de chaque formulaire modifié, et seulement de ceux-là', async () => {
  const log: string[] = [];
  const ok = await saveForms([fakeForm(true, true, log, 'fiche'), fakeForm(false, true, log, 'invitation')]);
  assert.equal(ok, true);
  assert.deepEqual(log, ['enregistre fiche']);
});

test('si un formulaire échoue, les autres restent faits et le panneau reste ouvert', async () => {
  const log: string[] = [];
  const ok = await saveForms([fakeForm(true, false, log, 'fiche'), fakeForm(true, true, log, 'invitation')]);
  assert.equal(ok, false);
  assert.deepEqual(log, ['enregistre fiche', 'enregistre invitation']);
});

test('un champ différent de sa valeur enregistrée est une modification non enregistrée', () => {
  assert.equal(hasUnsavedChanges({ title: 'Atelier', dueDate: '' }, { title: 'Atelier 2', dueDate: '' }), true);
  assert.equal(hasUnsavedChanges({ approach: null }, { approach: 'adaptive' }), true);
});

test('une valeur remise comme avant ne compte pas', () => {
  assert.equal(hasUnsavedChanges({ title: 'Atelier', dueDate: '' }, { title: 'Atelier', dueDate: '' }), false);
});

test('un formulaire de création resté à ses valeurs de départ ne compte pas', () => {
  assert.equal(hasUnsavedChanges({ code: '', name: '', roles: [] }, { code: '', name: '', roles: [] }), false);
});

test('une liste cochée compte par son contenu, pas par l’ordre des clics', () => {
  // Décocher puis recocher A la replace en fin de liste : la valeur est revenue.
  assert.equal(hasUnsavedChanges({ needIds: ['A', 'B'] }, { needIds: ['B', 'A'] }), false);
  assert.equal(hasUnsavedChanges({ needIds: ['A', 'B'] }, { needIds: ['B'] }), true);
  assert.equal(hasUnsavedChanges({ needIds: ['A', 'B'] }, { needIds: ['A', 'C'] }), true);
});
