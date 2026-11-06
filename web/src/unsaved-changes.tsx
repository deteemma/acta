// Modifications non enregistrées (ticket 15) : déclaration des formulaires d'un
// panneau et alerte. Règles dans @app/shared (unsaved-changes.ts) ; la pile de
// panneaux (panels.tsx) garde les sorties.
import { type FormValues, type GuardedForm, type SaveOutcome, TrackedForm, type UnsavedChoice } from '@app/shared';
import {
  createContext,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type SyntheticEvent,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useI18n } from './i18n';

/** Inscrit un formulaire auprès du panneau qui le contient ; renvoie sa désinscription. */
export const FormRegistryContext = createContext<((form: GuardedForm) => () => void) | null>(null);

/**
 * Montre le formulaire quand son enregistrement depuis l'alerte échoue : son
 * erreur serait sinon invisible (onglet masqué de l'administration).
 */
export const RevealFormContext = createContext<(() => void) | null>(null);

/**
 * Déclare un formulaire : `values` sont ses champs ; `save` fait ce que fait son
 * bouton, sans l'événement. Renvoie le gestionnaire d'envoi du formulaire.
 */
export function useUnsavedForm<V extends FormValues>(values: V, save: () => Promise<SaveOutcome<V>>) {
  const register = useContext(FormRegistryContext);
  const reveal = useContext(RevealFormContext);
  const [form] = useState(() => new TrackedForm(values, save));
  const revealRef = useRef(reveal);

  useEffect(() => {
    form.update(values, save);
    revealRef.current = reveal;
  });

  useEffect(
    () =>
      register?.({
        isDirty: () => form.isDirty(),
        discard: () => form.discard(),
        submit: async () => {
          const saved = await form.submit();
          if (!saved) revealRef.current?.();
          return saved;
        },
      }),
    [register, form],
  );

  return useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      void form.submit();
    },
    [form],
  );
}

/** Alerte : au-dessus de tous les panneaux ; Échap ou un clic hors de l'alerte valent « Continuer la saisie ». */
export function UnsavedChangesAlert({
  title,
  saving,
  onChoice,
}: {
  /** Panneau concerné : avec plusieurs panneaux, il peut être masqué par un autre. */
  title: string;
  saving: boolean;
  onChoice: (choice: UnsavedChoice) => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    // `autoFocus` de React n'agit pas sur un <dialog> encore fermé.
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => {
      dialog.close();
      // React a déjà retiré l'alerte : le navigateur ne rend pas le focus de lui-même.
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  const keepEditing = () => {
    if (!saving) onChoice('keepEditing');
  };

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    keepEditing();
  }

  function onCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    keepEditing();
  }

  function onBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) keepEditing();
  }

  return (
    <dialog
      ref={ref}
      className="unsaved-alert"
      role="alertdialog"
      aria-labelledby="unsaved-alert-title"
      aria-describedby="unsaved-alert-message"
      onKeyDown={onKeyDown}
      onCancel={onCancel}
      onClick={onBackdropClick}
    >
      <div className="unsaved-alert-body">
        <h2 id="unsaved-alert-title">{title}</h2>
        <p id="unsaved-alert-message">{t('unsavedChanges.message')}</p>
        <div className="unsaved-alert-buttons">
          <button type="button" className="primary" disabled={saving} onClick={() => onChoice('save')}>
            {t('unsavedChanges.save')}
          </button>
          <button type="button" className="danger" disabled={saving} onClick={() => onChoice('discard')}>
            {t('unsavedChanges.discard')}
          </button>
          <button type="button" data-autofocus disabled={saving} onClick={keepEditing}>
            {t('unsavedChanges.keepEditing')}
          </button>
        </div>
      </div>
    </dialog>
  );
}
