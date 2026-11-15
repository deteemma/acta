// Administration de la limite de pièces jointes (ticket 31, décision 14 point 4) :
// une valeur pour toute l'application, bornée par @app/shared (attachments.ts).
// L'administrateur ne voit pas l'occupation des initiatives.
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_QUOTA_DEFAULT_MB,
  ATTACHMENT_QUOTA_MAX_MB,
  ATTACHMENT_QUOTA_MIN_MB,
  attachmentQuotaInputSchema,
  type AttachmentQuotaDto,
} from '@app/shared';
import { type ReactNode, useEffect, useState } from 'react';
import { api } from './api';
import { useFileSize } from './attachments';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { useUnsavedForm } from './unsaved-changes';

export function AttachmentQuotaSection() {
  const { t, locale } = useI18n();
  const size = useFileSize();
  const formatNumber = (value: number) => new Intl.NumberFormat(locale).format(value);
  const bounds = { min: formatNumber(ATTACHMENT_QUOTA_MIN_MB), max: formatNumber(ATTACHMENT_QUOTA_MAX_MB) };
  const [quota, setQuota] = useState<AttachmentQuotaDto | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    api.getAttachmentQuota().then(setQuota, (e: unknown) => setError(toUiError(e)));
  }, []);

  /** Vrai si la limite est enregistrée. */
  async function save(input: string): Promise<boolean> {
    setDone(null);
    // Même schéma de validation que l'API (@app/shared) ; un champ vide n'est pas 0.
    const parsed = attachmentQuotaInputSchema.safeParse({ quotaMb: input.trim() === '' ? Number.NaN : Number(input) });
    if (!parsed.success) {
      setError({ key: 'admin.attachmentQuota.invalid', params: bounds });
      return false;
    }
    try {
      const saved = await api.setAttachmentQuota(parsed.data);
      setQuota(saved);
      setError(null);
      setDone(t('admin.attachmentQuota.saved', { quota: formatNumber(saved.quotaMb) }));
      return true;
    } catch (e) {
      setError(toUiError(e));
      return false;
    }
  }

  return (
    <section>
      <h3 className="visually-hidden">{t('admin.attachments')}</h3>
      <p>
        <small>{t('admin.attachmentsHint')}</small>
      </p>
      <ErrorMessage error={error} />
      {done && <p className="notice">{done}</p>}
      {quota === null ? (
        !error && <p>{t('common.loading')}</p>
      ) : (
        // Limite enregistrée : le champ repart de la valeur renvoyée par l'API.
        <QuotaForm key={quota.quotaMb} quota={quota} onSave={save}>
          <small>
            {t('admin.attachmentQuota.range', { ...bounds, default: formatNumber(ATTACHMENT_QUOTA_DEFAULT_MB) })}
          </small>
          <small>{t('admin.attachmentQuota.fileMax', { max: size(ATTACHMENT_MAX_BYTES) })}</small>
        </QuotaForm>
      )}
    </section>
  );
}

function QuotaForm({
  quota,
  onSave,
  children,
}: {
  quota: AttachmentQuotaDto;
  onSave: (input: string) => Promise<boolean>;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(String(quota.quotaMb));
  const unchanged = value.trim() === String(quota.quotaMb);
  const submit = useUnsavedForm({ value }, () => (unchanged ? Promise.resolve(true) : onSave(value)));
  return (
    // noValidate : une valeur hors des bornes reçoit le message de l'application, pas celui du navigateur.
    <form className="stacked invite" noValidate onSubmit={submit}>
      <label>
        {t('admin.attachmentQuota.label')}
        <input
          type="number"
          inputMode="numeric"
          min={ATTACHMENT_QUOTA_MIN_MB}
          max={ATTACHMENT_QUOTA_MAX_MB}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      {children}
      <button type="submit" disabled={unchanged}>
        {t('admin.attachmentQuota.save')}
      </button>
    </form>
  );
}
