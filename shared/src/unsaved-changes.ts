// Modification non enregistrée (décision 12 de la phase 2, voir CONTEXT.md).

/** Valeur d'un champ de formulaire ; une liste est un ensemble de choix cochés. */
export type FormValue = string | number | boolean | null | undefined | readonly string[];
export type FormValues = Readonly<Record<string, FormValue>>;

function sameValue(a: FormValue, b: FormValue): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item) => (b as readonly string[]).includes(item as string));
  }
  return a === b;
}

/**
 * Vrai si au moins un champ a une valeur différente de celle enregistrée (en
 * création : de celle de départ). Revenir à la valeur d'avant n'en est pas une.
 */
export function hasUnsavedChanges(saved: FormValues, current: FormValues): boolean {
  return Object.keys({ ...saved, ...current }).some((field) => !sameValue(saved[field], current[field]));
}

/**
 * Valeur de comparaison d'un choix proposé d'office (tâche présélectionnée) :
 * la valeur proposée fait partie des valeurs de départ, même si elle arrive
 * après l'ouverture ; null tant que rien d'autre n'est choisi.
 */
export function chosenValue(value: string, proposed: string | undefined): string | null {
  return value === (proposed ?? '') ? null : value;
}

/** Ce que voit une sortie d'un formulaire de panneau. */
export interface GuardedForm {
  isDirty(): boolean;
  /** Fait ce que ferait le bouton du formulaire ; faux en cas d'échec, erreur affichée par le formulaire. */
  submit(): Promise<boolean>;
  discard(): void;
}

/**
 * Résultat d'un enregistrement : faux en cas d'échec ; vrai si ce qui a été
 * envoyé devient la référence ; sinon, les valeurs auxquelles le formulaire
 * revient (formulaire vidé après son envoi : invitation, ajout).
 */
export type SaveOutcome<V extends FormValues> = boolean | V;

/** Suit l'écart d'un formulaire avec ses dernières valeurs enregistrées. */
export class TrackedForm<V extends FormValues> implements GuardedForm {
  private saved: V;
  private current: V;
  private save: () => Promise<SaveOutcome<V>>;
  private sending: Promise<boolean> | null = null;

  constructor(values: V, save: () => Promise<SaveOutcome<V>>) {
    this.saved = values;
    this.current = values;
    this.save = save;
  }

  /** Valeurs affichées et enregistrement à jour, à chaque rendu. */
  update(values: V, save: () => Promise<SaveOutcome<V>>): void {
    this.current = values;
    this.save = save;
  }

  isDirty(): boolean {
    return hasUnsavedChanges(this.saved, this.current);
  }

  /** Pendant un envoi, rejoint celui-ci : rien n'est envoyé deux fois (réseau lent, puis alerte). */
  submit(): Promise<boolean> {
    this.sending ??= this.send().finally(() => {
      this.sending = null;
    });
    return this.sending;
  }

  private async send(): Promise<boolean> {
    // Ce qui est saisi pendant l'envoi n'est pas enregistré : cela reste une modification.
    const submitted = this.current;
    const outcome = await this.save();
    if (outcome === false) return false;
    this.saved = outcome === true ? submitted : outcome;
    return true;
  }

  discard(): void {
    this.saved = this.current;
  }
}

/** Vrai si au moins un formulaire a une modification non enregistrée. */
export const hasDirtyForm = (forms: Iterable<GuardedForm>): boolean => [...forms].some((form) => form.isDirty());

/**
 * Enregistre chaque formulaire modifié d'un panneau, dans l'ordre. Si l'un
 * échoue, les autres restent faits (décision 12, point 8) ; vrai si tous ont réussi.
 */
export async function saveForms(forms: readonly GuardedForm[]): Promise<boolean> {
  let allSaved = true;
  for (const form of forms.filter((f) => f.isDirty())) {
    if (!(await form.submit())) allSaved = false;
  }
  return allSaved;
}

/** Choix proposés par l'alerte ; Échap ou un clic hors de l'alerte valent « Continuer la saisie ». */
export type UnsavedChoice = 'save' | 'discard' | 'keepEditing';

export type LeaveResult<P> = { outcome: 'left' } | { outcome: 'keptEditing' } | { outcome: 'saveFailed'; panel: P };

/**
 * Sortie de panneaux, donnés du dessus vers le dessous : une alerte par panneau
 * modifié (décision 12, points 5 à 7). `onLeft` signale chaque panneau modifié
 * réglé (enregistré ou abandonné), qui peut alors se fermer.
 */
export async function leavePanels<P extends { forms: readonly GuardedForm[] }>(
  panels: readonly P[],
  ask: (panel: P) => Promise<UnsavedChoice>,
  onLeft: (panel: P) => void,
): Promise<LeaveResult<P>> {
  for (const panel of panels) {
    if (!hasDirtyForm(panel.forms)) continue;
    const choice = await ask(panel);
    if (choice === 'keepEditing') return { outcome: 'keptEditing' };
    if (choice === 'discard') panel.forms.forEach((form) => form.discard());
    else if (!(await saveForms(panel.forms))) return { outcome: 'saveFailed', panel };
    onLeft(panel);
  }
  return { outcome: 'left' };
}
