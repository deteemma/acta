// Fiche d'une initiative (onglets Aperçu et Paramètres de l'écran de données,
// ADR-0021), membre, création en fenêtre de dialogue.
import {
  ANALYSIS_APPROACHES,
  type AnalysisApproach,
  can,
  canEditInitiativeCode,
  createInitiativeSchema,
  englishTermTooltip,
  type InitiativeDto,
  type InitiativeMemberDto,
  INITIATIVE_DESCRIPTION_MAX_LENGTH,
  type Locale,
  updateInitiativeSchema,
} from '@app/shared';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api, ApiError } from './api';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { Dialog, useCloseSilently, useSettleUnsaved } from './dialogs';
import { TextWithReferences } from './rich-text';
import { useUnsavedForm } from './unsaved-changes';

/** Date AAAA-MM-JJ ou horodatage, affiché dans la langue de l'interface. */
export function formatDate(locale: Locale, date: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: date.length === 10 ? 'UTC' : undefined }).format(
    new Date(date),
  );
}

/** Approche d'analyse : terme du BABOK, l'anglais en info-bulle (ADR-0013). */
function ApproachLabel({ approach }: { approach: AnalysisApproach }) {
  const { t, locale } = useI18n();
  return <span title={englishTermTooltip(locale, `approach.${approach}`)}>{t(`approach.${approach}`)}</span>;
}

/** Fiche en lecture seule : lecteur, ou initiative archivée. Le code est dans l'onglet Paramètres. */
export function InitiativeDetails({ initiative }: { initiative: InitiativeDto }) {
  const { t, locale } = useI18n();
  const notSet = <small>{t('initiative.notSet')}</small>;
  return (
    <dl>
      <dt>{t('initiative.name')}</dt>
      <dd>{initiative.name}</dd>
      <dt>{t('initiative.description')}</dt>
      <dd className="multiline">{initiative.description ? <TextWithReferences text={initiative.description} /> : notSet}</dd>
      <dt title={englishTermTooltip(locale, 'initiative.analysisApproach')}>{t('initiative.analysisApproach')}</dt>
      <dd>{initiative.analysisApproach ? <ApproachLabel approach={initiative.analysisApproach} /> : notSet}</dd>
      <dt>{t('initiative.startDate')}</dt>
      <dd>{initiative.startDate ? formatDate(locale, initiative.startDate) : notSet}</dd>
      <dt>{t('initiative.plannedEndDate')}</dt>
      <dd>{initiative.plannedEndDate ? formatDate(locale, initiative.plannedEndDate) : notSet}</dd>
    </dl>
  );
}

