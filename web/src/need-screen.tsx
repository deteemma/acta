// Besoins (ticket 09) : liste d'une initiative, onglets d'un besoin dans l'écran
// de données (ADR-0021, N11 : Fiche, Exigences, Liens) et fenêtre de création
// (N15). Règles dans @app/shared (needs.ts, references.ts, roles.ts).
import {
  memberName,
  can,
  createNeedSchema,
  type InitiativeDto,
  NEED_DESCRIPTION_MAX_LENGTH,
  NEED_NATURES,
  NEED_TITLE_MAX_LENGTH,
  type NeedDto,
  type NeedNature,
  type NeedRefDto,
  type RequirementDto,
  type StakeholderDto,
} from '@app/shared';
import { useState } from 'react';
import { NewActionButton } from './action-panels';
import { LinkedTickets } from './link-panels';
import { api, ApiError } from './api';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { Panel, useCloseSilently } from './panels';
import { useOpenNode } from './references';
import { RequirementList } from './requirement-screen';
import { RichText, RichTextEditor } from './rich-text';
import { StakeholderLink } from './stakeholder-screen';
import { formatDateTime } from './team-section';
import { useUnsavedForm } from './unsaved-changes';

export const canEditNeeds = (initiative: InitiativeDto) =>
  can(initiative.myRole, 'editNeeds', { archived: initiative.archivedAt != null });

/** Bouton qui ouvre la fiche d'un besoin : sa référence et son titre. */
export function NeedLink({ initiativeId, need }: { initiativeId: string; need: NeedRefDto }) {
  const openNode = useOpenNode();
  return (
    <button type="button" className="link" onClick={() => openNode(initiativeId, { kind: 'need', id: need.id })}>
      <strong>{need.reference}</strong> {need.title}
    </button>
  );
}

/** Besoins, dans l'ordre reçu (par référence), avec leur nature. */
export function NeedList({ needs }: { needs: NeedDto[] }) {
  const { t } = useI18n();
  return (
    <ul className="links dense-list action-list">
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

/** Onglet Fiche : les champs (en lecture seule pour un lecteur ou une initiative archivée), la trace et la suppression. */
export function NeedSheet({
  initiative,
  need,
  stakeholders,
  onChanged,
  onDeleted,
}: {
  initiative: InitiativeDto;
  need: NeedDto;
  /** Parties prenantes de l'initiative, que l'on peut mettre à l'origine du besoin. */
  stakeholders: StakeholderDto[];
  /** Modifié : les listes et l'arborescence se rechargent. */
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const editable = canEditNeeds(initiative);
  return (
    <>
      {editable ? (
        <NeedForm initiativeId={initiative.id} need={need} stakeholders={stakeholders} onSaved={onChanged} />
      ) : (
        <NeedDetails need={need} />
      )}
      <AuditTrail need={need} />
      {editable && <DeleteNeed need={need} onDeleted={onDeleted} />}
    </>
  );
}

/** Exigences qui répondent au besoin. */
export const requirementsOfNeed = (needId: string, requirements: RequirementDto[]) =>
  requirements.filter((r) => r.needs.some((n) => n.id === needId));

/** Onglet Exigences. */
export function NeedRequirements({ requirements }: { requirements: RequirementDto[] }) {
  const { t } = useI18n();
  return (
    <>
      <h4 className="section-title">
        {t('need.requirements')} <span className="count">{requirements.length}</span>
      </h4>
      <RequirementList requirements={requirements} />
      {requirements.length === 0 && <p>{t('need.noRequirements')}</p>}
    </>
  );
}

/** Onglet Liens : tickets et pages liés, et « + Action » depuis le besoin. */
export function NeedLinks({
  initiative,
  need,
  version,
  onChanged,
}: {
  initiative: InitiativeDto;
  need: NeedDto;
  /** Change à chaque écriture sur un ticket ou un lien. */
  version: number;
  /** Un lien avec un ticket a été créé ou retiré. */
  onChanged: () => void;
}) {
  return (
    <LinkedTickets
      initiativeId={initiative.id}
      end={{ kind: 'need', id: need.id }}
      canEdit={can(initiative.myRole, 'editLinks', { archived: initiative.archivedAt != null })}
      version={version}
      onChanged={onChanged}
      actions={<NewActionButton initiative={initiative} from={{ kind: 'need', id: need.id }} />}
    />
  );
}

/** Nouveau besoin, en fenêtre de dialogue (N15) : les champs de création actuels. */
export function CreateNeedDialog({
  initiativeId,
  stakeholders,
  onCreated,
  onClose,
}: {
  initiativeId: string;
  stakeholders: StakeholderDto[];
  /** Créé : les listes se rechargent, l'écran de données l'affiche. */
  onCreated: (need: NeedDto) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const closeSilently = useCloseSilently();
  return (
    <Panel title={t('needs.new')} variant="dialog" onClose={onClose}>
      <NeedForm
        initiativeId={initiativeId}
        stakeholders={stakeholders}
        onSaved={(created) => {
          // Saisie enregistrée : pas d'alerte.
          closeSilently();
          onCreated(created);
        }}
      />
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
  const submit = useUnsavedForm({ title, nature, description, stakeholderIds }, save);

  const toggleStakeholder = (id: string) =>
    setStakeholderIds((current) => (current.includes(id) ? current.filter((s) => s !== id) : [...current, id]));

  async function save(): Promise<boolean> {
    setSaved(false);
    // Même schéma de validation que l'API (@app/shared) ; le formulaire envoie
    // tous les champs, la fiche complète vaut aussi pour une modification.
    const parsed = createNeedSchema.safeParse({ title, nature, description, stakeholderIds });
    if (!parsed.success) {
      setError({ key: 'need.invalid' });
      return false;
    }
    try {
      onSaved(
        need
          ? await api.updateNeed(initiativeId, need.id, parsed.data)
          : await api.createNeed(initiativeId, parsed.data),
      );
      setError(null);
      setSaved(true);
      return true;
    } catch (e) {
      setError(e instanceof ApiError && e.status === 400 && !e.refusal ? { key: 'need.invalid' } : toUiError(e));
      return false;
    }
  }

  return (
    <form className="stacked" onSubmit={submit} onChange={() => setSaved(false)}>
      {/* Référence et titre sur une ligne (ticket 04, lot 1). */}
      <div className="field-row reference-title">
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
      </div>
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
