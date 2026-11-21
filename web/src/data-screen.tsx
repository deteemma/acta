// Écran de données (ADR-0021, N11) : à droite de l'arborescence, le fil
// d'Ariane depuis l'initiative, l'en-tête de l'élément (type, référence, titre,
// badges), puis ses onglets ; un seul sous-écran affiché à la fois. Les
// alertes, le référentiel et l'administration (N3) suivent la même présentation.
import type { InitiativeTreeNode } from '@app/shared';
import { type KeyboardEvent, type ReactNode, useRef } from 'react';
import { useI18n } from './i18n';
import { useNodeLabel } from './initiative-tree';
import { SCREEN_TITLE_ID } from './dialogs';

export interface Tab<T extends string> {
  id: T;
  label: string;
  count?: number;
  /** Info-bulle du libellé (ex. terme anglais du BABOK). */
  tooltip?: string;
}

/** Étape du fil d'Ariane. */
export interface Crumb {
  key: string;
  label: string;
  onSelect: () => void;
}

type ScreenProps<T extends string> = {
  /** Type de l'élément, au-dessus du titre ; absent pour un écran hors de l'initiative (alertes…). */
  kind?: ReactNode;
  reference?: string | null;
  title: string;
  /** Info-bulle du titre (ex. nom anglais d'un élément du BABOK). */
  titleTooltip?: string;
  badges?: ReactNode;
  /** Onglets de l'élément ; sans eux, ou avec un seul, pas de barre d'onglets. */
  tabs?: Tab<T>[];
  tab?: T;
  onTab?: (tab: T) => void;
  children: ReactNode;
};

/** Écran d'un élément de l'initiative : le fil d'Ariane part de l'initiative. */
export function DataScreen<T extends string>({
  crumbs,
  onCrumb,
  ...props
}: ScreenProps<T> & {
  /** Nœuds de l'initiative jusqu'au parent de l'élément affiché. */
  crumbs: InitiativeTreeNode[];
  onCrumb: (node: InitiativeTreeNode) => void;
}) {
  const label = useNodeLabel();
  return (
    <ScreenLayout
      {...props}
      crumbs={crumbs.map((node, index) => ({
        key: node.key,
        label: index === 0 ? `${node.reference} · ${label(node)}` : label(node),
        onSelect: () => onCrumb(node),
      }))}
    />
  );
}

/** Fil d'Ariane, en-tête et onglets d'un écran de la zone de droite. */
export function ScreenLayout<T extends string>({
  crumbs,
  kind,
  reference,
  title,
  titleTooltip,
  badges,
  tabs = [],
  tab,
  onTab,
  children,
}: ScreenProps<T> & { crumbs: Crumb[] }) {
  const { t } = useI18n();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  // Onglets : flèches pour se déplacer, Entrée ou Espace pour ouvrir (activation manuelle,
  // l'alerte des modifications non enregistrées pouvant s'interposer).
  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target =
      event.key === 'ArrowRight' ? tabs[(index + 1) % tabs.length]
      : event.key === 'ArrowLeft' ? tabs[(index - 1 + tabs.length) % tabs.length]
      : event.key === 'Home' ? tabs[0]
      : event.key === 'End' ? tabs.at(-1)
      : undefined;
    if (!target) return;
    event.preventDefault();
    tabRefs.current.get(target.id)?.focus();
  }

  return (
    <section className="data-screen" aria-labelledby={SCREEN_TITLE_ID}>
      {crumbs.length > 0 && (
        <nav className="crumbs" aria-label={t('dataScreen.breadcrumb')}>
          <ol>
            {crumbs.map((crumb) => (
              <li key={crumb.key}>
                <button type="button" className="link" onClick={crumb.onSelect}>
                  {crumb.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <header className="data-head">
        {(kind || reference) && (
          <small className="data-kind">
            {kind} {reference && <span className="code">{reference}</span>}
          </small>
        )}
        {/* Reçoit le focus à chaque changement d'élément (useTitleFocus, App.tsx). */}
        <h1 id={SCREEN_TITLE_ID} tabIndex={-1} title={titleTooltip}>
          {title}
        </h1>
        {badges && <div className="data-badges">{badges}</div>}
      </header>
      {tabs.length > 1 && (
        <div className="tabs" role="tablist" aria-label={t('dataScreen.tabs', { title })}>
          {tabs.map((item, index) => (
            <button
              key={item.id}
              ref={(el) => {
                if (el) tabRefs.current.set(item.id, el);
                else tabRefs.current.delete(item.id);
              }}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={item.id === tab}
              aria-controls="tab-panel"
              tabIndex={item.id === tab ? 0 : -1}
              onKeyDown={(e) => onTabKeyDown(e, index)}
              onClick={() => item.id !== tab && onTab?.(item.id)}
            >
              {item.tooltip ? <span title={item.tooltip}>{item.label}</span> : item.label}
              {item.count !== undefined && <span className="tree-count">{item.count}</span>}
            </button>
          ))}
        </div>
      )}
      <div
        className="data-body"
        id="tab-panel"
        role={tabs.length > 1 ? 'tabpanel' : undefined}
        aria-labelledby={tabs.length > 1 ? `tab-${tab}` : undefined}
      >
        {children}
      </div>
    </section>
  );
}
