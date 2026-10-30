// Texte mis en forme d'une action (ticket 07) : affiché élément par élément
// d'après l'arbre de @app/shared (rich-text.ts), saisi avec une barre d'outils.
import {
  applyFormat,
  parseRichText,
  RICH_TEXT_FORMATS,
  type RichInline,
  type RichTextFormat,
  type TextSelection,
} from '@app/shared';
import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { useI18n } from './i18n';

function Inlines({ nodes }: { nodes: RichInline[] }) {
  return nodes.map((node, index) => {
    switch (node.type) {
      case 'text':
        return <Fragment key={index}>{node.text}</Fragment>;
      case 'bold':
        return <strong key={index}><Inlines nodes={node.children} /></strong>;
      case 'italic':
        return <em key={index}><Inlines nodes={node.children} /></em>;
      case 'link':
        return (
          <a key={index} href={node.href} target="_blank" rel="noopener noreferrer">
            {node.text}
          </a>
        );
    }
  });
}

/** Les titres commencent sous celui du panneau (h2). */
const HEADING_TAGS = { 1: 'h3', 2: 'h4', 3: 'h5' } as const;

export function RichText({ source }: { source: string }) {
  return (
    <div className="rich-text">
      {parseRichText(source).map((block, index) => {
        switch (block.type) {
          case 'heading': {
            const Tag = HEADING_TAGS[block.level];
            return <Tag key={index}><Inlines nodes={block.content} /></Tag>;
          }
          case 'paragraph':
            return (
              <p key={index}>
                {block.lines.map((line, i) => (
                  <Fragment key={i}>
                    {i > 0 && <br />}
                    <Inlines nodes={line} />
                  </Fragment>
                ))}
              </p>
            );
          case 'list': {
            const Tag = block.ordered ? 'ol' : 'ul';
            return (
              <Tag key={index}>
                {block.items.map((item, i) => (
                  <li key={i}><Inlines nodes={item} /></li>
                ))}
              </Tag>
            );
          }
        }
      })}
    </div>
  );
}

/** Symboles des listes et du lien ; gras, italique et titre : initiale du libellé (G/B, I, T/H). */
const FORMAT_SYMBOLS: Partial<Record<RichTextFormat, string>> = { bulletList: '•', numberedList: '1.', link: '🔗' };

/** Saisie : zone de texte et barre d'outils, avec un aperçu du rendu. */
export function RichTextEditor({
  label,
  value,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  // Sélection à rétablir après l'application d'un bouton.
  const pendingSelection = useRef<TextSelection | null>(null);

  useLayoutEffect(() => {
    const selection = pendingSelection.current;
    if (!selection || !ref.current) return;
    pendingSelection.current = null;
    ref.current.focus();
    ref.current.setSelectionRange(selection.start, selection.end);
  });

  function format(f: RichTextFormat) {
    const textarea = ref.current!;
    const result = applyFormat(value, { start: textarea.selectionStart, end: textarea.selectionEnd }, f);
    pendingSelection.current = result.selection;
    onChange(result.text);
  }

  // Une seule étiquette : `label` nomme la zone de texte (pas d'imbrication dans
  // un <label>, qui engloberait aussi les boutons).
  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar" role="toolbar" aria-label={t('richText.toolbar')}>
        <span>{label}</span>
        {!preview &&
          RICH_TEXT_FORMATS.map((f) => (
            <button key={f} type="button" title={t(`richText.${f}`)} aria-label={t(`richText.${f}`)} onClick={() => format(f)}>
              <span className={`format-${f}`}>{FORMAT_SYMBOLS[f] ?? t(`richText.${f}`)[0]}</span>
            </button>
          ))}
        <button type="button" className="link" aria-pressed={preview} onClick={() => setPreview((p) => !p)}>
          {t(preview ? 'richText.edit' : 'richText.preview')}
        </button>
      </div>
      {preview ? (
        <RichText source={value} />
      ) : (
        <>
          <textarea
            ref={ref}
            aria-label={label}
            rows={8}
            maxLength={maxLength}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <small>{t('richText.hint')}</small>
        </>
      )}
    </div>
  );
}