/** Fiche modifiable : propriétaire et contributeurs. Le code est dans l'onglet Paramètres. */
export function InitiativeForm({ initiative, onSaved }: { initiative: InitiativeDto; onSaved: (i: InitiativeDto) => void }) {
  const { t, locale } = useI18n();
  const [name, setName] = useState(initiative.name);
  const [description, setDescription] = useState(initiative.description ?? '');
  const [approach, setApproach] = useState<AnalysisApproach | null>(initiative.analysisApproach);
  const [startDate, setStartDate] = useState(initiative.startDate ?? '');
  const [plannedEndDate, setPlannedEndDate] = useState(initiative.plannedEndDate ?? '');
  const [error, setError] = useState<UiError | null>(null);
  const [saved, setSaved] = useState(false);
  const submit = useUnsavedForm({ name, description, approach, startDate, plannedEndDate }, save);

  async function save(): Promise<boolean> {
    setSaved(false);
    // Même schéma de validation que l'API (@app/shared).
    const parsed = updateInitiativeSchema.safeParse({
      name,
      description,
      analysisApproach: approach,
      startDate: startDate || null,
      plannedEndDate: plannedEndDate || null,
    });
    if (!parsed.success) {
      setError({ key: 'initiative.invalid' });
      return false;
    }
    try {
      onSaved(await api.updateInitiative(initiative.id, parsed.data));
      setError(null);
      setSaved(true);
      return true;
    } catch (e) {
      setError(e instanceof ApiError && e.status === 400 ? { key: 'initiative.invalid' } : toUiError(e));
      return false;
    }
  }

  const edited = () => setSaved(false);

  return (
    <form className="stacked" onSubmit={submit} onChange={edited}>
      <label>
        {t('initiative.name')}
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        {t('initiative.description')}
        <textarea
          rows={5}
          maxLength={INITIATIVE_DESCRIPTION_MAX_LENGTH}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <fieldset>
        <legend title={englishTermTooltip(locale, 'initiative.analysisApproach')}>
          {t('initiative.analysisApproach')}
        </legend>
        <label className="inline">
          <input type="radio" name="approach" checked={approach === null} onChange={() => setApproach(null)} />
          {t('initiative.notSet')}
        </label>
        {ANALYSIS_APPROACHES.map((a) => (
          <label key={a} className="inline">
            <input type="radio" name="approach" checked={approach === a} onChange={() => setApproach(a)} />
            <ApproachLabel approach={a} />
          </label>
        ))}
      </fieldset>
      <div className="dates">
        <label>
          {t('initiative.startDate')}
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label>
          {t('initiative.plannedEndDate')}
          <input
            type="date"
            min={startDate || undefined}
            value={plannedEndDate}
            onChange={(e) => setPlannedEndDate(e.target.value)}
          />
        </label>
      </div>
      <button type="submit">{t('initiative.save')}</button>
      <ErrorMessage error={error} />
      <p role="status">{saved && t('initiative.saved')}</p>
    </form>
  );
}

/**
 * Code de l'initiative (onglet Paramètres) : modifiable par le propriétaire seul,
 * tant qu'aucune référence n'a été attribuée et que l'initiative n'est pas archivée.
 */
export function InitiativeCode({ initiative, onSaved }: { initiative: InitiativeDto; onSaved: (i: InitiativeDto) => void }) {
  const { t } = useI18n();
  const editable = canEditInitiativeCode(initiative);
  const [code, setCode] = useState(initiative.code);
  const [error, setError] = useState<UiError | null>(null);
  const [saved, setSaved] = useState(false);
  const submit = useUnsavedForm({ code }, save);

  async function save(): Promise<boolean> {
    setSaved(false);
    // Même schéma de validation que l'API (@app/shared).
    const parsed = updateInitiativeSchema.safeParse({ code });
    if (!parsed.success) {
      setError({ key: 'initiatives.invalid' });
      return false;
    }
    try {
      onSaved(await api.updateInitiative(initiative.id, parsed.data));
      setError(null);
      setSaved(true);
      return true;
    } catch (e) {
      setError(e instanceof ApiError && e.status === 400 ? { key: 'initiatives.invalid' } : toUiError(e));
      return false;
    }
  }

  if (!editable) {
    return (
      <dl>
        <dt>{t('initiative.code')}</dt>
        <dd>
          <span className="code">{initiative.code}</span>
          {initiative.codeFrozen && (
            <>
              <br />
              <small>{t('initiative.codeFrozen')}</small>
            </>
          )}
        </dd>
      </dl>
    );
  }
  return (
    <form className="stacked" onSubmit={submit} onChange={() => setSaved(false)}>
      <label>
        {t('initiative.code')}
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
      </label>
      <button type="submit">{t('initiative.save')}</button>
      <ErrorMessage error={error} />
      <p role="status">{saved && t('initiative.saved')}</p>
    </form>
  );
}

