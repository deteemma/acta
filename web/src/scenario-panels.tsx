// Scénarios Gherkin (phase 3, ticket 01) : section « Scénarios » de la fiche d'une
// exigence de solution fonctionnelle. Règles dans @app/shared (scenarios.ts,
// roles.ts) ; décisions D1 à D19 de .scratch/phase-3/spec.md. Web seulement (D19).
import {
  createScenarioSchema,
  moveScenario,
  SCENARIO_TEXT_MAX_LENGTH,
  SCENARIO_TITLE_MAX_LENGTH,
  type ScenarioChangedSinceBody,
  type ScenarioDto,
  updateScenarioSchema,
} from '@app/shared';
import { useId, useState } from 'react';
import { api, ApiError } from './api';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { useUnsavedForm } from './unsaved-changes';

const toError = (e: unknown): UiError =>
  e instanceof ApiError && e.status === 400 && !e.refusal ? { key: 'scenario.invalid' } : toUiError(e);

/**
 * Scénarios d'une exigence, dans leur ordre (D9) : tout membre lit ; propriétaires
 * et contributeurs écrivent, ordonnent et suppriment (D17). La liste est tenue par
 * la fiche, qui en a besoin pour figer le type (D2) et confirmer la suppression (D3).
 */
export function ScenariosSection({
  initiativeId,
  requirementId,
  scenarios,
  canEdit,
  onChange,
}: {
  initiativeId: string;
  requirementId: string;
  scenarios: ScenarioDto[];
  canEdit: boolean;
  onChange: (scenarios: ScenarioDto[]) => void;
}) {
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<UiError | null>(null);

  const replace = (next: ScenarioDto) => onChange(scenarios.map((s) => (s.id === next.id ? next : s)));

  async function move(id: string, offset: -1 | 1) {
    try {
      const scenarioIds = moveScenario(
        scenarios.map((s) => s.id),
        id,
        offset,
      );
      onChange(await api.reorderScenarios(initiativeId, requirementId, { scenarioIds }));
      setError(null);
    } catch (e) {
      setError(toError(e));
      // Ordre dépassé : la liste actuelle remplace celle affichée.
      if (e instanceof ApiError && e.refusal === 'scenarioOrderOutdated') {
        api.listScenarios(initiativeId, requirementId).then(onChange, () => undefined);
      }
    }
  }

  return (
    <section className="scenarios-section">
      <h3 className="group-title">
        {t('scenario.section')} {scenarios.length > 0 && <span className="count">{scenarios.length}</span>}
      </h3>
      <ErrorMessage error={error} />
      {scenarios.length === 0 && (
        <p>
          <small>{t('scenario.none')}</small>
        </p>
      )}
      {scenarios.length > 0 && (
        <ol className="scenario-list">
          {scenarios.map((scenario, index) => (
            <ScenarioItem
              key={scenario.id}
              initiativeId={initiativeId}
              scenario={scenario}
              canEdit={canEdit}
              first={index === 0}
              last={index === scenarios.length - 1}
              onSaved={replace}
              onMove={(offset) => void move(scenario.id, offset)}
              onDeleted={() => onChange(scenarios.filter((s) => s.id !== scenario.id))}
            />
          ))}
        </ol>
      )}
      {canEdit &&
        (adding ? (
          <ScenarioForm
            legend={t('scenario.new')}
            submitLabel={t('scenario.create')}
            initial={{ title: '', text: '' }}
            onSave={async (values) => {
              // Créé en dernier (D9).
              onChange([...scenarios, await api.createScenario(initiativeId, requirementId, values)]);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button type="button" onClick={() => setAdding(true)}>
            {t('scenario.add')}
          </button>
        ))}
    </section>
  );
}

function ScenarioItem({
  initiativeId,
  scenario,
  canEdit,
  first,
  last,
  onSaved,
  onMove,
  onDeleted,
}: {
  initiativeId: string;
  scenario: ScenarioDto;
  canEdit: boolean;
  first: boolean;
  last: boolean;
  onSaved: (scenario: ScenarioDto) => void;
  onMove: (offset: -1 | 1) => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const titleId = useId();
  const { reference } = scenario;

  async function remove() {
    try {
      await api.deleteScenario(initiativeId, scenario.requirementId, scenario.id);
      onDeleted();
    } catch (e) {
      setConfirming(false);
      setError(toError(e));
    }
  }

  return (
    <li className="scenario" aria-labelledby={titleId}>
      <div className="scenario-header">
        <h4 id={titleId} className="scenario-title">
          <span className="code">{reference}</span> {scenario.title}
        </h4>
        {canEdit && !editing && !confirming && (
          <span className="scenario-actions">
            <button type="button" className="ghost" aria-label={t('scenario.editLabel', { reference })} onClick={() => setEditing(true)}>
              {t('scenario.edit')}
            </button>
            <button
              type="button"
              className="ghost"
              disabled={first}
              aria-label={t('scenario.moveUpLabel', { reference })}
              onClick={() => onMove(-1)}
            >
              {t('scenario.moveUp')}
            </button>
            <button
              type="button"
              className="ghost"
              disabled={last}
              aria-label={t('scenario.moveDownLabel', { reference })}
              onClick={() => onMove(1)}
            >
              {t('scenario.moveDown')}
            </button>
            <button type="button" className="ghost" aria-label={t('scenario.deleteLabel', { reference })} onClick={() => setConfirming(true)}>
              {t('scenario.delete')}
            </button>
          </span>
        )}
      </div>
      {editing ? (
        <EditScenario
          initiativeId={initiativeId}
          scenario={scenario}
          onSaved={(next) => {
            onSaved(next);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : scenario.text ? (
        <pre className="gherkin-text">{scenario.text}</pre>
      ) : (
        <p>
          <small>{t('scenario.textEmpty')}</small>
        </p>
      )}
      {confirming && (
        <div role="alertdialog" aria-labelledby={`scenario-delete-${scenario.id}`} className="confirm">
          <p id={`scenario-delete-${scenario.id}`}>{t('scenario.deleteConfirm', { reference, title: scenario.title })}</p>
          <button type="button" autoFocus onClick={() => setConfirming(false)}>
            {t('common.cancel')}
          </button>{' '}
          <button type="button" className="danger" onClick={() => void remove()}>
            {t('scenario.deleteConfirmButton')}
          </button>
        </div>
      )}
      <ErrorMessage error={error} />
    </li>
  );
}

/**
 * Modification d'un scénario, basée sur son état à l'ouverture (D14). Si quelqu'un
 * l'a modifié entre-temps, l'enregistrement est refusé : « Recharger le scénario »
 * remplace la saisie par l'état actuel, sur lequel refaire la modification.
 */
function EditScenario({
  initiativeId,
  scenario,
  onSaved,
  onCancel,
}: {
  initiativeId: string;
  scenario: ScenarioDto;
  onSaved: (scenario: ScenarioDto) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [base, setBase] = useState(scenario);
  const [latest, setLatest] = useState<ScenarioDto | null>(null);
  // Change à chaque rechargement : le formulaire repart de l'état actuel.
  const [formKey, setFormKey] = useState(0);

  return (
    <>
      <ScenarioForm
        key={formKey}
        legend={t('scenario.edit')}
        submitLabel={t('scenario.save')}
        initial={{ title: base.title, text: base.text }}
        onSave={async (values) => {
          try {
            const parsed = updateScenarioSchema.parse({ baseRowVersion: base.rowVersion, ...values });
            onSaved(await api.updateScenario(initiativeId, scenario.requirementId, scenario.id, parsed));
          } catch (e) {
            if (e instanceof ApiError && e.refusal === 'scenarioChangedSince') {
              setLatest((e.body as ScenarioChangedSinceBody).scenario);
            }
            throw e;
          }
        }}
        onCancel={onCancel}
      />
      {latest && (
        <button
          type="button"
          onClick={() => {
            setBase(latest);
            setLatest(null);
            setFormKey((k) => k + 1);
          }}
        >
          {t('scenario.reload')}
        </button>
      )}
    </>
  );
}

/** Titre et texte d'un scénario, déclarés pour l'alerte de modification non enregistrée. */
function ScenarioForm({
  legend,
  submitLabel,
  initial,
  onSave,
  onCancel,
}: {
  legend: string;
  submitLabel: string;
  initial: { title: string; text: string };
  /** Lève l'erreur de l'API : elle s'affiche sous le formulaire. */
  onSave: (values: { title: string; text: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState(initial.title);
  const [text, setText] = useState(initial.text);
  const [error, setError] = useState<UiError | null>(null);
  const submit = useUnsavedForm({ title, text }, save);

  async function save() {
    // Même schéma de validation que l'API (@app/shared) : le Gherkin n'est pas contrôlé (D11).
    const parsed = createScenarioSchema.safeParse({ title, text });
    if (!parsed.success) {
      setError({ key: 'scenario.invalid' });
      return false;
    }
    try {
      await onSave(parsed.data);
      setError(null);
      return true;
    } catch (e) {
      setError(toError(e));
      return false;
    }
  }

  return (
    <form className="stacked scenario-form" onSubmit={submit}>
      <fieldset>
        <legend>{legend}</legend>
        <label>
          {t('scenario.title')}
          <input data-autofocus value={title} maxLength={SCENARIO_TITLE_MAX_LENGTH} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          {t('scenario.text')}
          <textarea
            className="gherkin-input"
            value={text}
            rows={8}
            maxLength={SCENARIO_TEXT_MAX_LENGTH}
            spellCheck={false}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <small>{t('scenario.textHint')}</small>
      </fieldset>
      <div>
        <button type="submit">{submitLabel}</button>{' '}
        <button type="button" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
      <ErrorMessage error={error} />
    </form>
  );
}
