// Scénarios Gherkin (phase 3, tickets 01 à 05) : section « Scénarios » de la
// fiche d'une exigence de solution fonctionnelle, avec en tête la langue et le
// Contexte de sa Fonctionnalité, l'historique et la validation de syntaxe de chacun, et l'export .feature. Règles dans
// @app/shared (scenarios.ts, roles.ts) ; décisions D1 à D19 de
// .scratch/phase-3/spec.md. Web seulement (D19).
import {
  BACKGROUND_TEXT_MAX_LENGTH,
  type BackgroundChangedSinceBody,
  type BackgroundDto,
  backgroundHistory,
  createScenarioSchema,
  featureFile,
  featureFileName,
  type FeatureDto,
  type GherkinChange,
  type GherkinHistoryEntry,
  type Locale,
  LOCALES,
  memberName,
  moveScenario,
  newFeatureLanguage,
  saveBackgroundSchema,
  SCENARIO_TEXT_MAX_LENGTH,
  SCENARIO_TITLE_MAX_LENGTH,
  type ScenarioChangedSinceBody,
  type ScenarioDto,
  scenarioHistory,
  type ScenarioSnapshot,
  updateScenarioSchema,
} from '@app/shared';
import { ArrowDown, ArrowUp, Download } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { api, ApiError } from './api';
import { saveFile } from './download';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { GherkinCheck } from './gherkin-check';
import { formatDateTime } from './team-section';
import { useUnsavedForm } from './unsaved-changes';

/** Saisie refusée par le schéma de l'API (400 sans motif) : `invalid` ; sinon le motif du refus. */
const toError = (e: unknown, invalid: UiError = { key: 'scenario.invalid' }): UiError =>
  e instanceof ApiError && e.status === 400 && !e.refusal ? invalid : toUiError(e);

/** Fonctionnalité sans langue ni Contexte : rien n'a encore été créé (D5). */
export const NO_FEATURE: FeatureDto = { language: null, background: null };

/**
 * Scénarios d'une exigence, dans leur ordre (D9), précédés de la langue et du
 * Contexte de la Fonctionnalité (D5, D12) : tout membre lit ; propriétaires et
 * contributeurs écrivent, ordonnent, suppriment et changent la langue (D17). La
 * liste et la Fonctionnalité sont tenues par la fiche, qui en a besoin pour figer
 * le type (D2) et confirmer la suppression (D3).
 */
