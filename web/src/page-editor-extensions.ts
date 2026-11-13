// Extensions de l'éditeur de page (ticket 22, décision 08 point 2, ADR-0019) :
// exactement la mise en forme de PAGE_NODE_TYPES et PAGE_MARK_TYPES (@app/shared).
// Tout le reste est désactivé, pour qu'un collage depuis Word n'apporte rien
// d'autre. Importé seulement par l'éditeur, chargé à la demande.
import { isSafePageHref, PAGE_HEADING_LEVELS, splitReferences } from '@app/shared';
import { Extension, Node } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { TableKit } from '@tiptap/extension-table';
import StarterKit from '@tiptap/starter-kit';

/** Adresse affichable d'une image du texte (`attachmentId`, ou `upload:<clé>` avant l'enregistrement). */
export type ImageResolver = (attachmentId: string) => Promise<string | 'deleted' | 'unavailable'>;

/**
 * Image du texte (ticket 26) : bloc qui désigne sa pièce jointe par son seul
 * identifiant, enregistré tel quel dans le JSON (`attrs.attachmentId`), jamais par
 * une adresse. Un collage depuis une autre application n'apporte aucune image par
 * son HTML : seuls les fichiers image collés ou déposés s'insèrent (page-editor.tsx).
 */
const PageImage = Node.create<{ resolve: ImageResolver | null; labels: { image: string; deleted: string; unavailable: string } }>({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  // Sans `resolve` (test de compatibilité), aucune vue n'est créée : les libellés ne servent pas.
  addOptions: () => ({ resolve: null, labels: { image: '', deleted: '', unavailable: '' } }),
  addAttributes: () => ({
    attachmentId: {
      default: null,
      parseHTML: (element) => element.getAttribute('data-attachment-id'),
      renderHTML: (attributes) => ({ 'data-attachment-id': attributes.attachmentId as string }),
    },
  }),
  parseHTML: () => [{ tag: 'img[data-attachment-id]' }],
  renderHTML: ({ HTMLAttributes }) => ['img', HTMLAttributes],
  addNodeView() {
    const { resolve, labels } = this.options;
    if (!resolve) return null;
    return ({ node }) => {
      const dom = document.createElement('p');
      dom.className = 'page-image';
      dom.contentEditable = 'false';
      const id = node.attrs.attachmentId as string | null;
      if (id) {
        void resolve(id).then((state) => {
          if (state === 'deleted' || state === 'unavailable') {
            const note = document.createElement('small');
            note.textContent = state === 'deleted' ? labels.deleted : labels.unavailable;
            dom.classList.add('page-image-missing');
            dom.append(note);
          } else {
            const img = document.createElement('img');
            img.src = state;
            img.alt = labels.image;
            dom.append(img);
          }
        });
      }
      return { dom };
    };
  },
});

export function pageExtensions(images?: { resolve: ImageResolver; labels: { image: string; deleted: string; unavailable: string } }) {
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
    images ? PageImage.configure(images) : PageImage,
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
