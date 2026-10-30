// Contenu des panneaux : fiche d'une initiative, membre, création rapide.
import {
  type ActionDto,
  ANALYSIS_APPROACHES,
  type BabokDto,
  type AnalysisApproach,
  can,
  createInitiativeSchema,
  englishTermTooltip,
  type InitiativeDto,
  type InitiativeMemberDto,
  INITIATIVE_DESCRIPTION_MAX_LENGTH,
  type Locale,
  type OwnerDesignationDto,
  sortByDueDate,
  type StakeholderDto,
  updateInitiativeSchema,
} from '@app/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { ActionList } from './action-panels';
import { api, ApiError } from './api';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { Panel, usePanels } from './panels';
import { memberName, TeamSection } from './team-section';

/** Date AAAA-MM-JJ ou horodatage, affiché dans la langue de l'interface. */
export function formatDate(locale: Locale, date: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: date.length === 10 ? 'UTC' : undefined }).format(
    new Date(date),
  );
}

export function InitiativePanel({
  initiativeId,
  babok,
  actionsVersion,
  stakeholdersVersion,
  onChanged,
  onDeleted,
  onClose,
}: {
  initiativeId: string;
  babok: BabokDto | null;
  /** Change à chaque écriture sur une action : la liste des actions se recharge. */
  actionsVersion: number;
  /** Change à chaque écriture sur une partie prenante. */
  stakeholdersVersion: number;
  onChanged: (initiative: InitiativeDto) => void;
  onDeleted: (initiativeId: string) => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { open } = usePanels();
  const [initiative, setInitiative] = useState<InitiativeDto | null>(null);
  const [members, setMembers] = useState<InitiativeMemberDto[] | null>(null);
  const [designations, setDesignations] = useState<OwnerDesignationDto[]>([]);
  const [actions, setActions] = useState<ActionDto[]>([]);
  const [stakeholders, setStakeholders] = useState<StakeholderDto[]>([]);
  const [error, setError] = useState<UiError | null>(null);

  // Rechargée après chaque changement de l'équipe : il peut changer mon rôle.
  const load = () =>
    Promise.all([
      api.getInitiative(initiativeId),
      api.listMembers(initiativeId),
      api.listOwnerDesignations(initiativeId),
    ]).then(([i, m, d]) => {
      changed(i);
      setMembers(m);
      setDesignations(d);
    }, (e: unknown) => setError(toUiError(e)));

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initiativeId]);

  useEffect(() => {
    api.listActions(initiativeId).then(setActions, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, actionsVersion]);

  useEffect(() => {
    api.listStakeholders(initiativeId).then(setStakeholders, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, stakeholdersVersion]);

  function changed(next: InitiativeDto) {
    setInitiative(next);
    onChanged(next);
  }

  const state = { archived: initiative?.archivedAt != null };

  return (
    <Panel title={initiative ? `${initiative.code} · ${initiative.name}` : t('common.loading')} onClose={onClose}>
      <ErrorMessage error={error} />
      {initiative && members && (
        <>
          {initiative.archivedAt && (
            <p className="notice">{t('initiative.archivedOn', { date: formatDate(locale, initiative.archivedAt) })}</p>
          )}
          {can(initiative.myRole, 'edit', state) ? (
            <InitiativeForm initiative={initiative} onSaved={changed} />
          ) : (
            <InitiativeDetails initiative={initiative} />
          )}
          <dl>
            <dt>{t('initiative.myRole')}</dt>
            <dd>{t(`role.${initiative.myRole}`)}</dd>
          </dl>
          <h3>{t('actions.section')}</h3>
          <ActionList actions={sortByDueDate(actions)} babok={babok} />
          {actions.length === 0 && <p>{t('actions.sectionEmpty')}</p>}
          <div className="section-header">
            <h3 title={englishTermTooltip(locale, 'stakeholders.section')}>{t('stakeholders.section')}</h3>
            <button type="button" onClick={() => open({ kind: 'stakeholders', initiativeId })}>
              {t('stakeholders.open')}
            </button>
          </div>
          <p>
            {stakeholders.length === 0
              ? t('stakeholders.sectionEmpty')
              : t('stakeholders.sectionCount', { count: stakeholders.length })}
          </p>
          <TeamSection
            initiative={initiative}
            members={members}
            designations={designations}
            onChanged={() => void load()}
            onLeft={() => {
              // L'initiative quitte la liste, comme une suppression.
              onDeleted(initiative.id);
              onClose();
            }}
          />
          {can(initiative.myRole, 'archive', state) && (
            <OwnerActions
              initiative={initiative}
              onChanged={changed}
              onDeleted={() => {
                onDeleted(initiative.id);
                onClose();
              }}
            />
          )}
        </>
      )}
    </Panel>
  );
}

/** Approche d'analyse : terme du BABOK, l'anglais en info-bulle (ADR-0013). */
function ApproachLabel({ approach }: { approach: AnalysisApproach }) {
  const { t, locale } = useI18n();
  return <span title={englishTermTooltip(locale, `approach.${approach}`)}>{t(`approach.${approach}`)}</span>;
}

/** Fiche en lecture seule : lecteur, ou initiative archivée. */
function InitiativeDetails({ initiative }: { initiative: InitiativeDto }) {
  const { t, locale } = useI18n();
  const notSet = <small>{t('initiative.notSet')}</small>;
  return (
    <dl>
      <dt>{t('initiative.code')}</dt>
      <dd>{initiative.code}</dd>
      <dt>{t('initiative.name')}</dt>
      <dd>{initiative.name}</dd>
      <dt>{t('initiative.description')}</dt>
      <dd className="multiline">{initiative.description ?? notSet}</dd>
      <dt title={englishTermTooltip(locale, 'initiative.analysisApproach')}>{t('initiative.analysisApproach')}</dt>
      <dd>{initiative.analysisApproach ? <ApproachLabel approach={initiative.analysisApproach} /> : notSet}</dd>
      <dt>{t('initiative.startDate')}</dt>
      <dd>{initiative.startDate ? formatDate(locale, initiative.startDate) : notSet}</dd>
      <dt>{t('initiative.plannedEndDate')}</dt>
      <dd>{initiative.plannedEndDate ? formatDate(locale, initiative.plannedEndDate) : notSet}</dd>
    </dl>
  );
}

/** Fiche modifiable : propriétaire et contributeurs ; le code est réservé au propriétaire. */
function InitiativeForm({ initiative, onSaved }: { initiative: InitiativeDto; onSaved: (i: InitiativeDto) => void }) {
  const { t, locale } = useI18n();
  const canEditCode = can(initiative.myRole, 'editCode');
  const [code, setCode] = useState(initiative.code);
  const [name, setName] = useState(initiative.name);
  const [description, setDescription] = useState(initiative.description ?? '');
  const [approach, setApproach] = useState<AnalysisApproach | null>(initiative.analysisApproach);
  const [startDate, setStartDate] = useState(initiative.startDate ?? '');
  const [plannedEndDate, setPlannedEndDate] = useState(initiative.plannedEndDate ?? '');
  const [error, setError] = useState<UiError | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    // Même schéma de validation que l'API (@app/shared).
    const parsed = updateInitiativeSchema.safeParse({
      ...(canEditCode ? { code } : {}),
      name,
      description,
      analysisApproach: approach,
      startDate: startDate || null,
      plannedEndDate: plannedEndDate || null,
    });
    if (!parsed.success) {
      const codeIssue = parsed.error.issues.some((issue) => issue.path[0] === 'code');
      setError({ key: codeIssue ? 'initiatives.invalid' : 'initiative.invalid' });
      return;
    }
    try {
      onSaved(await api.updateInitiative(initiative.id, parsed.data));
      setError(null);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 400 ? { key: 'initiative.invalid' } : toUiError(e));
    }
  }

  const edited = () => setSaved(false);

  return (
    <form className="stacked" onSubmit={(e) => void save(e)} onChange={edited}>
      <label>
        {t('initiative.code')}
        {canEditCode ? (
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        ) : (
          <input value={code} readOnly aria-readonly="true" />
        )}
      </label>
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

/** Archiver / désarchiver, supprimer après confirmation (règles dans @app/shared : propriétaire). */
function OwnerActions({
  initiative,
  onChanged,
  onDeleted,
}: {
  initiative: InitiativeDto;
  onChanged: (i: InitiativeDto) => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
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
    run(async () =>
      onChanged(
        await (initiative.archivedAt
          ? api.unarchiveInitiative(initiative.id)
          : api.archiveInitiative(initiative.id)),
      ),
    );

  return (
    <section className="owner-actions">
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
            {t(initiative.archivedAt ? 'initiative.unarchive' : 'initiative.archive')}
          </button>{' '}
          {can(initiative.myRole, 'delete', { archived: initiative.archivedAt != null }) && (
            <button type="button" className="danger" onClick={() => setConfirming(true)}>
              {t('initiative.delete')}
            </button>
          )}
        </>
      )}
      <ErrorMessage error={error} />
    </section>
  );
}

