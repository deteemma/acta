// Modifications non enregistrées (ticket 15) : formulaires du téléphone et alerte
// native. Règles dans @app/shared (unsaved-changes.ts).
import {
  type FormValues,
  type GuardedForm,
  hasDirtyForm,
  leavePanels,
  type SaveOutcome,
  TrackedForm,
  type UnsavedChoice,
} from '@app/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useI18n } from './i18n';

/** Formulaires d'un écran ou d'une feuille, et sortie gardée par l'alerte. */
export interface FormScope {
  register: (form: GuardedForm) => () => void;
  isDirty: () => boolean;
  /** Poursuit `proceed` s'il n'y a rien à perdre, ou après « Enregistrer » réussi ou « Abandonner ». */
  leave: (proceed: () => void) => void;
}

export const FormScopeContext = createContext<FormScope | null>(null);

export function useFormScope(): FormScope {
  const { t } = useI18n();
  const forms = useRef(new Set<GuardedForm>());
  const leaving = useRef(false);

  return useMemo<FormScope>(() => {
    // Android : à gauche le bouton neutre, à droite le positif ; toucher hors de
    // l'alerte ou le bouton retour valent « Continuer la saisie ».
    const ask = () =>
      new Promise<UnsavedChoice>((resolve) => {
        Alert.alert(
          t('unsavedChanges.message'),
          undefined,
          [
            { text: t('unsavedChanges.keepEditing'), style: 'cancel', onPress: () => resolve('keepEditing') },
            { text: t('unsavedChanges.discard'), style: 'destructive', onPress: () => resolve('discard') },
            { text: t('unsavedChanges.save'), onPress: () => resolve('save') },
          ],
          { cancelable: true, onDismiss: () => resolve('keepEditing') },
        );
      });

    return {
      register: (form) => {
        forms.current.add(form);
        return () => forms.current.delete(form);
      },
      isDirty: () => hasDirtyForm(forms.current),
      leave: (proceed) => {
        if (leaving.current) return;
        leaving.current = true;
        void leavePanels([{ forms: [...forms.current] }], ask, () => undefined)
          .then((result) => {
            if (result.outcome === 'left') proceed();
          })
          .finally(() => {
            leaving.current = false;
          });
      },
    };
  }, [t]);
}

/**
 * Déclare un formulaire : `values` sont ses champs ; `save` fait ce que fait son
 * bouton. Renvoie l'action de ce bouton.
 */
export function useUnsavedForm<V extends FormValues>(values: V, save: () => Promise<SaveOutcome<V>>) {
  const scope = useContext(FormScopeContext);
  const [form] = useState(() => new TrackedForm(values, save));

  useEffect(() => {
    form.update(values, save);
  });

  useEffect(() => scope?.register(form), [scope, form]);

  return useCallback(() => form.submit(), [form]);
}
