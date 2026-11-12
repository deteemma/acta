// Génère la migration 0026 à partir du document de relecture validé (ticket 28).
// Usage, depuis la racine, après « pnpm --filter @app/shared build » :
//   node scripts/generer-modeles-de-page.mjs
// Chaque modèle passe pageContentSchema (@app/shared) avant d'être écrit.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const docPath = '.scratch/phase-2/28-modeles-de-page-relecture.md';
const sharedPath = 'shared/dist/index.js';
const outPath = 'api/migrations/0026_modeles_de_page_livres.sql';
const { pageContentSchema } = await import(pathToFileURL(sharedPath).href);
const typo = (s) => s.replace(/'/g, '’');
const text = (t, italic = false) => ({ type: 'text', text: typo(t), ...(italic ? { marks: [{ type: 'italic' }] } : {}) });
const para = (t, italic) => ({ type: 'paragraph', content: [text(t, italic)] });
const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

const lines = readFileSync(docPath, 'utf8').replace(/\r/g, '').split('\n');
const templates = [];
let tpl = null;
let lang = null;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let m;
  if ((m = line.match(/^### (\d\.\d) — (.+) · \*(.+)\*$/))) {
    tpl = { task: m[1], name: { fr: typo(m[2]), en: typo(m[3]) }, content: { fr: [], en: [] } };
    templates.push(tpl);
    lang = null;
  } else if (/^## /.test(line)) {
    tpl = null;
  } else if (!tpl) {
    continue;
  } else if (line === '**Français**') lang = 'fr';
  else if (line === '**English**') lang = 'en';
  else if (!lang || line.trim() === '' || line.startsWith('Tâche : ')) continue;
  else if ((m = line.match(/^#### (.+)$/))) tpl.content[lang].push({ type: 'heading', attrs: { level: 2 }, content: [text(m[1])] });
  else if ((m = line.match(/^\*(.+)\*$/))) tpl.content[lang].push(para(m[1], true));
  else if (line.startsWith('|')) {
    const head = cells(line);
    if (!/^\|[-|]+\|$/.test(lines[i + 1] ?? '')) throw new Error(`tableau sans séparateur : ${line}`);
    i++;
    const row = (type, values) => ({ type: 'tableRow', content: values.map((v) => ({ type, content: [v ? para(v) : { type: 'paragraph' }] })) });
    tpl.content[lang].push({ type: 'table', content: [row('tableHeader', head), row('tableCell', head.map(() => ''))] });
  } else throw new Error(`ligne non reconnue (${tpl.task}, ${lang}) : ${line}`);
}

if (templates.length !== 22) throw new Error(`${templates.length} modèles au lieu de 22`);
const q = (s) => `'${s.replace(/'/g, "''")}'`;
const rows = templates.map((t, n) => {
  const docs = {};
  for (const l of ['fr', 'en']) {
    if (t.content[l].length === 0) throw new Error(`${t.task} ${l} vide`);
    docs[l] = { type: 'doc', content: t.content[l] };
    const r = pageContentSchema.safeParse(docs[l]);
    if (!r.success) throw new Error(`${t.task} ${l} invalide : ${r.error.message}`);
  }
  const id = `5f1e2d3c-0028-4a00-8000-${String(n + 1).padStart(12, '0')}`;
  return `  (${q(id)}, ${q(t.task)}, ${q(t.name.fr)}, ${q(t.name.en)},\n   ${q(JSON.stringify(docs.fr))}::jsonb,\n   ${q(JSON.stringify(docs.en))}::jsonb, 'delivered')`;
});

const sql = `-- Les 22 modèles de page livrés (phase 2, ticket 28, décision 09 points 1 à 3).
-- Noms officiels des livrables du BABOK v3 en français et en anglais ; plans et
-- textes d'aide rédigés pour ACTA, sans texte de l'IIBA (ADR-0012), validés par la
-- responsable fonctionnelle le 12.11.2026.
--
-- Généré par scripts/generer-modeles-de-page.mjs depuis le document de relecture
-- .scratch/phase-2/28-modeles-de-page-relecture.md :
-- un titre de niveau 4 devient un titre de niveau 2, un paragraphe en italique un
-- texte d'aide, un tableau un tableau à remplir (une ligne vide sous l'en-tête).

INSERT INTO page_template (id, task_id, name_fr, name_en, content_fr, content_en, origin) VALUES
${rows.join(',\n')};

-- Retrait des deux modèles d'essai du ticket 27 : supprimés s'ils n'ont jamais
-- servi ; sinon désactivés, car un modèle qui a servi ne se supprime pas
-- (décision 09, point 6) ; les pages créées gardent leur mention « … (essai) ».
DELETE FROM page_template t
 WHERE t.id IN ('5f1e2d3c-0027-4a00-8000-000000000301', '5f1e2d3c-0027-4a00-8000-000000000601')
   AND NOT EXISTS (SELECT 1 FROM page p WHERE p.template_id = t.id);
UPDATE page_template SET active = false
 WHERE id IN ('5f1e2d3c-0027-4a00-8000-000000000301', '5f1e2d3c-0027-4a00-8000-000000000601');
`;
writeFileSync(outPath, sql);
console.log(`${templates.length} modèles écrits dans ${outPath}`);