export function MemberPanel({ member, onClose }: { member: InitiativeMemberDto; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Panel title={memberName(member)} onClose={onClose}>
      <dl>
        <dt>{t('member.email')}</dt>
        <dd>{member.email ?? '—'}</dd>
        <dt>{t('member.role')}</dt>
        <dd>{t(`role.${member.role}`)}</dd>
        <dt>{t('member.teamBa')}</dt>
        <dd>{t(member.isTeamBa ? 'common.yes' : 'common.no')}</dd>
      </dl>
    </Panel>
  );
}

/** Création rapide, ouverte par le bouton flottant « + ». La fiche créée remplace le panneau. */
export function CreateInitiativePanel({
  onCreated,
  onClose,
}: {
  onCreated: (initiative: InitiativeDto) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { replace } = usePanels();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<UiError | null>(null);

  async function create(event: FormEvent) {
    event.preventDefault();
    // Même schéma de validation que l'API (@app/shared).
    const parsed = createInitiativeSchema.safeParse({ code, name });
    if (!parsed.success) {
      setError({ key: 'initiatives.invalid' });
      return;
    }
    try {
      const initiative = await api.createInitiative(parsed.data);
      onCreated(initiative);
      replace({ kind: 'initiative', initiativeId: initiative.id });
    } catch (e) {
      setError(toUiError(e));
    }
  }

  return (
    <Panel title={t('initiatives.new')} onClose={onClose}>
      <form className="stacked" onSubmit={(e) => void create(e)}>
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
    </Panel>
  );
}