export function ScenariosSection({
  initiativeId,
  requirementId,
  scenarios,
  feature,
  canEdit,
  onChange,
  onFeatureChange,
}: {
  initiativeId: string;
  requirementId: string;
  scenarios: ScenarioDto[];
  feature: FeatureDto;
  canEdit: boolean;
  onChange: (scenarios: ScenarioDto[]) => void;
  onFeatureChange: (feature: FeatureDto) => void;
}) {
  const { t, locale } = useI18n();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  // Langue de la validation (D15) : celle de la Fonctionnalité, sinon celle que lui donnera l'auteur (D5).
  const language = feature.language ?? newFeatureLanguage(locale, null);

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
      <ExportFeatureButton initiativeId={initiativeId} requirementId={requirementId} language={language} onError={setError} />
      {feature.language && (
        <FeatureLanguage
          initiativeId={initiativeId}
          requirementId={requirementId}
          language={feature.language}
          canEdit={canEdit}
          onChange={onFeatureChange}
        />
      )}
      <Background
        initiativeId={initiativeId}
        requirementId={requirementId}
        background={feature.background}
        language={language}
        canEdit={canEdit}
        onChange={onFeatureChange}
      />
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
              language={language}
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
            language={language}
            onSave={async (values) => {
              // Créé en dernier (D9) ; le premier fixe la langue à celle de son auteur (D5).
              onChange([...scenarios, await api.createScenario(initiativeId, requirementId, { ...values, language: locale })]);
              setAdding(false);
              if (!feature.language) api.getFeature(initiativeId, requirementId).then(onFeatureChange, () => undefined);
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

/**
 * Export .feature (ticket 05, D16), pour tout membre, même sur une initiative
 * archivée (D17) : l'exigence, sa Fonctionnalité et ses scénarios relus au clic,
 * enregistrés par le navigateur. Tant que la langue n'est pas fixée (ni scénario
 * ni Contexte), celle que la section affiche : celle de l'utilisateur (D5).
 */
function ExportFeatureButton({
  initiativeId,
  requirementId,
  language,
  onError,
}: {
  initiativeId: string;
  requirementId: string;
  language: Locale;
  onError: (error: UiError) => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  async function exportFeature() {
    setBusy(true);
    try {
      const [requirement, feature, scenarios] = await Promise.all([
        api.getRequirement(initiativeId, requirementId),
        api.getFeature(initiativeId, requirementId),
        api.listScenarios(initiativeId, requirementId),
      ]);
      const content = featureFile({
        requirement,
        // Relue : un autre membre a pu la fixer ou la changer entre-temps.
        language: feature.language ?? language,
        background: feature.background?.text ?? null,
        scenarios,
      });
      saveFile(content, 'text/plain;charset=utf-8', featureFileName(requirement.reference));
    } catch (e) {
      onError(toUiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <p>
      <button type="button" className="ghost" disabled={busy} onClick={() => void exportFeature()}>
        <Download />
        {t('feature.export')}
      </button>
    </p>
  );
}

/**
 * Langue de la Fonctionnalité (D5), visible de tous ; propriétaires et
 * contributeurs la changent, enregistrée aussitôt, sans traduire aucun texte.
 */
function FeatureLanguage({
  initiativeId,
  requirementId,
  language,
  canEdit,
  onChange,
}: {
  initiativeId: string;
  requirementId: string;
  language: Locale;
  canEdit: boolean;
  onChange: (feature: FeatureDto) => void;
}) {
  const { t } = useI18n();
  const [error, setError] = useState<UiError | null>(null);

  async function change(next: Locale) {
    try {
      onChange(await api.setFeatureLanguage(initiativeId, requirementId, { language: next }));
      setError(null);
    } catch (e) {
      setError(toError(e));
    }
  }

  return (
    <div className="feature-language">
      {canEdit ? (
        <label>
          {t('feature.language')}{' '}
          <select value={language} onChange={(e) => void change(e.target.value as Locale)}>
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {t(`language.${l}`)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p>
          {t('feature.language')} : {t(`language.${language}`)}
        </p>
      )}
      <small>{t('feature.languageHint')}</small>
      <ErrorMessage error={error} />
    </div>
  );
}

/**
 * Contexte de la Fonctionnalité (D12), en tête de la section : facultatif, un au
 * plus, sans titre ni référence. Créé, modifié et supprimé par un propriétaire ou
 * un contributeur ; le premier fixe la langue s'il n'y a pas encore de scénario (D5).
 */
function Background({
  initiativeId,
  requirementId,
  background,
  language,
  canEdit,
  onChange,
}: {
  initiativeId: string;
  requirementId: string;
  background: BackgroundDto | null;
  language: Locale;
  canEdit: boolean;
  onChange: (feature: FeatureDto) => void;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const titleId = useId();

  async function remove() {
    try {
      await api.deleteBackground(initiativeId, requirementId);
      onChange(await api.getFeature(initiativeId, requirementId));
      // L'historique part avec le Contexte (D3) : un nouveau Contexte repart d'un historique vierge.
      setHistoryOpen(false);
      setConfirming(false);
      setError(null);
    } catch (e) {
      setConfirming(false);
      setError(toError(e));
    }
  }

  if (!background && !editing) {
    return canEdit ? (
      <p>
        <button type="button" onClick={() => setEditing(true)}>
          {t('background.add')}
        </button>
      </p>
    ) : null;
  }

  return (
    <div className="scenario background" aria-labelledby={titleId}>
      <div className="scenario-header">
        <h4 id={titleId} className="scenario-title">
          {t('background.title')}
        </h4>
        {background && !editing && !confirming && (
          <span className="scenario-actions">
            <button
              type="button"
              className="ghost"
              aria-expanded={historyOpen}
              aria-label={t(historyOpen ? 'background.historyHideLabel' : 'background.historyLabel')}
              onClick={() => setHistoryOpen(!historyOpen)}
            >
              {t(historyOpen ? 'scenario.historyHide' : 'scenario.history')}
            </button>
            {canEdit && (
              <>
                <button type="button" className="ghost" aria-label={t('background.editLabel')} onClick={() => setEditing(true)}>
                  {t('background.edit')}
                </button>
                <button type="button" className="ghost" aria-label={t('background.deleteLabel')} onClick={() => setConfirming(true)}>
                  {t('background.delete')}
                </button>
              </>
            )}
          </span>
        )}
      </div>
      {editing ? (
        <EditBackground
          initiativeId={initiativeId}
          requirementId={requirementId}
          background={background}
          language={language}
          onSaved={(next) => {
            onChange(next);
            setEditing(false);
          }}
          onReloaded={onChange}
          onCancel={() => setEditing(false)}
        />
      ) : (
        background && (
          <>
            <pre className="gherkin-text">{background.text}</pre>
            <GherkinCheck text={background.text} subject="background" language={language} label={t('gherkinCheck.runBackgroundLabel')} />
          </>
        )
      )}
      {background && historyOpen && (
        <GherkinHistory initiativeId={initiativeId} requirementId={requirementId} rowVersion={background.rowVersion} labelledBy={titleId} />
      )}
      {confirming && (
        <div role="alertdialog" aria-labelledby={`${titleId}-delete`} className="confirm">
          <p id={`${titleId}-delete`}>{t('background.deleteConfirm')}</p>
          <button type="button" autoFocus onClick={() => setConfirming(false)}>
            {t('common.cancel')}
          </button>{' '}
          <button type="button" className="danger" onClick={() => void remove()}>
            {t('background.deleteConfirmButton')}
          </button>
        </div>
      )}
      <ErrorMessage error={error} />
    </div>
  );
}

/**
 * Saisie du Contexte, basée sur son état à l'ouverture, absence comprise (D14).
 * Si quelqu'un l'a créé, modifié ou supprimé entre-temps, l'enregistrement est
 * refusé : « Recharger le Contexte » repart de l'état actuel.
 */
function EditBackground({
  initiativeId,
  requirementId,
  background,
  language,
  onSaved,
  onReloaded,
  onCancel,
}: {
  initiativeId: string;
  requirementId: string;
  background: BackgroundDto | null;
  language: Locale;
  onSaved: (feature: FeatureDto) => void;
  onReloaded: (feature: FeatureDto) => void;
  onCancel: () => void;
}) {
  const { t, locale } = useI18n();
  const [base, setBase] = useState(background);
  // `undefined` : pas de refus ; sinon l'état actuel du Contexte (null s'il a été supprimé).
  const [latest, setLatest] = useState<BackgroundDto | null | undefined>(undefined);
  const [formKey, setFormKey] = useState(0);

  return (
    <>
      <BackgroundForm
        key={formKey}
        submitLabel={base ? t('background.save') : t('background.create')}
        initialText={base?.text ?? ''}
        language={language}
        onSave={async (text) => {
          try {
            // Le premier Contexte fixe la langue à celle de son auteur s'il n'y a pas encore de scénario (D5).
            onSaved(await api.saveBackground(initiativeId, requirementId, { baseRowVersion: base?.rowVersion ?? null, text, language: locale }));
          } catch (e) {
            if (e instanceof ApiError && e.refusal === 'backgroundChangedSince') {
              setLatest((e.body as BackgroundChangedSinceBody).background);
            }
            throw e;
          }
        }}
        onCancel={onCancel}
      />
      {latest !== undefined && (
        <button
          type="button"
          onClick={() => {
            setBase(latest);
            setLatest(undefined);
            setFormKey((k) => k + 1);
            api.getFeature(initiativeId, requirementId).then(onReloaded, () => undefined);
          }}
        >
          {t('background.reload')}
        </button>
      )}
    </>
  );
}

/** Texte du Contexte, déclaré pour l'alerte de modification non enregistrée. */
function BackgroundForm({
  submitLabel,
  initialText,
  language,
  onSave,
  onCancel,
}: {
  submitLabel: string;
  initialText: string;
  language: Locale;
  /** Lève l'erreur de l'API : elle s'affiche sous le formulaire. */
  onSave: (text: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [text, setText] = useState(initialText);
  const [error, setError] = useState<UiError | null>(null);
  const submit = useUnsavedForm({ text }, save);

  async function save() {
    // Même schéma de validation que l'API (@app/shared) : le Gherkin n'est pas contrôlé (D11).
    const parsed = saveBackgroundSchema.safeParse({ baseRowVersion: null, text });
    if (!parsed.success) {
      setError({ key: 'background.invalid' });
      return false;
    }
    try {
      await onSave(parsed.data.text);
      setError(null);
      return true;
    } catch (e) {
      setError(toError(e, { key: 'background.invalid' }));
      return false;
    }
  }

  return (
    <form className="stacked scenario-form" onSubmit={submit}>
      <label>
        {t('background.text')}
        <textarea
          data-autofocus
          className="gherkin-input"
          value={text}
          rows={6}
          maxLength={BACKGROUND_TEXT_MAX_LENGTH}
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <small>{t('background.textHint')}</small>
      <GherkinCheck text={text} subject="background" language={language} label={t('gherkinCheck.runBackgroundLabel')} />
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

function ScenarioItem({
  initiativeId,
  scenario,
  language,
  canEdit,
  first,
  last,
  onSaved,
  onMove,
  onDeleted,
}: {
  initiativeId: string;
  scenario: ScenarioDto;
  language: Locale;
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
  const [historyOpen, setHistoryOpen] = useState(false);
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
        {!editing && !confirming && (
          <span className="scenario-actions">
            <button
              type="button"
              className="ghost"
              aria-expanded={historyOpen}
              aria-label={t(historyOpen ? 'scenario.historyHideLabel' : 'scenario.historyLabel', { reference })}
              onClick={() => setHistoryOpen(!historyOpen)}
            >
              {t(historyOpen ? 'scenario.historyHide' : 'scenario.history')}
            </button>
            {canEdit && (
              <>
                <button type="button" className="ghost" aria-label={t('scenario.editLabel', { reference })} onClick={() => setEditing(true)}>
                  {t('scenario.edit')}
                </button>
                <button
                  type="button"
                  className="ghost icon-only"
                  disabled={first}
                  aria-label={t('scenario.moveUpLabel', { reference })}
                  title={t('scenario.moveUp')}
                  onClick={() => onMove(-1)}
                >
                  <ArrowUp />
                </button>
                <button
                  type="button"
                  className="ghost icon-only"
                  disabled={last}
                  aria-label={t('scenario.moveDownLabel', { reference })}
                  title={t('scenario.moveDown')}
                  onClick={() => onMove(1)}
                >
                  <ArrowDown />
                </button>
                <button type="button" className="ghost" aria-label={t('scenario.deleteLabel', { reference })} onClick={() => setConfirming(true)}>
                  {t('scenario.delete')}
                </button>
              </>
            )}
          </span>
        )}
      </div>
      {editing ? (
        <EditScenario
          initiativeId={initiativeId}
          scenario={scenario}
          language={language}
          onSaved={(next) => {
            onSaved(next);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          {scenario.text ? (
            <pre className="gherkin-text">{scenario.text}</pre>
          ) : (
            <p>
              <small>{t('scenario.textEmpty')}</small>
            </p>
          )}
          <GherkinCheck text={scenario.text} subject="scenario" language={language} label={t('gherkinCheck.runScenarioLabel', { reference })} />
        </>
      )}
      {historyOpen && (
        <GherkinHistory
          initiativeId={initiativeId}
          requirementId={scenario.requirementId}
          scenarioId={scenario.id}
          rowVersion={scenario.rowVersion}
          labelledBy={titleId}
        />
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
  language,
  onSaved,
  onCancel,
}: {
  initiativeId: string;
  scenario: ScenarioDto;
  language: Locale;
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
        language={language}
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
  language,
  onSave,
  onCancel,
}: {
  legend: string;
  submitLabel: string;
  initial: { title: string; text: string };
  language: Locale;
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
        <GherkinCheck text={text} subject="scenario" language={language} label={t('gherkinCheck.run')} />
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

/** Le Contexte n'a qu'un champ suivi, le texte : ses entrées sont celles d'un scénario. */
type HistoryEntry = GherkinHistoryEntry<GherkinChange<ScenarioSnapshot>>;

/**
 * Historique propre à un scénario ou au Contexte (D13), consultable par tout
 * membre : qui, quand, et pour chaque champ modifié l'ancienne et la nouvelle
 * valeur. Même frise que l'historique d'une exigence ; le texte, souvent long,
 * s'affiche avant et après à la demande. Sans `scenarioId`, celui du Contexte.
 * Relu à chaque enregistrement (`rowVersion`).
 */
function GherkinHistory({
  initiativeId,
  requirementId,
  scenarioId,
  rowVersion,
  labelledBy,
}: {
  initiativeId: string;
  requirementId: string;
  scenarioId?: string;
  rowVersion: number;
  labelledBy: string;
}) {
  const { t, locale } = useI18n();
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    const loaded: Promise<HistoryEntry[]> = scenarioId
      ? api.scenarioHistory(initiativeId, requirementId, scenarioId).then(scenarioHistory)
      : api.backgroundHistory(initiativeId, requirementId).then(backgroundHistory);
    loaded.then(setEntries, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, requirementId, scenarioId, rowVersion]);

  if (error) return <ErrorMessage error={error} />;
  if (!entries) return <p role="status">{t('common.loading')}</p>;
  const empty = <em>{t('scenario.historyEmptyText')}</em>;
  return (
    <section className="gherkin-history" aria-labelledby={labelledBy}>
      <ol className="timeline">
        {entries.map((entry, index) => (
          // Deux modifications d'une même transaction ont la même date : la place suffit, la liste est relue en entier.
          <li key={index}>
            <span className="timeline-when">
              {t(entry.kind === 'created' ? 'scenario.historyCreated' : 'scenario.historyUpdated', {
                date: formatDateTime(locale, entry.changedAt),
                name: memberName(entry.changedBy),
              })}
            </span>
            {entry.changes.length > 0 && (
              <table className="change-table">
                <thead>
                  <tr>
                    <td />
                    <th scope="col">{t('requirement.historyBefore')}</th>
                    <th scope="col">{t('requirement.historyAfter')}</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.changes.map((change) =>
                    change.field === 'text' ? (
                      <tr key={change.field}>
                        <th scope="row">{t('scenario.text')}</th>
                        <td colSpan={2}>
                          <details>
                            <summary>{t('scenario.historyShowText')}</summary>
                            <div className="change-statement">
                              <pre className="gherkin-text change-before">{change.from || empty}</pre>
                              <pre className="gherkin-text">{change.to || empty}</pre>
                            </div>
                          </details>
                        </td>
                      </tr>
                    ) : (
                      <tr key={change.field}>
                        <th scope="row">{t('scenario.title')}</th>
                        <td className="change-before">{change.from}</td>
                        <td>{change.to}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
