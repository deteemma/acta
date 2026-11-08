// Éditeur de page (ticket 22, décision 08, ADR-0019) : Tiptap, dans le rendu final,
// avec une barre d'outils sur les tokens de design. Chargé à la demande (import
// dynamique depuis pages-screen.tsx) : le reste d'ACTA ne charge pas Tiptap.
import { isSafePageHref, type PageDoc, type ReferenceDto, searchReferences } from '@app/shared';
import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { EditorContent, type Editor, useEditor, useEditorState } from '@tiptap/react';
import Suggestion, { exitSuggestion, type SuggestionProps } from '@tiptap/suggestion';
import {
  Bold,
  Hash,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListOrdered,
  Redo2,
  Table,
  Undo2,
  Unlink,
} from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { useI18n } from './i18n';
import { pageExtensions } from './page-editor-extensions';

/** Références proposées à la saisie de `#` : au plus ce nombre. */
const SUGGESTION_LIMIT = 8;
const referenceSuggestionKey = new PluginKey('referenceSuggestion');

interface SuggestionState {
  items: ReferenceDto[];
  active: number;
  rect: DOMRect | null;
  select: (item: ReferenceDto) => void;
}

/**
 * Pont entre Tiptap, qui garde ses extensions et ses rappels d'une frappe à
 * l'autre, et le composant React, qui les renouvelle à chaque rendu.
 */
class EditorBridge {
  references: readonly ReferenceDto[] = [];
  /** Le bouton « Référence » ouvre la liste sans attendre de lettre. */
  openedByButton = false;
  suggestion: SuggestionState | null = null;
  onReady: (doc: PageDoc) => void = () => undefined;
  onChange: (doc: PageDoc) => void = () => undefined;
  onSuggestion: (state: SuggestionState | null) => void = () => undefined;

  /** Rappels et références du dernier rendu. */
  connect(props: Pick<EditorBridge, 'references' | 'onReady' | 'onChange' | 'onSuggestion'>) {
    Object.assign(this, props);
  }

  openByButton() {
    this.openedByButton = true;
  }

  showSuggestion(next: SuggestionState | null) {
    this.suggestion = next;
    this.onSuggestion(next);
  }
}

/** `#` suivi de quelques lettres propose tickets, exigences, besoins et pages ; Entrée insère la référence, en texte. */
function referenceSuggestion(bridge: EditorBridge) {
  return Extension.create({
    name: 'referenceSuggestion',
    addProseMirrorPlugins() {
      return [
        Suggestion<ReferenceDto, ReferenceDto>({
          editor: this.editor,
          pluginKey: referenceSuggestionKey,
          char: '#',
          allowSpaces: false,
          items: ({ query }) => searchReferences(bridge.references, query).slice(0, SUGGESTION_LIMIT),
          command: ({ editor, range, props }) => {
            editor
              .chain()
              .focus()
              .insertContentAt(range, [{ type: 'text', text: `${props.reference} ` }])
              .run();
          },
          render: () => {
            // `# ` en début de ligne fait un titre : la liste n'apparaît qu'après une lettre.
            const update = (props: SuggestionProps<ReferenceDto, ReferenceDto>) => {
              const visible = props.query.length > 0 || bridge.openedByButton;
              bridge.showSuggestion(
                visible
                  ? {
                      items: props.items,
                      active: Math.min(bridge.suggestion?.active ?? 0, Math.max(props.items.length - 1, 0)),
                      rect: props.clientRect?.() ?? null,
                      select: (item) => props.command(item),
                    }
                  : null,
              );
            };
            return {
              onStart: update,
              onUpdate: update,
              onExit: () => {
                bridge.openedByButton = false;
                bridge.showSuggestion(null);
              },
              onKeyDown: ({ event }) => {
                const current = bridge.suggestion;
                if (!current || current.items.length === 0) return false;
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  const step = event.key === 'ArrowDown' ? 1 : -1;
                  bridge.showSuggestion({ ...current, active: (current.active + step + current.items.length) % current.items.length });
                  return true;
                }
                if (event.key === 'Enter' || event.key === 'Tab') {
                  current.select(current.items[current.active]!);
                  return true;
                }
                return false;
              },
            };
          },
        }),
      ];
    },
  });
}

