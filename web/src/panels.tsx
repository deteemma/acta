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
import {
  type AnalysisObjectRef,
  type GuardedForm,
  hasDirtyForm,
  type InitiativeMemberDto,
  leavePanels,
  type UnsavedChoice,
} from '@app/shared';
import { useI18n } from './i18n';
import { DOCKED_PANEL, ResizeHandle } from './resize';
import { FormRegistryContext, UnsavedChangesAlert } from './unsaved-changes';

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
  /** Ticket d'un autre type que l'Action (ticket 18). */
  | { kind: 'ticket'; initiativeId: string; ticketId: string }
  /** « Nouveau ticket » ; avec `epicId`, ouvert depuis le « + Ticket » de cet Epic. */
  | { kind: 'createTicket'; initiativeId: string; epicId?: string }
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
  /** Depuis la page, remplace les panneaux ouverts : gardé par l'alerte. */
  open: (content: PanelContent) => void;
  /** Remplace le dernier panneau (ex. palette → fiche) en gardant son élément d'origine ; gardé par l'alerte. */
  replace: (content: PanelContent) => void;
  /** La fiche créée remplace le panneau : sa saisie vient d'être enregistrée, pas d'alerte. */
  replaceSaved: (content: PanelContent) => void;
  /** Ferme un panneau et ceux ouverts par-dessus ; gardé par l'alerte. */
  close: (id: number) => void;
  /** Ferme tous les panneaux, avec l'alerte ; vrai si la sortie peut se poursuivre. */
  leaveAll: () => Promise<boolean>;
  /**
   * Quitte l'écran en cours (changement d'écran, déconnexion) : ferme tous les
   * panneaux, puis passe la saisie de l'écran lui-même (page en écriture) à l'alerte.
   */
  leaveScreen: () => Promise<boolean>;
  /** Passe la seule saisie de l'écran à l'alerte, sans rien fermer ; vrai si elle est réglée. */
  settleScreen: () => Promise<boolean>;
}

/** Formulaires de l'écran principal (page en écriture, ticket 22) : inscrits comme un panneau sous tous les autres. */
const SCREEN_ID = 0;
/** Titre de l'écran, repris en tête de l'alerte. */
export const SCREEN_TITLE_ID = 'screen-title';

const PanelsContext = createContext<Panels | null>(null);

/** Fermeture sans alerte du panneau en cours : son objet vient d'être supprimé ou quitté. */
const CloseSilentlyContext = createContext<() => void>(() => undefined);
export const useCloseSilently = () => useContext(CloseSilentlyContext);

/**
 * Passe le panneau en cours à l'alerte s'il est modifié, sans le fermer ; vrai si
 * l'action demandée se poursuit (archivage : la fiche passe en lecture seule).
 */
const SettleUnsavedContext = createContext<() => Promise<boolean>>(() => Promise.resolve(true));
export const useSettleUnsaved = () => useContext(SettleUnsavedContext);

let nextId = 1;

const panelTitleElement = (id: number) => document.getElementById(id === SCREEN_ID ? SCREEN_TITLE_ID : panelTitleId(id));
const panelTitleId = (id: number) => `panel-title-${id}`;

/** Amène sous les yeux l'erreur du panneau, une fois affichée. */
function scrollToError(id: number) {
  requestAnimationFrame(() => {
    const scope = id === SCREEN_ID ? document.querySelector('main.page') : panelTitleElement(id)?.closest('dialog');
    const errors = scope?.querySelectorAll('.error') ?? [];
    [...errors].find((error) => error.checkVisibility())?.scrollIntoView({ block: 'center' });
  });
}

interface Asking {
  id: number;
  title: string;
  saving: boolean;
  answer: (choice: UnsavedChoice) => void;
}

