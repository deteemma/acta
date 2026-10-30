// Besoins (ticket 09) : liste d'une initiative, fiche d'un besoin dans un
// panneau latéral. Règles dans @app/shared (needs.ts, references.ts, roles.ts).
import {
  type ActionDto,
  type BabokDto,
  can,
  createNeedSchema,
  type InitiativeDto,
  NEED_DESCRIPTION_MAX_LENGTH,
  NEED_NATURES,
  NEED_TITLE_MAX_LENGTH,
  type NeedDto,
  type NeedNature,
  type NeedRefDto,
  type StakeholderDto,
  sortByDueDate,
} from '@app/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { ActionList } from './action-panels';
import { api, ApiError } from './api';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { Panel, usePanels } from './panels';
import { RichText, RichTextEditor } from './rich-text';
import { StakeholderLink } from './stakeholder-panels';
import { formatDateTime, memberName } from './team-section';

export const canEditNeeds = (initiative: InitiativeDto) =>
  can(initiative.myRole, 'editNeeds', { archived: initiative.archivedAt != null });

/** Bouton qui ouvre la fiche d'un besoin : sa référence et son titre. */
export function NeedLink({ initiativeId, need }: { initiativeId: string; need: NeedRefDto }) {
  const { open } = usePanels();
  return (
    <button type="button" className="link" onClick={() => open({ kind: 'need', initiativeId, needId: need.id })}>
      <strong>{need.reference}</strong> {need.title}
    </button>
  );
}

