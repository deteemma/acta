// Extensions de l'éditeur de page (ticket 22, décision 08 point 2, ADR-0019) :
// exactement la mise en forme de PAGE_NODE_TYPES et PAGE_MARK_TYPES (@app/shared).
// Tout le reste est désactivé, pour qu'un collage depuis Word n'apporte rien
// d'autre. Importé seulement par l'éditeur, chargé à la demande.
import { isSafePageHref, PAGE_HEADING_LEVELS, splitReferences } from '@app/shared';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { TableKit } from '@tiptap/extension-table';
import StarterKit from '@tiptap/starter-kit';

export function pageExtensions() {
  return [
    StarterKit.configure({
      blockquote: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      underline: false,
      heading: { levels: [...PAGE_HEADING_LEVELS] },
      link: {
        openOnClick: false,
        autolink: true,
        protocols: ['mailto'],
        defaultProtocol: 'https',
        isAllowedUri: (url) => isSafePageHref(url),
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      },
    }),
    // Pas de largeur de colonne réglable (décision 08, point 2).
    TableKit.configure({ table: { resizable: false } }),
    ReferenceHighlight,
  ];
}

/** Les références saisies restent du texte, mises en valeur pendant l'écriture (décision 08, point 4). */
const ReferenceHighlight = Extension.create({
  name: 'referenceHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('referenceHighlight'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;
              let offset = 0;
              for (const part of splitReferences(node.text)) {
                const length = part.type === 'reference' ? part.reference.length : part.text.length;
                if (part.type === 'reference') {
                  decorations.push(Decoration.inline(pos + offset, pos + offset + length, { class: 'reference-in-editor' }));
                }
                offset += length;
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