export function PanelsProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Entry[]>([]);
  const [asking, setAsking] = useState<Asking | null>(null);
  // Lus par une sortie en cours, qui s'étale sur plusieurs rendus.
  const stackRef = useRef(stack);
  const forms = useRef(new Map<number, Set<GuardedForm>>());
  const leaving = useRef(false);

  const update = useCallback((next: (s: Entry[]) => Entry[]) => {
    stackRef.current = next(stackRef.current);
    setStack(stackRef.current);
  }, []);

  const formsOf = useCallback((id: number) => [...(forms.current.get(id) ?? [])], []);

  const registerForm = useCallback((id: number, form: GuardedForm) => {
    const set = forms.current.get(id) ?? new Set<GuardedForm>();
    forms.current.set(id, set);
    set.add(form);
    return () => {
      set.delete(form);
      if (set.size === 0) forms.current.delete(id);
    };
  }, []);

  /** Referme un panneau et ceux ouverts par-dessus. */
  const closeWithoutAlert = useCallback(
    (id: number) => {
      update((s) => {
        const index = s.findIndex((e) => e.id === id);
        return index < 0 ? s : s.slice(0, index);
      });
    },
    [update],
  );

  /**
   * Passe chaque panneau modifié de `entries` (du dessous vers le dessus) à
   * l'alerte ; `onSettled` reçoit chacun une fois réglé. Vrai si la sortie se poursuit.
   */
  const leave = useCallback(
    async (entries: Pick<Entry, 'id'>[], onSettled: (id: number) => void): Promise<boolean> => {
      leaving.current = true;
      const result = await leavePanels(
        entries.toReversed().map((entry) => ({ id: entry.id, forms: formsOf(entry.id) })),
        ({ id }) =>
          new Promise<UnsavedChoice>((resolve) => {
            setAsking({
              id,
              title: panelTitleElement(id)?.textContent ?? '',
              saving: false,
              answer: (choice) => {
                if (choice === 'save') setAsking((a) => a && { ...a, saving: true });
                resolve(choice);
              },
            });
          }),
        ({ id }) => onSettled(id),
      );
      leaving.current = false;
      setAsking(null);
      if (result.outcome === 'saveFailed') {
        // Ce qui est au-dessus cacherait le panneau et son erreur.
        const { id } = result.panel;
        update((s) => s.slice(0, s.findIndex((e) => e.id === id) + 1));
        scrollToError(id);
      }
      return result.outcome === 'left';
    },
    [formsOf, update],
  );

  /**
   * Sans modification, la sortie se fait aussitôt ; pendant une alerte, elle est
   * ignorée. Vrai si elle a eu lieu.
   */
  const guarded = useCallback(
    async (entries: Pick<Entry, 'id'>[], proceed: () => void): Promise<boolean> => {
      if (leaving.current) return false;
      const dirty = entries.some((e) => hasDirtyForm(formsOf(e.id)));
      if (dirty && !(await leave(entries, closeWithoutAlert))) return false;
      proceed();
      return true;
    },
    [closeWithoutAlert, formsOf, leave],
  );

  const settleUnsaved = useCallback(
    async (id: number): Promise<boolean> => {
      if (leaving.current) return false;
      const entry = stackRef.current.find((e) => e.id === id);
      if (!entry || !hasDirtyForm(formsOf(id))) return true;
      return leave([entry], () => undefined);
    },
    [formsOf, leave],
  );

  const open = useCallback(
    (content: PanelContent) => {
      const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      // Ouvert depuis la page alors qu'un panneau est ancré : il le remplace, au
      // lieu de s'empiler à chaque objet consulté. La palette, elle, s'y superpose.
      const fromPage = !opener?.closest('dialog') && content.kind !== 'palette';
      void guarded(fromPage ? stackRef.current : [], () => {
        update((s) => [...(fromPage ? [] : s), { id: nextId++, content, opener }]);
      });
    },
    [guarded, update],
  );

  /** Le panneau `top` (déjà refermé si l'alerte est passée par là) laisse la place à `content`. */
  const swap = useCallback(
    (top: Entry, content: PanelContent) => {
      update((s) => [...s.filter((e) => e.id !== top.id), { id: nextId++, content, opener: top.opener }]);
    },
    [update],
  );

  const replace = useCallback(
    (content: PanelContent) => {
      const top = stackRef.current.at(-1);
      if (top) void guarded([top], () => swap(top, content));
    },
    [guarded, swap],
  );

  // Enregistré depuis l'alerte : le panneau va se fermer, la sortie demandée se poursuit.
  const replaceSaved = useCallback(
    (content: PanelContent) => {
      const top = stackRef.current.at(-1);
      if (top && !leaving.current) swap(top, content);
    },
    [swap],
  );

  const close = useCallback(
    (id: number) => {
      const index = stackRef.current.findIndex((e) => e.id === id);
      if (index >= 0) void guarded(stackRef.current.slice(index), () => closeWithoutAlert(id));
    },
    [closeWithoutAlert, guarded],
  );

  const leaveAll = useCallback(() => guarded(stackRef.current, () => update(() => [])), [guarded, update]);
  const leaveScreen = useCallback(
    () => guarded([{ id: SCREEN_ID }, ...stackRef.current], () => update(() => [])),
    [guarded, update],
  );
  const settleScreen = useCallback(() => guarded([{ id: SCREEN_ID }], () => undefined), [guarded]);

  // Fermeture ou rechargement de l'onglet : seulement le message du navigateur.
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      const dirty = [...forms.current.values()].some(hasDirtyForm);
      if (dirty) event.preventDefault();
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const value = useMemo<Panels>(
    () => ({ stack, open, replace, replaceSaved, close, leaveAll, leaveScreen, settleScreen }),
    [stack, open, replace, replaceSaved, close, leaveAll, leaveScreen, settleScreen],
  );
  const registry = useMemo(
    () => ({ registerForm, closeWithoutAlert, settleUnsaved }),
    [registerForm, closeWithoutAlert, settleUnsaved],
  );
  return (
    <PanelRegistryContext.Provider value={registry}>
      <PanelsContext.Provider value={value}>
        {children}
        {asking && (
          <UnsavedChangesAlert key={asking.id} title={asking.title} saving={asking.saving} onChoice={asking.answer} />
        )}
      </PanelsContext.Provider>
    </PanelRegistryContext.Provider>
  );
}

