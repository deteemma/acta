// Administration des types de ticket et de leurs statuts (ticket 29, décisions 03
// et 14) : liste des types avec leur acronyme ; déplier un type montre ses
// statuts, leur famille et « fermé », et les formulaires. Modèle : l'onglet des
// statuts d'exigence. Les contrôles et les refus suivent @app/shared
// (ticket-type-catalog.ts).
import {
  ACRONYM_MAX_LENGTH,
  ADDED_STATUS_TONES,
  type AddedStatusTone,
  type AdminTicketStatusDto,
  type AdminTicketTypeDto,
  checkTicketStatusCreation,
  checkTicketStatusDeletion,
  checkTicketStatusUpdate,
  checkTicketTypeCreation,
  checkTicketTypeDeletion,
  checkTicketTypeUpdate,
  type CreateTicketStatusInput,
  createTicketStatusSchema,
  createTicketTypeSchema,
  isTicketTypeRefusal,
  LOCALES,
  MIN_TICKET_STATUSES,
  type ReferenceCategoryDto,
  TICKET_LABEL_MAX_LENGTH,
  type TicketLabels,
  ticketLabelsSchema,
  type TicketTypeRefusal,
  type UpdateTicketStatusInput,
  type UpdateTicketTypeInput,
} from '@app/shared';
import { useEffect, useState } from 'react';
import { api, ApiError } from './api';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { setTicketTypes } from './ticket-types';
import { useUnsavedForm } from './unsaved-changes';

const refusalError = (refusal: TicketTypeRefusal): UiError => ({ key: `ticketType.refusal.${refusal}` });

/** Refus de l'API pour un type ou un statut ; ses motifs portent parfois le nom d'un autre refus. */
function ticketTypeError(error: unknown): UiError {
  if (error instanceof ApiError && isTicketTypeRefusal(error.refusal)) return refusalError(error.refusal);
  return toUiError(error);
}

export function TicketTypesSection() {
  const { t, locale } = useI18n();
  const [types, setTypes] = useState<AdminTicketTypeDto[] | null>(null);
  const [categories, setCategories] = useState<ReferenceCategoryDto[]>([]);
  const [error, setError] = useState<UiError | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const replaceTypes = (next: AdminTicketTypeDto[]) => {
    setTypes(next);
    // Création, filtres, fiches et onglet des références proposent aussitôt la nouvelle liste.
    setTicketTypes(next);
  };

  useEffect(() => {
    api.listTicketTypes().then(setTypes, (e: unknown) => setError(toUiError(e)));
  }, []);

  /** Refus des règles de @app/shared, sinon appel de l'API ; message de réussite. */
  async function run(
    refusal: TicketTypeRefusal | null,
    call: () => Promise<AdminTicketTypeDto[]>,
    message: string,
  ): Promise<boolean> {
    if (refusal) {
      setDone(null);
      setError(refusalError(refusal));
      return false;
    }
    try {
      replaceTypes(await call());
      setError(null);
      setDone(message);
      return true;
    } catch (e) {
      setDone(null);
      setError(ticketTypeError(e));
      // Refusé parce que la liste a changé entre-temps : elle est à jour.
      api.listTicketTypes().then(replaceTypes, () => undefined);
      return false;
    }
  }

  const list = types ?? [];
  const label = (labels: TicketLabels) => labels[locale];
  const toggleMessage = (kind: 'Type' | 'Status', active: boolean | undefined) =>
    active === undefined
      ? (`admin.ticket${kind}.saved` as const)
      : active
        ? (`admin.ticket${kind}.reactivated` as const)
        : (`admin.ticket${kind}.deactivated` as const);

  const actions: TypeActions = {
    updateType: (type, change) =>
      run(
        checkTicketTypeUpdate(list, type.code, change),
        () => api.updateTicketType(type.code, change),
        t(toggleMessage('Type', change.active), { label: label(change.labels ?? type.labels) }),
      ),
    removeType: (type) =>
      void run(
        checkTicketTypeDeletion(list, type.code),
        () => api.deleteTicketType(type.code),
        t('admin.ticketType.deleted', { label: label(type.labels) }),
      ),
    addStatus: (type, input) =>
      run(
        checkTicketStatusCreation(list, type.code, input),
        () => api.addTicketStatus(type.code, input),
        t('admin.ticketStatus.added', { label: label(input.labels) }),
      ),
    updateStatus: (type, status, change) =>
      run(
        checkTicketStatusUpdate(list, type.code, status.code, change),
        () => api.updateTicketStatus(type.code, status.code, change),
        t(toggleMessage('Status', change.active), { label: label(change.labels ?? status.labels) }),
      ),
    removeStatus: (type, status) =>
      void run(
        checkTicketStatusDeletion(list, type.code, status.code),
        () => api.deleteTicketStatus(type.code, status.code),
        t('admin.ticketStatus.deleted', { label: label(status.labels) }),
      ),
  };

  async function addType(input: AddTypeValues): Promise<boolean> {
    // Acronymes réservés à vie : ceux des catégories, lus au moment de l'ajout.
    let reserved = categories;
    try {
      reserved = await api.listReferenceCategories();
      setCategories(reserved);
    } catch {
      // Sans réponse, la base refuse un acronyme déjà pris (seconde barrière).
    }
    return run(
      checkTicketTypeCreation(list, reserved, input),
      () => api.addTicketType(input),
      t('admin.ticketType.added', { label: label(input.labels) }),
    );
  }

  return (
    <section>
      <h3 className="visually-hidden">{t('admin.ticketTypes')}</h3>
      <p>
        <small>{t('admin.ticketTypesHint')}</small>
      </p>
      <ErrorMessage error={error} />
      {done && <p className="notice">{done}</p>}
      {types && (
        <ul className="links dense-list ticket-type-list">
          {types.map((type) => (
            <TicketTypeItem key={type.code} type={type} actions={actions} />
          ))}
        </ul>
      )}
      <AddTicketTypeForm onAdd={addType} />
    </section>
  );
}

