// Fenêtres de dialogue (navigation par arborescence, ADR-0021, N1 et N15) : la
// palette et les créations s'ouvrent dans une petite fenêtre modale centrée,
// au-dessus de l'écran de données. Chacune est un <dialog> modal : le navigateur
// y maintient le focus et Échap ne referme que la dernière ouverte.
// Les formulaires de l'écran de données et ceux des fenêtres sont gardés par
// l'alerte des modifications non enregistrées (N13).
import { X } from 'lucide-react';
import {
  createContext,
  type KeyboardEvent,
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
  leavePanels,
  type Locale,
  type UnsavedChoice,
} from '@app/shared';
import { useI18n } from './i18n';
import { FormRegistryContext, UnsavedChangesAlert } from './unsaved-changes';

/** Ce qu'une fenêtre de dialogue peut afficher. */
export type DialogContent =
  | { kind: 'palette' }
  | { kind: 'createInitiative' }
  /**
   * Création rapide ; l'initiative est proposée d'après l'écran d'où l'on
   * vient. Avec `from`, l'action est créée depuis cet objet et liée à lui (ticket 13).
   */
  | { kind: 'createAction'; initiativeId?: string; from?: AnalysisObjectRef }
  /** « Nouveau ticket » ; avec `epicId`, ouvert depuis le « + Ticket » de cet Epic. */
  | { kind: 'createTicket'; initiativeId: string; epicId?: string }
  /** L'élément créé s'ouvre ensuite dans l'écran de données. */
  | { kind: 'createStakeholder'; initiativeId: string }
  | { kind: 'createNeed'; initiativeId: string }
  | { kind: 'createRequirement'; initiativeId: string }
  /** « Nouvelle page » ; avec `parentId`, « Sous-page » de cette page. */
  | { kind: 'createPage'; initiativeId: string; parentId?: string }
  /** Avec la langue de la validation de syntaxe (D15). */
  | { kind: 'createScenario'; initiativeId: string; requirementId: string; language: Locale };

interface Entry {
  id: number;
  content: DialogContent;
  /** Élément qui avait le focus à l'ouverture : il le retrouve à la fermeture. */
  opener: HTMLElement | null;
}

interface Dialogs {
  stack: Entry[];
  /** Ouvre une fenêtre par-dessus celles déjà ouvertes. */
  open: (content: DialogContent) => void;
  /** Ferme une fenêtre et celles ouvertes par-dessus ; gardé par l'alerte. */
  close: (id: number) => void;
  /**
   * Quitte l'écran de données (changement d'élément, d'onglet ou d'initiative,
   * déconnexion) : ferme les fenêtres, puis passe la saisie de l'écran lui-même
   * à l'alerte. Vrai si la sortie peut se poursuivre.
   */
  leaveScreen: () => Promise<boolean>;
  /** Passe la seule saisie de l'écran à l'alerte, sans rien fermer ; vrai si elle est réglée. */
  settleScreen: () => Promise<boolean>;
  /** Vrai pendant une sortie gardée par l'alerte. */
  isLeaving: () => boolean;
}

/** Formulaires de l'écran de données : inscrits sous toutes les fenêtres. */
const SCREEN_ID = 0;
/** Titre de l'écran de données, repris en tête de l'alerte. */
export const SCREEN_TITLE_ID = 'screen-title';

const DialogsContext = createContext<Dialogs | null>(null);

/** Fermeture sans alerte de la fenêtre en cours : sa saisie vient d'être enregistrée. */
const CloseSilentlyContext = createContext<() => void>(() => undefined);
export const useCloseSilently = () => useContext(CloseSilentlyContext);

/**
 * Passe la saisie en cours à l'alerte si elle est modifiée, sans rien fermer ;
 * vrai si l'action demandée se poursuit (archivage : la fiche passe en lecture seule).
 */
const SettleUnsavedContext = createContext<() => Promise<boolean>>(() => Promise.resolve(true));
export const useSettleUnsaved = () => useContext(SettleUnsavedContext);

let nextId = 1;

const dialogTitleId = (id: number) => `dialog-title-${id}`;
const titleElement = (id: number) => document.getElementById(id === SCREEN_ID ? SCREEN_TITLE_ID : dialogTitleId(id));

