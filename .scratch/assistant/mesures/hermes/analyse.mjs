// Analyse les requêtes et réponses consignées par le relais (essai du ticket 10).
import { readFileSync } from 'node:fs';
const dir = process.argv[2];
for (const n of process.argv.slice(3)) {
  const t = readFileSync(`${dir}/${n}-requete.txt`, 'utf8');
  const b = JSON.parse(t.slice(t.indexOf('\n') + 1));
  const { messages, tools, ...reste } = b;
  console.log(`== ${n}`, JSON.stringify(reste));
  console.log(' outils:', tools ? tools.length : 'absent', '| messages:', messages.map((m) => `${m.role}:${(m.content || '').length}`).join(' '));
  const r = readFileSync(`${dir}/${n}-reponse.txt`, 'utf8');
  let usage = null; let reflexion = 0; let texte = '';
  try {
    const j = JSON.parse(r); usage = j.usage;
    const m = j.choices[0].message; reflexion = (m.reasoning || m.reasoning_content || '').length; texte = m.content || '';
  } catch {
    for (const l of r.split('\n')) {
      if (!l.startsWith('data: ') || l.includes('[DONE]')) continue;
      const j = JSON.parse(l.slice(6)); if (j.usage) usage = j.usage;
      const d = j.choices?.[0]?.delta || {}; reflexion += (d.reasoning || d.reasoning_content || '').length; texte += d.content || '';
    }
  }
  console.log(' usage:', JSON.stringify(usage), '| réflexion (car.):', reflexion, '| réponse:', JSON.stringify(texte.slice(0, 160)));
}
