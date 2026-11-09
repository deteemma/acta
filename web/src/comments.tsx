// Commentaires (ticket 20, décision 05) : fil simple sur la fiche d'un ticket, de
// tout type, du plus ancien au plus récent. Règles dans @app/shared (comments.ts,
// roles.ts). Le fil ne touche pas l'historique du ticket.
import {
  canDeleteComment,
  canEditComment,
  canWriteComment,
  type CommentActor,
  type CommentDto,
  commentInputSchema,
  COMMENT_MAX_LENGTH,
  type InitiativeRole,
  memberName,
  sortThread,
} from '@app/shared';
import { useEffect, useState } from 'react';
import { api, ApiError } from './api';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { RichText, RichTextEditor } from './rich-text';
import { formatDateTime } from './team-section';
import { useUnsavedForm } from './unsaved-changes';

const toError = (e: unknown): UiError =>
  e instanceof ApiError && e.status === 400 && !e.refusal ? { key: 'comment.invalid' } : toUiError(e);

/** Section « Commentaires » de la fiche d'un ticket : tout membre lit ; propriétaires et contributeurs écrivent. */
export function TicketComments({
  initiativeId,
  ticketId,
  initiative,
  myId,
}: {
  initiativeId: string;
  ticketId: string;
  initiative: { myRole: InitiativeRole | null; archived: boolean };
  myId: string | null;
}) {
  const { t } = useI18n();
  const [comments, setComments] = useState<CommentDto[] | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const actor: CommentActor | null = myId ? { userId: myId, role: initiative.myRole, archived: initiative.archived } : null;

  useEffect(() => {
    api.listTicketComments(initiativeId, ticketId).then(setComments, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, ticketId]);

  // Les lignes de trace des commentaires supprimés ne comptent pas.
  const count = comments?.filter((c) => c.body !== null).length ?? 0;
  const replace = (comment: CommentDto) => setComments((all) => all && sortThread(all.map((c) => (c.id === comment.id ? comment : c))));

  return (
    <section className="comments-section">
      <h3 className="group-title">
        {t('comment.section')} {count > 0 && <span className="count">{count}</span>}
      </h3>
      <ErrorMessage error={error} />
      {comments && comments.length === 0 && (
        <p>
          <small>{t('comment.none')}</small>
        </p>
      )}
      {comments && comments.length > 0 && (
        <ol className="comment-thread">
          {comments.map((comment) => (
            <CommentItem key={comment.id} initiativeId={initiativeId} comment={comment} actor={actor} onChanged={replace} />
          ))}
        </ol>
      )}
      {actor && canWriteComment(actor) && comments && (
        <NewComment
          onCreate={async (body) => {
            setComments(await api.createTicketComment(initiativeId, ticketId, { body }));
          }}
        />
      )}
    </section>
  );
}

function CommentItem({
  initiativeId,
  comment,
  actor,
  onChanged,
}: {
  initiativeId: string;
  comment: CommentDto;
  actor: CommentActor | null;
  onChanged: (comment: CommentDto) => void;
}) {
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const date = formatDateTime(locale, comment.createdAt);
  const name = memberName(comment.author);

  if (comment.body === null) {
    return (
      <li className="comment comment-deleted">
        <small>
          {t('comment.deleted', {
            name: comment.deletedBy ? memberName(comment.deletedBy) : '',
            date: comment.deletedAt ? formatDateTime(locale, comment.deletedAt) : '',
          })}
        </small>
      </li>
    );
  }

  const authorship = { authorId: comment.author.userId, deleted: false };
  const canEdit = !!actor && canEditComment(authorship, actor);
  const canDelete = !!actor && canDeleteComment(authorship, actor);

  async function remove() {
    try {
      onChanged(await api.deleteComment(initiativeId, comment.id));
    } catch (e) {
      setConfirming(false);
      setError(toError(e));
    }
  }

  return (
    <li className="comment">
      <p className="comment-meta">
        <small>
          {t('comment.meta', { name, date })}
          {comment.editedAt && <> · {t('comment.edited', { date: formatDateTime(locale, comment.editedAt) })}</>}
        </small>
        {!editing && !confirming && canEdit && (
          <button type="button" className="ghost" aria-label={t('comment.editLabel', { name, date })} onClick={() => setEditing(true)}>
            {t('comment.edit')}
          </button>
        )}
        {!editing && !confirming && canDelete && (
          <button type="button" className="ghost" aria-label={t('comment.deleteLabel', { name, date })} onClick={() => setConfirming(true)}>
            {t('comment.delete')}
          </button>
        )}
      </p>
      {editing ? (
        <EditComment
          initial={comment.body}
          onSave={async (body) => {
            onChanged(await api.updateComment(initiativeId, comment.id, { body }));
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <RichText source={comment.body} />
      )}
      {confirming && (
        <div role="alertdialog" aria-labelledby={`comment-delete-${comment.id}`} className="confirm">
          <p id={`comment-delete-${comment.id}`}>{t('comment.deleteConfirm')}</p>
          <button type="button" autoFocus onClick={() => setConfirming(false)}>
            {t('common.cancel')}
          </button>{' '}
          <button type="button" className="danger" onClick={() => void remove()}>
            {t('comment.deleteConfirmButton')}
          </button>
        </div>
      )}
      <ErrorMessage error={error} />
    </li>
  );
}

/** Ajout : le formulaire se vide une fois le commentaire enregistré. */
function NewComment({ onCreate }: { onCreate: (body: string) => Promise<void> }) {
  const { t } = useI18n();
  const [body, setBody] = useState('');
  const [error, setError] = useState<UiError | null>(null);
  const submit = useUnsavedForm({ body }, create);

  async function create() {
    // Même schéma de validation que l'API (@app/shared).
    const parsed = commentInputSchema.safeParse({ body });
    if (!parsed.success) {
      setError({ key: 'comment.invalid' });
      return false;
    }
    try {
      await onCreate(parsed.data.body);
      setError(null);
      setBody('');
      return { body: '' };
    } catch (e) {
      setError(toError(e));
      return false;
    }
  }

  return (
    <form className="stacked new-comment" onSubmit={submit}>
      <RichTextEditor label={t('comment.new')} value={body} maxLength={COMMENT_MAX_LENGTH} rows={4} onChange={setBody} />
      <button type="submit">{t('comment.add')}</button>
      <ErrorMessage error={error} />
      <p>
        <small>{t('comment.hint')}</small>
      </p>
    </form>
  );
}

function EditComment({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (body: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [body, setBody] = useState(initial);
  const [error, setError] = useState<UiError | null>(null);
  const submit = useUnsavedForm({ body }, save);

  async function save() {
    const parsed = commentInputSchema.safeParse({ body });
    if (!parsed.success) {
      setError({ key: 'comment.invalid' });
      return false;
    }
    try {
      await onSave(parsed.data.body);
      return true;
    } catch (e) {
      setError(toError(e));
      return false;
    }
  }

  return (
    <form className="stacked" onSubmit={submit}>
      <RichTextEditor label={t('comment.edit')} value={body} maxLength={COMMENT_MAX_LENGTH} rows={4} onChange={setBody} />
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
