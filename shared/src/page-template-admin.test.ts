import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type AdminPageTemplateDto,
  checkPageTemplateCreation,
  checkPageTemplateDeletion,
  checkPageTemplateUpdate,
  pageTemplateInputSchema,
} from './page-template-admin.js';
import type { PageTemplateDto } from './page-templates.js';

const doc = { type: 'doc' as const, content: [] };
function template(id: string, taskId: string | null, fr: string, en: string, active = true): PageTemplateDto {
  return { id, name: { fr, en }, content: { fr: doc, en: doc }, taskId, origin: 'delivered', active };
}

const words = (text: string) => ({ type: 'doc' as const, content: [{ type: 'paragraph' as const, content: [{ type: 'text' as const, text }] }] });
const input = (fr: string, en: string, taskId: string | null = null) => ({
  name: { fr, en },
  content: { fr: words('Contexte'), en: words('Context') },
  taskId,
});

test('un modèle ajouté ne reprend pas le nom d’un autre modèle, dans aucune langue, accents et majuscules ignorés', () => {
  const templates = [template('etat', '6.1', 'Description de l’état actuel', 'Current State Description')];
  assert.equal(checkPageTemplateCreation(templates, input('DESCRIPTION DE L’ETAT ACTUEL', 'Other'), ['3.1']), 'nameTaken');
  assert.equal(checkPageTemplateCreation(templates, input('Autre', ' current state description '), ['3.1']), 'nameTaken');
  assert.equal(checkPageTemplateCreation(templates, input('Compte rendu', 'Minutes'), ['3.1']), null);
});

test('un modèle ajouté a un nom et un contenu d’au moins un mot dans chaque langue, sans image', () => {
  assert.equal(pageTemplateInputSchema.safeParse(input('Compte rendu', 'Minutes')).success, true);
  const blank = { ...input('Compte rendu', 'Minutes'), content: { fr: words('Contexte'), en: words('   ') } };
  assert.equal(pageTemplateInputSchema.safeParse(blank).success, false);
  const empty = { ...input('Compte rendu', 'Minutes'), content: { fr: { type: 'doc', content: [{ type: 'paragraph' }] }, en: words('Context') } };
  assert.equal(pageTemplateInputSchema.safeParse(empty).success, false);
  const image = {
    ...input('Compte rendu', 'Minutes'),
    content: {
      fr: { type: 'doc', content: [...words('Contexte').content, { type: 'image', attrs: { attachmentId: '5f1e2d3c-0027-4a00-8000-000000000301' } }] },
      en: words('Context'),
    },
  };
  assert.equal(pageTemplateInputSchema.safeParse(image).success, false);
  assert.equal(pageTemplateInputSchema.safeParse(input(' ', 'Minutes')).success, false);
  assert.deepEqual(pageTemplateInputSchema.parse(input(' Compte rendu ', 'Minutes')).name, { fr: 'Compte rendu', en: 'Minutes' });
});

const added = (id: string, fr: string, en: string, used = false): AdminPageTemplateDto => ({
  ...template(id, null, fr, en),
  origin: 'added',
  used,
});
const delivered = (id: string, fr: string, en: string): AdminPageTemplateDto => ({ ...template(id, '6.1', fr, en), used: true });

test('un modèle livré se désactive et se réactive, mais ne se modifie pas', () => {
  const templates = [delivered('etat', 'État actuel', 'Current State')];
  assert.equal(checkPageTemplateUpdate(templates, 'etat', { active: false }, ['6.1']), null);
  assert.equal(checkPageTemplateUpdate(templates, 'etat', { active: true }, ['6.1']), null);
  assert.equal(checkPageTemplateUpdate(templates, 'etat', input('État', 'State'), ['6.1']), 'deliveredTemplateLocked');
  assert.equal(checkPageTemplateUpdate(templates, 'inconnu', { active: false }, ['6.1']), 'unknownTemplate');
});

test('un modèle ajouté se modifie, change de tâche et se désactive ; il garde son propre nom, pas celui d’un autre', () => {
  const templates = [delivered('etat', 'État actuel', 'Current State'), added('cr', 'Compte rendu', 'Minutes')];
  assert.equal(checkPageTemplateUpdate(templates, 'cr', input('Compte rendu', 'Minutes', '6.1'), ['6.1']), null);
  assert.equal(checkPageTemplateUpdate(templates, 'cr', input('Etat actuel', 'Minutes'), ['6.1']), 'nameTaken');
  assert.equal(checkPageTemplateUpdate(templates, 'cr', input('Compte rendu', 'Minutes', '9.9'), ['6.1']), 'unknownTask');
  assert.equal(checkPageTemplateUpdate(templates, 'cr', { active: false }, ['6.1']), null);
});

test('seul un modèle ajouté qui n’a jamais servi se supprime', () => {
  const templates = [delivered('etat', 'État', 'State'), added('neuf', 'Neuf', 'New'), added('servi', 'Servi', 'Used', true)];
  assert.equal(checkPageTemplateDeletion(templates, 'neuf'), null);
  assert.equal(checkPageTemplateDeletion(templates, 'servi'), 'templateUsed');
  assert.equal(checkPageTemplateDeletion(templates, 'etat'), 'deliveredTemplateLocked');
  assert.equal(checkPageTemplateDeletion(templates, 'inconnu'), 'unknownTemplate');
});
