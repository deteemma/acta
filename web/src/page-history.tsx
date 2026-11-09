// Enregistrements et versions d'une page (ticket 23, décisions 07 points 4 et 5,
// 08 points 6 et 8) : historique en volet à droite, enregistrement ouvert et
// comparaison de deux enregistrements au centre. Règles dans @app/shared
// (page-revisions.ts).
import {
  checkPageRevisionDelete,
  checkPageRevisionRestore,
  checkPageVersionDeclare,
  checkPageVersionNote,
  currentPageRevision,
  diffPageTexts,
  memberName,
  nextPageVersionNumber,
  PAGE_VERSION_NOTE_MAX_LENGTH,
  type PageDiffPart,
  type PageRevisionDto,
  type PageRevisionRow,
  pageComparisonText,
} from '@app/shared';
import { ArrowLeft, GitCompare, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { api } from './api';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { PageContent } from './page-content';
import { formatDateTime } from './team-section';
import { useUnsavedForm } from './unsaved-changes';

/** Ce que le centre de l'écran montre : la page, un enregistrement, ou deux comparés. */
export type PageShown = { kind: 'page' } | { kind: 'revision'; id: string } | { kind: 'compare'; fromId: string; toId: string };

/**
 * Historique en volet : versions mises en évidence, filtre « versions seulement »,
 * ouverture d'un enregistrement, choix de deux enregistrements à comparer. Tout
 * membre le consulte.
 */
export function PageHistory({
  revisions,
  shown,
  onShow,
  onClose,
}: {
  /** Du plus récent au plus ancien. */
  revisions: PageRevisionRow[] | null;
  shown: PageShown;
  onShow: (shown: PageShown) => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const [versionsOnly, setVersionsOnly] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const titleId = useId();
  const current = revisions && currentPageRevision(revisions);
  const listed = (revisions ?? []).filter((r) => !versionsOnly || r.versionNumber !== null);

  function toggle(id: string) {
    // Deux au plus : cocher un troisième remplace le plus ancien coché.
    setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id].slice(-2)));
  }

  function compare() {
    // Du plus ancien au plus récent, quel que soit l'ordre des cases.
    const [a, b] = [...picked].sort(
      (x, y) => revisions!.find((r) => r.id === x)!.sequence - revisions!.find((r) => r.id === y)!.sequence,
    );
    onShow({ kind: 'compare', fromId: a!, toId: b! });
  }

  return (
    <aside className="page-history" aria-labelledby={titleId}>
      <div className="page-history-header">
        <h2 id={titleId}>{t('pageHistory.title')}</h2>
        <button type="button" className="ghost icon-only" aria-label={t('page.historyClose')} title={t('page.historyClose')} onClick={onClose}>
          <X />
        </button>
      </div>
      <label className="checkbox">
        <input type="checkbox" checked={versionsOnly} onChange={(e) => setVersionsOnly(e.target.checked)} />
        {t('pageHistory.versionsOnly')}
      </label>
      {revisions === null ? (
        <p>{t('common.loading')}</p>
      ) : listed.length === 0 ? (
        <p className="page-empty">{t('pageHistory.noVersion')}</p>
      ) : (
        <ol className="page-history-list">
          {listed.map((r) => {
            const date = formatDateTime(locale, r.createdAt);
            const open = shown.kind === 'revision' && shown.id === r.id;
            if (r.deletedAt) {
              return (
                <li key={r.id} className="page-history-row deleted">
                  {r.versionNumber !== null && <span className="badge">{t('page.versionBadge', { number: r.versionNumber })}</span>}
                  <small>
                    {t('pageHistory.deleted', {
                      date,
                      name: r.deletedBy ? memberName(r.deletedBy) : '',
                      deletedAt: formatDateTime(locale, r.deletedAt),
                    })}
                  </small>
                </li>
              );
            }
            return (
              <li key={r.id} className={`page-history-row${r.versionNumber !== null ? ' version' : ''}${open ? ' open' : ''}`}>
                <input
                  type="checkbox"
                  checked={picked.includes(r.id)}
                  aria-label={t('pageHistory.select', { date })}
                  onChange={() => toggle(r.id)}
                />
                <button type="button" className="page-history-open" aria-current={open || undefined} onClick={() => onShow({ kind: 'revision', id: r.id })}>
                  <span className="page-history-tags">
                    {r.versionNumber !== null && <span className="badge accent">{t('page.versionBadge', { number: r.versionNumber })}</span>}
                    {r.id === current?.id && <span className="badge">{t('pageHistory.current')}</span>}
                  </span>
                  <span>{t('pageHistory.revision', { date, name: memberName(r.createdBy) })}</span>
                  {r.versionNote && <small className="page-history-note">{r.versionNote}</small>}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <div className="page-history-compare">
        <button type="button" disabled={picked.length !== 2} onClick={compare}>
          <GitCompare />
          {t('pageHistory.compare')}
        </button>
        {picked.length !== 2 && <small>{t('pageHistory.compareHint')}</small>}
      </div>
    </aside>
  );
}

/**
 * Enregistrement ouvert depuis l'historique : son titre et son contenu, et pour
 * un propriétaire ou un contributeur, restaurer, déclarer comme version, corriger
 * la note ou supprimer.
 */
export function PageRevisionView({
  initiativeId,
  pageId,
  revisionId,
  revisions,
  canEdit,
  onShow,
  onRevisions,
  onRestored,
}: {
  initiativeId: string;
  pageId: string;
  revisionId: string;
  revisions: PageRevisionRow[];
  canEdit: boolean;
  onShow: (shown: PageShown) => void;
  /** Historique renvoyé par une déclaration, une note corrigée ou une suppression. */
  onRevisions: (revisions: PageRevisionRow[], status: string) => void;
  onRestored: (status: string) => void;
}) {
  const { t, locale } = useI18n();
  const [revision, setRevision] = useState<PageRevisionDto | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [noteForm, setNoteForm] = useState<'declare' | 'edit' | null>(null);
  const row = revisions.find((r) => r.id === revisionId);
  const current = currentPageRevision(revisions);

  useEffect(() => {
    api.getPageRevision(initiativeId, pageId, revisionId).then(setRevision, (e: unknown) => setError(toUiError(e)));
    // Un enregistrement supprimé ou dont la note change est relu.
  }, [initiativeId, pageId, revisionId, row?.deletedAt, row?.versionNote]);

  if (!revision || !row) return <ErrorMessage error={error} />;
  const date = formatDateTime(locale, revision.createdAt);

  async function run<T>(action: () => Promise<T>, done: (result: T) => void) {
    try {
      done(await action());
      setError(null);
    } catch (e) {
      setError(toUiError(e));
    }
  }

  const restore = () =>
    run(
      () => api.restorePageRevision(initiativeId, pageId, revisionId),
      // Même titre et même contenu que l'état actuel : rien n'est enregistré.
      (restored) =>
        onRestored(t(restored.revisionId === current?.id ? 'pageRevision.restoredUnchanged' : 'pageRevision.restored', { date })),
    );
  const remove = () =>
    run(
      () => api.deletePageRevision(initiativeId, pageId, revisionId),
      (list) => {
        setConfirming(false);
        onRevisions(list, t('pageRevision.deleted', { date }));
      },
    );
  const deleteRefusal = checkPageRevisionDelete(revisions, revisionId);
  const declarable = !checkPageVersionDeclare(revisions, revisionId);
  const nextVersion = nextPageVersionNumber(revisions);

  return (
    <article className="page-view page-revision">
      <button type="button" className="ghost" onClick={() => onShow({ kind: 'page' })}>
        <ArrowLeft />
        {t('pageRevision.back')}
      </button>
      <p className="notice page-revision-banner">
        {row.versionNumber !== null && <span className="badge accent">{t('page.versionBadge', { number: row.versionNumber })}</span>}{' '}
        {t('pageRevision.heading', { date, name: memberName(revision.createdBy) })}
        {revision.id === current?.id && <> · {t('pageRevision.isCurrent')}</>}
        {row.versionNote && (
          <>
            <br />
            <small>{row.versionNote}</small>
          </>
        )}
      </p>
      <ErrorMessage error={error} />
      {revision.deletedAt ? (
        <p className="page-empty">
          {t('pageRevision.deletedNotice', {
            name: revision.deletedBy ? memberName(revision.deletedBy) : '',
            date: formatDateTime(locale, revision.deletedAt),
          })}
        </p>
      ) : (
        <>
          <h2 className="page-view-title">{revision.title}</h2>
          {revision.content ? <PageContent doc={revision.content} /> : <p className="page-empty">{t('page.emptyContent')}</p>}
        </>
      )}
      {!revision.deletedAt && (
        <section className="owner-actions page-owner-actions">
          <div className="page-view-actions">
            {current && revision.id !== current.id && (
              <button type="button" onClick={() => onShow({ kind: 'compare', fromId: revision.id, toId: current.id })}>
                <GitCompare />
                {t('pageRevision.compareWithCurrent')}
              </button>
            )}
            {canEdit && !checkPageRevisionRestore(revisions, revisionId) && (
              <button type="button" onClick={() => void restore()}>
                {t('pageRevision.restore')}
              </button>
            )}
            {canEdit && declarable && noteForm === null && (
              <button type="button" onClick={() => setNoteForm('declare')}>
                {t('pageRevision.declare', { number: nextVersion })}
              </button>
            )}
            {canEdit && !checkPageVersionNote(revisions, revisionId) && noteForm === null && (
              <button type="button" onClick={() => setNoteForm('edit')}>
                {t('pageRevision.editNote')}
              </button>
            )}
          </div>
          {canEdit && noteForm && (
            <VersionNoteForm
              initial={noteForm === 'edit' ? (row.versionNote ?? '') : ''}
              submitLabel={noteForm === 'edit' ? t('pageRevision.saveNote') : t('pageRevision.declare', { number: nextVersion })}
              onCancel={() => setNoteForm(null)}
              onSubmit={async (note) => {
                try {
                  const list =
                    noteForm === 'edit'
                      ? await api.updatePageVersionNote(initiativeId, pageId, revisionId, { note })
                      : await api.declarePageVersion(initiativeId, pageId, revisionId, { note });
                  setNoteForm(null);
                  setError(null);
                  onRevisions(list, noteForm === 'edit' ? '' : t('pageRevision.declared', { number: nextVersion }));
                  return true;
                } catch (e) {
                  setError(toUiError(e));
                  return false;
                }
              }}
            />
          )}
          {canEdit &&
            // Le dernier enregistrement, l'état actuel, ne se supprime pas : pas de bouton.
            deleteRefusal !== 'lastPageRevision' &&
            (confirming ? (
              <div role="alertdialog" aria-labelledby="page-revision-delete-confirm" className="confirm">
                <p id="page-revision-delete-confirm">{t('pageRevision.deleteConfirm', { date })}</p>
                <button type="button" autoFocus onClick={() => setConfirming(false)}>
                  {t('common.cancel')}
                </button>{' '}
                <button type="button" className="danger" onClick={() => void remove()}>
                  {t('pageRevision.deleteConfirmButton')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="danger"
                onClick={() => (deleteRefusal ? setError({ key: `pageRevision.refusal.${deleteRefusal}` }) : setConfirming(true))}
              >
                {t('pageRevision.delete')}
              </button>
            ))}
        </section>
      )}
    </article>
  );
}

/** Note d'une version : à la déclaration après coup, ou pour la corriger. Gardée par l'alerte. */
function VersionNoteForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: string;
  submitLabel: string;
  onSubmit: (note: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [note, setNote] = useState(initial);
  const handleSubmit = useUnsavedForm({ note }, () => onSubmit(note));
  return (
    <form className="page-version-note" onSubmit={handleSubmit} noValidate>
      <VersionNoteField note={note} onChange={setNote} autoFocus />
      <span className="page-view-actions">
        <button type="button" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="primary">
          {submitLabel}
        </button>
      </span>
    </form>
  );
}

/** Zone de la note de version, avec son compteur ; aussi dans la barre d'enregistrement. */
export function VersionNoteField({ note, onChange, autoFocus = false }: { note: string; onChange: (note: string) => void; autoFocus?: boolean }) {
  const { t, locale } = useI18n();
  return (
    <label className="page-version-note-field">
      <span>{t('page.versionNote')}</span>
      <textarea
        rows={2}
        autoFocus={autoFocus}
        value={note}
        maxLength={PAGE_VERSION_NOTE_MAX_LENGTH}
        onChange={(e) => onChange(e.target.value)}
      />
      <small className="page-counter" aria-live="polite">
        {t('page.counter', { count: note.length.toLocaleString(locale), max: PAGE_VERSION_NOTE_MAX_LENGTH.toLocaleString(locale) })}
      </small>
    </label>
  );
}

/**
 * Comparaison de deux enregistrements dans un seul texte (décision 08, point 8) :
 * ajouts et suppressions mis en évidence, sur le texte extrait du JSON.
 */
export function PageComparison({
  initiativeId,
  pageId,
  fromId,
  toId,
  onShow,
}: {
  initiativeId: string;
  pageId: string;
  fromId: string;
  toId: string;
  onShow: (shown: PageShown) => void;
}) {
  const { t, locale } = useI18n();
  const [pair, setPair] = useState<[PageRevisionDto, PageRevisionDto] | null>(null);
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    Promise.all([api.getPageRevision(initiativeId, pageId, fromId), api.getPageRevision(initiativeId, pageId, toId)]).then(
      ([from, to]) => setPair([from, to]),
      (e: unknown) => setError(toUiError(e)),
    );
  }, [initiativeId, pageId, fromId, toId]);

  if (!pair) return <ErrorMessage error={error} />;
  const [from, to] = pair;
  const titleDiff = diffPageTexts(from.title ?? '', to.title ?? '');
  const contentDiff = diffPageTexts(pageComparisonText(from.content), pageComparisonText(to.content));
  const unchanged = (parts: PageDiffPart[]) => parts.every((p) => p.kind === 'same');

  return (
    <article className="page-view page-comparison">
      <button type="button" className="ghost" onClick={() => onShow({ kind: 'page' })}>
        <ArrowLeft />
        {t('pageRevision.back')}
      </button>
      <h2 className="page-view-title">{t('pageCompare.title')}</h2>
      <p className="notice">
        {t('pageCompare.between', { from: formatDateTime(locale, from.createdAt), to: formatDateTime(locale, to.createdAt) })}
        <br />
        <small>{t('pageCompare.legend')}</small>
      </p>
      <ErrorMessage error={error} />
      {!unchanged(titleDiff) && (
        <section>
          <h3>{t('pageCompare.titleLabel')}</h3>
          <DiffText parts={titleDiff} />
        </section>
      )}
      <section>
        <h3>{t('pageCompare.contentLabel')}</h3>
        {unchanged(contentDiff) ? <p className="page-empty">{t('pageCompare.noDifference')}</p> : <DiffText parts={contentDiff} />}
      </section>
    </article>
  );
}

function DiffText({ parts }: { parts: PageDiffPart[] }) {
  const { t } = useI18n();
  return (
    <div className="page-diff">
      {parts.map((part, i) =>
        part.kind === 'same' ? (
          <span key={i}>{part.text}</span>
        ) : part.kind === 'added' ? (
          <ins key={i}>
            <span className="visually-hidden">{t('pageCompare.added')} </span>
            {part.text}
          </ins>
        ) : (
          <del key={i}>
            <span className="visually-hidden">{t('pageCompare.removed')} </span>
            {part.text}
          </del>
        ),
      )}
    </div>
  );
}