interface TypeActions {
  updateType: (type: AdminTicketTypeDto, change: UpdateTicketTypeInput) => Promise<boolean>;
  removeType: (type: AdminTicketTypeDto) => void;
  addStatus: (type: AdminTicketTypeDto, input: CreateTicketStatusInput) => Promise<boolean>;
  updateStatus: (type: AdminTicketTypeDto, status: AdminTicketStatusDto, change: UpdateTicketStatusInput) => Promise<boolean>;
  removeStatus: (type: AdminTicketTypeDto, status: AdminTicketStatusDto) => void;
}

/** Un type : déplié, ses statuts dans l'ordre, puis les formulaires. */
function TicketTypeItem({ type, actions }: { type: AdminTicketTypeDto; actions: TypeActions }) {
  const { t, locale } = useI18n();
  return (
    <li>
      <details className="disclosure ticket-type">
        <summary>
          <span className="disclosure-name">
            {type.labels.fr} · {type.labels.en}
          </span>
          <span className="team-controls">
            <span className="code">{type.acronym}</span>
            <small className="badge">
              {type.delivered
                ? t('admin.ticketType.delivered')
                : t(type.active ? 'admin.ticketType.active' : 'admin.ticketType.inactive')}
              {!type.delivered && type.used && ` · ${t('admin.ticketType.used')}`}
            </small>
          </span>
        </summary>
        {!type.delivered && (
          <AddedTypeForm
            // Libellés changés (ici ou par un autre administrateur) : champs remis à jour.
            key={`${type.labels.fr}:${type.labels.en}`}
            type={type}
            onSave={(labels) => actions.updateType(type, { labels })}
            onToggle={() => void actions.updateType(type, { active: !type.active })}
            onDelete={() => actions.removeType(type)}
          />
        )}
        <h4>{t('admin.ticketType.statusesOf', { type: type.labels[locale] })}</h4>
        <ol className="links dense-list team-members">
          {type.statuses.map((status, index) =>
            status.delivered ? (
              <li key={status.code}>
                <span>
                  {status.labels.fr} · {status.labels.en}
                </span>
                <StatusFacts status={status} initial={index === 0} />
              </li>
            ) : (
              <AddedStatusForm
                key={`${status.code}:${status.labels.fr}:${status.labels.en}`}
                status={status}
                initial={index === 0}
                onSave={(labels) => actions.updateStatus(type, status, { labels })}
                onToggle={() => void actions.updateStatus(type, status, { active: !status.active })}
                onDelete={() => actions.removeStatus(type, status)}
              />
            ),
          )}
        </ol>
        <AddTicketStatusForm typeLabel={type.labels[locale]} onAdd={(input) => actions.addStatus(type, input)} />
      </details>
    </li>
  );
}