/** Amène sous les yeux l'erreur de l'écran ou de la fenêtre, une fois affichée. */
function scrollToError(id: number) {
  requestAnimationFrame(() => {
    const scope = id === SCREEN_ID ? document.querySelector('main.page') : titleElement(id)?.closest('dialog');
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

export function DialogsProvider({ children }: { children: ReactNode }) {
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

  /** Referme une fenêtre et celles ouvertes par-dessus. */
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
   * Passe chaque saisie modifiée de `entries` (du dessous vers le dessus) à
   * l'alerte ; `onSettled` reçoit chacune une fois réglée. Vrai si la sortie se poursuit.
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
              title: titleElement(id)?.textContent ?? '',
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
        // Ce qui est au-dessus cacherait la saisie et son erreur.
        const { id } = result.panel;
        update((s) => (id === SCREEN_ID ? [] : s.slice(0, s.findIndex((e) => e.id === id) + 1)));
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

  const open = useCallback(
    (content: DialogContent) => {
      const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      update((s) => [...s, { id: nextId++, content, opener }]);
    },
    [update],
  );

  const close = useCallback(
    (id: number) => {
      const index = stackRef.current.findIndex((e) => e.id === id);
      if (index >= 0) void guarded(stackRef.current.slice(index), () => closeWithoutAlert(id));
    },
    [closeWithoutAlert, guarded],
  );

  const leaveScreen = useCallback(
    () => guarded([{ id: SCREEN_ID }, ...stackRef.current], () => update(() => [])),
    [guarded, update],
  );
  const settleScreen = useCallback(() => guarded([{ id: SCREEN_ID }], () => undefined), [guarded]);
  const isLeaving = useCallback(() => leaving.current, []);

  // Fermeture ou rechargement de l'onglet : seulement le message du navigateur.
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      const dirty = [...forms.current.values()].some(hasDirtyForm);
      if (dirty) event.preventDefault();
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const value = useMemo<Dialogs>(
    () => ({ stack, open, close, leaveScreen, settleScreen, isLeaving }),
    [stack, open, close, leaveScreen, settleScreen, isLeaving],
  );
  const registry = useMemo(() => ({ registerForm, closeWithoutAlert }), [registerForm, closeWithoutAlert]);
  return (
    <DialogRegistryContext.Provider value={registry}>
      <DialogsContext.Provider value={value}>
        {children}
        {asking && (
          <UnsavedChangesAlert key={asking.id} title={asking.title} saving={asking.saving} onChoice={asking.answer} />
        )}
      </DialogsContext.Provider>
    </DialogRegistryContext.Provider>
  );
}

const DialogRegistryContext = createContext<{
  registerForm: (id: number, form: GuardedForm) => () => void;
  closeWithoutAlert: (id: number) => void;
} | null>(null);

export function useDialogs(): Dialogs {
  const dialogs = useContext(DialogsContext);
  if (!dialogs) throw new Error('useDialogs() hors de DialogsProvider');
  return dialogs;
}

/**
 * Contenu de l'écran de données : ses formulaires sont gardés par leaveScreen et
 * settleScreen ; useSettleUnsaved y passe la saisie de l'écran à l'alerte (archivage).
 */
export function ScreenForms({ children }: { children: ReactNode }) {
  const registry = useContext(DialogRegistryContext)!;
  const { settleScreen } = useDialogs();
  const register = useCallback((form: GuardedForm) => registry.registerForm(SCREEN_ID, form), [registry]);
  return (
    <FormRegistryContext.Provider value={register}>
      <SettleUnsavedContext.Provider value={settleScreen}>{children}</SettleUnsavedContext.Provider>
    </FormRegistryContext.Provider>
  );
}

/** Affiche les fenêtres ouvertes ; `render` donne le contenu de chacune. */
export function DialogHost({ render }: { render: (content: DialogContent, close: () => void) => ReactNode }) {
  const { stack, close } = useDialogs();
  return (
    <>
      {stack.map((entry) => (
        <DialogSlot key={entry.id} entry={entry}>
          {render(entry.content, () => close(entry.id))}
        </DialogSlot>
      ))}
    </>
  );
}

/** Contexte d'une fenêtre : son entrée, ses formulaires, sa fermeture sans alerte. */
function DialogSlot({ entry, children }: { entry: Entry; children: ReactNode }) {
  const registry = useContext(DialogRegistryContext)!;
  const { id } = entry;
  const register = useCallback((form: GuardedForm) => registry.registerForm(id, form), [registry, id]);
  const closeSilently = useCallback(() => registry.closeWithoutAlert(id), [registry, id]);
  return (
    <DialogEntryContext.Provider value={entry}>
      <FormRegistryContext.Provider value={register}>
        <CloseSilentlyContext.Provider value={closeSilently}>{children}</CloseSilentlyContext.Provider>
      </FormRegistryContext.Provider>
    </DialogEntryContext.Provider>
  );
}

const DialogEntryContext = createContext<Entry | null>(null);

export function Dialog({
  title,
  kicker,
  variant = 'dialog',
  onClose,
  children,
}: {
  title: string;
  /** Au-dessus du titre : l'initiative où se fait la création. */
  kicker?: ReactNode;
  /** `palette` : en haut de l'écran, plus large ; `dialog` : centrée. */
  variant?: 'dialog' | 'palette';
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const entry = useContext(DialogEntryContext);
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current!;
    if (!dialog.open) dialog.showModal();
    // `autoFocus` de React n'agit pas sur un <dialog> encore fermé.
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    // Échap quand le focus est hors de la fenêtre (clic sur du texte) : la
    // fermeture est gardée par l'alerte.
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onCloseRef.current();
    };
    // Le navigateur peut fermer malgré tout (deuxième Échap d'affilée) : la
    // fenêtre est rouverte, l'alerte décide. L'événement arrive en différé :
    // celui d'une fermeture suivie d'une réouverture (double montage de React en
    // développement) est ignoré.
    const handleClose = () => {
      if (dialog.open) return;
      dialog.showModal();
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
  }, [entry]);

  function closeOnEscape(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      onClose();
    }
  }

  const titleId = dialogTitleId(entry?.id ?? 0);
  return (
    <dialog ref={ref} className={`modal modal-${variant}`} aria-labelledby={titleId} onKeyDown={closeOnEscape}>
      <header className="modal-header">
        <div className="modal-title">
          {kicker && <div className="modal-kicker">{kicker}</div>}
          <h2 id={titleId}>{title}</h2>
        </div>
        <button type="button" className="modal-close" aria-label={t('panel.close')} title={t('panel.close')} onClick={onClose}>
          <X />
        </button>
      </header>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
