// Contenu d'une page en lecture seule (ticket 22, ADR-0019) : le JSON de Tiptap
// affiché nœud par nœud, sans charger l'éditeur et sans jamais l'interpréter comme
// du HTML. Les références, restées du texte, sont reliées à leur objet.
import { isSafePageHref, type PageDoc, type PageMark, type PageNode, splitReferences } from '@app/shared';
import type { ReactNode } from 'react';
import { ReferenceMention } from './references';

export function PageContent({ doc }: { doc: PageDoc }) {
  return <div className="page-content">{renderChildren(doc)}</div>;
}

const renderChildren = (node: PageNode): ReactNode[] => (node.content ?? []).map((child, i) => renderNode(child, i));

/** Nombre entier positif d'un attribut, sinon `fallback`. */
function positiveInt(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

function renderNode(node: PageNode, key: number): ReactNode {
  switch (node.type) {
    case 'paragraph':
      return <p key={key}>{renderChildren(node)}</p>;
    case 'heading': {
      const level = node.attrs?.level;
      const Tag = level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4';
      return <Tag key={key}>{renderChildren(node)}</Tag>;
    }
    case 'bulletList':
      return <ul key={key}>{renderChildren(node)}</ul>;
    case 'orderedList':
      return (
        <ol key={key} start={positiveInt(node.attrs?.start, 1)}>
          {renderChildren(node)}
        </ol>
      );
    case 'listItem':
      return <li key={key}>{renderChildren(node)}</li>;
    case 'hardBreak':
      return <br key={key} />;
    case 'table':
      return (
        <div key={key} className="page-table">
          <table>
            <tbody>{renderChildren(node)}</tbody>
          </table>
        </div>
      );
    case 'tableRow':
      return <tr key={key}>{renderChildren(node)}</tr>;
    case 'tableHeader':
    case 'tableCell': {
      const Cell = node.type === 'tableHeader' ? 'th' : 'td';
      return (
        <Cell key={key} colSpan={positiveInt(node.attrs?.colspan, 1)} rowSpan={positiveInt(node.attrs?.rowspan, 1)}>
          {renderChildren(node)}
        </Cell>
      );
    }
    case 'text':
      return <Text key={key} text={node.text ?? ''} marks={node.marks ?? []} />;
    case 'doc':
      return null;
  }
}

/** Texte et ses marques ; un lien garde le texte tel quel, sans relier les références qu'il contient. */
function Text({ text, marks }: { text: string; marks: readonly PageMark[] }) {
  const link = marks.find((m) => m.type === 'link');
  const href = link?.attrs?.href;
  let content: ReactNode =
    link && isSafePageHref(href) ? (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {text}
      </a>
    ) : (
      splitReferences(text).map((part, i) =>
        part.type === 'reference' ? <ReferenceMention key={i} reference={part.reference} /> : part.text,
      )
    );
  if (marks.some((m) => m.type === 'italic')) content = <em>{content}</em>;
  if (marks.some((m) => m.type === 'bold')) content = <strong>{content}</strong>;
  return <>{content}</>;
}
