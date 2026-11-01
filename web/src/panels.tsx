// Coque de navigation (ticket 02) : panneaux empilés au-dessus de l'écran en
// cours. Chaque panneau est un <dialog> modal : le navigateur y maintient le
// focus et Échap ne referme que le dernier ouvert. Sur grand écran (refonte du
// design, ticket 03), un panneau latéral s'ancre à droite sans être modal : la
// liste reste utilisable à côté.
import { X } from 'lucide-react';
import {
  createContext,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { AnalysisObjectRef, InitiativeMemberDto } from '@app/shared';
import { useI18n } from './i18n';

/** Ce qu'un panneau peut afficher. */
export type PanelContent =
  | { kind: 'palette' }
  | { kind: 'createInitiative' }
  | { kind: 'initiative'; initiativeId: string }
  | { kind: 'dashboard'; initiativeId: string }
  | { kind: 'alerts' }
  | { kind: 'member'; member: InitiativeMemberDto }
  | { kind: 'admin' }
  | { kind: 'babok' }
  | { kind: 'babokElement'; elementId: string }
  /**
   * Création rapide ; l'initiative est proposée d'après le panneau d'où l'on
   * vient. Avec `from`, l'action est créée depuis cet objet et liée à lui (ticket 13).
   */
  | { kind: 'createAction'; initiativeId?: string; from?: AnalysisObjectRef }
  | { kind: 'action'; initiativeId: string; actionId: string }
  | { kind: 'stakeholders'; initiativeId: string }
  /** Sans `stakeholderId`, création d'une partie prenante. */
  | { kind: 'stakeholder'; initiativeId: string; stakeholderId?: string }
  /** Sans `needId`, création d'un besoin. */
  | { kind: 'need'; initiativeId: string; needId?: string }
  /** Sans `requirementId`, création d'une exigence. */
  | { kind: 'requirement'; initiativeId: string; requirementId?: string };

interface Entry {
  id: number;
  content: PanelContent;
  /** Élément qui avait le focus à l'ouverture : il le retrouve à la fermeture. */
  opener: HTMLElement | null;
}

interface Panels {
  stack: Entry[];
  open: (content: PanelContent) => void;
  /** Remplace le dernier panneau (ex. palette → fiche) en gardant son élément d'origine. */
  replace: (content: PanelContent) => void;
  close: (id: number) => void;
}

const PanelsContext = createContext<Panels | null>(null);

let nextId = 1;

export function PanelsProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Entry[]>([]);

  const open = useCallback((content: PanelContent) => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Ouvert depuis la page alors qu'un panneau est ancré : il le remplace, au
    // lieu de s'empiler à chaque objet consulté. La palette, elle, s'y superpose.
    const fromPage = !opener?.closest('dialog') && content.kind !== 'palette';
    setStack((s) => [...(fromPage ? [] : s), { id: nextId++, content, opener }]);
  }, []);

  const replace = useCallback((content: PanelContent) => {
    setStack((s) => {
      const top = s.at(-1);
      return top ? [...s.slice(0, -1), { id: nextId++, content, opener: top.opener }] : s;
    });
  }, []);

  // Fermer un panneau referme aussi ceux ouverts par-dessus.
  const close = useCallback((id: number) => {
    setStack((s) => {
      const index = s.findIndex((e) => e.id === id);
      return index < 0 ? s : s.slice(0, index);
    });
  }, []);

  const value = useMemo<Panels>(() => ({ stack, open, replace, close }), [stack, open, replace, close]);
  return <PanelsContext.Provider value={value}>{children}</PanelsContext.Provider>;
}

export function usePanels(): Panels {
  const panels = useContext(PanelsContext);
  if (!panels) throw new Error('usePanels() hors de PanelsProvider');
  return panels;
}

/** Affiche la pile de panneaux ; `render` donne le contenu de chacun. */
export function PanelHost({ render }: { render: (content: PanelContent, close: () => void) => ReactNode }) {
  const { stack, close } = usePanels();
  return (
    <>
      {stack.map((entry) => (
        <PanelEntryContext.Provider key={entry.id} value={entry}>
          {render(entry.content, () => close(entry.id))}
        </PanelEntryContext.Provider>
      ))}
    </>
  );
}