export default function PageEditor({
  initialContent,
  references,
  label,
  onReady,
  onChange,
}: {
  initialContent: PageDoc | null;
  /** Références proposées, dans l'ordre où les montrer. */
  references: readonly ReferenceDto[];
  /** Nom accessible de la zone d'écriture. */
  label: string;
  /** Contenu tel que l'éditeur le lit à l'ouverture : point de comparaison des modifications. */
  onReady: (doc: PageDoc) => void;
  onChange: (doc: PageDoc) => void;
}) {
  const { t } = useI18n();
  const [suggestion, setSuggestion] = useState<SuggestionState | null>(null);
  // Rappels connus dès la création : Tiptap peut signaler qu'il est prêt avant le premier effet.
  const [bridge] = useState(() => {
    const created = new EditorBridge();
    created.connect({ references, onReady, onChange, onSuggestion: setSuggestion });
    return created;
  });

  useEffect(() => {
    bridge.connect({ references, onReady, onChange, onSuggestion: setSuggestion });
  }, [bridge, references, onReady, onChange]);

  const editor = useEditor({
    extensions: [...pageExtensions(), referenceSuggestion(bridge)],
    content: initialContent,
    shouldRerenderOnTransaction: false,
    editorProps: { attributes: { 'aria-label': label, 'aria-multiline': 'true', role: 'textbox', class: 'page-content' } },
    onCreate: ({ editor }) => bridge.onReady(editor.getJSON() as PageDoc),
    onUpdate: ({ editor }) => bridge.onChange(editor.getJSON() as PageDoc),
  });

  function insertReference() {
    const { from } = editor.state.selection;
    const before = editor.state.doc.textBetween(Math.max(0, from - 1), from, '\n', '\n');
    bridge.openByButton();
    editor.chain().focus().insertContent(before === '' || /\s/.test(before) ? '#' : ' #').run();
  }

  return (
    <div className="page-editor">
      <Toolbar
        editor={editor}
        onReference={insertReference}
        onEscapeSuggestion={() => exitSuggestion(editor.view, referenceSuggestionKey)}
      />
      <EditorContent editor={editor} />
      {suggestion && (
        <ul
          className="reference-suggestions"
          role="listbox"
          aria-label={t('page.referenceSuggestions')}
          style={suggestion.rect ? { top: suggestion.rect.bottom + 4, left: suggestion.rect.left } : undefined}
        >
          {suggestion.items.length === 0 && <li className="reference-suggestions-empty">{t('page.noReference')}</li>}
          {suggestion.items.map((item, index) => (
            <li
              key={item.id}
              role="option"
              aria-selected={index === suggestion.active}
              // Le clic ne doit pas retirer le focus de l'éditeur avant l'insertion.
              onMouseDown={(e) => {
                e.preventDefault();
                suggestion.select(item);
              }}
            >
              <strong>{item.reference}</strong> {item.title} <small>· {t(`referenceCategory.${item.category}`)}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Toolbar({
  editor,
  onReference,
  onEscapeSuggestion,
}: {
  editor: Editor;
  onReference: () => void;
  onEscapeSuggestion: () => void;
}) {
  const { t } = useI18n();
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  const [linkError, setLinkError] = useState(false);
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      link: e.isActive('link'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      table: e.isActive('table'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  function applyLink() {
    const value = (linkDraft ?? '').trim();
    const href = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
    if (!value || !isSafePageHref(href)) {
      setLinkError(true);
      return;
    }
    if (editor.state.selection.empty && !state.link) {
      chain().insertContent({ type: 'text', text: value, marks: [{ type: 'link', attrs: { href } }] }).run();
    } else {
      chain().extendMarkRange('link').setLink({ href }).run();
    }
    setLinkDraft(null);
  }

  const tool = (key: string, icon: ReactNode, active: boolean, run: () => void, disabled = false) => (
    <button
      type="button"
      className={active ? 'active' : undefined}
      aria-pressed={active}
      title={t(`page.tool.${key}` as Parameters<typeof t>[0])}
      aria-label={t(`page.tool.${key}` as Parameters<typeof t>[0])}
      disabled={disabled}
      onClick={run}
    >
      {icon}
    </button>
  );

  return (
    <div className="page-toolbar" role="toolbar" aria-label={t('page.toolbar')} onKeyDown={(e) => e.key === 'Escape' && onEscapeSuggestion()}>
      <span className="page-toolbar-group">
        {tool('h1', <Heading1 />, state.h1, () => chain().toggleHeading({ level: 1 }).run())}
        {tool('h2', <Heading2 />, state.h2, () => chain().toggleHeading({ level: 2 }).run())}
        {tool('h3', <Heading3 />, state.h3, () => chain().toggleHeading({ level: 3 }).run())}
      </span>
      <span className="page-toolbar-group">
        {tool('bold', <Bold />, state.bold, () => chain().toggleBold().run())}
        {tool('italic', <Italic />, state.italic, () => chain().toggleItalic().run())}
        {tool('link', <Link />, state.link, () => {
          setLinkError(false);
          setLinkDraft(linkDraft === null ? ((editor.getAttributes('link').href as string | undefined) ?? '') : null);
        })}
        {state.link && tool('unlink', <Unlink />, false, () => chain().extendMarkRange('link').unsetLink().run())}
      </span>
      <span className="page-toolbar-group">
        {tool('bulletList', <List />, state.bulletList, () => chain().toggleBulletList().run())}
        {tool('orderedList', <ListOrdered />, state.orderedList, () => chain().toggleOrderedList().run())}
        {tool('table', <Table />, state.table, () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), state.table)}
      </span>
      <span className="page-toolbar-group">
        <button type="button" title={t('page.tool.reference')} onClick={onReference}>
          <Hash />
          {t('page.tool.reference')}
        </button>
      </span>
      <span className="page-toolbar-group">
        {tool('undo', <Undo2 />, false, () => chain().undo().run(), !state.canUndo)}
        {tool('redo', <Redo2 />, false, () => chain().redo().run(), !state.canRedo)}
      </span>
      {state.table && (
        <span className="page-toolbar-group page-toolbar-table" aria-label={t('page.tool.tableGroup')} role="group">
          <button type="button" onClick={() => chain().addRowAfter().run()}>{t('page.tool.addRow')}</button>
          <button type="button" onClick={() => chain().deleteRow().run()}>{t('page.tool.deleteRow')}</button>
          <button type="button" onClick={() => chain().addColumnAfter().run()}>{t('page.tool.addColumn')}</button>
          <button type="button" onClick={() => chain().deleteColumn().run()}>{t('page.tool.deleteColumn')}</button>
          <button type="button" className="danger" onClick={() => chain().deleteTable().run()}>{t('page.tool.deleteTable')}</button>
        </span>
      )}
      {linkDraft !== null && (
        // Pas de <form> : la barre est dans le formulaire de la page.
        <div className="page-link-form" role="group" aria-label={t('page.tool.link')}>
          <input
            autoFocus
            type="text"
            inputMode="url"
            aria-label={t('page.tool.linkAddress')}
            placeholder="https://"
            value={linkDraft}
            aria-invalid={linkError}
            onChange={(e) => {
              setLinkDraft(e.target.value);
              setLinkError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyLink();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setLinkDraft(null);
                editor.commands.focus();
              }
            }}
          />
          <button type="button" onClick={applyLink}>
            {t('page.tool.linkApply')}
          </button>
          {linkError && <small className="error">{t('page.tool.linkInvalid')}</small>}
        </div>
      )}
    </div>
  );
}