/** Famille, « fermé », « initial », état d'un statut ajouté. */
function StatusFacts({ status, initial }: { status: AdminTicketStatusDto; initial: boolean }) {
  const { t } = useI18n();
  return (
    <span className="team-controls">
      <span className={`badge status tone-${status.tone}`}>{t(`statusTone.${status.tone}`)}</span>
      {status.closed && <small className="badge">{t('admin.ticketType.closed')}</small>}
      {initial && <small className="badge">{t('admin.ticketType.initial')}</small>}
      {!status.delivered && (
        <small className="badge">
          {t(status.active ? 'admin.ticketType.active' : 'admin.ticketType.inactive')}
          {status.used && ` · ${t('admin.ticketType.used')}`}
        </small>
      )}
    </span>
  );
}

function LabelInputs({
  labels,
  onChange,
  of,
  labelOf,
}: {
  labels: TicketLabels;
  onChange: (labels: TicketLabels) => void;
  /** Libellé actuel de l'élément modifié, pour nommer les champs ; absent à l'ajout. */
  of?: string;
  /** Nom des champs d'une ligne de statut à l'ajout d'un type. */
  labelOf?: (language: 'fr' | 'en') => string;
}) {
  const { t } = useI18n();
  return (
    <>
      {LOCALES.map((language) => (
        <input
          key={language}
          value={labels[language]}
          size={16}
          maxLength={TICKET_LABEL_MAX_LENGTH}
          placeholder={t(`admin.ticketType.${language}`)}
          aria-label={
            labelOf?.(language) ??
            (of ? t(`admin.ticketType.${language}Of`, { label: of }) : t(`admin.ticketType.${language}`))
          }
          onChange={(e) => onChange({ ...labels, [language]: e.target.value })}
        />
      ))}
    </>
  );
}

/** Renommer un élément ajouté : bouton actif seulement sur des libellés valides et changés. */
function useLabelsForm(current: TicketLabels, onSave: (labels: TicketLabels) => Promise<boolean>) {
  const [labels, setLabels] = useState(current);
  // Même schéma de validation que l'API (@app/shared).
  const parsed = ticketLabelsSchema.safeParse(labels);
  const unchanged = parsed.success && parsed.data.fr === current.fr && parsed.data.en === current.en;
  // Le bouton est inactif sur des libellés invalides ; l'alerte, elle, peut enregistrer.
  const [invalid, setInvalid] = useState(false);
  const submit = useUnsavedForm(labels, async () => {
    setInvalid(!parsed.success);
    if (!parsed.success) return false;
    return unchanged || onSave(parsed.data);
  });
  return { labels, setLabels, canSave: parsed.success && !unchanged, invalid, submit };
}