/** Archiver / désarchiver, supprimer après confirmation (règles dans @app/shared : propriétaire). */
export function OwnerActions({
  initiative,
  onChanged,
  onDeleted,
}: {
  initiative: InitiativeDto;
  onChanged: (i: InitiativeDto) => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const settleUnsaved = useSettleUnsaved();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<UiError | null>(null);

  async function run(action: () => Promise<void>) {
    try {
      setError(null);
      await action();
    } catch (e) {
      setError(toUiError(e));
    }
  }

  const toggleArchive = () =>
    run(async () => {
      // La fiche va passer en lecture seule : sa saisie ne doit pas se perdre (décision 12, point 9).
      if (!initiative.archivedAt && !(await settleUnsaved())) return;
      onChanged(
        await (initiative.archivedAt
          ? api.unarchiveInitiative(initiative.id)
          : api.archiveInitiative(initiative.id)),
      );
    });

  return (
    <section className="owner-actions">
      <h3 className="group-title">{t('role.owner')}</h3>
      {confirming ? (
        <div role="alertdialog" aria-labelledby="delete-confirm" className="confirm">
          <p id="delete-confirm">{t('initiative.deleteConfirm', { code: initiative.code })}</p>
          <button type="button" autoFocus onClick={() => setConfirming(false)}>
            {t('common.cancel')}
          </button>{' '}
          <button
            type="button"
            className="danger"
            onClick={() => void run(async () => {
              await api.deleteInitiative(initiative.id);
              onDeleted();
            })}
          >
            {t('initiative.deleteConfirmButton')}
          </button>
        </div>
      ) : (
        <>
          <button type="button" onClick={() => void toggleArchive()}>
            {initiative.archivedAt ? <ArchiveRestore /> : <Archive />}
            {t(initiative.archivedAt ? 'initiative.unarchive' : 'initiative.archive')}
          </button>{' '}
          {can(initiative.myRole, 'delete', { archived: initiative.archivedAt != null }) && (
            <button type="button" className="danger" onClick={() => setConfirming(true)}>
              <Trash2 />
              {t('initiative.delete')}
            </button>
          )}
        </>
      )}
      <ErrorMessage error={error} />
    </section>
  );
}

/** Fiche d'un membre de l'équipe, en lecture. */
export function MemberDetails({ member }: { member: InitiativeMemberDto }) {
  const { t } = useI18n();
  return (
    <dl>
      <dt>{t('member.email')}</dt>
      <dd>{member.email ?? '—'}</dd>
      <dt>{t('member.role')}</dt>
      <dd>{t(`role.${member.role}`)}</dd>
      <dt>{t('member.teamBa')}</dt>
      <dd>{t(member.isTeamBa ? 'common.yes' : 'common.no')}</dd>
    </dl>
  );
}

/** Nouvelle initiative, en fenêtre de dialogue (N15) ; une fois créée, elle s'ouvre à droite. */
export function CreateInitiativeDialog({
  onCreated,
  onClose,
}: {
  /** L'initiative vient d'être créée : la liste la reçoit, l'écran de données l'affiche. */
  onCreated: (initiative: InitiativeDto) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const closeSilently = useCloseSilently();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<UiError | null>(null);
  const submit = useUnsavedForm({ code, name }, create);

  async function create(): Promise<boolean> {
    // Même schéma de validation que l'API (@app/shared).
    const parsed = createInitiativeSchema.safeParse({ code, name });
    if (!parsed.success) {
      setError({ key: 'initiatives.invalid' });
      return false;
    }
    try {
      const initiative = await api.createInitiative(parsed.data);
      // Saisie enregistrée : pas d'alerte. Enregistrée depuis l'alerte, la sortie demandée
      // se poursuit et l'écran ne suit pas la nouvelle initiative.
      closeSilently();
      onCreated(initiative);
      return true;
    } catch (e) {
      setError(toUiError(e));
      return false;
    }
  }

  return (
    <Dialog title={t('initiatives.new')} onClose={onClose}>
      <form className="stacked" onSubmit={submit}>
        <label>
          {t('initiative.code')}
          <input
            data-autofocus
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={t('initiatives.codePlaceholder')}
          />
        </label>
        <label>
          {t('initiative.name')}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('initiatives.namePlaceholder')} />
        </label>
        <button type="submit">{t('initiatives.create')}</button>
      </form>
      <ErrorMessage error={error} />
    </Dialog>
  );
}