/** Besoins, dans l'ordre reçu (par référence), avec leur nature. */
export function NeedList({ needs }: { needs: NeedDto[] }) {
  const { t } = useI18n();
  return (
    <ul className="links action-list">
      {needs.map((n) => (
        <li key={n.id}>
          <NeedLink initiativeId={n.initiativeId} need={n} />
          <span className="action-meta">
            <span className="badge">{t(`needNature.${n.nature}`)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Fiche d'un besoin ; sans `needId`, création. */
export function NeedPanel({
  babok,
  initiativeId,
  needId,
  actionsVersion,
  stakeholdersVersion,
  onChanged,
  onClose,
}: {
  babok: BabokDto | null;
  initiativeId: string;
  needId?: string;
  /** Change à chaque écriture sur une action : les actions liées se rechargent. */
  actionsVersion: number;
  /** Change à chaque écriture sur une partie prenante : les choix se rechargent. */
  stakeholdersVersion: number;
  /** Un besoin a été créé, modifié ou supprimé : les listes se rechargent. */
  onChanged: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { replace } = usePanels();
  const [initiative, setInitiative] = useState<InitiativeDto | null>(null);
  const [need, setNeed] = useState<NeedDto | null>(null);
  const [stakeholders, setStakeholders] = useState<StakeholderDto[] | null>(null);
  const [actions, setActions] = useState<ActionDto[]>([]);
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    api.getInitiative(initiativeId).then(setInitiative, (e: unknown) => setError(toUiError(e)));
    if (needId) api.getNeed(initiativeId, needId).then(setNeed, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, needId]);

  useEffect(() => {
    api.listStakeholders(initiativeId).then(setStakeholders, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, stakeholdersVersion]);

  useEffect(() => {
    if (!needId) return;
    api.listActions(initiativeId).then(setActions, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, needId, actionsVersion]);

  const linkedActions = sortByDueDate(actions.filter((a) => a.needs.some((n) => n.id === needId)));
  const ready = initiative && stakeholders && (!needId || need);

  return (
    <Panel
      title={need ? `${need.reference} · ${need.title}` : needId ? t('common.loading') : t('needs.new')}
      onClose={onClose}
    >
      <ErrorMessage error={error} />
      {ready && (
        <>
          {initiative.archivedAt && <p className="notice">{t('initiative.archived')}</p>}
          {canEditNeeds(initiative) ? (
            <NeedForm
              initiativeId={initiativeId}
              need={need ?? undefined}
              stakeholders={stakeholders}
              onSaved={(next) => {
                setNeed(next);
                onChanged();
                if (!need) replace({ kind: 'need', initiativeId, needId: next.id });
              }}
            />
          ) : (
            need && <NeedDetails need={need} />
          )}
          {need && (
            <>
              <h3>{t('need.actions')}</h3>
              <ActionList actions={linkedActions} babok={babok} />
              {linkedActions.length === 0 && <p>{t('need.noActions')}</p>}
              <AuditTrail need={need} />
              {canEditNeeds(initiative) && (
                <DeleteNeed
                  need={need}
                  onDeleted={() => {
                    onChanged();
                    onClose();
                  }}
                />
              )}
            </>
          )}
        </>
      )}
    </Panel>
  );
}

/** Fiche en lecture seule : lecteur, ou initiative archivée. */
function NeedDetails({ need }: { need: NeedDto }) {
  const { t } = useI18n();
  const notSet = <small>{t('initiative.notSet')}</small>;
  return (
    <dl>
      <dt>{t('need.reference')}</dt>
      <dd>{need.reference}</dd>
      <dt>{t('need.nature')}</dt>
      <dd>{t(`needNature.${need.nature}`)}</dd>
      <dt>{t('need.stakeholders')}</dt>
      <dd>
        {need.stakeholders.length === 0 ? (
          <small>{t('need.noStakeholders')}</small>
        ) : (
          <ul className="links">
            {need.stakeholders.map((s) => (
              <li key={s.id}>
                <StakeholderLink initiativeId={need.initiativeId} stakeholder={s} />
              </li>
            ))}
          </ul>
        )}
      </dd>
      <dt>{t('need.description')}</dt>
      <dd>{need.description ? <RichText source={need.description} /> : notSet}</dd>
    </dl>
  );
}

function NeedForm({
  initiativeId,
  need,
  stakeholders,
  onSaved,
}: {
  initiativeId: string;
  /** Absent à la création. */
  need?: NeedDto;
  /** Parties prenantes de l'initiative, que l'on peut mettre à l'origine du besoin. */
  stakeholders: StakeholderDto[];
  onSaved: (need: NeedDto) => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState(need?.title ?? '');
  const [nature, setNature] = useState<NeedNature>(need?.nature ?? 'problem');
  const [description, setDescription] = useState(need?.description ?? '');
  const [stakeholderIds, setStakeholderIds] = useState<readonly string[]>(need?.stakeholders.map((s) => s.id) ?? []);
  const [error, setError] = useState<UiError | null>(null);
  const [saved, setSaved] = useState(false);

  const toggleStakeholder = (id: string) =>
    setStakeholderIds((current) => (current.includes(id) ? current.filter((s) => s !== id) : [...current, id]));

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    // Même schéma de validation que l'API (@app/shared) ; le formulaire envoie
    // tous les champs, la fiche complète vaut aussi pour une modification.
    const parsed = createNeedSchema.safeParse({ title, nature, description, stakeholderIds });
    if (!parsed.success) {
      setError({ key: 'need.invalid' });
      return;
    }
    try {
      onSaved(
        need
          ? await api.updateNeed(initiativeId, need.id, parsed.data)
          : await api.createNeed(initiativeId, parsed.data),
      );
      setError(null);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 400 && !e.refusal ? { key: 'need.invalid' } : toUiError(e));
    }
  }

  return (
    <form className="stacked" onSubmit={(e) => void save(e)} onChange={() => setSaved(false)}>
      {need && (
        <label>
          {t('need.reference')}
          <input value={need.reference} readOnly aria-readonly="true" />
        </label>
      )}
      <label>
        {t('need.title')}
        <input
          data-autofocus={need ? undefined : true}
          value={title}
          maxLength={NEED_TITLE_MAX_LENGTH}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        {t('need.nature')}
        <select value={nature} onChange={(e) => setNature(e.target.value as NeedNature)}>
          {NEED_NATURES.map((n) => (
            <option key={n} value={n}>
              {t(`needNature.${n}`)}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>{t('need.stakeholders')}</legend>
        {stakeholders.length === 0 && <small>{t('stakeholders.sectionEmpty')}</small>}
        {stakeholders.map((s) => (
          <label key={s.id} className="inline">
            <input type="checkbox" checked={stakeholderIds.includes(s.id)} onChange={() => toggleStakeholder(s.id)} />
            {s.name}
          </label>
        ))}
      </fieldset>
      <RichTextEditor
        label={t('need.description')}
        value={description}
        maxLength={NEED_DESCRIPTION_MAX_LENGTH}
        onChange={(value) => {
          setDescription(value);
          setSaved(false);
        }}
      />
      <button type="submit">{need ? t('need.save') : t('need.create')}</button>
      <ErrorMessage error={error} />
      <p role="status">{saved && t('need.saved')}</p>
    </form>
  );
}

/** Date de création et de dernière modification, avec leur auteur. */
function AuditTrail({ need }: { need: NeedDto }) {
  const { t, locale } = useI18n();
  return (
    <p className="audit">
      <small>
        {t('need.created', { date: formatDateTime(locale, need.createdAt), name: memberName(need.createdBy) })}
        <br />
        {t('need.updated', { date: formatDateTime(locale, need.updatedAt), name: memberName(need.updatedBy) })}
      </small>
    </p>
  );
}

/** Suppression après confirmation ; refusée si le besoin est lié à une action. */
function DeleteNeed({ need, onDeleted }: { need: NeedDto; onDeleted: () => void }) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<UiError | null>(null);

  async function remove() {
    try {
      await api.deleteNeed(need.initiativeId, need.id);
      onDeleted();
    } catch (e) {
      setConfirming(false);
      setError(toUiError(e));
    }
  }

  return (
    <section className="owner-actions">
      {confirming ? (
        <div role="alertdialog" aria-labelledby="need-delete-confirm" className="confirm">
          <p id="need-delete-confirm">{t('need.deleteConfirm', { reference: need.reference, title: need.title })}</p>
          <button type="button" autoFocus onClick={() => setConfirming(false)}>
            {t('common.cancel')}
          </button>{' '}
          <button type="button" className="danger" onClick={() => void remove()}>
            {t('need.deleteConfirmButton')}
          </button>
        </div>
      ) : (
        <>
          <button type="button" className="danger" onClick={() => setConfirming(true)}>
            {t('need.delete')}
          </button>
          <p>
            <small>{t('need.deleteHint')}</small>
          </p>
        </>
      )}
      <ErrorMessage error={error} />
    </section>
  );
}
