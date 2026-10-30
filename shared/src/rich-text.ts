// Description mise en forme d'une action (ticket 07) : sous-ensemble de Markdown
// enregistré tel quel. Il est lu ici en arbre, affiché élément par élément par le
// web et le mobile : jamais interprété comme du HTML.

export type RichInline =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: RichInline[] }
  | { type: 'italic'; children: RichInline[] }
  /** Adresse http, https ou mailto seulement. */
  | { type: 'link'; href: string; text: string }
  /** Référence écrite telle quelle (ticket 10, ex. CRM-EX-012), que l'affichage relie à son objet. */
  | { type: 'reference'; reference: string };

export type RichBlock =
  | { type: 'heading'; level: 1 | 2 | 3; content: RichInline[] }
  /** Lignes d'un paragraphe : les retours à la ligne sont gardés. */
  | { type: 'paragraph'; lines: RichInline[][] }
  | { type: 'list'; ordered: boolean; items: RichInline[][] };

const HEADING = /^(#{1,3}) +(.*)$/;
const BULLET_ITEM = /^[-*] +(.*)$/;
const NUMBERED_ITEM = /^\d+[.)] +(.*)$/;

export function parseRichText(source: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  // Bloc en cours, que les lignes suivantes prolongent.
  let open: Extract<RichBlock, { type: 'paragraph' | 'list' }> | null = null;
  for (const line of source.split(/\r?\n/)) {
    const heading = HEADING.exec(line) as [string, string, string] | null;
    const bullet = BULLET_ITEM.exec(line) as [string, string] | null;
    const numbered = NUMBERED_ITEM.exec(line) as [string, string] | null;
    if (!line.trim()) {
      open = null;
    } else if (heading) {
      open = null;
      blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3, content: parseInline(heading[2]) });
    } else if (bullet || numbered) {
      const ordered = !bullet;
      if (open?.type !== 'list' || open.ordered !== ordered) {
        open = { type: 'list', ordered, items: [] };
        blocks.push(open);
      }
      open.items.push(parseInline((bullet ?? numbered)![1]));
    } else {
      if (open?.type !== 'paragraph') {
        open = { type: 'paragraph', lines: [] };
        blocks.push(open);
      }
      open.lines.push(parseInline(line));
    }
  }
  return blocks;
}

const LINK = /^\[([^\]\n]+)\]\(([^)\s]+)\)/;
const SAFE_HREF = /^(https?:\/\/|mailto:)/i;
/** CODE-ACRONYME-NUMÉRO (references.ts), ni précédé ni suivi d'une lettre, d'un chiffre ou d'un tiret. */
const REFERENCE = /^[A-Z][A-Z0-9]{1,9}-[A-Z]{2,4}-\d{3,}(?![\p{L}\p{N}_-])/u;
const WORD_CHAR = /[\p{L}\p{N}_-]/u;

/** Référence qui commence à la position `i` du texte, ou null. */
function referenceAt(text: string, i: number): string | null {
  if (i > 0 && WORD_CHAR.test(text[i - 1]!)) return null;
  return REFERENCE.exec(text.slice(i))?.[0] ?? null;
}

/** Texte sans mise en forme (description d'une initiative) : les références y sont reconnues, le reste gardé tel quel. */
export function splitReferences(text: string): Extract<RichInline, { type: 'text' | 'reference' }>[] {
  const nodes: Extract<RichInline, { type: 'text' | 'reference' }>[] = [];
  let i = 0;
  while (i < text.length) {
    const reference = referenceAt(text, i);
    if (reference) {
      nodes.push({ type: 'reference', reference });
      i += reference.length;
      continue;
    }
    const last = nodes.at(-1);
    if (last?.type === 'text') last.text += text[i];
    else nodes.push({ type: 'text', text: text[i]! });
    i++;
  }
  return nodes;
}

