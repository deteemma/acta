// Pièces jointes (ticket 21, décision 10) : section de la fiche d'un ticket, de
// tout type. Règles dans @app/shared (attachments.ts, roles.ts). Le contenu d'un
// fichier n'est jamais exécuté : une image ou un PDF s'ouvre dans une visionneuse
// sous son seul type (jamais HTML ni SVG, refusés à l'envoi), tout autre format se
// télécharge comme une suite d'octets.
import {
  ATTACHMENT_EXTENSIONS,
  type AttachmentDto,
  type AttachmentUsage,
  attachmentBaseName,
  attachmentFormat,
  can,
  checkAttachmentUpload,
  fileSize,
  type InitiativeRole,
  memberName,
  renamedAttachment,
  sortAttachments,
} from '@app/shared';
import { type ChangeEvent, type MouseEvent, type SyntheticEvent, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { formatDateTime } from './team-section';
import { useUnsavedForm } from './unsaved-changes';

/** Sélecteur de fichiers : les extensions acceptées seulement (le serveur contrôle de nouveau). */
const ACCEPT = Object.keys(ATTACHMENT_EXTENSIONS)
  .map((extension) => `.${extension}`)
  .join(',');

function useFileSize() {
  const { t, locale } = useI18n();
  return (bytes: number) => {
    const { value, unit } = fileSize(bytes);
    return t(`attachment.unit.${unit}`, { value: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value) });
  };
}