const PanelEntryContext = createContext<Entry | null>(null);

/**
 * Bouton flottant (« + Action »), repris dans chaque panneau latéral : un
 * panneau modal rend inerte l'écran en dessous, le bouton y reste ainsi accessible.
 */
export const FabContext = createContext<ReactNode>(null);

/** Glissement vers le bas, sur petit écran, au-delà duquel le panneau se referme. */
const SWIPE_CLOSE_PX = 80;
const NARROW_SCREEN = '(max-width: 40rem)';
/** Largeur à partir de laquelle un panneau latéral s'ancre à droite de la liste. */
const WIDE_SCREEN = '(min-width: 80rem)';

export function Panel({
  title,
  titleTooltip,
  kicker,
  badges,
  variant = 'side',
  showFab = true,
  onClose,
  children,
}: {
  title: string;
  /** Info-bulle du titre (ex. nom anglais d'un élément du BABOK). */
  titleTooltip?: string;
  /** Au-dessus du titre : nature et code de l'objet (refonte du design, ticket 04). */
  kicker?: ReactNode;
  /** Sous le titre : badges (rôle, statut…). */
  badges?: ReactNode;
  variant?: 'side' | 'palette';
  /** Faux pour le panneau que le bouton flottant ouvre lui-même. */
  showFab?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const entry = useContext(PanelEntryContext);
  const fab = useContext(FabContext);
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const drag = useRef<{ startY: number; dy: number } | null>(null);
  // Décidé à l'ouverture : un panneau ne change pas de mode s'il reste ouvert.
  const [docked] = useState(() => variant === 'side' && window.matchMedia(WIDE_SCREEN).matches);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current!;
    if (!dialog.open) {
      if (docked) dialog.show();
      else dialog.showModal();
    }
    // `autoFocus` de React n'agit pas sur un <dialog> encore fermé.
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    // Fermeture par le navigateur (Échap) : on retire le panneau de la pile.
    // L'événement arrive en différé : celui d'une fermeture suivie d'une
    // réouverture (double montage de React en développement) est ignoré.
    const handleClose = () => {
      if (!dialog.open) onCloseRef.current();
    };
    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.close();
      const opener = entry?.opener;
      if (opener?.isConnected) opener.focus();
    };
  }, [entry, docked]);

  // Un panneau ancré n'est pas modal : le navigateur n'y gère pas Échap.
  function closeOnEscape(event: KeyboardEvent<HTMLDialogElement>) {
    if (docked && event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      onClose();
    }
  }

  function startDrag(event: PointerEvent<HTMLElement>) {
    if (variant !== 'side' || !window.matchMedia(NARROW_SCREEN).matches) return;
    if ((event.target as HTMLElement).closest('button')) return;
    drag.current = { startY: event.clientY, dy: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    if (!drag.current) return;
    drag.current.dy = Math.max(0, event.clientY - drag.current.startY);
    ref.current!.style.transform = `translateY(${drag.current.dy}px)`;
  }

  function endDrag() {
    if (!drag.current) return;
    const { dy } = drag.current;
    drag.current = null;
    ref.current!.style.transform = '';
    if (dy > SWIPE_CLOSE_PX) onClose();
  }

  const titleId = `panel-title-${entry?.id ?? 0}`;
  return (
    <dialog
      ref={ref}
      className={`panel panel-${variant}${docked ? ' panel-docked' : ''}`}
      aria-labelledby={titleId}
      onKeyDown={closeOnEscape}
    >
      <header
        className="panel-header"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="panel-handle" aria-hidden="true" />
        <div className="panel-title">
          {kicker && <div className="panel-kicker">{kicker}</div>}
          <h2 id={titleId} title={titleTooltip}>
            {title}
          </h2>
          {badges && <div className="panel-badges">{badges}</div>}
        </div>
        <button type="button" className="panel-close" aria-label={t('panel.close')} title={t('panel.close')} onClick={onClose}>
          <X />
        </button>
      </header>
      <div className="panel-body">{children}</div>
      {variant === 'side' && showFab && fab}
    </dialog>
  );
}