/** `**gras**`, `*italique*`, `[texte](adresse)`, références ; une marque sans fin reste du texte. */
function parseInline(text: string): RichInline[] {
  const nodes: RichInline[] = [];
  const pushText = (chunk: string) => {
    const last = nodes.at(-1);
    if (last?.type === 'text') last.text += chunk;
    else nodes.push({ type: 'text', text: chunk });
  };
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    const link = LINK.exec(rest) as [string, string, string] | null;
    if (link && SAFE_HREF.test(link[2])) {
      nodes.push({ type: 'link', href: link[2], text: link[1] });
      i += link[0].length;
      continue;
    }
    const reference = referenceAt(text, i);
    if (reference) {
      nodes.push({ type: 'reference', reference });
      i += reference.length;
      continue;
    }
    const marker = rest.startsWith('**') ? '**' : rest.startsWith('*') ? '*' : null;
    const end = marker ? closingMarker(text, i + marker.length, marker) : -1;
    if (marker && end > 0) {
      const children = parseInline(text.slice(i + marker.length, end));
      nodes.push(marker === '**' ? { type: 'bold', children } : { type: 'italic', children });
      i = end + marker.length;
      continue;
    }
    pushText(marker ?? text[i]!);
    i += marker?.length ?? 1;
  }
  return nodes;
}

/**
 * Position de la marque qui ferme celle ouverte juste avant `start`, ou -1. Le
 * contenu ne commence ni ne finit par une espace (« 2 * 3 » n'est pas une marque).
 */
function closingMarker(text: string, start: number, marker: '*' | '**'): number {
  if (!text[start] || /\s/.test(text[start])) return -1;
  for (let j = text.indexOf(marker, start + 1); j > 0; j = text.indexOf(marker, j + 1)) {
    if (marker === '*' && (text[j + 1] === '*' || text[j - 1] === '*')) continue;
    // « ***» en fin de gras italique : le gras se ferme sur les deux dernières.
    while (marker === '**' && text[j + 2] === '*') j++;
    if (!/\s/.test(text[j - 1]!)) return j;
  }
  return -1;
}

/** Boutons de la barre d'outils de saisie. */
export const RICH_TEXT_FORMATS = ['bold', 'italic', 'heading', 'bulletList', 'numberedList', 'link'] as const;
export type RichTextFormat = (typeof RICH_TEXT_FORMATS)[number];

export interface TextSelection {
  start: number;
  end: number;
}

/** Applique un bouton de la barre d'outils au texte saisi ; renvoie le texte et la nouvelle sélection. */
export function applyFormat(
  source: string,
  selection: TextSelection,
  format: RichTextFormat,
): { text: string; selection: TextSelection } {
  const { start, end } = selection;
  const selected = source.slice(start, end);
  const around = (before: string, inner: string, after: string, select: TextSelection) => ({
    text: source.slice(0, start) + before + inner + after + source.slice(end),
    selection: select,
  });
  switch (format) {
    case 'bold':
    case 'italic': {
      const marker = format === 'bold' ? '**' : '*';
      return around(marker, selected, marker, { start: start + marker.length, end: end + marker.length });
    }
    case 'link': {
      const url = 'https://';
      const urlStart = start + selected.length + 3;
      return around('[', selected, `](${url})`, { start: urlStart, end: urlStart + url.length });
    }
    default: {
      // Lignes entières touchées par la sélection.
      const lineStart = start === 0 ? 0 : source.lastIndexOf('\n', start - 1) + 1;
      const nextBreak = source.indexOf('\n', end);
      const lineEnd = nextBreak < 0 ? source.length : nextBreak;
      const lines = source
        .slice(lineStart, lineEnd)
        .split('\n')
        .map((line, index) => `${format === 'heading' ? '## ' : format === 'bulletList' ? '- ' : `${index + 1}. `}${line}`)
        .join('\n');
      return {
        text: source.slice(0, lineStart) + lines + source.slice(lineEnd),
        selection: { start: lineStart, end: lineStart + lines.length },
      };
    }
  }
}