function AddedTypeForm({
  type,
  onSave,
  onToggle,
  onDelete,
}: {
  type: AdminTicketTypeDto;
  onSave: (labels: TicketLabels) => Promise<boolean>;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { t, locale } = useI18n();
  const form = useLabelsForm(type.labels, onSave);
  return (
    <form className="team-controls ticket-type-form" onSubmit={form.submit}>
      <LabelInputs labels={form.labels} onChange={form.setLabels} of={type.labels[locale]} />
      <button type="submit" disabled={!form.canSave}>
        {t('admin.ticketType.save')}
      </button>
      <button type="button" className={type.active ? 'danger' : undefined} onClick={onToggle}>
        {t(type.active ? 'admin.ticketType.deactivate' : 'admin.ticketType.reactivate')}
      </button>
      {/* Un type dont un ticket a déjà été créé ne se supprime pas : pas de bouton. */}
      {!type.used && (
        <button type="button" className="danger" onClick={onDelete}>
          {t('admin.ticketType.delete')}
        </button>
      )}
      {form.invalid && <ErrorMessage error={{ key: 'admin.ticketStatus.invalid' }} />}
    </form>
  );
}

function AddedStatusForm({
  status,
  initial,
  onSave,
  onToggle,
  onDelete,
}: {
  status: AdminTicketStatusDto;
  initial: boolean;
  onSave: (labels: TicketLabels) => Promise<boolean>;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { t, locale } = useI18n();
  const form = useLabelsForm(status.labels, onSave);
  return (
    <li>
      <form className="team-controls ticket-type-form" onSubmit={form.submit}>
        <LabelInputs labels={form.labels} onChange={form.setLabels} of={status.labels[locale]} />
        <StatusFacts status={status} initial={initial} />
        <button type="submit" disabled={!form.canSave}>
          {t('admin.ticketType.save')}
        </button>
        {/* Statut initial ou dernier fermé actif : le refus s'affiche au clic. */}
        <button type="button" className={status.active ? 'danger' : undefined} onClick={onToggle}>
          {t(status.active ? 'admin.ticketType.deactivate' : 'admin.ticketType.reactivate')}
        </button>
        {/* Un statut déjà porté ne se supprime pas : pas de bouton. */}
        {!status.used && (
          <button type="button" className="danger" onClick={onDelete}>
            {t('admin.ticketType.delete')}
          </button>
        )}
        {form.invalid && <ErrorMessage error={{ key: 'admin.ticketStatus.invalid' }} />}
      </form>
    </li>
  );
}

/** Champs d'un statut à ajouter : libellés, famille (neutre par défaut), fermé ou non. */
interface StatusRow {
  fr: string;
  en: string;
  tone: AddedStatusTone;
  closed: boolean;
}

const emptyRow = (closed = false): StatusRow => ({ fr: '', en: '', tone: 'neutral', closed });

const statusInput = (row: StatusRow): CreateTicketStatusInput => ({
  labels: { fr: row.fr, en: row.en },
  tone: row.tone,
  closed: row.closed,
});

function StatusRowInputs({ row, n, onChange }: { row: StatusRow; n?: number; onChange: (row: StatusRow) => void }) {
  const { t } = useI18n();
  return (
    <>
      <LabelInputs
        labels={row}
        onChange={(labels) => onChange({ ...row, ...labels })}
        labelOf={
          n === undefined
            ? undefined
            : (language) => t(language === 'fr' ? 'admin.ticketType.statusFrOf' : 'admin.ticketType.statusEnOf', { n })
        }
      />
      <select
        value={row.tone}
        aria-label={n === undefined ? t('admin.ticketType.tone') : t('admin.ticketType.toneOf', { n })}
        onChange={(e) => onChange({ ...row, tone: e.target.value as AddedStatusTone })}
      >
        {ADDED_STATUS_TONES.map((tone) => (
          <option key={tone} value={tone}>
            {t(`statusTone.${tone}`)}
          </option>
        ))}
      </select>
      <label className="inline">
        <input
          type="checkbox"
          checked={row.closed}
          aria-label={n === undefined ? undefined : t('admin.ticketType.closedOf', { n })}
          onChange={(e) => onChange({ ...row, closed: e.target.checked })}
        />
        {t('admin.ticketType.closedLabel')}
      </label>
    </>
  );
}

function AddTicketStatusForm({ typeLabel, onAdd }: { typeLabel: string; onAdd: (input: CreateTicketStatusInput) => Promise<boolean> }) {
  const { t } = useI18n();
  const [row, setRow] = useState(emptyRow());
  const [invalid, setInvalid] = useState(false);
  const submit = useUnsavedForm({ ...row }, async () => {
    // Même schéma de validation que l'API (@app/shared).
    const parsed = createTicketStatusSchema.safeParse(statusInput(row));
    setInvalid(!parsed.success);
    if (!parsed.success || !(await onAdd(parsed.data))) return false;
    const next = emptyRow();
    setRow(next);
    return { ...next };
  });
  return (
    <form className="stacked invite" onSubmit={submit}>
      <h5>{t('admin.ticketType.addStatusTitle', { type: typeLabel })}</h5>
      <div className="team-controls ticket-type-form">
        <StatusRowInputs row={row} onChange={setRow} />
      </div>
      <button type="submit">{t('admin.ticketType.addStatus')}</button>
      {invalid && <ErrorMessage error={{ key: 'admin.ticketStatus.invalid' }} />}
    </form>
  );
}

/** Saisie d'un type à ajouter ; les statuts, dans l'ordre (le premier est l'initial). */
type AddTypeValues = ReturnType<typeof createTicketTypeSchema.parse>;

const newTypeRows = () => [emptyRow(), emptyRow(true)];

function AddTicketTypeForm({ onAdd }: { onAdd: (input: AddTypeValues) => Promise<boolean> }) {
  const { t } = useI18n();
  const [labels, setLabels] = useState<TicketLabels>({ fr: '', en: '' });
  const [acronym, setAcronym] = useState('');
  const [rows, setRows] = useState<StatusRow[]>(newTypeRows);
  const [invalid, setInvalid] = useState(false);
  // Les lignes de statut, en texte : l'alerte de modification non enregistrée compare des valeurs simples.
  const values = { fr: labels.fr, en: labels.en, acronym, statuses: JSON.stringify(rows) };
  const submit = useUnsavedForm(values, async () => {
    // Même schéma de validation que l'API (@app/shared).
    const parsed = createTicketTypeSchema.safeParse({ labels, acronym, statuses: rows.map(statusInput) });
    setInvalid(!parsed.success);
    if (!parsed.success || !(await onAdd(parsed.data))) return false;
    const next = newTypeRows();
    setLabels({ fr: '', en: '' });
    setAcronym('');
    setRows(next);
    return { fr: '', en: '', acronym: '', statuses: JSON.stringify(next) };
  });
  const setRow = (index: number, row: StatusRow) => setRows(rows.map((r, i) => (i === index ? row : r)));
  return (
    <form className="stacked invite" onSubmit={submit}>
      <h4>{t('admin.ticketType.addTitle')}</h4>
      <div className="team-controls ticket-type-form">
        <LabelInputs labels={labels} onChange={setLabels} />
        <input
          value={acronym}
          size={5}
          maxLength={ACRONYM_MAX_LENGTH}
          placeholder={t('admin.ticketType.acronym')}
          aria-label={t('admin.ticketType.acronym')}
          onChange={(e) => setAcronym(e.target.value.toUpperCase())}
        />
      </div>
      <small>{t('admin.ticketType.statusesHint')}</small>
      <ol className="ticket-type-rows">
        {rows.map((row, index) => (
          <li key={index} className="team-controls ticket-type-form">
            <StatusRowInputs row={row} n={index + 1} onChange={(next) => setRow(index, next)} />
            {rows.length > MIN_TICKET_STATUSES && (
              <button
                type="button"
                className="link"
                onClick={() => setRows(rows.filter((_, i) => i !== index))}
              >
                {t('admin.ticketType.removeStatusRow', { n: index + 1 })}
              </button>
            )}
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => setRows([...rows, emptyRow()])}>
        {t('admin.ticketType.addStatusRow')}
      </button>
      <button type="submit">{t('admin.ticketType.add')}</button>
      {invalid && <ErrorMessage error={{ key: 'admin.ticketType.invalid' }} />}
    </form>
  );
}