/** Section « Pièces jointes » de la fiche d'un ticket : tout membre ouvre et télécharge ; propriétaires et contributeurs gèrent. */
export function TicketAttachments({
  initiativeId,
  ticketId,
  initiative,
}: {
  initiativeId: string;
  ticketId: string;
  initiative: { myRole: InitiativeRole | null; archived: boolean };
}) {
  const { t } = useI18n();
  const size = useFileSize();
  const [attachments, setAttachments] = useState<AttachmentDto[] | null>(null);
  const [usage, setUsage] = useState<AttachmentUsage | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [viewing, setViewing] = useState<AttachmentDto | null>(null);
  const canEdit = can(initiative.myRole, 'editAttachments', initiative);

  useEffect(() => {
    api.listTicketAttachments(initiativeId, ticketId).then(
      (r) => {
        setAttachments(r.attachments);
        setUsage(r.usage);
      },
      (e: unknown) => setError(toUiError(e)),
    );
  }, [initiativeId, ticketId]);

  // Les lignes de trace des fichiers supprimés ne comptent pas.
  const count = attachments?.filter((a) => a.deletedAt === null).length ?? 0;
  const replace = (attachment: AttachmentDto, freedBytes = 0) => {
    setAttachments((all) => all && sortAttachments(all.map((a) => (a.id === attachment.id ? attachment : a))));
    if (freedBytes) setUsage((u) => u && { ...u, usedBytes: u.usedBytes - freedBytes });
  };

  return (
    <section className="attachments-section">
      <h3 className="group-title">
        {t('attachment.section')} {count > 0 && <span className="count">{count}</span>}
      </h3>
      <ErrorMessage error={error} />
      {attachments && attachments.length === 0 && (
        <p>
          <small>{t('attachment.none')}</small>
        </p>
      )}
      {attachments && attachments.length > 0 && (
        <ul className="attachment-list">
          {attachments.map((attachment) => (
            <AttachmentItem
              key={attachment.id}
              initiativeId={initiativeId}
              attachment={attachment}
              canEdit={canEdit}
              onOpen={() => setViewing(attachment)}
              onChanged={replace}
            />
          ))}
        </ul>
      )}
      {usage && (
        <p className="attachment-usage">
          <small>{t('attachment.usage', { used: size(usage.usedBytes), quota: size(usage.quotaBytes) })}</small>
        </p>
      )}
      {canEdit && usage && (
        <AddAttachments
          usage={usage}
          onUpload={async (file) => {
            const r = await api.uploadTicketAttachment(initiativeId, ticketId, file);
            setAttachments(r.attachments);
            setUsage(r.usage);
            return r.usage;
          }}
        />
      )}
      {viewing && <AttachmentViewer initiativeId={initiativeId} attachment={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
}

/** Ajout : plusieurs fichiers à la fois, envoyés l'un après l'autre ; chaque refus est signalé avec le nom du fichier. */
function AddAttachments({ usage, onUpload }: { usage: AttachmentUsage; onUpload: (file: File) => Promise<AttachmentUsage> }) {
  const { t } = useI18n();
  const [uploading, setUploading] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name: string; error: UiError }[]>([]);

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    const refused: { name: string; error: UiError }[] = [];
    let current = usage;
    for (const file of files) {
      // Même contrôle que l'API (@app/shared), pour ne pas envoyer un fichier refusé d'avance.
      const refusal = checkAttachmentUpload({ name: file.name, sizeBytes: file.size }, current);
      if (refusal) {
        refused.push({ name: file.name, error: { key: `attachment.refusal.${refusal}` } });
        continue;
      }
      setUploading(file.name);
      try {
        current = await onUpload(file);
      } catch (e) {
        // Plus de 10 Mo : refusé par Fastify avant l'API (main.ts), sans motif.
        const tooLarge = e instanceof ApiError && e.status === 413;
        refused.push({ name: file.name, error: tooLarge ? { key: 'attachment.refusal.fileTooLarge' } : toUiError(e) });
      }
    }
    setUploading(null);
    setErrors(refused);
  }

  return (
    <div className="add-attachments">
      <label className="button file-button">
        {t('attachment.add')}
        <input type="file" multiple accept={ACCEPT} disabled={uploading !== null} onChange={(e) => void onChange(e)} />
      </label>
      {uploading && (
        <p role="status">
          <small>{t('attachment.uploading', { name: uploading })}</small>
        </p>
      )}
      {errors.map(({ name, error }, i) => (
        <FileError key={i} name={name} error={error} />
      ))}
      <p>
        <small>{t('attachment.hint')}</small>
      </p>
    </div>
  );
}

function FileError({ name, error }: { name: string; error: UiError }) {
  const { t } = useI18n();
  const message = 'raw' in error ? error.raw : t(error.key, error.params);
  return <ErrorMessage error={{ raw: t('attachment.fileError', { name, message }) }} />;
}

function AttachmentItem({
  initiativeId,
  attachment,
  canEdit,
  onOpen,
  onChanged,
}: {
  initiativeId: string;
  attachment: AttachmentDto;
  canEdit: boolean;
  onOpen: () => void;
  onChanged: (attachment: AttachmentDto, freedBytes?: number) => void;
}) {
  const { t, locale } = useI18n();
  const size = useFileSize();
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const name = attachment.name;

  if (attachment.deletedAt !== null) {
    return (
      <li className="attachment attachment-deleted">
        <small>
          {t('attachment.deleted', {
            file: name,
            name: attachment.deletedBy ? memberName(attachment.deletedBy) : '',
            date: formatDateTime(locale, attachment.deletedAt),
          })}
        </small>
      </li>
    );
  }

  async function download() {
    try {
      await downloadAttachment(initiativeId, attachment);
      setError(null);
    } catch (e) {
      setError(toUiError(e));
    }
  }

  async function remove() {
    try {
      onChanged(await api.deleteAttachment(initiativeId, attachment.id), attachment.sizeBytes);
    } catch (e) {
      setConfirming(false);
      setError(toUiError(e));
    }
  }

  return (
    <li className="attachment">
      <div className="attachment-line">
        {attachment.preview ? (
          <button type="button" className="link" aria-label={t('attachment.openLabel', { name })} onClick={onOpen}>
            {name}
          </button>
        ) : (
          <button type="button" className="link" aria-label={t('attachment.downloadLabel', { name })} onClick={() => void download()}>
            {name}
          </button>
        )}
        {!renaming && !confirming && (
          <span className="attachment-actions">
            {attachment.preview && (
              <button type="button" className="ghost" aria-label={t('attachment.downloadLabel', { name })} onClick={() => void download()}>
                {t('attachment.download')}
              </button>
            )}
            {canEdit && (
              <button type="button" className="ghost" aria-label={t('attachment.renameLabel', { name })} onClick={() => setRenaming(true)}>
                {t('attachment.rename')}
              </button>
            )}
            {canEdit && (
              <button type="button" className="ghost" aria-label={t('attachment.deleteLabel', { name })} onClick={() => setConfirming(true)}>
                {t('attachment.delete')}
              </button>
            )}
          </span>
        )}
      </div>
      <p className="attachment-meta">
        <small>
          {t('attachment.meta', {
            format: t(`attachment.format.${attachment.format}`),
            size: size(attachment.sizeBytes),
            name: memberName(attachment.author),
            date: formatDateTime(locale, attachment.createdAt),
          })}
        </small>
      </p>
      {renaming && (
        <RenameAttachment
          name={name}
          onSave={async (baseName) => {
            onChanged(await api.renameAttachment(initiativeId, attachment.id, baseName));
            setRenaming(false);
          }}
          onCancel={() => setRenaming(false)}
        />
      )}
      {confirming && (
        <div role="alertdialog" aria-labelledby={`attachment-delete-${attachment.id}`} className="confirm">
          <p id={`attachment-delete-${attachment.id}`}>{t('attachment.deleteConfirm', { name })}</p>
          <button type="button" autoFocus onClick={() => setConfirming(false)}>
            {t('common.cancel')}
          </button>{' '}
          <button type="button" className="danger" onClick={() => void remove()}>
            {t('attachment.deleteConfirmButton')}
          </button>
        </div>
      )}
      <ErrorMessage error={error} />
    </li>
  );
}

/** Renommer : on saisit le nom sans l'extension, qui reste affichée et ne change pas. */
function RenameAttachment({ name, onSave, onCancel }: { name: string; onSave: (baseName: string) => Promise<void>; onCancel: () => void }) {
  const { t } = useI18n();
  const initial = attachmentBaseName(name);
  const extension = name.slice(initial.length);
  const [baseName, setBaseName] = useState(initial);
  const [error, setError] = useState<UiError | null>(null);
  const submit = useUnsavedForm({ baseName }, save);

  async function save() {
    // Même règle que l'API (@app/shared).
    if (!renamedAttachment(name, baseName)) {
      setError({ key: 'attachment.invalidName' });
      return false;
    }
    try {
      await onSave(baseName);
      return true;
    } catch (e) {
      setError(toUiError(e));
      return false;
    }
  }

  return (
    <form className="stacked rename-attachment" onSubmit={submit}>
      <label>
        {t('attachment.newName')}
        <span className="rename-attachment-field">
          <input value={baseName} autoFocus onChange={(e) => setBaseName(e.target.value)} />
          <span aria-hidden="true">{extension}</span>
        </span>
      </label>
      <div>
        <button type="submit">{t('action.save')}</button>{' '}
        <button type="button" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
      <ErrorMessage error={error} />
    </form>
  );
}

/** Téléchargement : les octets sous un type neutre, jamais ouverts par le navigateur. */
async function downloadAttachment(initiativeId: string, attachment: AttachmentDto) {
  const bytes = await api.attachmentContent(initiativeId, attachment.id);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Visionneuse d'une image ou d'un PDF, par-dessus la fiche : Échap ou « Fermer ». */
function AttachmentViewer({ initiativeId, attachment, onClose }: { initiativeId: string; attachment: AttachmentDto; onClose: () => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  // Le type vient de la liste fixe des formats qui s'ouvrent (images et PDF), jamais du fichier.
  const mime = attachmentFormat(attachment.name)?.mime ?? null;

  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    if (!mime) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    api.attachmentContent(initiativeId, attachment.id).then(
      (bytes) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
        setUrl(objectUrl);
      },
      (e: unknown) => !cancelled && setError(toUiError(e)),
    );
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [initiativeId, attachment.id, mime]);

  function onCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    onClose();
  }

  function onBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <dialog ref={ref} className="attachment-viewer" aria-labelledby="attachment-viewer-title" onCancel={onCancel} onClick={onBackdropClick}>
      <div className="attachment-viewer-header">
        <h2 id="attachment-viewer-title">{attachment.name}</h2>
        <button type="button" onClick={onClose}>
          {t('attachment.close')}
        </button>
      </div>
      <ErrorMessage error={error} />
      {url && mime === 'application/pdf' && <iframe className="attachment-viewer-pdf" src={url} title={attachment.name} />}
      {url && mime?.startsWith('image/') && <img className="attachment-viewer-image" src={url} alt={attachment.name} />}
    </dialog>
  );
}