const PanelRegistryContext = createContext<{
  registerForm: (id: number, form: GuardedForm) => () => void;
  closeWithoutAlert: (id: number) => void;
  settleUnsaved: (id: number) => Promise<boolean>;
} | null>(null);

export function usePanels(): Panels {
  const panels = useContext(PanelsContext);
  if (!panels) throw new Error('usePanels() hors de PanelsProvider');
  return panels;
}

/** Contenu de l'écran principal : ses formulaires sont gardés par leaveScreen et settleScreen. */
export function ScreenForms({ children }: { children: ReactNode }) {
  const registry = useContext(PanelRegistryContext)!;
  const register = useCallback((form: GuardedForm) => registry.registerForm(SCREEN_ID, form), [registry]);
  return <FormRegistryContext.Provider value={register}>{children}</FormRegistryContext.Provider>;
}

/** Affiche la pile de panneaux ; `render` donne le contenu de chacun. */
export function PanelHost({ render }: { render: (content: PanelContent, close: () => void) => ReactNode }) {
  const { stack, close } = usePanels();
  return (
    <>
      {stack.map((entry) => (
        <PanelSlot key={entry.id} entry={entry}>
          {render(entry.content, () => close(entry.id))}
        </PanelSlot>
      ))}
    </>
  );
}

/** Contexte d'un panneau : son entrée, ses formulaires, sa fermeture sans alerte. */
function PanelSlot({ entry, children }: { entry: Entry; children: ReactNode }) {
  const registry = useContext(PanelRegistryContext)!;
  const { id } = entry;
  const register = useCallback((form: GuardedForm) => registry.registerForm(id, form), [registry, id]);
  const closeSilently = useCallback(() => registry.closeWithoutAlert(id), [registry, id]);
  const settle = useCallback(() => registry.settleUnsaved(id), [registry, id]);
  return (
    <PanelEntryContext.Provider value={entry}>
      <FormRegistryContext.Provider value={register}>
        <CloseSilentlyContext.Provider value={closeSilently}>
          <SettleUnsavedContext.Provider value={settle}>{children}</SettleUnsavedContext.Provider>
        </CloseSilentlyContext.Provider>
      </FormRegistryContext.Provider>
    </PanelEntryContext.Provider>
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
    // Échap quand le focus est hors du panneau (clic sur du texte) : la fermeture
    // passe par la pile, gardée par l'alerte.
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onCloseRef.current();
    };
    // Le navigateur peut fermer malgré tout (deuxième Échap d'affilée) : le panneau
    // est rouvert, la pile décide. L'événement arrive en différé : celui d'une
    // fermeture suivie d'une réouverture (double montage de React en
    // développement) est ignoré.
    const handleClose = () => {
      if (dialog.open) return;
      if (docked) dialog.show();
      else dialog.showModal();
      onCloseRef.current();
    };
    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('close', handleClose);
      dialog.close();
      const opener = entry?.opener;
      if (opener?.isConnected) opener.focus();
    };
  }, [entry, docked]);

  // Échap passe par la pile, gardée par l'alerte ; un panneau ancré n'est de toute
  // façon pas modal, le navigateur n'y gère pas Échap.
  function closeOnEscape(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'Escape' && !event.defaultPrevented) {
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

  const titleId = panelTitleId(entry?.id ?? 0);
  return (
    <dialog
      ref={ref}
      className={`panel panel-${variant}${docked ? ' panel-docked' : ''}`}
      aria-labelledby={titleId}
      onKeyDown={closeOnEscape}
    >
      {/* Panneau ancré : largeur réglable (validé le 01.11.2026). */}
      {docked && <ResizeHandle area={DOCKED_PANEL} label={t('panel.resize')} className="panel-resize" />}
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
